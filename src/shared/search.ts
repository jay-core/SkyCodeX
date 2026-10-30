// Searches are case-free everywhere: file names, a file's text, the whole folder. A Unicode-aware regular expression
// of the escaped query (not lower-casing, which can change a string's length) keeps match offsets exact.

/** A case-free matcher for the query, or null for an empty one. */
export function matcher(q: string): RegExp | null {
  return q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu') : null;
}

/** Where the query occurs in text: [start, end) pairs, in order. */
export function matchesIn(text: string, q: string, max = 1000): [number, number][] {
  const re = matcher(q), out: [number, number][] = [];
  if (!re) return out;
  for (let m = re.exec(text); m && out.length < max; m = re.exec(text)) out.push([m.index, m.index + m[0].length]);
  return out;
}

export interface Hit { file: string; line: number; col: number; len: number; text: string }

/** One file's matches, line by line; a long line is cut to a window around its first match. */
export function hitsIn(file: string, text: string, q: string, max = 200): Hit[] {
  const re = matcher(q), out: Hit[] = [];
  if (!re) return out;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length && out.length < max; i++) {
    re.lastIndex = 0;
    const m = re.exec(lines[i]);
    if (!m) continue;
    const l = lines[i].replace(/\r$/, ''), from = Math.max(0, m.index - 80);
    out.push({ file, line: i, col: m.index, len: m[0].length, text: (from ? '…' : '') + l.slice(from, from + 240) });
  }
  return out;
}
