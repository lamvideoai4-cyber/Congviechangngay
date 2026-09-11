import { getDb } from "./db";
import { nid } from "./ids";
import { computeOtMinutes } from "./ot";
import { applyProgress, refreshTaskStatus } from "./progress";
import { useAppStore } from "./store";
import { formatDate, shiftWindow } from "./time";
import { computeAmh, lateMinutesAt } from "./amh";
import { findShiftByCode, isLeaveCode, plannedMinutesOf } from "./shift-catalog";
import type { PersonnelWorkbook } from "./excel";
import type {
  Abnormality,
  Amh,
  Attendance,
  AttendanceStatus,
  AuditAction,
  DataItem,
  Employee,
  GoodsItem,
  Group,
  Handover,
  Lot,
  Overtime,
  Role,
  Task,
  ThreeSRecord,
  WorkBlock,
} from "./types";

function ctx() {
  const s = useAppStore.getState();
  return {
    userId: s.currentUserId ?? "system",
    userName: s.currentUserName || "Hệ thống",
    date: s.selectedDate,
    shiftId: s.selectedShiftId,
    otRound: s.otRoundMinutes,
  };
}

export async function writeAudit(input: {
  action: AuditAction;
  module: string;
  recordId: string;
  oldValue?: unknown;
  newValue?: unknown;
}): Promise<void> {
  const db = getDb();
  const c = ctx();
  await db.auditLogs.add({
    id: nid(),
    userId: c.userId,
    userName: c.userName,
    action: input.action,
    module: input.module,
    recordId: input.recordId,
    oldValue: input.oldValue === undefined ? null : JSON.stringify(input.oldValue),
    newValue: input.newValue === undefined ? null : JSON.stringify(input.newValue),
    timestamp: Date.now(),
    date: c.date,
    shiftId: c.shiftId,
  });
}

export async function persistSetting(key: string, value: string): Promise<void> {
  await getDb().settings.put({ key, value });
}

export async function createEmployee(data: Omit<Employee, "id" | "createdAt" | "updatedAt">) {
  const db = getDb();
  const now = Date.now();
  const row: Employee = { ...data, id: nid(), createdAt: now, updatedAt: now };
  await db.transaction("rw", db.employees, db.auditLogs, async () => {
    await db.employees.add(row);
    await writeAudit({ action: "CREATE", module: "employees", recordId: row.id, newValue: row });
  });
  return row;
}

export async function updateEmployee(id: string, patch: Partial<Employee>) {
  const db = getDb();
  const old = await db.employees.get(id);
  if (!old) throw new Error("Không tìm thấy nhân sự");
  const next = { ...old, ...patch, id, updatedAt: Date.now() };
  await db.transaction("rw", db.employees, db.auditLogs, async () => {
    await db.employees.put(next);
    await writeAudit({ action: "UPDATE", module: "employees", recordId: id, oldValue: old, newValue: next });
  });
  return next;
}

export async function deleteEmployee(id: string) {
  const db = getDb();
  const old = await db.employees.get(id);
  await db.transaction("rw", db.employees, db.auditLogs, async () => {
    await db.employees.delete(id);
    await writeAudit({ action: "DELETE", module: "employees", recordId: id, oldValue: old });
  });
}

export async function createGroup(name: string) {
  const db = getDb();
  const max = (await db.groups.toArray()).reduce((m, g) => Math.max(m, g.order), 0);
  const row: Group = { id: nid(), name, order: max + 1 };
  await db.groups.add(row);
  await writeAudit({ action: "CREATE", module: "groups", recordId: row.id, newValue: row });
  return row;
}

export async function renameGroup(id: string, name: string) {
  const db = getDb();
  const old = await db.groups.get(id);
  await db.groups.update(id, { name });
  await writeAudit({ action: "UPDATE", module: "groups", recordId: id, oldValue: old, newValue: { name } });
}

export async function deleteGroup(id: string) {
  const db = getDb();
  const used = await db.employees.where("groupId").equals(id).count();
  if (used > 0) throw new Error("Nhóm đang có nhân sự, không thể xóa");
  const old = await db.groups.get(id);
  await db.groups.delete(id);
  await writeAudit({ action: "DELETE", module: "groups", recordId: id, oldValue: old });
}

