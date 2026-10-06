import type { DesignSystem } from "./design-system.js";

type VerifyContext = Pick<DesignSystem, "candidatesToCss" | "resolveThemeValue">;

/**
 * Checks that two class names generate the same CSS declarations.
 *
 * Selectors and wrapping at-rules are ignored. Theme variables are resolved, simple `calc(<n> * <n>)` expressions are
 * evaluated and `rem` is converted to `px`, so `gap-[10px]` and `gap-2.5` compare equal at the given root font size.
 */
export function isEquivalent(ds: VerifyContext, from: string, to: string, rem: number): boolean {
  const [fromCss, toCss] = ds.candidatesToCss([from, to]);
  if (fromCss == null || toCss == null) return false;
  const left = declarations(ds, fromCss, rem);
  const right = declarations(ds, toCss, rem);
  return (
    left.length > 0 && left.length === right.length && left.every((declaration, index) => declaration === right[index])
  );
}

function declarations(ds: VerifyContext, css: string, rem: number): string[] {
  // Dropping everything in front of an opening brace removes selectors and at-rule preludes, leaving `{ prop: value; }` blocks.
  const body = css.replace(/[^{};]*\{/g, "{");
  const found: string[] = [];
  for (const match of body.matchAll(/([\w-]+)\s*:\s*([^;{}]+)/g)) {
    found.push(`${match[1] ?? ""}:${normalizeValue(ds, match[2] ?? "", rem)}`);
  }
  return found.sort();
}

function normalizeValue(ds: VerifyContext, raw: string, rem: number): string {
  let value = raw.trim().toLowerCase();

  // Resolve theme variables (`var(--spacing)`), a few passes for variables that reference other variables.
  for (let pass = 0; pass < 5; pass++) {
    const next = value.replace(
      /var\((--[\w-]+)\)/g,
      (whole, name: string) => ds.resolveThemeValue(name)?.toLowerCase() ?? whole,
    );
    if (next === value) break;
    value = next;
  }

  value = value.replace(
    /calc\(\s*(-?[\d.]+)(rem|px)?\s*\*\s*(-?[\d.]+)\s*\)/g,
    (_whole, a: string, unit: string | undefined, b: string) => {
      return `${format(Number(a) * Number(b))}${unit ?? ""}`;
    },
  );
  value = value.replace(/(-?[\d.]+)rem\b/g, (_whole, amount: string) => `${format(Number(amount) * rem)}px`);

  return value.replace(/\s+/g, "");
}

function format(amount: number): string {
  return String(Number(amount.toFixed(4)));
}
