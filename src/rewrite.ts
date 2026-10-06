import { canonicalizeValue } from "./canonicalize.js";
import type { DesignSystem } from "./design-system.js";
import { extractClassAttributes } from "./extract.js";
import { isEquivalent } from "./verify.js";

export interface LocatedChange {
  line: number;
  from: string;
  to: string;
}

export interface RewriteResult {
  /** The rewritten source, or `null` when nothing changed. */
  source: string | null;
  attributes: number;
  changes: LocatedChange[];
  /** Suggested rewrites that generate different CSS and were left alone. */
  unverified: LocatedChange[];
  skippedInterpolated: number;
  skippedDynamic: number;
  /** Attributes Tailwind could not process. */
  skippedErrors: number;
}

export interface RewriteOptions {
  rem: number;
  verify: boolean;
}

/** Canonicalizes the static class attributes of one file's source. Pure: reads and writes nothing. */
export function rewriteSource(ds: DesignSystem, source: string, options: RewriteOptions): RewriteResult {
  const extraction = extractClassAttributes(source);
  const result: RewriteResult = {
    source: null,
    attributes: extraction.attributes.length,
    changes: [],
    unverified: [],
    skippedInterpolated: extraction.interpolated,
    skippedDynamic: extraction.dynamic,
    skippedErrors: 0,
  };

  const replacements: { start: number; end: number; value: string }[] = [];
  for (const attribute of extraction.attributes) {
    const canonical = canonicalizeValue(ds, attribute.value, options.rem, (change) => {
      if (!options.verify || isEquivalent(ds, change.from, change.to, options.rem)) return true;
      result.unverified.push({ line: attribute.line, ...change });
      return false;
    });
    if (canonical === null) {
      result.skippedErrors++;
      continue;
    }
    if (canonical.changes.length === 0) continue;
    result.changes.push(...canonical.changes.map((change) => ({ line: attribute.line, ...change })));
    replacements.push({ start: attribute.start, end: attribute.end, value: canonical.value });
  }

  if (replacements.length > 0) {
    // Apply from the end so earlier offsets stay valid.
    let rewritten = source;
    for (const { start, end, value } of replacements.reverse()) {
      rewritten = rewritten.slice(0, start) + value + rewritten.slice(end);
    }
    result.source = rewritten;
  }
  return result;
}
