import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".git",
  ".nuxt",
  ".output",
  ".next",
  ".angular",
  ".svelte-kit",
  ".turbo",
  ".cache",
]);

/** Lists the files below `root` as absolute paths. Prefers git (honours .gitignore), falls back to a directory walk. */
export function listFiles(root: string): string[] {
  const fromGit = listGitFiles(root);
  return (fromGit.length > 0 ? fromGit : walk(root)).sort();
}

function listGitFiles(root: string): string[] {
  try {
    const output = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output
      .split("\0")
      .filter(Boolean)
      .map((relative) => path.join(root, relative))
      .filter((absolute) => fs.existsSync(absolute));
  } catch {
    // not a git repository, or git is unavailable
    return [];
  }
}

function walk(directory: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) walk(path.join(directory, entry.name), found);
    } else if (entry.isFile()) {
      found.push(path.join(directory, entry.name));
    }
  }
  return found;
}

export function hasExtension(file: string, extensions: readonly string[]): boolean {
  return extensions.includes(path.extname(file).slice(1).toLowerCase());
}