export async function createBlock(name: string) {
  const db = getDb();
  const max = (await db.workBlocks.toArray()).reduce((m, g) => Math.max(m, g.order), 0);
  const row: WorkBlock = { id: nid(), name, order: max + 1 };
  await db.workBlocks.add(row);
  await writeAudit({ action: "CREATE", module: "workBlocks", recordId: row.id, newValue: row });
  return row;
}

export async function updateBlock(id: string, name: string) {
  await getDb().workBlocks.update(id, { name });
  await writeAudit({ action: "UPDATE", module: "workBlocks", recordId: id, newValue: { name } });
}

export async function deleteBlock(id: string) {
  const db = getDb();
  const used = await db.tasks.where("blockId").equals(id).count();
  if (used > 0) throw new Error("Khối đang có công việc, không thể xóa");
  await db.workBlocks.delete(id);
  await writeAudit({ action: "DELETE", module: "workBlocks", recordId: id });
}

export async function reorderBlocks(ids: string[]) {
  const db = getDb();
  await db.transaction("rw", db.workBlocks, async () => {
    for (let i = 0; i < ids.length; i++) {
      await db.workBlocks.update(ids[i]!, { order: i + 1 });
    }
  });
}

export async function attendanceForDay(employeeId: string, date: string): Promise<Attendance | undefined> {
  const rows = await getDb().attendance.where("employeeId").equals(employeeId).toArray();
  return rows.find((a) => a.date === date);
}

function normalizeAttendance(row: Attendance): Attendance {
  return {
    ...row,
    lateMinutes: row.lateMinutes ?? 0,
    arrived: row.arrived ?? Boolean(row.checkIn),
    declareCode: row.declareCode ?? "",
  };
}

async function putAttendance(row: Attendance) {
  const db = getDb();
  await db.transaction("rw", db.attendance, db.auditLogs, async () => {
    await db.attendance.put(row);
    await writeAudit({
      action: row.checkIn ? "CHECK_IN" : "UPDATE",
      module: "attendance",
      recordId: row.id,
      newValue: row,
    });
  });
}

export async function declareShift(employeeId: string, code: string, date?: string) {
  const db = getDb();
  const c = ctx();
  const day = date ?? c.date;
  const shifts = await db.shifts.toArray();
  const shift = findShiftByCode(shifts, code) ?? (c.shiftId ? await db.shifts.get(c.shiftId) : undefined);
  if (!shift) throw new Error(`Không nhận mã ca ${code || "(trống)"}`);
  const resolved = (code || shift.code || "").toUpperCase();
  const existing = await attendanceForDay(employeeId, day);
  const leave = isLeaveCode(resolved);
  const now = Date.now();
  const row: Attendance = existing
    ? {
        ...normalizeAttendance(existing),
        shiftId: shift.id,
        declareCode: resolved,
        status: leave ? "ABSENT" : existing.arrived ? existing.status : "PLANNED",
        arrived: leave ? false : existing.arrived,
        checkIn: leave ? null : existing.checkIn,
        lateMinutes: leave ? 0 : existing.lateMinutes ?? 0,
        note: leave ? shift.name : existing.note,
      }
    : {
        id: nid(),
        employeeId,
        date: day,
        shiftId: shift.id,
        checkIn: null,
        checkOut: null,
        status: leave ? "ABSENT" : "PLANNED",
        otMinutes: 0,
        lateMinutes: 0,
        arrived: false,
        declareCode: resolved,
        note: leave ? shift.name : "",
        createdAt: now,
      };
  await putAttendance(row);
  await syncAmh(employeeId, day);
  return row;
}

export async function markArrived(employeeId: string, at?: number) {
  const db = getDb();
  const c = ctx();
  const now = at ?? Date.now();
  let existing = await attendanceForDay(employeeId, c.date);
  if (!existing) {
    await declareShift(employeeId, "", c.date);
    existing = await attendanceForDay(employeeId, c.date);
  }
  if (!existing) throw new Error("Chưa khai ca");
  const shift = await db.shifts.get(existing.shiftId);
  if (!shift) throw new Error("Không tìm thấy ca");
  if ((shift.kind ?? "WORK") === "LEAVE") throw new Error("Ca nghỉ — không chấm đến");
  const window = shiftWindow(c.date, shift);
  const late = lateMinutesAt(window.start.getTime(), now, 0);
  const row: Attendance = {
    ...normalizeAttendance(existing),
    checkIn: now,
    arrived: true,
    lateMinutes: late,
    status: late > 0 ? "LATE" : "PRESENT",
  };
  await putAttendance(row);
  await writeAudit({ action: "CHECK_IN", module: "attendance", recordId: row.id, newValue: row });
  await syncAmh(employeeId, c.date);
  return row;
}

