export const SKIPPED_DIRS = ['build', 'out', 'cmake-build-*', '.git', 'node_modules', 'third_party', 'external', 'vendor'];
export const SKIPPED_NOTE = `folders not searched: ${SKIPPED_DIRS.join(', ')}`;
export function matcher(q: string): RegExp | null {
  return q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu') : null;
}

export function matchesIn(text: string, q: string, max = 1000): [number, number][] {
  const re = matcher(q), out: [number, number][] = [];
  if (!re) return out;
  for (let m = re.exec(text); m && out.length < max; m = re.exec(text)) out.push([m.index, m.index + m[0].length]);
  return out;
}

export interface Hit { file: string; line: number; col: number; len: number; text: string }

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
