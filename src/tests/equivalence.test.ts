// Speed changes that must not change a single result: each new implementation against the one it replaced
// (copied here as it was), on real sources and on many random inputs.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { lineOf, addressTaken, addressCandidates } from '../shared/flowcore';

const oldLineOf = (text: string, off: number) => { let n = 0; for (let i = 0; i < off && i < text.length; i++) if (text.charCodeAt(i) === 10) n++; return n; };
function oldAddressTaken(text: string, names: Set<string>): Set<string> {
  const out = new Set<string>();
  const clean = text.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ').replace(/"(?:\\.|[^"\\])*"/g, '""');
  for (const m of clean.matchAll(/(?:[=,({]|\breturn)\s*&?\s*(?:\w+::)*([A-Za-z_]\w*)\s*(?=[,;)}])/g)) if (names.has(m[1])) out.add(m[1]);
  return out;
}

/** Every C/C++ file of the samples. */
const sources = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? (e.name === 'build' || e.name.startsWith('.') ? [] : sources(p)) : /\.(c|cc|cpp|h|hpp)$/.test(e.name) ? [p] : [];
});
const texts = sources(path.join(__dirname, '../../samples')).map((f) => fs.readFileSync(f, 'utf8'));
let seed = 7;
const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
const randomText = () => Array.from({ length: rnd(400) }, () => '\n\nab;=(&f, g)\r\n{x}//c\n"s"/*q*/'[rnd(28)]).join('');

describe('lineOf (newline offsets, binary search)', () => {
  it('gives the old answer at every offset of real sources, including past the end and before the start', () => {
    expect(texts.length).toBeGreaterThan(10);
    for (const t of texts) for (let off = -2; off <= t.length + 2; off++) if (lineOf(t, off) !== oldLineOf(t, off)) throw new Error(`differs at ${off}`);
  });
  it('gives the old answer on random texts, alternating between texts', () => {
    const ts = Array.from({ length: 60 }, randomText);
    for (let k = 0; k < 20000; k++) { const t = ts[rnd(ts.length)], off = rnd(t.length + 4) - 2; expect(lineOf(t, off)).toBe(oldLineOf(t, off)); }
    expect(lineOf('a\nb', NaN)).toBe(oldLineOf('a\nb', NaN));
  });
});

describe('addressTaken (candidates per file, then the names)', () => {
  it('gives the old set, in the old order, on real sources and random texts', () => {
    for (const t of [...texts, ...Array.from({ length: 300 }, randomText)]) {
      const cands = addressCandidates(t), names = new Set([...cands.filter((_, i) => i % 2 === 0), 'f', 'g', 'main']);
      expect([...addressTaken(t, names)]).toEqual([...oldAddressTaken(t, names)]);
    }
  });
});

describe('the order of what a call through a pointer could reach', () => {
  it('sorting on precomputed keys with one collator equals the old comparator', () => {
    const words = ['on_get', 'On_post', 'worker', 'éclair', 'Zeta', 'alpha', 'alpha2', '_x', 'b10', 'b9', 'ß', 'a'];
    for (let k = 0; k < 300; k++) {
      const t = Array.from({ length: rnd(30) }, () => [words[rnd(words.length)] + (rnd(3) ? '' : rnd(9)), Array.from({ length: rnd(3) }, () => ['/p/src/a.c', '/p/lib/b.c', '/p/src/sub/c.c'][rnd(3)])] as [string, string[]]);
      const dir = ['/p/src', '/p/lib', ''][rnd(3)];
      const old = [...t].sort((a, b) => +!a[1].some((f) => f.startsWith(dir)) - +!b[1].some((f) => f.startsWith(dir)) || a[0].localeCompare(b[0])).map(([n]) => n).slice(0, 12);
      const coll = new Intl.Collator();
      const now = t.map(([n, files]) => ({ n, far: +!files.some((f) => f.startsWith(dir)) })).sort((a, b) => a.far - b.far || coll.compare(a.n, b.n)).map((x) => x.n).slice(0, 12);
      expect(now).toEqual(old);
    }
  });
});
