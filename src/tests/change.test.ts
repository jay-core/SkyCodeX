// What a change does (FLOW-DESIGN §8b): samples/change/v1 (before) and v2 (after), each recorded from clangd with
// src/tests/fixtures/record-flow.mjs. What changed is worked out by hand from the two files.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadFixture } from './flowrun.fixture';
import { alignChange, functionTexts } from '../shared/flowalign';

const ROOT = path.join(__dirname, '../..');
const side = (v: string) => {
  const dir = path.join(ROOT, 'samples/change', v);
  const { infos, run } = loadFixture(path.join(ROOT, `src/tests/fixtures/change-${v}-flow.json`), dir);
  const r = run([...infos.keys()].find((k) => infos.get(k)!.name === 'main')!);
  return { run: r, root: '', texts: functionTexts(r, (f) => fs.readFileSync(path.join(dir, f), 'utf8')) };
};
const v1 = side('v1'), v2 = side('v2');
const m = alignChange(v2, v1, 'v1');
const R = m.run.rows;

describe('what a change does (samples/change v1 → v2)', () => {
  it('says the change in one line', () => {
    expect(m.summary).toBe('+ 2 steps in handle · − log_request from start · route now inside if (validate(r) && check_size(r)) · 2 steps changed');
    expect([m.added, m.removed, m.changed, m.moved]).toEqual([2, 1, 2, 1]);
  });
  it('marks what was added, what changed, and what moved under a new condition', () => {
    expect(R.filter((r) => r.changeNote).map((r) => `${r.name}: ${r.change ?? '-'} | ${r.changeNote}`)).toEqual([
      'start: changed | changed · 1 line',
      'handle: changed | changed · 2 lines',
      'validate: added | added',
      'check_size: added | added',
      'route: - | now inside if (validate(r) && check_size(r))',
    ]);
  });
  it('a removed call stands in place, where the older version made it', () => {
    expect((m.run.ghosts ?? []).map((g) => `${R[g.after].name}: ${g.names.join(', ')} | ${g.why} | ${g.kind}`)).toEqual(['start: log_request | removed · in v1 | removed']);
  });
  // (every function of v2 sits a line lower than in v1: main, accept, route and send_response say nothing above)
  it('a version compared with itself changes nothing', () => {
    const same = alignChange(v2, v2, 'v2');
    expect(same.summary).toBe('no change to what this run does since v2');
    expect(same.run.rows.some((r) => r.changeNote)).toBe(false);
  });
});
