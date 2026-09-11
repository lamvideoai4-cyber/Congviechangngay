import Dexie, { type Table } from "dexie";
import type {
  Abnormality,
  Amh,
  AppNotification,
  AppSetting,
  Attendance,
  AuditLog,
  BlobRow,
  Checklist,
  ChecklistItem,
  DataItem,
  Employee,
  GoodsItem,
  Group,
  Handover,
  Lot,
  LotClosure,
  Overtime,
  Photo,
  Shift,
  Task,
  ThreeSRecord,
  WorkBlock,
} from "./types";

export class CvpDB extends Dexie {
  employees!: Table<Employee, string>;
  groups!: Table<Group, string>;
  shifts!: Table<Shift, string>;
  attendance!: Table<Attendance, string>;
  workBlocks!: Table<WorkBlock, string>;
  tasks!: Table<Task, string>;
  checklists!: Table<Checklist, string>;
  checklistItems!: Table<ChecklistItem, string>;
  photos!: Table<Photo, string>;
  blobs!: Table<BlobRow, string>;
  auditLogs!: Table<AuditLog, string>;
  overtimes!: Table<Overtime, string>;
  amhs!: Table<Amh, string>;
  dataItems!: Table<DataItem, string>;
  goodsItems!: Table<GoodsItem, string>;
  lots!: Table<Lot, string>;
  lotClosures!: Table<LotClosure, string>;
  threeS!: Table<ThreeSRecord, string>;
  abnormalities!: Table<Abnormality, string>;
  notifications!: Table<AppNotification, string>;
  settings!: Table<AppSetting, string>;
  handovers!: Table<Handover, string>;

  constructor() {
    super("congviecpro");
    this.version(1).stores({
      employees: "id, code, groupId, shiftId, status, name",
      groups: "id, order",
      shifts: "id, order",
      attendance: "id, employeeId, date, shiftId, [employeeId+date+shiftId]",
      workBlocks: "id, order",
      tasks: "id, blockId, assigneeId, date, shiftId, status, deadline",
      checklists: "id, blockId",
      checklistItems: "id, checklistId, taskId, threeSId, done",
      photos: "id, ownerModule, ownerId, createdAt",
      blobs: "id",
      auditLogs: "id, timestamp, module, recordId, date, shiftId, action",
      overtimes: "id, employeeId, date, shiftId",
      amhs: "id, employeeId, date, shiftId, status",
      dataItems: "id, productCode, invoice, lot, status",
      goodsItems: "id, invoice, productCode, lot, status, exportDate",
      lots: "id, lotCode, invoice, productCode, status, date",
      lotClosures: "id, lotId, closedAt",
      threeS: "id, date, shiftId",
      abnormalities: "id, status, detectedAt, linkedModule, linkedId",
      notifications: "id, dueAt, read",
      settings: "key",
      handovers: "id, date, shiftId",
    });
    this.version(2).stores({
      employees: "id, code, serialNumber, groupId, shiftId, status, name",
      groups: "id, order",
      shifts: "id, code, order, kind",
      attendance: "id, employeeId, date, shiftId, [employeeId+date+shiftId]",
      workBlocks: "id, order",
      tasks: "id, blockId, assigneeId, date, shiftId, status, deadline",
      checklists: "id, blockId",
      checklistItems: "id, checklistId, taskId, threeSId, done",
      photos: "id, ownerModule, ownerId, createdAt",
      blobs: "id",
      auditLogs: "id, timestamp, module, recordId, date, shiftId, action",
      overtimes: "id, employeeId, date, shiftId",
      amhs: "id, employeeId, date, shiftId, status",
      dataItems: "id, productCode, invoice, lot, status",
      goodsItems: "id, invoice, productCode, lot, status, exportDate",
      lots: "id, lotCode, invoice, productCode, status, date",
      lotClosures: "id, lotId, closedAt",
      threeS: "id, date, shiftId",
      abnormalities: "id, status, detectedAt, linkedModule, linkedId",
      notifications: "id, dueAt, read",
      settings: "key",
      handovers: "id, date, shiftId",
    });
  }
}

let _db: CvpDB | null = null;

export function canUseDb(): boolean {
  return typeof indexedDB !== "undefined";
}

export function getDb(): CvpDB {
  if (!canUseDb()) {
    throw new Error("IndexedDB không khả dụng");
  }
  if (!_db) _db = new CvpDB();
  return _db;
}

export async function resetDatabase(): Promise<void> {
  const db = getDb();
  await db.delete();
  _db = null;
}
