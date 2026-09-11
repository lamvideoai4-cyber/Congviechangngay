import { durationMinutes, roundToStep } from "./time.ts";

export interface OtInput {
  startTime: string;
  endTime: string;
  roundMinutes?: number;
}

export function computeOtMinutes(input: OtInput): number {
  const raw = durationMinutes(input.startTime, input.endTime);
  return roundToStep(raw, input.roundMinutes ?? 30);
}

export function computeOtHours(input: OtInput): number {
  return Math.round((computeOtMinutes(input) / 60) * 10) / 10;
}

/** Detect overnight OT (end clock is earlier than start clock). */
export function isOvernight(startTime: string, endTime: string): boolean {
  return durationMinutes(startTime, endTime) !== clockDiffSameDay(startTime, endTime);
}

function clockDiffSameDay(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}
