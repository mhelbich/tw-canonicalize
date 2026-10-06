import fs from "node:fs";
import path from "node:path";

// Matches `@import "tailwindcss"`, `@import "tailwindcss/theme.css" layer(theme)` and `@import url("tailwindcss")`.
const TAILWIND_IMPORT = /@import\s+(?:url\(\s*)?["']tailwindcss(?:\/[^"']*)?["']/;

/** CSS files that import Tailwind CSS v4 (`@import "tailwindcss"`), i.e. candidates for the entry stylesheet. */
export function findEntryCandidates(files: readonly string[]): string[] {
  return files.filter((file) => file.endsWith(".css") && TAILWIND_IMPORT.test(fs.readFileSync(file, "utf8")));
}

/** Returns the absolute path of the entry stylesheet: `css` if given, else the only candidate among `files`. */
export function resolveEntryCss(root: string, css: string | undefined, files: readonly string[]): string {
  if (css) {
    const resolved = path.resolve(root, css);
    if (!fs.existsSync(resolved)) throw new Error(`Entry stylesheet not found: ${resolved}`);
    return resolved;
  }
  const candidates = findEntryCandidates(files);
  if (candidates.length === 1 && candidates[0]) return candidates[0];
  if (candidates.length === 0) {
    throw new Error(
      `No stylesheet with @import "tailwindcss" found below ${root}. Pass it with --css <file>. (Tailwind CSS v3 projects are not supported.)`,
    );
  }
  const list = candidates.map((candidate) => `  ${path.relative(root, candidate)}`).join("\n");
  throw new Error(`Several stylesheets import Tailwind CSS, pass one with --css <file>:\n${list}`);
}
