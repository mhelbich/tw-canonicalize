import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isBelowMinimumVersion } from "../src/design-system.js";

describe("isBelowMinimumVersion", () => {
  it("flags versions older than the minimum", () => {
    for (const version of ["4.1.17", "4.1.15", "4.0.17", "3.4.17"])
      assert.equal(isBelowMinimumVersion(version), true, version);
  });

  it("accepts the minimum and newer versions", () => {
    for (const version of ["4.1.18", "4.1.19", "4.2.0", "4.10.0", "5.0.0", "4.3.3-beta.1"]) {
      assert.equal(isBelowMinimumVersion(version), false, version);
    }
  });

  it("does not flag unknown versions", () => {
    assert.equal(isBelowMinimumVersion(undefined), false);
    assert.equal(isBelowMinimumVersion("next"), false);
  });
});
