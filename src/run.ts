import fs from "node:fs";
import path from "node:path";
import { loadDesignSystem } from "./design-system.js";
import { resolveEntryCss } from "./entry.js";
import { hasExtension, listFiles } from "./files.js";
import { rewriteSource } from "./rewrite.js";

export interface RunOptions {
  root: string;
  css?: string | undefined;
  extensions: readonly string[];
  rem: number;
  apply: boolean;
  verify: boolean;
}

export interface Change {
  /** Path relative to the root. */
  file: string;
  line: number;
  from: string;
  to: string;
}

export interface RunResult {
  entryCss: string;
  tailwindVersion: string | undefined;
  scannedFiles: number;
  attributes: number;
  changes: Change[];
  /** Rewrites Tailwind suggested but that did not generate the same CSS. They are never applied while verification is on. */
  unverified: Change[];
  skippedInterpolated: number;
  skippedDynamic: number;
  /** Attributes Tailwind could not process. */
  skippedErrors: number;
  changedFiles: string[];
  applied: boolean;
}

export async function run(options: RunOptions): Promise<RunResult> {
  const root = path.resolve(options.root);
  const files = listFiles(root);
  const entryCss = resolveEntryCss(root, options.css, files);
  const { ds, tailwindVersion } = await loadDesignSystem(root, entryCss);

  const result: RunResult = {
    entryCss,
    tailwindVersion,
    scannedFiles: 0,
    attributes: 0,
    changes: [],
    unverified: [],
    skippedInterpolated: 0,
    skippedDynamic: 0,
    skippedErrors: 0,
    changedFiles: [],
    applied: options.apply,
  };

  for (const file of files) {
    if (!hasExtension(file, options.extensions)) continue;
    const relative = path.relative(root, file);
    const rewrite = rewriteSource(ds, fs.readFileSync(file, "utf8"), options);

    result.scannedFiles++;
    result.attributes += rewrite.attributes;
    result.skippedInterpolated += rewrite.skippedInterpolated;
    result.skippedDynamic += rewrite.skippedDynamic;
    result.skippedErrors += rewrite.skippedErrors;
    result.changes.push(...rewrite.changes.map((change) => ({ file: relative, ...change })));
    result.unverified.push(...rewrite.unverified.map((change) => ({ file: relative, ...change })));

    if (rewrite.source !== null) {
      result.changedFiles.push(relative);
      if (options.apply) fs.writeFileSync(file, rewrite.source);
    }
  }

  return result;
}
