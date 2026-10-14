import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { isBelowMinimumVersion, resolveTailwindNode } from "../src/design-system.js";

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

describe("resolveTailwindNode", () => {
  const sandboxes: string[] = [];
  after(() => {
    for (const dir of sandboxes) fs.rmSync(dir, { recursive: true, force: true });
  });

  const sandbox = () => {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "tw-canonicalize-")));
    sandboxes.push(dir);
    return dir;
  };

  const writePackage = (dir: string, name: string) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name, version: "4.3.3", main: "index.js" }));
    fs.writeFileSync(path.join(dir, "index.js"), "module.exports = {};");
  };

  const link = (target: string, linkPath: string) => {
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    fs.symlinkSync(target, linkPath, "dir");
  };

  /** pnpm layout: a project that only links `tailwindcss`, with `@tailwindcss/node` hoisted into the virtual store. */
  const pnpmLayout = () => {
    const dir = sandbox();
    const store = path.join(dir, "node_modules", ".pnpm");
    const tailwindcss = path.join(store, "tailwindcss@4.3.3", "node_modules", "tailwindcss");
    const node = path.join(store, "node_modules", "@tailwindcss", "node");
    writePackage(tailwindcss, "tailwindcss");
    writePackage(node, "@tailwindcss/node");
    const project = path.join(dir, "apps", "web");
    fs.mkdirSync(project, { recursive: true });
    fs.writeFileSync(path.join(project, "package.json"), "{}");
    link(tailwindcss, path.join(project, "node_modules", "tailwindcss"));
    return { project, node };
  };

  it("resolves a directly installed @tailwindcss/node", () => {
    const dir = sandbox();
    fs.writeFileSync(path.join(dir, "package.json"), "{}");
    writePackage(path.join(dir, "node_modules", "@tailwindcss", "node"), "@tailwindcss/node");
    assert.equal(resolveTailwindNode(dir), path.join(dir, "node_modules", "@tailwindcss", "node", "index.js"));
  });

  it("finds a hoisted @tailwindcss/node through tailwindcss alone (pnpm, e.g. via @nuxt/ui)", () => {
    const { project, node } = pnpmLayout();
    assert.equal(resolveTailwindNode(project), path.join(node, "index.js"));
  });

  it("throws when the project has no Tailwind at all", () => {
    const dir = sandbox();
    fs.writeFileSync(path.join(dir, "package.json"), "{}");
    assert.throws(() => resolveTailwindNode(dir), /Could not resolve @tailwindcss\/node/);
  });
});
