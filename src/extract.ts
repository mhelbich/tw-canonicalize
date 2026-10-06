export interface ClassAttribute {
  /** Offset of the first character of the value (right after the opening quote). */
  start: number;
  /** Offset right after the last character of the value (at the closing quote). */
  end: number;
  value: string;
  line: number;
}

export interface Extraction {
  attributes: ClassAttribute[];
  /** `class="…"` values skipped because they contain interpolation (`{{ }}`, `${ }`, `{ }`). */
  interpolated: number;
  /** Dynamic bindings that are never touched (`:class`, `[ngClass]`, `[class]`, `className={…}`). */
  dynamic: number;
}

// Static class attributes only. The lookbehind rejects `:class`, `v-bind:class`, `[class]`, `data-class`, `.class` and identifiers ending in "class".
const STATIC_CLASS = /(?<![\w:.\-@#$[])(?:class|className)\s*=\s*(["'])([\s\S]*?)\1/g;
const DYNAMIC_CLASS =
  /(?:(?<![\w.\-@#$])(?::class|v-bind:class|\[ngClass\]|\[class(?:\.[\w.-]+)?\])\s*=|(?<![\w:.\-@#$[])className\s*=\s*\{)/g;

export function extractClassAttributes(source: string): Extraction {
  const lineStarts = [0];
  for (let index = source.indexOf("\n"); index !== -1; index = source.indexOf("\n", index + 1)) {
    lineStarts.push(index + 1);
  }

  const attributes: ClassAttribute[] = [];
  let interpolated = 0;
  for (const match of source.matchAll(STATIC_CLASS)) {
    const value = match[2] ?? "";
    if (/[{}]/.test(value)) {
      interpolated++;
      continue;
    }
    const start = match.index + match[0].indexOf(value, match[0].indexOf("=") + 1);
    attributes.push({ start, end: start + value.length, value, line: lineOf(lineStarts, start) });
  }

  return { attributes, interpolated, dynamic: [...source.matchAll(DYNAMIC_CLASS)].length };
}

function lineOf(lineStarts: readonly number[], offset: number): number {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((lineStarts[middle] ?? 0) <= offset) low = middle;
    else high = middle - 1;
  }
  return low + 1;
}
