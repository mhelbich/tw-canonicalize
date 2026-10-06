#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { formatReport } from "./report.js";
import { run } from "./run.js";

const DEFAULT_EXTENSIONS = ["html", "vue", "svelte", "astro", "jsx", "tsx"];

const HELP = `tw-canonicalize [options]

Rewrites Tailwind CSS v4 class names in templates to their canonical form (the "suggestCanonicalClasses"
fixes of the Tailwind IntelliSense extension, in bulk). Dry run by default.

Options:
  --css <file>       Entry stylesheet importing Tailwind (auto-detected when exactly one file has @import "tailwindcss")
  --root <dir>       Project root, default: current directory
  --ext <list>       Comma-separated file extensions, default: ${DEFAULT_EXTENSIONS.join(",")}
  --rem <px>         Root font size used for rem conversions, default: 16
  --apply            Write the changes to disk
  --check            Exit with code 1 when changes are found (for CI)
  --no-verify        Also apply rewrites whose generated CSS differs from the original
  -h, --help         Show this help
  -v, --version      Show the version

Only static class="…" / className="…" attributes are rewritten. Dynamic bindings are never touched.`;

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      css: { type: "string" },
      root: { type: "string" },
      ext: { type: "string" },
      rem: { type: "string" },
      apply: { type: "boolean", default: false },
      check: { type: "boolean", default: false },
      "no-verify": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.log(HELP);
    return 0;
  }
  if (values.version) {
    console.log(await readVersion());
    return 0;
  }

  const rem = values.rem === undefined ? 16 : Number(values.rem);
  if (!Number.isFinite(rem) || rem <= 0) throw new Error(`Invalid --rem value: ${values.rem}`);
  if (values.apply && values.check) throw new Error("--apply and --check cannot be combined.");

  const root = path.resolve(values.root ?? process.cwd());
  const extensions = (values.ext ?? DEFAULT_EXTENSIONS.join(","))
    .split(",")
    .map((extension) => extension.trim().replace(/^\./, "").toLowerCase())
    .filter(Boolean);

  const result = await run({
    root,
    css: values.css,
    extensions,
    rem,
    apply: values.apply,
    verify: !values["no-verify"],
  });
  console.log(formatReport(result, root));
  return values.check && result.changes.length > 0 ? 1 : 0;
}

async function readVersion(): Promise<string> {
  const manifest = new URL("../package.json", import.meta.url);
  return (JSON.parse(await readFile(manifest, "utf8")) as { version: string }).version;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(`tw-canonicalize: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  },
);
