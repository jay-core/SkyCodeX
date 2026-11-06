import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadFixture } from './flowrun.fixture';
import { buildSeq, stepNumbers } from '../shared/flowseq';
import { metroRow, callAt, resultOf, detailCard } from '../shared/metrofacts';

const ROOT = path.resolve(__dirname, '../..'), TINY = path.join(ROOT, 'samples/tinyhttp'), FIX = path.join(ROOT, 'src/tests/fixtures');
const run = loadFixture(path.join(FIX, 'tinyhttp-flow.json'), TINY).run('src/main.cpp#3');
const s = buildSeq(run), nums = stepNumbers(s);
const lines = (f: string) => { try { return fs.readFileSync(path.isAbsolute(f) ? f : path.join(TINY, f), 'utf8').replace(/\r/g, '').split('\n'); } catch { return null; } };
const rows = s.items.map((_, i) => metroRow(s, i, nums, lines));

describe('metro facts', () => {
  it('reads the call, its result and the text around it from the code', () => {
    expect(callAt('    auto headers = parse_headers(req.raw);', 19, 'parse_headers')).toBe('parse_headers(req.raw)');
    expect(resultOf('    auto headers = ', ';')?.text).toBe('→ headers');
    expect(resultOf('    if (!keep_alive(', '))')?.text).toBe('→ argument of keep_alive');
    expect(resultOf('    while (running_ && ', ') {')?.text).toBe('→ the condition');
    expect(resultOf('    for (auto line : ', ') {')?.text).toBe('→ each item');
    expect(resultOf('    return ', ';')?.text).toBe('→ returned');
    expect(resultOf('    if (x == ', ')')?.text).toBe('→ the condition');
    expect(resultOf('    std::thread flusher([this] { metrics_.', '; });')?.text).toBe('');   // inside a lambda's body: no claim about a result
    expect(resultOf('    server.', ';')?.text).toBe('');
  });

  it('never states anything the source does not contain', () => {
    // every call text is in its caller's line, every loop text in the caller's file
    for (const m of rows) {
      const r = run.rows[s.items[m.item]], c = r.caller != null ? run.rows[r.caller] : null;
      if (!c || !r.at) continue;
      const L = lines(c.file)!;
      if (!r.approx) expect(L[r.at.line]).toContain(m.callText);
      if (m.inside) expect(L.join('\n')).toContain(m.inside.replace(/ · .*$/, '').slice(0, 20));
      if (m.result.startsWith('→ ') && !/^→ (returned|each item|the condition|unused|argument of )/.test(m.result)) expect(L[r.at.line]).toContain(m.result.slice(2));
    }
  });

  it('finds tinyhttp’s facts: parse_headers into headers, the thread, the comment', () => {
    const ph = rows.find((m) => m.name === 'parse_headers')!;
    expect(ph.callText).toBe('parse_headers(req.raw)');
    expect(ph.result).toBe('→ headers');
    // nothing that returns no value is said to have its result thrown away, and pure means pure all the way down
    for (const m of rows) if (m.notes.some((n) => n.text === 'result thrown away')) expect(run.effects?.[run.rows[s.items[m.item]].kind === 'ref' ? run.rows[run.rows[s.items[m.item]].ref!].key : run.rows[s.items[m.item]].key]?.returnsValue).toBe(true);
    expect(rows.find((m) => m.name === 'is_space')!.notes.some((n) => n.text === 'pure')).toBe(true);
    expect(rows.find((m) => m.name === 'handle')!.notes.some((n) => n.text === 'pure')).toBe(false);
    expect(rows.find((m) => m.name === 'start')!.notes.some((n) => n.text === 'pure')).toBe(false);
    // library calls aren't known: a function that makes one is never called pure (listen opens a socket)
    for (const n of ['listen', 'write_all', 'close', 'read_env', 'split']) expect(rows.find((m) => m.name === n)?.notes.some((x) => x.text === 'pure') ?? false).toBe(false);
    expect(rows.find((m) => m.name === 'handle')!.notes.some((n) => n.text.includes('Handles one client request'))).toBe(true);
  });
});

describe('details card', () => {
  it('says how often trim is called, by whom, and what it calls, from the run', () => {
    const at = s.items.findIndex((row) => { const r = run.rows[row]; return r.kind === 'ref' && run.rows[r.ref!].name.endsWith('trim'); });
    const c = detailCard(s, at, null, at, nums, lines);
    expect(c.timesCalled).toBe(2);
    expect(c.callers).toEqual([{ name: 'parse_headers', count: 2 }]);
    expect(c.calls.map((x) => x.state)).toEqual(['done', 'now']);
    expect(c.calls.every((x) => x.code.includes('trim('))).toBe(true);
    expect(c.callee.signature).toContain('trim(sv s)');
    expect(c.itsCalls.map((x) => x.name)).toContain('is_space');
    expect(c.library).toEqual(expect.arrayContaining(['empty', 'front', 'back', 'remove_prefix', 'remove_suffix']));
    expect(c.loops).toBe(2);
    expect(c.effects.pure).toMatch(/library calls/);
    expect(c.caller?.makes.map((m) => m.name)).toEqual(expect.arrayContaining(['split', 'trim']));
  });
});
