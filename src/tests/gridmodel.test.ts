import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { loadFixture } from './flowrun.fixture';
import { buildSeq, stepNumbers } from '../shared/flowseq';
import { buildGrid } from '../shared/gridmodel';

const ROOT = path.resolve(__dirname, '../..');
const run = loadFixture(path.join(ROOT, 'src/tests/fixtures/tinyhttp-flow.json'), path.join(ROOT, 'samples/tinyhttp')).run('src/main.cpp#3');
const s = buildSeq(run), nums = stepNumbers(s);

describe('call grid', () => {
  it('puts every call in exactly one square, in run order, and nothing else', () => {
    const g = buildGrid(s, nums);
    const all = [...g.cells.values()].flat().sort((a, b) => a - b);
    expect(all).toEqual(s.items.map((_, i) => i).filter((i) => run.rows[s.items[i]].caller != null));
    for (const v of g.cells.values()) expect(v).toEqual([...v].sort((a, b) => a - b));
    g.cellOf.forEach((k, i) => { if (k) expect(g.cells.get(k)).toContain(i); });
  });

  it('counts calls made and calls received, and groups by file', () => {
    const g = buildGrid(s, nums);
    const made = g.cols.reduce((n, c) => n + c.count, 0), got = g.rows.reduce((n, r) => n + r.count, 0);
    expect(made).toBe(got);
    expect(made).toBe([...g.cells.values()].flat().length);
    const fi = g.rows.map((r) => g.files.indexOf(r.file));
    expect(fi).toEqual([...fi].sort((a, b) => a - b));
    // tinyhttp: parse_headers calls trim twice, and that cell holds both steps
    const ph = g.cols.find((c) => c.name === 'parse_headers')!, tr = g.rows.find((r) => r.name === 'trim')!;
    expect(g.cells.get(`${ph.key}>${tr.key}`)!.length).toBe(2);
  });

  it('sorts by most called', () => {
    const g = buildGrid(s, nums, 'count');
    expect(g.rows.map((r) => r.count)).toEqual([...g.rows.map((r) => r.count)].sort((a, b) => b - a));
  });
});
