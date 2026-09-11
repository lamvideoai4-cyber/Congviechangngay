import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Lot } from "./types.ts";

function canClose(lot: Lot): { ok: boolean; reason?: string } {
  if (lot.status === "CLOSED") return { ok: false, reason: "already-closed" };
  if (!lot.lotCode.trim()) return { ok: false, reason: "missing-code" };
  if (lot.quantity <= 0) return { ok: false, reason: "bad-qty" };
  return { ok: true };
}

describe("lot closing", () => {
  const open: Lot = {
    id: "1",
    lotCode: "LOT-260901-08",
    invoice: "INV-1",
    productCode: "SP-001",
    date: "2026-09-01",
    quantity: 1200,
    status: "OPEN",
    createdAt: 1,
  };

  it("allows closing an open lot", () => {
    assert.equal(canClose(open).ok, true);
  });

  it("rejects a second close", () => {
    assert.equal(canClose({ ...open, status: "CLOSED" }).ok, false);
  });

  it("rejects empty code or zero qty", () => {
    assert.equal(canClose({ ...open, lotCode: "  " }).ok, false);
    assert.equal(canClose({ ...open, quantity: 0 }).ok, false);
  });
});
