import { describe, it, expect } from 'vitest';
import { grid, dotX, dotY, level, parts, ready, type BarPart, type LoadInputs } from '../renderer/lib/loadbar';

const G = grid(0, 55.2, 15, 0.55, 2.3);
const dots = () => { const out: { x: number; y: number }[] = []; for (let c = 0; c <= G.cols; c++) for (let r = 0; r <= G.rows; r++) out.push({ x: dotX(G, c), y: dotY(G, r) }); return out; };
const run = (fill: number | null): BarPart => ({ state: 'run', fill });
const base: LoadInputs = { lsp: 'ready', built: true, indexing: false, index: null, settling: false, retrying: false, entry: { state: 'done' }, trace: { state: 'done' }, read: { state: 'done' } };

describe('P5.B.1 the fill tells the truth', () => {
  it('(a) lights nothing at 0 %', () => {
    for (const d of dots()) expect(level(G, run(0), d.x, d.y, 0)).toBe(0);
  });
  it('(b) waiting lights nothing and done lights every dot fully', () => {
    for (const d of dots()) {
      expect(level(G, { state: 'wait', fill: null }, d.x, d.y, 0.3)).toBe(0);
      expect(level(G, { state: 'done', fill: null }, d.x, d.y, 0.3)).toBe(1);
    }
  });
  it('lights every dot fully at 100 % and some at 1/91 and 37/91', () => {
    for (const d of dots()) expect(level(G, run(1), d.x, d.y, 0)).toBe(1);
    for (const f of [1 / 91, 37 / 91]) expect(dots().some((d) => level(G, run(f), d.x, d.y, 0) > 0)).toBe(true);
  });
  it('(c) no dot dims as a known count rises', () => {
    const fs = [0, 1 / 91, 37 / 91, 1];
    for (const d of dots()) for (let i = 1; i < fs.length; i++) expect(level(G, run(fs[i]), d.x, d.y, 0)).toBeGreaterThanOrEqual(level(G, run(fs[i - 1]), d.x, d.y, 0));
  });
  it('(d) the front moves by fractions of a column, never a whole column at once', () => {
    const span = G.x1 - G.x0 + G.h / 2, step = G.dx / 20 / span, start = 37 / 91;
    for (let k = 1; k <= 20; k++) {
      const a = start + (k - 1) * step, b = start + k * step;
      for (const d of dots()) expect(Math.abs(level(G, run(b), d.x, d.y, 0) - level(G, run(a), d.x, d.y, 0))).toBeLessThanOrEqual(1 / 20 + 1e-9);
    }
  });
  it('(e) the first and last columns lie on the edges, and spacing is even', () => {
    expect(Math.abs(dotX(G, 0) - G.r - G.x0)).toBeLessThan(0.01);
    expect(Math.abs(dotX(G, G.cols) + G.r - G.x1)).toBeLessThan(0.01);
    expect(Math.abs(dotY(G, 0) - G.r)).toBeLessThan(0.01);
    expect(Math.abs(dotY(G, G.rows) + G.r - G.h)).toBeLessThan(0.01);
    for (let c = 1; c <= G.cols; c++) expect(Math.abs(dotX(G, c) - dotX(G, c - 1) - G.dx)).toBeLessThan(1e-9);
    for (let r = 1; r <= G.rows; r++) expect(Math.abs(dotY(G, r) - dotY(G, r - 1) - G.dy)).toBeLessThan(1e-9);
  });
  it('a part with no known total shows a moving arrow that stays below full', () => {
    const lit = dots().map((d) => level(G, run(null), d.x, d.y, 0.5));
    expect(Math.max(...lit)).toBeGreaterThan(0);
    expect(Math.max(...lit)).toBeLessThan(1);
  });
});

describe('P5.B.2 the bar leaves only when everything is ready', () => {
  const cases: [string, Partial<LoadInputs>][] = [
    ['clangd not ready', { lsp: 'starting' }],
    ['indexing', { indexing: true }],
    ['settling', { settling: true }],
    ['retry pending', { retrying: true }],
    ['run not built', { built: false }],
    ['reading each function', { read: { state: 'run' } }],
    ['a step running', { trace: { state: 'run' } }],
  ];
  for (const [name, change] of cases) it(`not ready while ${name}`, () => expect(ready({ ...base, ...change })).toBe(false));
  it('ready when all are true, and every part then shows done', () => {
    expect(ready(base)).toBe(true);
    expect(parts(base).every((p) => p.state === 'done')).toBe(true);
  });
  it('a failed clangd does not hold the bar for ever', () => expect(ready({ ...base, lsp: 'failed' })).toBe(true));
  it('with no project open nothing is loading', () => expect(ready({ ...base, lsp: 'off' })).toBe(true));
});
