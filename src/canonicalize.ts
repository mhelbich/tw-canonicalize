import type { DesignSystem } from "./design-system.js";

export interface TokenChange {
  from: string;
  to: string;
}

export interface CanonicalizedValue {
  value: string;
  changes: TokenChange[];
}

/**
 * Canonicalizes every class in a `class="…"` value. Whitespace between the classes is preserved.
 * Returns `null` if Tailwind throws, so the caller can skip the attribute.
 */
export function canonicalizeValue(
  ds: Pick<DesignSystem, "canonicalizeCandidates">,
  value: string,
  rem: number,
  accept: (change: TokenChange) => boolean = () => true,
): CanonicalizedValue | null {
  const parts = value.split(/(\s+)/);
  const tokens = parts.filter((part) => part.trim() !== "");
  if (tokens.length === 0) return { value, changes: [] };

  const canonical = canonicalizeTokens(ds, tokens, rem);
  if (canonical === null) return null;

  const changes: TokenChange[] = [];
  let index = 0;
  const rebuilt = parts.map((part) => {
    if (part.trim() === "") return part;
    const to = canonical[index++] ?? part;
    if (to === part) return part;
    const change = { from: part, to };
    if (!accept(change)) return part;
    changes.push(change);
    return to;
  });
  return { value: rebuilt.join(""), changes };
}

/**
 * Tailwind drops duplicates from its result (`["a", "a"]` gives `["a"]`), so the output of one batch call cannot be
 * matched to the input by position. In that case fall back to one call per class, which always returns one class.
 */
function canonicalizeTokens(
  ds: Pick<DesignSystem, "canonicalizeCandidates">,
  tokens: string[],
  rem: number,
): string[] | null {
  try {
    const batch = ds.canonicalizeCandidates(tokens, { rem });
    if (batch.length === tokens.length) return batch;

    const single: string[] = [];
    for (const token of tokens) {
      const [canonical, ...rest] = ds.canonicalizeCandidates([token], { rem });
      if (canonical === undefined || rest.length > 0) return null;
      single.push(canonical);
    }
    return single;
  } catch {
    return null;
  }
}
