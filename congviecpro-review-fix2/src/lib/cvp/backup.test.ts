import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectDuplicates } from "./dupes.ts";

describe("duplicate detection", () => {
  it("finds rows with the same id", () => {
    const incoming = [
      { id: "a", name: "1" },
      { id: "b", name: "2" },
      { id: "c", name: "3" },
    ];
    const existing = [
      { id: "b", name: "old" },
      { id: "d", name: "4" },
    ];
    const dups = detectDuplicates(incoming, existing);
    assert.deepEqual(dups.map((d) => d.id), ["b"]);
  });

  it("returns empty when no overlap", () => {
    assert.equal(detectDuplicates([{ id: "x" }], [{ id: "y" }]).length, 0);
  });
});
