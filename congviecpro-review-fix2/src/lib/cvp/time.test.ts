import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDays,
  durationMinutes,
  formatDate,
  getActiveContext,
  getActiveShift,
  roundToStep,
  shiftDateFor,
  shiftWindow,
  type Shift,
} from "./time.ts";

const shifts: Shift[] = [
  { id: "1", name: "Ca 1", startTime: "06:00", endTime: "14:00", crossesMidnight: false, order: 1 },
  { id: "2", name: "Ca 2", startTime: "08:00", endTime: "17:00", crossesMidnight: false, order: 2 },
  { id: "3", name: "Ca 3", startTime: "14:00", endTime: "22:00", crossesMidnight: false, order: 3 },
  { id: "4", name: "Ca 4", startTime: "22:00", endTime: "06:00", crossesMidnight: true, order: 4 },
];

describe("night shift date", () => {
  it("22:00 01/09 belongs to 2026-09-01 Ca 4", () => {
    const now = new Date(2026, 8, 1, 22, 5, 0);
    const ctx = getActiveContext(now, shifts);
    assert.equal(ctx?.shift.id, "4");
    assert.equal(ctx?.date, "2026-09-01");
  });

  it("01:00 02/09 still belongs to 2026-09-01 Ca 4", () => {
    const now = new Date(2026, 8, 2, 1, 0, 0);
    const ctx = getActiveContext(now, shifts);
    assert.equal(ctx?.shift.id, "4");
    assert.equal(ctx?.date, "2026-09-01");
  });

  it("05:59 still Ca 4 previous date; 06:00 is Ca 1 new date", () => {
    const before = new Date(2026, 8, 2, 5, 59, 0);
    const after = new Date(2026, 8, 2, 6, 0, 0);
    assert.equal(getActiveContext(before, shifts)?.date, "2026-09-01");
    assert.equal(getActiveContext(after, shifts)?.shift.id, "1");
    assert.equal(getActiveContext(after, shifts)?.date, "2026-09-02");
  });
});

describe("overlapping day shifts", () => {
  it("09:00 prefers Ca 2 which started more recently than Ca 1", () => {
    const now = new Date(2026, 8, 1, 9, 0, 0);
    assert.equal(getActiveShift(now, shifts)?.id, "2");
  });

  it("07:00 is Ca 1", () => {
    const now = new Date(2026, 8, 1, 7, 0, 0);
    assert.equal(getActiveShift(now, shifts)?.id, "1");
  });
});

describe("shift window overnight", () => {
  it("Ca 4 window is 22:00 day1 to 06:00 day2", () => {
    const w = shiftWindow("2026-09-01", shifts[3]!);
    assert.equal(formatDate(w.start), "2026-09-01");
    assert.equal(w.start.getHours(), 22);
    assert.equal(formatDate(w.end), "2026-09-02");
    assert.equal(w.end.getHours(), 6);
  });

  it("shiftDateFor after midnight uses previous calendar day", () => {
    const now = new Date(2026, 8, 2, 3, 30, 0);
    assert.equal(shiftDateFor(now, shifts[3]!), "2026-09-01");
  });
});

describe("duration overnight", () => {
  it("22:00 → 01:00 = 3 hours", () => {
    assert.equal(durationMinutes("22:00", "01:00"), 180);
  });
  it("22:00 → 06:00 = 8 hours", () => {
    assert.equal(durationMinutes("22:00", "06:00"), 480);
  });
  it("23:30 → 02:30 = 3 hours", () => {
    assert.equal(durationMinutes("23:30", "02:30"), 180);
  });
  it("14:00 → 16:30 = 150 minutes", () => {
    assert.equal(durationMinutes("14:00", "16:30"), 150);
  });
});

describe("rounding", () => {
  it("rounds 44 min to 30, 46 to 60 with step 30", () => {
    assert.equal(roundToStep(44, 30), 30);
    assert.equal(roundToStep(46, 30), 60);
  });
});

describe("addDays", () => {
  it("crosses month", () => {
    assert.equal(addDays("2026-09-01", -1), "2026-08-31");
  });
});
