import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/** The subset of Tailwind's (unstable) design system API this tool relies on. */
export interface DesignSystem {
  canonicalizeCandidates(candidates: string[], options?: { rem?: number }): string[];
  candidatesToCss(classes: string[]): (string | null)[];
  resolveThemeValue(path: string, forceInline?: boolean): string | undefined;
}

interface TailwindNode {
  __unstable__loadDesignSystem?: (css: string, options: { base: string }) => Promise<DesignSystem>;
}

export interface LoadedDesignSystem {
  ds: DesignSystem;
  tailwindVersion: string | undefined;
}

// Packages that depend on @tailwindcss/node. With strict layouts (pnpm) it is not resolvable from the project root directly.
const NODE_PROVIDERS = ["@tailwindcss/vite", "@tailwindcss/postcss", "@tailwindcss/cli"];

/** Resolves `@tailwindcss/node` from the target project, so each repo is processed with its own Tailwind version. */
export function resolveTailwindNode(root: string): string {
  const projectRequire = createRequire(path.join(root, "package.json"));
  try {
    return projectRequire.resolve("@tailwindcss/node");
  } catch {
    // fall through to the packages that bring it in
  }
  for (const provider of NODE_PROVIDERS) {
    try {
      return createRequire(projectRequire.resolve(provider)).resolve("@tailwindcss/node");
    } catch {
      // try the next one
    }
  }
  throw new Error(
    `Could not resolve @tailwindcss/node from ${root}. Run the package manager install in the project first, and make sure it uses Tailwind CSS v4 (tailwindcss with @tailwindcss/vite, @tailwindcss/postcss or @tailwindcss/cli).`,
  );
}

/** First Tailwind release whose canonicalizer covers the full set of utilities (4.1.15 - 4.1.17 only handle some). */
export const MIN_TAILWIND_VERSION = "4.1.18";

/** True when `version` is a plain `major.minor.patch` older than {@link MIN_TAILWIND_VERSION}. Unknown formats are not flagged. */
export function isBelowMinimumVersion(version: string | undefined): boolean {
  const parse = (value: string) => /^(\d+)\.(\d+)\.(\d+)/.exec(value)?.slice(1).map(Number);
  const actual = version === undefined ? undefined : parse(version);
  const minimum = parse(MIN_TAILWIND_VERSION);
  if (!actual || !minimum) return false;
  for (let index = 0; index < 3; index++) {
    const difference = (actual[index] ?? 0) - (minimum[index] ?? 0);
    if (difference !== 0) return difference < 0;
  }
  return false;
}

export function readTailwindVersion(root: string): string | undefined {
  try {
    const manifest = createRequire(path.join(root, "package.json")).resolve("tailwindcss/package.json");
    return (JSON.parse(fs.readFileSync(manifest, "utf8")) as { version?: string }).version;
  } catch {
    return undefined;
  }
}

export async function loadDesignSystem(root: string, entryCss: string): Promise<LoadedDesignSystem> {
  const tailwindVersion = readTailwindVersion(root);
  const nodePath = resolveTailwindNode(root);
  const tailwindNode = createRequire(nodePath)(nodePath) as TailwindNode;
  const load = tailwindNode.__unstable__loadDesignSystem;
  if (typeof load !== "function") {
    throw new Error(
      `@tailwindcss/node (tailwindcss ${tailwindVersion ?? "unknown"}) has no __unstable__loadDesignSystem. This tool needs Tailwind CSS v4.`,
    );
  }
  const ds = await load(fs.readFileSync(entryCss, "utf8"), { base: path.dirname(entryCss) });
  if (typeof ds.canonicalizeCandidates !== "function") {
    throw new Error(
      `tailwindcss ${tailwindVersion ?? "unknown"} has no canonicalizeCandidates. Upgrade to a newer Tailwind CSS 4.x release.`,
    );
  }
  return { ds, tailwindVersion };
}
