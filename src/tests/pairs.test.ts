// Pairs that don't close (src/shared/flowpairs.ts), on real clangd output for samples/pairs (recorded with
// src/tests/fixtures/record-flow.mjs). Each function in the sample says what should be found; worked out by hand.
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { loadFixture } from './flowrun.fixture';
import { findings } from '../shared/flowseq';

const ROOT = path.join(__dirname, '../..');
const { infos, run } = loadFixture(path.join(ROOT, 'src/tests/fixtures/pairs-flow.json'), path.join(ROOT, 'samples/pairs'));
const r = run([...infos.keys()].find((k) => infos.get(k)!.name === 'main')!);
const found: Record<string, string[]> = {};
for (const k of infos.keys()) found[infos.get(k)!.name] = (r.pairs?.[k] ?? []).map((x) => `${x.what} ${x.name} ${x.opened.line + 1} | ${x.exit.kind} ${x.exit.kind === 'end' ? '' : x.exit.line + 1} | ${x.path.join(' / ')}`);

describe('pairs that don\'t close (samples/pairs)', () => {
  it('finds each one left open, where it was opened, the way out and the path', () => {
    expect(found.lock_early).toEqual(['lock m 17 | return 18 | if (x < 0)']);
    expect(found.mem_branch).toEqual(['memory buf 25 | return 27 | if (bad)']);
    expect(found.file_throw).toEqual([`file f 58 | throw 59 | if (fgetc(f) != 'P')`]);
    expect(found.member_lock).toEqual(['lock mu 66 | return 67 | if (a)']);
    expect(found.by_case).toEqual(['lock m 80 | return 83 | switch (k) · case 1']);
  });
  it('says nothing where every path closes, a goto lands somewhere unknown, or a call never returns', () => {
    for (const f of ['lock_ok', 'mem_goto', 'file_loop', 'dies', 'main', 'die']) expect(found[f], f).toEqual([]);
  });
  it('a path that tests the same condition twice is reported, and the finding says so', () => {
    expect(found.linked).toEqual(['lock m 92 | end  | if (a) / if (a) · not taken']);
    const f = findings(r).find((x) => x.kind === 'pair' && /linked/.test(x.text))!;
    expect(f.grade).toBe('possible');
    expect(f.text).toMatch(/tests if \(a\) twice/);
  });
  it('appear among the findings, one per function and way out', () => {
    const pairs = findings(r).filter((x) => x.kind === 'pair').map((x) => x.text);
    expect(pairs).toContain('lock_early: lock m taken on line 17 · not released if it returns at line 18 (if (x < 0))');
    expect(pairs).toContain(`file_throw: file f opened on line 58 · not closed if it throws at line 59 (if (fgetc(f) != 'P'))`);
    expect(pairs).toHaveLength(6);
  });
});