export async function setLateMinutes(employeeId: string, minutes: number) {
  const c = ctx();
  const existing = await attendanceForDay(employeeId, c.date);
  if (!existing?.arrived) throw new Error("Chưa tích đã đến");
  const late = Math.max(0, Math.round(minutes));
  const row: Attendance = {
    ...normalizeAttendance(existing),
    lateMinutes: late,
    status: late > 0 ? "LATE" : "PRESENT",
  };
  await putAttendance(row);
  return row;
}

export async function checkIn(employeeId: string) {
  return markArrived(employeeId);
}

export async function checkOut(employeeId: string) {
  const db = getDb();
  const c = ctx();
  const now = Date.now();
  const existing = await attendanceForDay(employeeId, c.date);
  if (!existing?.checkIn) throw new Error("Chưa chấm vào");
  if (existing.checkOut) throw new Error("Đã chấm ra");
  const shift = await db.shifts.get(existing.shiftId);
  if (!shift) throw new Error("Không tìm thấy ca");
  const window = shiftWindow(c.date, shift);
  const grace = 5 * 60 * 1000;
  let status: AttendanceStatus = existing.status === "LATE" ? "LATE" : "PRESENT";
  let otMinutes = 0;
  if (now < window.end.getTime() - grace) status = "EARLY_LEAVE";
  if (now > window.end.getTime() + grace) {
    status = "OVERTIME";
    otMinutes = Math.round((now - window.end.getTime()) / 60000);
  }
  const next: Attendance = { ...normalizeAttendance(existing), checkOut: now, status, otMinutes };
  await db.transaction("rw", db.attendance, db.auditLogs, async () => {
    await db.attendance.put(next);
    await writeAudit({ action: "CHECK_OUT", module: "attendance", recordId: next.id, newValue: next });
  });
  await syncAmh(employeeId, c.date);
  return next;
}

export async function markAbsent(employeeId: string, note: string, code?: string) {
  if (code) return declareShift(employeeId, code);
  const c = ctx();
  const existing = await attendanceForDay(employeeId, c.date);
  const shiftId = existing?.shiftId || c.shiftId;
  if (!shiftId) throw new Error("Chưa chọn ca");
  const row: Attendance = existing
    ? { ...normalizeAttendance(existing), status: "ABSENT", arrived: false, checkIn: null, note }
    : {
        id: nid(),
        employeeId,
        date: c.date,
        shiftId,
        checkIn: null,
        checkOut: null,
        status: "ABSENT",
        otMinutes: 0,
        lateMinutes: 0,
        arrived: false,
        declareCode: "",
        note,
        createdAt: Date.now(),
      };
  await putAttendance(row);
  await syncAmh(employeeId, c.date);
  return row;
}

