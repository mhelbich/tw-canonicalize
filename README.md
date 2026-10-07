# tw-canonicalize

Rewrites Tailwind CSS **v4** class names in your templates to their canonical form, in bulk. These are the fixes the
Tailwind IntelliSense extension offers one by one as `suggestCanonicalClasses` (`min-h-[100px]` → `min-h-25`,
`gap-[10px]` → `gap-2.5`, `max-w-[600px]` → `max-w-150`, …). `npx @tailwindcss/upgrade` only covers a small part of them.

It uses the canonicalizer that ships with Tailwind itself (`canonicalizeCandidates` of the design system loaded via
`@tailwindcss/node`), with the Tailwind version and theme of the project you run it in.
Every rewrite is checked to generate the same CSS before it is applied. It does only this one job: no class sorting, deduplication or linting.

## Usage

```bash
# dry run in the current project (nothing is written)
npx tw-canonicalize

# write the changes
npx tw-canonicalize --apply

# CI: exit code 1 if anything is not canonical
npx tw-canonicalize --check
```

Run it in a project that has Tailwind CSS v4 installed and a clean git tree, then review the diff.

| Option         | Default                         | Description                                                                                 |
| -------------- | ------------------------------- | ------------------------------------------------------------------------------------------- |
| `--css <file>` | auto-detected                   | Entry stylesheet with `@import "tailwindcss"`. Required when several files match (or none). |
| `--root <dir>` | current directory               | Project root.                                                                               |
| `--ext <list>` | `html,vue,svelte,astro,jsx,tsx` | File extensions to process. Add e.g. `ts` (Angular inline templates), `mdx`, `php`, `erb`.  |
| `--rem <px>`   | `16`                            | Root font size for the `px` ↔ `rem` equivalence check.                                      |
| `--apply`      | off (dry run)                   | Write the changes.                                                                          |
| `--check`      | off                             | Exit with code 1 when changes are found. Cannot be combined with `--apply`.                 |
| `--no-verify`  | verification on                 | Also apply rewrites whose generated CSS differs from the original.                          |

Exit codes: `0` ok, `1` changes found under `--check`, `2` error.

## What it does (and does not do)

- Processes **static** `class="…"`, `class='…'` and `className="…"` attributes, in any file with a configured extension.
  The match ignores context, so it also finds them inside JS strings and comments (this is what makes `--ext ts` work for
  Angular inline templates). Files come from `git ls-files` (so `.gitignore` is respected), or a directory walk outside a git repository.
- Never touches dynamic bindings (`:class`, `v-bind:class`, `[ngClass]`, `[class]`, `className={…}`) or values with
  interpolation (`{{ }}`, `${ }`, `{ }`). They are counted and reported as skipped.
- Does not look at class helper calls (`cn(…)`, `clsx(…)`, `cva(…)`, `twMerge(…)`). Their strings are neither rewritten nor counted.
- Does not touch `@apply` or `<style>` blocks.
- **Verifies every rewrite**: the generated CSS declarations of the old and the new class are compared (theme variables
  resolved, `calc(<n> * <n>)` evaluated, `rem` converted to `px`). A rewrite that generates different CSS is reported and
  left alone. Selectors are not compared, only declarations.
- Idempotent: a second run finds nothing.

## Caveats

- It relies on `__unstable__loadDesignSystem` and `canonicalizeCandidates` from `@tailwindcss/node`, which are not a public API.
  Needs **tailwindcss >= 4.1.18**; tested up to 4.3.3. Older versions either fail with a clear message (<= 4.1.14: no
  `canonicalizeCandidates`) or rewrite only part of the classes (4.1.15 - 4.1.17: spacing utilities such as `gap-`/`px-`/`py-`,
  but not e.g. `w-`, `min-h-`, `mt-`, `max-w-`).
- Pixel values become spacing-scale classes (`gap-[10px]` → `gap-2.5` = `0.625rem`). They are identical at the default 16px root
  font size but scale with a changed browser font size, unlike the fixed pixel value.
- One stylesheet (one theme) is used for the whole run. In a monorepo with different themes, run it once per package:
  `--root packages/a --css src/app.css`.
- Tailwind CSS v3 projects are not supported (migrate to v4 first).
- With strict `node_modules` layouts (pnpm) `@tailwindcss/node` is looked up through `@tailwindcss/vite`, `@tailwindcss/postcss`
  and `@tailwindcss/cli`.

## Development

```bash
npm install
npm run typecheck && npm run lint && npm run format:check && npm test
npm run build
```

Run a local checkout against a project:

```bash
npx tsx src/cli.ts --root /path/to/project   # from source
node dist/cli.js --root /path/to/project     # after npm run build
```

To try the packaged tarball: `npm pack`, then `npx --package=./tw-canonicalize-0.1.0.tgz tw-canonicalize` (plain `npx ./file.tgz` treats the path as a command).

Tests run the CLI against `test/fixtures/basic` (copied to the git-ignored `test/.tmp`, so Node resolves this repo's Tailwind).

## Release

1. `npm version patch|minor|major` (runs lint, typecheck and tests, bumps the version, creates the tag), then `git push --follow-tags`.
2. The `Publish` workflow stages the version (`npm stage publish`, stage-only token in the `NPM_TOKEN` secret).
3. Approve it with 2FA: `npm stage list`, then `npm stage approve <stage-id>` (or on npmjs.com).
4. Once it is live on npm, create the GitHub release: `scripts/github-release.sh` (checks npm, then `gh release create` with generated notes).
