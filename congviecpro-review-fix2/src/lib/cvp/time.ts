import type { Shift } from "./types.ts";

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function parseHHmm(value: string): number {
  const [h, m] = value.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function minutesToHHmm(total: number): string {
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

export function formatDateVi(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function combineDateTime(date: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = parseDate(date);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

export interface ShiftWindow {
  start: Date;
  end: Date;
  date: string;
  shift: Shift;
}

/** Ca 4 22:00–06:00: if now is 01:00 on 02/09, the shift date is 01/09. */
export function shiftDateFor(now: Date, shift: Shift): string {
  const today = formatDate(now);
  if (!shift.crossesMidnight) return today;
  const mins = now.getHours() * 60 + now.getMinutes();
  const endMins = parseHHmm(shift.endTime);
  const startMins = parseHHmm(shift.startTime);
  if (mins < endMins && endMins < startMins) {
    return addDays(today, -1);
  }
  return today;
}

export function shiftWindow(date: string, shift: Shift): ShiftWindow {
  const start = combineDateTime(date, shift.startTime);
  let end = combineDateTime(date, shift.endTime);
  if (shift.crossesMidnight || end.getTime() <= start.getTime()) {
    end = combineDateTime(addDays(date, 1), shift.endTime);
  }
  return { start, end, date, shift };
}

export function isInWindow(now: Date, window: ShiftWindow): boolean {
  const t = now.getTime();
  return t >= window.start.getTime() && t < window.end.getTime();
}

/**
 * Pick the active shift. Overlapping windows (Ca 1 06–14 and Ca 2 08–17)
 * resolve to the shift that started most recently.
 */
export function getActiveShift(now: Date, shifts: Shift[]): Shift | null {
  const today = formatDate(now);
  const yesterday = addDays(today, -1);
  const candidates: { shift: Shift; start: number }[] = [];
  for (const shift of shifts) {
    if ((shift.kind ?? "WORK") === "LEAVE") continue;
    if (shift.autoPick === false) continue;
    const dates = shift.crossesMidnight ? [yesterday, today] : [today];
    for (const date of dates) {
      const w = shiftWindow(date, shift);
      if (isInWindow(now, w)) {
        candidates.push({ shift, start: w.start.getTime() });
      }
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.start - a.start);
  return candidates[0]?.shift ?? null;
}

export function getActiveContext(
  now: Date,
  shifts: Shift[],
): { shift: Shift; date: string } | null {
  const shift = getActiveShift(now, shifts);
  if (!shift) return null;
  return { shift, date: shiftDateFor(now, shift) };
}

export function durationMinutes(startHHmm: string, endHHmm: string): number {
  const s = parseHHmm(startHHmm);
  const e = parseHHmm(endHHmm);
  let d = e - s;
  if (d <= 0) d += 24 * 60;
  return d;
}

export function roundToStep(minutes: number, step: number): number {
  if (step <= 0) return minutes;
  return Math.round(minutes / step) * step;
}

export function hoursFromMinutes(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

export function formatHours(minutes: number): string {
  const h = hoursFromMinutes(minutes);
  return Number.isInteger(h) ? `${h}` : h.toFixed(1);
}

export function startOfWeek(iso: string): string {
  const d = parseDate(iso);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatDate(d);
}

export function startOfMonth(iso: string): string {
  const d = parseDate(iso);
  d.setDate(1);
  return formatDate(d);
}

export function datesInRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export const DEFAULT_SHIFTS: Omit<Shift, "id">[] = [
  { name: "Ca 1", startTime: "06:00", endTime: "14:00", crossesMidnight: false, order: 1 },
  { name: "Ca 2", startTime: "08:00", endTime: "17:00", crossesMidnight: false, order: 2 },
  { name: "Ca 3", startTime: "14:00", endTime: "22:00", crossesMidnight: false, order: 3 },
  { name: "Ca 4", startTime: "22:00", endTime: "06:00", crossesMidnight: true, order: 4 },
];