export async function createTask(data: Omit<Task, "id" | "createdAt" | "updatedAt" | "completedAt" | "status" | "progress"> & { progress?: number }) {
  const now = Date.now();
  const row: Task = {
    ...data,
    id: nid(),
    progress: data.progress ?? 0,
    status: "TODO",
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  const db = getDb();
  await db.transaction("rw", db.tasks, db.auditLogs, async () => {
    await db.tasks.add(row);
    await writeAudit({ action: "CREATE", module: "tasks", recordId: row.id, newValue: row });
  });
  return row;
}

export async function updateTask(id: string, patch: Partial<Task>) {
  const db = getDb();
  const old = await db.tasks.get(id);
  if (!old) throw new Error("Không tìm thấy công việc");
  const next = { ...old, ...patch, id, updatedAt: Date.now() };
  await db.tasks.put(next);
  await writeAudit({ action: "UPDATE", module: "tasks", recordId: id, oldValue: old, newValue: next });
  return next;
}

export async function setTaskProgress(id: string, progress: number) {
  const db = getDb();
  const old = await db.tasks.get(id);
  if (!old) throw new Error("Không tìm thấy công việc");
  const now = Date.now();
  const applied = applyProgress(old, progress, now);
  const next: Task = { ...old, ...applied };
  await db.transaction("rw", db.tasks, db.auditLogs, async () => {
    await db.tasks.put(next);
    await writeAudit({
      action: applied.status === "COMPLETED" ? "COMPLETE" : "PROGRESS",
      module: "tasks",
      recordId: id,
      oldValue: { progress: old.progress, status: old.status },
      newValue: { progress: next.progress, status: next.status },
    });
  });
  return next;
}

export async function deleteTask(id: string) {
  const db = getDb();
  const old = await db.tasks.get(id);
  await db.transaction("rw", db.tasks, db.auditLogs, async () => {
    await db.tasks.delete(id);
    await writeAudit({ action: "DELETE", module: "tasks", recordId: id, oldValue: old });
  });
}

export async function refreshOverdueTasks() {
  const db = getDb();
  const now = Date.now();
  const open = await db.tasks.filter((t) => t.status !== "COMPLETED").toArray();
  for (const t of open) {
    const next = refreshTaskStatus(t, now);
    if (next !== t.status) await db.tasks.update(t.id, { status: next, updatedAt: now });
  }
}

export async function toggleChecklistItem(id: string, done: boolean) {
  const db = getDb();
  const c = ctx();
  const now = Date.now();
  await db.checklistItems.update(id, {
    done,
    completedAt: done ? now : null,
    completedBy: done ? c.userId : null,
  });
  await writeAudit({
    action: done ? "COMPLETE" : "UPDATE",
    module: "checklistItems",
    recordId: id,
    newValue: { done },
  });
}

export async function addChecklistItem(checklistId: string, label: string, extra?: { taskId?: string; threeSId?: string }) {
  const db = getDb();
  const siblings = await db.checklistItems.where("checklistId").equals(checklistId).count();
  const row = {
    id: nid(),
    checklistId,
    taskId: extra?.taskId ?? null,
    threeSId: extra?.threeSId ?? null,
    label,
    done: false,
    completedAt: null,
    completedBy: null,
    photoId: null,
    note: "",
    order: siblings + 1,
  };
  await db.checklistItems.add(row);
  return row;
}

export async function savePhoto(input: {
  ownerModule: string;
  ownerId: string;
  kind: string;
  blob: Blob;
  note?: string;
}) {
  const db = getDb();
  const blobId = nid();
  const photoId = nid();
  await db.transaction("rw", db.blobs, db.photos, db.auditLogs, async () => {
    await db.blobs.add({ id: blobId, mime: input.blob.type || "image/jpeg", data: input.blob, createdAt: Date.now() });
    await db.photos.add({
      id: photoId,
      ownerModule: input.ownerModule,
      ownerId: input.ownerId,
      kind: input.kind,
      blobId,
      note: input.note ?? "",
      createdAt: Date.now(),
    });
    await writeAudit({ action: "PHOTO", module: input.ownerModule, recordId: input.ownerId, newValue: { photoId, kind: input.kind } });
  });
  return photoId;
}

export async function deletePhoto(id: string) {
  const db = getDb();
  const photo = await db.photos.get(id);
  if (!photo) return;
  await db.transaction("rw", db.photos, db.blobs, async () => {
    await db.photos.delete(id);
    await db.blobs.delete(photo.blobId);
  });
}

export async function createOvertime(data: Omit<Overtime, "id" | "totalMinutes" | "createdAt">) {
  const db = getDb();
  const c = ctx();
  const totalMinutes = computeOtMinutes({
    startTime: data.startTime,
    endTime: data.endTime,
    roundMinutes: c.otRound,
  });
  const row: Overtime = { ...data, id: nid(), totalMinutes, createdAt: Date.now() };
  await db.transaction("rw", db.overtimes, db.auditLogs, async () => {
    await db.overtimes.add(row);
    await writeAudit({ action: "OT_CREATE", module: "overtimes", recordId: row.id, newValue: row });
  });
  await syncAmh(row.employeeId, row.date);
  return row;
}

export async function updateOvertime(id: string, patch: Partial<Overtime>) {
  const db = getDb();
  const old = await db.overtimes.get(id);
  if (!old) throw new Error("Không tìm thấy OT");
  const c = ctx();
  const merged = { ...old, ...patch, id };
  merged.totalMinutes = computeOtMinutes({
    startTime: merged.startTime,
    endTime: merged.endTime,
    roundMinutes: c.otRound,
  });
  await db.overtimes.put(merged);
  await writeAudit({ action: "UPDATE", module: "overtimes", recordId: id, oldValue: old, newValue: merged });
  await syncAmh(merged.employeeId, merged.date);
  return merged;
}

export async function deleteOvertime(id: string) {
  const old = await getDb().overtimes.get(id);
  await getDb().overtimes.delete(id);
  await writeAudit({ action: "DELETE", module: "overtimes", recordId: id, oldValue: old });
  if (old) await syncAmh(old.employeeId, old.date);
}

export async function syncAmh(employeeId: string, date: string) {
  const db = getDb();
  const att = await attendanceForDay(employeeId, date);
  const shift = att ? await db.shifts.get(att.shiftId) : null;
  const leave = shift ? (shift.kind ?? "WORK") === "LEAVE" : false;
  const shiftMinutes = leave || !shift ? 0 : plannedMinutesOf(shift);
  const ots = (await db.overtimes.where("employeeId").equals(employeeId).toArray()).filter((o) => o.date === date);
  const otMinutes = ots.reduce((s, o) => s + o.totalMinutes, 0);
  const existing = (await db.amhs.where("employeeId").equals(employeeId).toArray()).find((a) => a.date === date);
  const adjustMinutes = existing?.adjustMinutes ?? 0;
  const computed = computeAmh({ shiftMinutes, otMinutes, adjustMinutes });
  const shiftId = att?.shiftId ?? existing?.shiftId ?? useAppStore.getState().selectedShiftId ?? "";
  const row: Amh = existing
    ? {
        ...existing,
        shiftId,
        shiftMinutes: computed.shiftMinutes,
        otMinutes: computed.otMinutes,
        adjustMinutes: computed.adjustMinutes,
        hours: computed.hours,
        status: existing.confirmed ? "APPROVED" : "DECLARED",
      }
    : {
        id: nid(),
        employeeId,
        date,
        shiftId,
        hours: computed.hours,
        shiftMinutes: computed.shiftMinutes,
        otMinutes: computed.otMinutes,
        adjustMinutes: computed.adjustMinutes,
        confirmed: false,
        status: "DECLARED",
        note: "",
        taskId: null,
        createdAt: Date.now(),
      };
  if (!att && ots.length === 0 && !existing) return null;
  await db.amhs.put(row);
  return row;
}

export async function confirmAmh(id: string, adjustMinutes?: number) {
  const old = await getDb().amhs.get(id);
  if (!old) throw new Error("Không tìm thấy AMH");
  const computed = computeAmh({
    shiftMinutes: old.shiftMinutes ?? 0,
    otMinutes: old.otMinutes ?? 0,
    adjustMinutes: adjustMinutes ?? old.adjustMinutes ?? 0,
  });
  const next: Amh = {
    ...old,
    ...computed,
    confirmed: true,
    status: "APPROVED",
  };
  await getDb().amhs.put(next);
  await writeAudit({ action: "UPDATE", module: "amhs", recordId: id, oldValue: old, newValue: next });
  return next;
}

export async function createAmh(
  data: Omit<Amh, "id" | "createdAt" | "shiftMinutes" | "otMinutes" | "adjustMinutes" | "confirmed"> &
    Partial<Pick<Amh, "shiftMinutes" | "otMinutes" | "adjustMinutes" | "confirmed">>,
) {
  const computed = computeAmh({
    shiftMinutes: data.shiftMinutes ?? Math.round((data.hours ?? 0) * 60),
    otMinutes: data.otMinutes ?? 0,
    adjustMinutes: data.adjustMinutes ?? 0,
  });
  const row: Amh = {
    ...data,
    ...computed,
    confirmed: data.confirmed ?? false,
    id: nid(),
    createdAt: Date.now(),
  };
  await getDb().amhs.add(row);
  await writeAudit({ action: "CREATE", module: "amhs", recordId: row.id, newValue: row });
  return row;
}

export async function updateAmh(id: string, patch: Partial<Amh>) {
  const old = await getDb().amhs.get(id);
  if (!old) throw new Error("Không tìm thấy AMH");
  const next = { ...old, ...patch, id };
  await getDb().amhs.put(next);
  await writeAudit({ action: "UPDATE", module: "amhs", recordId: id, oldValue: old, newValue: next });
  return next;
}

export async function deleteAmh(id: string) {
  const old = await getDb().amhs.get(id);
  await getDb().amhs.delete(id);
  await writeAudit({ action: "DELETE", module: "amhs", recordId: id, oldValue: old });
}

export async function upsertDataItem(data: Omit<DataItem, "id" | "createdAt" | "updatedAt" | "completedAt"> & { id?: string }) {
  const db = getDb();
  const now = Date.now();
  const completedAt = data.status === "COMPLETED" ? now : null;
  if (data.id) {
    const old = await db.dataItems.get(data.id);
    const next: DataItem = {
      ...(old as DataItem),
      ...data,
      id: data.id,
      updatedAt: now,
      completedAt: data.status === "COMPLETED" ? (old?.completedAt ?? now) : null,
    };
    await db.dataItems.put(next);
    await writeAudit({ action: "UPDATE", module: "dataItems", recordId: next.id, oldValue: old, newValue: next });
    return next;
  }
  const row: DataItem = { ...data, id: nid(), createdAt: now, updatedAt: now, completedAt };
  await db.dataItems.add(row);
  await writeAudit({ action: "CREATE", module: "dataItems", recordId: row.id, newValue: row });
  return row;
}

export async function deleteDataItem(id: string) {
  const old = await getDb().dataItems.get(id);
  await getDb().dataItems.delete(id);
  await writeAudit({ action: "DELETE", module: "dataItems", recordId: id, oldValue: old });
}

export async function upsertGoods(data: Omit<GoodsItem, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  const db = getDb();
  const now = Date.now();
  if (data.id) {
    const old = await db.goodsItems.get(data.id);
    const next: GoodsItem = { ...(old as GoodsItem), ...data, id: data.id, updatedAt: now };
    await db.goodsItems.put(next);
    await writeAudit({ action: "UPDATE", module: "goodsItems", recordId: next.id, oldValue: old, newValue: next });
    return next;
  }
  const row: GoodsItem = { ...data, id: nid(), createdAt: now, updatedAt: now };
  await db.goodsItems.add(row);
  await writeAudit({ action: "CREATE", module: "goodsItems", recordId: row.id, newValue: row });
  return row;
}

export async function deleteGoods(id: string) {
  const old = await getDb().goodsItems.get(id);
  await getDb().goodsItems.delete(id);
  await writeAudit({ action: "DELETE", module: "goodsItems", recordId: id, oldValue: old });
}

export async function upsertLot(data: Omit<Lot, "id" | "createdAt"> & { id?: string }) {
  const db = getDb();
  if (data.id) {
    const old = await db.lots.get(data.id);
    if (old?.status === "CLOSED") throw new Error("Lot đã chốt, không sửa trực tiếp");
    const next: Lot = { ...(old as Lot), ...data, id: data.id };
    await db.lots.put(next);
    await writeAudit({ action: "UPDATE", module: "lots", recordId: next.id, oldValue: old, newValue: next });
    return next;
  }
  const row: Lot = { ...data, id: nid(), createdAt: Date.now() };
  await db.lots.add(row);
  await writeAudit({ action: "CREATE", module: "lots", recordId: row.id, newValue: row });
  return row;
}

export async function closeLot(lotId: string, note: string, photoId: string | null) {
  const db = getDb();
  const lot = await db.lots.get(lotId);
  if (!lot) throw new Error("Không tìm thấy Lot");
  if (lot.status === "CLOSED") throw new Error("Lot đã được chốt");
  const c = ctx();
  const now = Date.now();
  const closure = {
    id: nid(),
    lotId,
    closedBy: c.userId,
    closedAt: now,
    note,
    photoId,
  };
  await db.transaction("rw", db.lots, db.lotClosures, db.auditLogs, async () => {
    await db.lots.update(lotId, { status: "CLOSED" });
    await db.lotClosures.add(closure);
    await writeAudit({
      action: "LOT_CLOSE",
      module: "lots",
      recordId: lotId,
      oldValue: { status: lot.status },
      newValue: { status: "CLOSED", closedBy: c.userName, note },
    });
  });
  return closure;
}

export async function createThreeS(date: string, shiftId: string) {
  const row: ThreeSRecord = {
    id: nid(),
    date,
    shiftId,
    note: "",
    completedAt: null,
    createdAt: Date.now(),
  };
  const db = getDb();
  const labels = ["Sàng lọc", "Sắp xếp", "Sạch sẽ", "Săn sóc / Duy trì", "Sẵn sàng / Kỷ luật", "3D"];
  await db.transaction("rw", db.threeS, db.checklistItems, db.auditLogs, async () => {
    await db.threeS.add(row);
    await db.checklistItems.bulkAdd(
      labels.map((label, i) => ({
        id: nid(),
        checklistId: `threes-${row.id}`,
        taskId: null,
        threeSId: row.id,
        label,
        done: false,
        completedAt: null,
        completedBy: null,
        photoId: null,
        note: "",
        order: i + 1,
      })),
    );
    await writeAudit({ action: "CREATE", module: "threeS", recordId: row.id, newValue: row });
  });
  return row;
}

export async function createAbnormal(data: Omit<Abnormality, "id" | "createdAt" | "updatedAt">) {
  const now = Date.now();
  const row: Abnormality = { ...data, id: nid(), createdAt: now, updatedAt: now };
  await getDb().abnormalities.add(row);
  await writeAudit({ action: "CREATE", module: "abnormalities", recordId: row.id, newValue: row });
  return row;
}

export async function updateAbnormal(id: string, patch: Partial<Abnormality>) {
  const old = await getDb().abnormalities.get(id);
  if (!old) throw new Error("Không tìm thấy bất thường");
  const next = { ...old, ...patch, id, updatedAt: Date.now() };
  await getDb().abnormalities.put(next);
  await writeAudit({ action: "UPDATE", module: "abnormalities", recordId: id, oldValue: old, newValue: next });
  return next;
}

export async function saveHandover(input: { summary: string; note: string }) {
  const c = ctx();
  const row: Handover = {
    id: nid(),
    date: c.date,
    shiftId: c.shiftId ?? "",
    createdBy: c.userId,
    summary: input.summary,
    note: input.note,
    createdAt: Date.now(),
  };
  await getDb().handovers.add(row);
  await writeAudit({ action: "HANDOVER", module: "handovers", recordId: row.id, newValue: row });
  return row;
}

export async function lookupCode(code: string) {
  const db = getDb();
  const q = code.trim();
  if (!q) return [] as Array<{ module: string; id: string; title: string; subtitle: string }>;
  const upper = q.toUpperCase();
  const hits: Array<{ module: string; id: string; title: string; subtitle: string }> = [];
  const employees = await db.employees.filter((e) => e.code.toUpperCase() === upper || e.serialNumber.toUpperCase() === upper || e.name.toLowerCase().includes(q.toLowerCase())).toArray();
  for (const e of employees) hits.push({ module: "employees", id: e.id, title: e.name, subtitle: e.code });
  const data = await db.dataItems.filter((d) => d.productCode.toUpperCase() === upper || d.invoice.toUpperCase() === upper || d.lot.toUpperCase() === upper).toArray();
  for (const d of data) hits.push({ module: "dataItems", id: d.id, title: d.productCode, subtitle: `${d.invoice} · ${d.lot}` });
  const goods = await db.goodsItems.filter((d) => d.invoice.toUpperCase() === upper || d.productCode.toUpperCase() === upper || d.lot.toUpperCase() === upper || d.itemCode.toUpperCase() === upper).toArray();
  for (const d of goods) hits.push({ module: "goodsItems", id: d.id, title: d.itemCode || d.productCode, subtitle: d.invoice });
  const lots = await db.lots.filter((d) => d.lotCode.toUpperCase() === upper || d.invoice.toUpperCase() === upper).toArray();
  for (const d of lots) hits.push({ module: "lots", id: d.id, title: d.lotCode, subtitle: d.invoice });
  const tasks = await db.tasks.filter((t) => t.id === q || t.name.toLowerCase().includes(q.toLowerCase())).toArray();
  for (const t of tasks) hits.push({ module: "tasks", id: t.id, title: t.name, subtitle: t.id.slice(0, 8) });
  return hits;
}

export async function globalSearch(q: string) {
  return lookupCode(q);
}

export function todayIso() {
  return formatDate(new Date());
}

export interface ImportResult {
  created: number;
  updated: number;
  roster: number;
  skipped: number;
  errors: string[];
}

export async function importPersonnelWorkbook(book: PersonnelWorkbook): Promise<ImportResult> {
  const db = getDb();
  const result: ImportResult = { created: 0, updated: 0, roster: 0, skipped: 0, errors: [] };
  const shifts = await db.shifts.toArray();
  let groups = await db.groups.toArray();
  const defaultGroup =
    groups.find((g) => g.name.toLowerCase().includes("thành phẩm")) ??
    groups[0] ??
    (await (async () => {
      const g: Group = { id: nid(), name: "Tổ thành phẩm E", order: 1 };
      await db.groups.add(g);
      groups = [g];
      return g;
    })());
  const defaultShift = shifts.find((s) => s.code === "X") ?? shifts.find((s) => s.autoPick) ?? shifts[0];
  const people = await db.employees.toArray();
  const bySbd = new Map(people.map((p) => [(p.serialNumber || p.code).toUpperCase(), p]));

  await db.transaction("rw", db.employees, db.groups, db.attendance, db.amhs, db.auditLogs, async () => {
    for (const row of book.people) {
      const key = (row.sbd || row.name).toUpperCase();
      if (!row.name && !row.sbd) {
        result.skipped += 1;
        continue;
      }
      const shift = (row.shiftCode ? findShiftByCode(shifts, row.shiftCode) : undefined) ?? defaultShift;
      if (!shift) {
        result.errors.push(`${row.name}: không có ca`);
        continue;
      }
      let group = defaultGroup;
      if (row.group) {
        const found = groups.find((g) => g.name.toLowerCase() === row.group.toLowerCase());
        if (found) group = found;
        else {
          const g: Group = { id: nid(), name: row.group, order: groups.length + 1 };
          await db.groups.add(g);
          groups.push(g);
          group = g;
        }
      }
      const existing = bySbd.get(key);
      if (existing) {
        const next: Employee = {
          ...existing,
          name: row.name || existing.name,
          serialNumber: row.sbd || existing.serialNumber,
          code: row.sbd || existing.code,
          position: row.position || existing.position || "",
          phone: row.phone || existing.phone || "",
          groupId: group.id,
          shiftId: shift.id,
          note: row.note || existing.note,
          updatedAt: Date.now(),
        };
        await db.employees.put(next);
        bySbd.set(key, next);
        result.updated += 1;
      } else {
        const created: Employee = {
          id: nid(),
          code: row.sbd || row.name,
          name: row.name || row.sbd,
          serialNumber: row.sbd,
          position: row.position,
          phone: row.phone,
          groupId: group.id,
          shiftId: shift.id,
          status: "ACTIVE",
          role: "USER",
          note: row.note,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await db.employees.add(created);
        bySbd.set(key, created);
        result.created += 1;
      }
    }
  });

  for (const cell of book.roster) {
    const emp = bySbd.get(cell.sbd.toUpperCase());
    if (!emp) {
      result.errors.push(`Lịch ca SBD ${cell.sbd}: chưa có nhân sự`);
      continue;
    }
    if (!findShiftByCode(shifts, cell.code)) {
      result.errors.push(`${emp.name} ${cell.date}: mã ca ${cell.code} lạ`);
      continue;
    }
    try {
      await declareShift(emp.id, cell.code, cell.date);
      result.roster += 1;
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  await writeAudit({
    action: "IMPORT",
    module: "employees",
    recordId: "excel",
    newValue: { created: result.created, updated: result.updated, roster: result.roster },
  });
  return result;
}

