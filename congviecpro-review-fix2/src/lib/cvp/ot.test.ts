import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeOtHours, computeOtMinutes, isOvernight } from "./ot.ts";

describe("OT overnight", () => {
  it("22:00 → 01:00 = 3h (180 min) with 30-min rounding", () => {
    assert.equal(computeOtMinutes({ startTime: "22:00", endTime: "01:00" }), 180);
    assert.equal(computeOtHours({ startTime: "22:00", endTime: "01:00" }), 3);
    assert.equal(isOvernight("22:00", "01:00"), true);
  });

  it("22:00 → 06:00 = 8h", () => {
    assert.equal(computeOtMinutes({ startTime: "22:00", endTime: "06:00" }), 480);
  });

  it("23:30 → 02:30 = 3h", () => {
    assert.equal(computeOtMinutes({ startTime: "23:30", endTime: "02:30" }), 180);
  });

  it("14:00 → 16:20 rounds to 150 min with step 30", () => {
    assert.equal(computeOtMinutes({ startTime: "14:00", endTime: "16:20", roundMinutes: 30 }), 150);
  });

  it("same-day OT is not overnight", () => {
    assert.equal(isOvernight("14:00", "16:00"), false);
  });
});
