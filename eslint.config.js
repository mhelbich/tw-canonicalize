// @ts-check
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

// `import.meta.dirname` needs the `@types/node` global `ImportMeta` augmentation, which
// isn't available in the bare fallback project this file itself lints under (see
// `allowDefaultProject` below) — so resolve it the portable way instead.
const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig(
  globalIgnores(["dist/**", "coverage/**", "test/fixtures/**", "test/.tmp/**"]),
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        // Auto-discovers the right tsconfig per file instead of a hand-maintained `project` glob.
        projectService: {
          // This file itself isn't part of any tsconfig `include` — fall back to a default project for it.
          allowDefaultProject: ["eslint.config.js"],
        },
        tsconfigRootDir,
      },
    },
    rules: {
      // Type-only imports/exports are enforced by `verbatimModuleSyntax` in tsconfig already.
      "@typescript-eslint/consistent-type-imports": "off",
    },
  },
  // node:test registers async tests fire-and-forget; the runner tracks the returned
  // promise itself, so there's nothing for calling code to await.
  {
    files: ["test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
  // Must come last: turns off stylistic rules that would otherwise fight Prettier.
  eslintConfigPrettier,
);
