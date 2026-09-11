import type { Task, TaskStatus } from "./types.ts";

export const PROGRESS_STEPS = [0, 25, 50, 75, 100] as const;

export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function statusFromProgress(
  progress: number,
  previous: TaskStatus,
  deadline: number | null,
  now: number,
): TaskStatus {
  const p = clampProgress(progress);
  if (p >= 100) return "COMPLETED";
  if (deadline && now > deadline && p < 100) return "OVERDUE";
  if (p <= 0) {
    if (previous === "PAUSED") return "PAUSED";
    return previous === "IN_PROGRESS" || previous === "OVERDUE" ? "IN_PROGRESS" : "TODO";
  }
  if (previous === "PAUSED") return "PAUSED";
  return "IN_PROGRESS";
}

export function applyProgress(
  task: Task,
  progress: number,
  now: number,
): Pick<Task, "progress" | "status" | "completedAt" | "updatedAt"> {
  const next = clampProgress(progress);
  const status = statusFromProgress(next, task.status, task.deadline, now);
  return {
    progress: next,
    status,
    completedAt: status === "COMPLETED" ? (task.completedAt ?? now) : null,
    updatedAt: now,
  };
}

export function refreshTaskStatus(task: Task, now: number): TaskStatus {
  if (task.status === "COMPLETED" || task.progress >= 100) return "COMPLETED";
  if (task.status === "PAUSED") return "PAUSED";
  if (task.deadline && now > task.deadline && task.progress < 100) return "OVERDUE";
  return task.status;
}
