import path from "node:path";
import { isBelowMinimumVersion, MIN_TAILWIND_VERSION } from "./design-system.js";
import type { RunResult } from "./run.js";

/** Formats a run for the terminal: per-change locations, a summary of distinct rewrites and what was skipped. */
export function formatReport(result: RunResult, root: string): string {
  const lines: string[] = [];
  lines.push(
    `Entry stylesheet: ${path.relative(root, result.entryCss)} (tailwindcss ${result.tailwindVersion ?? "unknown"})`,
  );
  if (isBelowMinimumVersion(result.tailwindVersion)) {
    lines.push(
      `Warning: tailwindcss < ${MIN_TAILWIND_VERSION} only canonicalizes part of the classes. Upgrade for complete results.`,
    );
  }
  lines.push(`Scanned ${result.scannedFiles} files, ${result.attributes} static class attributes`);

  if (result.changes.length > 0) {
    lines.push("");
    for (const change of result.changes) {
      lines.push(`${change.file}:${change.line}  ${change.from} -> ${change.to}`);
    }

    const counts = new Map<string, number>();
    for (const change of result.changes) {
      const key = `${change.from} -> ${change.to}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    lines.push("");
    lines.push(`${result.changes.length} rewrites (${counts.size} distinct) in ${result.changedFiles.length} files:`);
    for (const [key, count] of [...counts].sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(`  ${count}x  ${key}`);
    }
  } else {
    lines.push("");
    lines.push("Nothing to change, all class names are already canonical.");
  }

  if (result.unverified.length > 0) {
    lines.push("");
    lines.push(
      `${result.unverified.length} suggested rewrites generate different CSS and were left alone (use --no-verify to force):`,
    );
    for (const change of result.unverified) {
      lines.push(`  ${change.file}:${change.line}  ${change.from} -> ${change.to}`);
    }
  }

  const skipped: string[] = [];
  if (result.skippedDynamic > 0) skipped.push(`${result.skippedDynamic} dynamic class bindings`);
  if (result.skippedInterpolated > 0) skipped.push(`${result.skippedInterpolated} class attributes with interpolation`);
  if (result.skippedErrors > 0) skipped.push(`${result.skippedErrors} class attributes Tailwind could not process`);
  if (skipped.length > 0) {
    lines.push("");
    lines.push(`Skipped: ${skipped.join(", ")}`);
  }

  if (result.changes.length > 0) {
    lines.push("");
    lines.push(
      result.applied
        ? `Applied to ${result.changedFiles.length} files.`
        : "Dry run, nothing written. Re-run with --apply to write the changes.",
    );
  }
  return lines.join("\n");
}
