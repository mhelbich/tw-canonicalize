import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalizeValue } from "../src/canonicalize.js";

// Mimics Tailwind: rewrites `px-[10px]` and drops duplicates from the result.
const dedupingDesignSystem = {
  canonicalizeCandidates: (candidates: string[]) => [
    ...new Set(candidates.map((candidate) => (candidate === "px-[10px]" ? "px-2.5" : candidate))),
  ],
};

describe("canonicalizeValue", () => {
  it("rewrites a value and keeps its whitespace", () => {
    const result = canonicalizeValue(dedupingDesignSystem, "flex \n  px-[10px]", 16);
    assert.equal(result?.value, "flex \n  px-2.5");
    assert.deepEqual(result?.changes, [{ from: "px-[10px]", to: "px-2.5" }]);
  });

  it("handles duplicate classes that Tailwind removes from its result", () => {
    const result = canonicalizeValue(dedupingDesignSystem, "px-[10px]  px-[10px] flex", 16);
    assert.equal(result?.value, "px-2.5  px-2.5 flex");
    assert.equal(result?.changes.length, 2);
  });

  it("returns null when Tailwind throws", () => {
    const failing = {
      canonicalizeCandidates: () => {
        throw new Error("boom");
      },
    };
    assert.equal(canonicalizeValue(failing, "flex", 16), null);
  });

  it("skips changes the accept callback rejects", () => {
    const result = canonicalizeValue(dedupingDesignSystem, "px-[10px]", 16, () => false);
    assert.equal(result?.value, "px-[10px]");
    assert.deepEqual(result?.changes, []);
  });
});
