import { hoursFromMinutes } from "./time";

export interface AmhParts {
  shiftMinutes: number;
  otMinutes: number;
  adjustMinutes: number;
}

/** AMH = giờ ca thực tế đã xác nhận + OT đã xác nhận + điều chỉnh đã duyệt. */
export function computeAmh(parts: AmhParts): AmhParts & { totalMinutes: number; hours: number } {
  const shiftMinutes = Math.max(0, Math.round(parts.shiftMinutes));
  const otMinutes = Math.max(0, Math.round(parts.otMinutes));
  const adjustMinutes = Math.round(parts.adjustMinutes);
  const totalMinutes = Math.max(0, shiftMinutes + otMinutes + adjustMinutes);
  return {
    shiftMinutes,
    otMinutes,
    adjustMinutes,
    totalMinutes,
    hours: hoursFromMinutes(totalMinutes),
  };
}

export function lateMinutesAt(shiftStartMs: number, arrivedMs: number, graceMinutes = 0): number {
  const raw = Math.floor((arrivedMs - shiftStartMs) / 60000) - graceMinutes;
  return Math.max(0, raw);
}
