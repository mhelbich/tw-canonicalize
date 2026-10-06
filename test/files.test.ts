import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { hasExtension, listFiles } from "../src/files.js";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "tw-canonicalize-files-"));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

function write(root: string, relative: string, content = ""): void {
  fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
  fs.writeFileSync(path.join(root, relative), content);
}

const names = (root: string) => listFiles(root).map((file) => path.relative(root, file));

describe("listFiles", () => {
  it("uses git in a repository: honours .gitignore and includes untracked files", () => {
    const root = fs.mkdtempSync(path.join(scratch, "git-"));
    execFileSync("git", ["init", "-q"], { cwd: root });
    // "vendor" is not in the walk's built-in ignore list, so only git can exclude it.
    write(root, ".gitignore", "vendor/\n");
    write(root, "src/a.html");
    write(root, "vendor/c.html");

    assert.deepEqual(names(root), [".gitignore", "src/a.html"]);
  });

  it("walks the directory outside a repository and skips well-known build directories", () => {
    const root = fs.mkdtempSync(path.join(scratch, "walk-"));
    write(root, "src/a.html");
    write(root, "node_modules/pkg/b.html");
    write(root, "dist/c.html");

    assert.deepEqual(names(root), ["src/a.html"]);
  });
});

describe("hasExtension", () => {
  it("matches case-insensitively without the dot", () => {
    assert.equal(hasExtension("/x/App.TSX", ["tsx"]), true);
    assert.equal(hasExtension("/x/notes.txt", ["tsx"]), false);
  });
});
