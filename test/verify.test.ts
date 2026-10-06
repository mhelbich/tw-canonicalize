import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isEquivalent } from "../src/verify.js";

const css: Record<string, string> = {
  "gap-[10px]": ".gap-\\[10px\\] {\n  gap: 10px;\n}\n",
  "gap-2.5": ".gap-2\\.5 {\n  gap: calc(var(--spacing) * 2.5);\n}\n",
  "gap-3": ".gap-3 {\n  gap: calc(var(--spacing) * 3);\n}\n",
  "h-[100%]": ".h-\\[100\\%\\] {\n  height: 100%;\n}\n",
  "h-full": ".h-full {\n  height: 100%;\n}\n",
  "xl:max-w-screen-2xl":
    "@media (width >= 80rem) {\n  .xl\\:max-w-screen-2xl {\n    max-width: var(--breakpoint-2xl);\n  }\n}\n",
  "xl:max-w-(--breakpoint-2xl)":
    "@media (width >= 80rem) {\n  .xl\\:max-w-\\(--breakpoint-2xl\\) {\n    max-width: var(--breakpoint-2xl);\n  }\n}\n",
  "hover:p-1":
    ".hover\\:p-1 {\n  &:hover {\n    @media (hover: hover) {\n      padding: calc(var(--spacing) * 1);\n    }\n  }\n}\n",
  "hover:p-[4px]":
    ".hover\\:p-\\[4px\\] {\n  &:hover {\n    @media (hover: hover) {\n      padding: 4px;\n    }\n  }\n}\n",
};

const ds = {
  candidatesToCss: (classes: string[]) => classes.map((name) => css[name] ?? null),
  resolveThemeValue: (name: string) => ({ "--spacing": "0.25rem", "--breakpoint-2xl": "96rem" })[name],
};

describe("isEquivalent", () => {
  it("treats spacing scale values as equal to their pixel form at 16px", () => {
    assert.equal(isEquivalent(ds, "gap-[10px]", "gap-2.5", 16), true);
  });

  it("detects a different value", () => {
    assert.equal(isEquivalent(ds, "gap-[10px]", "gap-3", 16), false);
  });

  it("depends on the root font size", () => {
    assert.equal(isEquivalent(ds, "gap-[10px]", "gap-2.5", 20), false);
  });

  it("compares percentages and keywords", () => {
    assert.equal(isEquivalent(ds, "h-[100%]", "h-full", 16), true);
  });

  it("ignores wrapping media queries and renamed selectors", () => {
    assert.equal(isEquivalent(ds, "xl:max-w-screen-2xl", "xl:max-w-(--breakpoint-2xl)", 16), true);
  });

  it("handles nested variant output", () => {
    assert.equal(isEquivalent(ds, "hover:p-1", "hover:p-[4px]", 16), true);
  });

  it("is false when a class generates no CSS", () => {
    assert.equal(isEquivalent(ds, "gap-[10px]", "not-a-class", 16), false);
  });
});
