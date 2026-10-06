import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { run } from "../src/run.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, "fixtures", "basic");
const scratch = path.join(here, ".tmp");
const cli = path.join(here, "..", "src", "cli.ts");
const extensions = ["html", "vue", "svelte", "astro", "jsx", "tsx"];

// Copies live inside the repo (git-ignored) so Node still resolves the repo's own Tailwind from them.
function copyFixture(): string {
  fs.mkdirSync(scratch, { recursive: true });
  const target = fs.mkdtempSync(path.join(scratch, "basic-"));
  fs.cpSync(fixture, target, { recursive: true });
  return target;
}

after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const rewrites = (changes: { from: string; to: string }[]) =>
  changes.map((change) => `${change.from} -> ${change.to}`).sort();

describe("run", () => {
  it("lists canonical rewrites without touching files in a dry run", async () => {
    const root = copyFixture();
    const before = fs.readFileSync(path.join(root, "index.html"), "utf8");
    const result = await run({ root, extensions, rem: 16, apply: false, verify: true });

    assert.deepEqual(rewrites(result.changes), [
      "gap-[10px] -> gap-2.5",
      "max-w-[600px] -> max-w-150",
      "min-h-[100px] -> min-h-25",
      "mt-[5px] -> mt-1.25",
      "mt-[5px] -> mt-1.25",
      "px-[10px] -> px-2.5",
      "py-[20px] -> py-5",
      "w-[400px] -> w-100",
      "w-[400px] -> w-100",
    ]);
    assert.deepEqual(result.unverified, []);
    assert.equal(result.skippedInterpolated, 1);
    assert.equal(result.skippedDynamic, 3);
    assert.equal(result.applied, false);
    assert.equal(fs.readFileSync(path.join(root, "index.html"), "utf8"), before);
  });

  it("reports file and line of each change", async () => {
    const result = await run({ root: copyFixture(), extensions, rem: 16, apply: false, verify: true });
    const change = result.changes.find((candidate) => candidate.from === "min-h-[100px]");
    assert.equal(change?.file, "index.html");
    assert.equal(change?.line, 1);
  });

  it("applies the rewrites and is idempotent", async () => {
    const root = copyFixture();
    const first = await run({ root, extensions, rem: 16, apply: true, verify: true });
    assert.equal(first.changes.length, 9);

    const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
    assert.match(html, /class="min-h-25 gap-2\.5 flex"/);
    assert.match(html, /class="a \{\{ b \}\} gap-\[10px\]"/, "interpolated attributes stay untouched");
    assert.match(html, /\[ngClass\]="\{ 'py-\[20px\]': a \}"/, "bindings stay untouched");
    assert.match(html, /class='w-100'/, "quote style is preserved");
    assert.match(html, /text-brand-500/, "custom theme colors survive");
    assert.match(
      fs.readFileSync(path.join(root, "src", "App.vue"), "utf8"),
      /class="w-100 mt-1\.25" :class="\{ 'h-\[300px\]': a \}"/,
    );
    assert.match(
      fs.readFileSync(path.join(root, "src", "Comp.tsx"), "utf8"),
      /className="max-w-150 px-2\.5" data-class="gap-\[10px\]"/,
    );
    assert.match(
      fs.readFileSync(path.join(root, "src", "notes.txt"), "utf8"),
      /gap-\[10px\]/,
      "other extensions stay untouched",
    );

    const second = await run({ root, extensions, rem: 16, apply: true, verify: true });
    assert.deepEqual(second.changes, []);
    assert.deepEqual(second.changedFiles, []);
  });

  it("only processes the requested extensions", async () => {
    const result = await run({ root: copyFixture(), extensions: ["vue"], rem: 16, apply: false, verify: true });
    assert.deepEqual(rewrites(result.changes), ["mt-[5px] -> mt-1.25", "w-[400px] -> w-100"]);
  });

  it("fails clearly when no entry stylesheet exists", async () => {
    const root = copyFixture();
    fs.rmSync(path.join(root, "app.css"));
    await assert.rejects(
      run({ root, extensions, rem: 16, apply: false, verify: true }),
      /No stylesheet with @import "tailwindcss"/,
    );
  });

  it("asks for --css when several stylesheets import Tailwind", async () => {
    const root = copyFixture();
    fs.writeFileSync(path.join(root, "other.css"), '@import "tailwindcss";\n');
    await assert.rejects(run({ root, extensions, rem: 16, apply: false, verify: true }), /Several stylesheets/);
    const result = await run({ root, css: "app.css", extensions, rem: 16, apply: false, verify: true });
    assert.equal(result.changes.length, 9);
  });
});

describe("cli", () => {
  const invoke = (args: string[]) =>
    spawnSync(process.execPath, ["--import", "tsx", cli, ...args], { encoding: "utf8" });

  it("prints help", () => {
    const result = invoke(["--help"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /--apply/);
  });

  it("exits with 1 under --check when changes exist, without writing", () => {
    const root = copyFixture();
    const result = invoke(["--root", root, "--check"]);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /min-h-\[100px\] -> min-h-25/);
    assert.match(fs.readFileSync(path.join(root, "index.html"), "utf8"), /min-h-\[100px\]/);
  });

  it("exits with 0 after --apply and then reports nothing to change", () => {
    const root = copyFixture();
    assert.equal(invoke(["--root", root, "--apply"]).status, 0);
    const again = invoke(["--root", root, "--check"]);
    assert.equal(again.status, 0, again.stderr);
    assert.match(again.stdout, /Nothing to change/);
  });

  it("exits with 2 on an unusable root", () => {
    const result = invoke(["--root", scratch]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /tw-canonicalize:/);
  });

  it("rejects --apply together with --check", () => {
    assert.equal(invoke(["--apply", "--check"]).status, 2);
  });
});
