import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyProgress, clampProgress, statusFromProgress } from "./progress.ts";
import type { Task } from "./types.ts";

const base: Task = {
  id: "t1",
  name: "X",
  blockId: "b",
  assigneeId: "e",
  date: "2026-09-01",
  shiftId: "s",
  estimatedMinutes: 30,
  deadline: null,
  reminderTime: null,
  status: "TODO",
  progress: 0,
  note: "",
  createdAt: 1,
  updatedAt: 1,
  completedAt: null,
};

describe("progress", () => {
  it("clamps to 0–100", () => {
    assert.equal(clampProgress(-10), 0);
    assert.equal(clampProgress(150), 100);
    assert.equal(clampProgress(33.4), 33);
  });

  it("100% completes and stamps completedAt", () => {
    const now = 1_000_000;
    const next = applyProgress(base, 100, now);
    assert.equal(next.status, "COMPLETED");
    assert.equal(next.progress, 100);
    assert.equal(next.completedAt, now);
  });

  it("dropping below 100 clears completedAt", () => {
    const done = { ...base, status: "COMPLETED" as const, progress: 100, completedAt: 5 };
    const next = applyProgress(done, 75, 10);
    assert.equal(next.status, "IN_PROGRESS");
    assert.equal(next.completedAt, null);
  });

  it("past deadline becomes OVERDUE when not complete", () => {
    const now = 200;
    assert.equal(statusFromProgress(50, "IN_PROGRESS", 100, now), "OVERDUE");
  });

  it("paused stays paused until 100%", () => {
    assert.equal(statusFromProgress(50, "PAUSED", null, 1), "PAUSED");
    assert.equal(statusFromProgress(100, "PAUSED", null, 1), "COMPLETED");
  });
});
