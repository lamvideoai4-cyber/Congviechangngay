import type { CvpDB } from "./db";
import type { Shift, ShiftKind } from "./types";
import { durationMinutes } from "./time";

export interface ShiftDef {
  code: string;
  label: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  kind: ShiftKind;
  autoPick: boolean;
  plannedMinutes: number;
  order: number;
  legacyNames?: string[];
}

/** Mã ca tổ thành phẩm E — khớp lịch Excel + màn khai ca. */
export const SHIFT_CATALOG: ShiftDef[] = [
  { code: "M", label: "Ca sáng", startTime: "06:00", endTime: "14:00", crossesMidnight: false, kind: "WORK", autoPick: true, plannedMinutes: 8 * 60, order: 1, legacyNames: ["Ca 1"] },
  { code: "M1", label: "Ca sáng kéo dài", startTime: "06:00", endTime: "15:00", crossesMidnight: false, kind: "WORK", autoPick: false, plannedMinutes: 9 * 60, order: 2 },
  { code: "X5", label: "Ca ngày 07–16", startTime: "07:00", endTime: "16:00", crossesMidnight: false, kind: "WORK", autoPick: false, plannedMinutes: 9 * 60, order: 3 },
  { code: "X", label: "Ca ngày", startTime: "08:00", endTime: "17:00", crossesMidnight: false, kind: "WORK", autoPick: true, plannedMinutes: 9 * 60, order: 4, legacyNames: ["Ca 2"] },
  { code: "X3", label: "Ca ngày 09–18", startTime: "09:00", endTime: "18:00", crossesMidnight: false, kind: "WORK", autoPick: false, plannedMinutes: 9 * 60, order: 5 },
  { code: "A", label: "Ca chiều", startTime: "14:00", endTime: "22:00", crossesMidnight: false, kind: "WORK", autoPick: true, plannedMinutes: 8 * 60, order: 6, legacyNames: ["Ca 3"] },
  { code: "D", label: "Ca đêm", startTime: "22:00", endTime: "06:00", crossesMidnight: true, kind: "WORK", autoPick: true, plannedMinutes: 8 * 60, order: 7, legacyNames: ["Ca 4"] },
  { code: "SM", label: "Ngày nghỉ", startTime: "06:00", endTime: "14:00", crossesMidnight: false, kind: "LEAVE", autoPick: false, plannedMinutes: 0, order: 20 },
  { code: "SM1", label: "Ngày nghỉ", startTime: "06:00", endTime: "15:00", crossesMidnight: false, kind: "LEAVE", autoPick: false, plannedMinutes: 0, order: 21 },
  { code: "S", label: "Ngày nghỉ", startTime: "08:00", endTime: "17:00", crossesMidnight: false, kind: "LEAVE", autoPick: false, plannedMinutes: 0, order: 22 },
  { code: "SA", label: "Ngày nghỉ", startTime: "14:00", endTime: "22:00", crossesMidnight: false, kind: "LEAVE", autoPick: false, plannedMinutes: 0, order: 23 },
  { code: "E", label: "Đêm ngày nghỉ", startTime: "22:00", endTime: "06:00", crossesMidnight: true, kind: "LEAVE", autoPick: false, plannedMinutes: 0, order: 24 },
  { code: "P", label: "Nghỉ phép", startTime: "00:00", endTime: "00:00", crossesMidnight: false, kind: "LEAVE", autoPick: false, plannedMinutes: 0, order: 25 },
  { code: "CK", label: "Nghỉ nghĩa vụ", startTime: "00:00", endTime: "00:00", crossesMidnight: false, kind: "LEAVE", autoPick: false, plannedMinutes: 0, order: 26 },
  { code: "RO", label: "Nghỉ không lý do", startTime: "00:00", endTime: "00:00", crossesMidnight: false, kind: "LEAVE", autoPick: false, plannedMinutes: 0, order: 27 },
  { code: "TS", label: "Nghỉ thai sản", startTime: "00:00", endTime: "00:00", crossesMidnight: false, kind: "LEAVE", autoPick: false, plannedMinutes: 0, order: 28 },
  { code: "O", label: "Nghỉ ốm", startTime: "00:00", endTime: "00:00", crossesMidnight: false, kind: "LEAVE", autoPick: false, plannedMinutes: 0, order: 29 },
];

export function normalizeShiftCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function catalogByCode(code: string): ShiftDef | undefined {
  const c = normalizeShiftCode(code);
  return SHIFT_CATALOG.find((s) => s.code === c);
}

export function isLeaveCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return catalogByCode(code)?.kind === "LEAVE";
}

export function isWorkShift(shift: Shift): boolean {
  return (shift.kind ?? "WORK") === "WORK";
}

export function headerShifts(shifts: Shift[]): Shift[] {
  return shifts.filter((s) => isWorkShift(s)).sort((a, b) => a.order - b.order);
}

export function shiftLabel(shift: Shift): string {
  const code = shift.code ? `${shift.code} ` : "";
  if (shift.kind === "LEAVE") {
    return `${code}· ${shift.name}`.replace("  ", " ");
  }
  return `${code}${shift.startTime}–${shift.endTime}`.trim();
}

export function plannedMinutesOf(shift: Shift): number {
  if (typeof shift.plannedMinutes === "number") return shift.plannedMinutes;
  if ((shift.kind ?? "WORK") === "LEAVE") return 0;
  if (!shift.startTime || !shift.endTime || shift.startTime === shift.endTime) return 0;
  return durationMinutes(shift.startTime, shift.endTime);
}

export function findShiftByCode(shifts: Shift[], code: string): Shift | undefined {
  const c = normalizeShiftCode(code);
  return shifts.find((s) => (s.code ?? "").toUpperCase() === c);
}

export function toShiftRow(def: ShiftDef, id?: string): Shift {
  return {
    id: id ?? `shift-${def.code}`,
    name: def.label,
    startTime: def.startTime,
    endTime: def.endTime,
    crossesMidnight: def.crossesMidnight,
    order: def.order,
    code: def.code,
    kind: def.kind,
    autoPick: def.autoPick,
    plannedMinutes: def.plannedMinutes,
  };
}

export async function ensureShiftCatalog(db: CvpDB): Promise<Shift[]> {
  const existing = await db.shifts.toArray();
  for (const def of SHIFT_CATALOG) {
    const match = existing.find(
      (s) =>
        s.code === def.code ||
        s.id === `shift-${def.code}` ||
        (def.legacyNames ?? []).includes(s.name),
    );
    const row = toShiftRow(def, match?.id);
    await db.shifts.put(row);
    if (match) {
      match.code = row.code;
      match.kind = row.kind;
      match.autoPick = row.autoPick;
      match.plannedMinutes = row.plannedMinutes;
      match.name = row.name;
      match.startTime = row.startTime;
      match.endTime = row.endTime;
      match.crossesMidnight = row.crossesMidnight;
      match.order = row.order;
    } else {
      existing.push(row);
    }
  }
  return db.shifts.orderBy("order").toArray();
}
