// Configurations (FLOW-DESIGN §8b), on real clangd output for samples/configs as built (recorded with
// src/tests/fixtures/record-flow.mjs). Worked out by hand from the sample and its compile_flags.txt.
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { loadFixture, describeRun } from './flowrun.fixture';
import { alignRuns, macrosTested } from '../shared/flowalign';

const ROOT = path.join(__dirname, '../..');
const { infos, run } = loadFixture(path.join(ROOT, 'src/tests/fixtures/configs-flow.json'), path.join(ROOT, 'samples/configs'));
const r = run([...infos.keys()].find((k) => infos.get(k)!.name === 'main')!);
const steps = r.rows.filter((x) => x.kind === 'step').map((x) => x.name);

describe('configurations (samples/configs, as built: BOARD=1)', () => {
  it('runs only the code of this build: #if picks one board, #ifdef DEBUG is out, the checks are in', () => {
    expect(steps).toEqual(['main', 'start', 'init_board_a', 'check_stack', 'run', 'pick_width', 'wide', 'after_constexpr']);
  });
  it('an if constexpr is not a branch: the side kept runs unconditionally, the other is a ghost in place', () => {
    const ghosts = (r.ghosts ?? []).map((g) => `${r.rows[g.owner].name} after ${r.rows[g.after].name}: ${g.names.join(', ')} | ${g.why}`);
    expect(ghosts).toEqual([
      'pick_width after wide: narrow | not in this build · sizeof(void *) == 8 is true',
      'after_constexpr after after_constexpr: narrow | not in this build · sizeof(char) == 2 is false',
    ]);
    expect(describeRun(r).filter((l) => /\b(wide|narrow)\b/.test(l))).toEqual(['    7 wide']);
  });
  it('a discarded side that returns does not end the function: what follows still runs', () => {
    const after = r.rows.findIndex((x) => x.kind === 'step' && x.name === 'after_constexpr');
    expect(r.rows.filter((x) => x.caller === after).map((x) => x.name)).toEqual(['run']);
    expect(r.exits?.[r.rows[after].key]?.map((x) => x.text)).toEqual(['return 0']);
  });
});

// the same sample recorded with -DDEBUG -DBOARD=2 (record-flow.mjs … -DDEBUG -DBOARD=2): a later -D wins
const alt = loadFixture(path.join(ROOT, 'src/tests/fixtures/configs-alt-flow.json'), path.join(ROOT, 'samples/configs'));
const ra = alt.run([...alt.infos.keys()].find((k) => alt.infos.get(k)!.name === 'main')!);

describe('another setting lined up with as built (DEBUG defined, BOARD=2)', () => {
  const m = alignRuns(ra, r, 'only with DEBUG · BOARD=2', 'only as built');
  it('says what only this setting runs, at the topmost row of each part', () => {
    expect(m.run.rows.filter((x) => x.only).map((x) => `${x.name} | ${x.only}`)).toEqual(['log_line | only with DEBUG · BOARD=2', 'init_board_b | only with DEBUG · BOARD=2']);
  });
  it('puts what only as built runs in place as a ghost, after the call made before it', () => {
    expect((m.run.ghosts ?? []).map((g) => `${m.run.rows[g.after].name}: ${g.names.join(', ')} | ${g.why}`)).toEqual([
      'log_line: init_board_a | only as built',
      'wide: narrow | not in this build · sizeof(void *) == 8 is true',
      'after_constexpr: narrow | not in this build · sizeof(char) == 2 is false',
    ]);
    expect([m.added, m.removed]).toEqual([2, 1]);
  });
  it('a run lined up with itself differs nowhere', () => {
    const same = alignRuns(r, r, 'x', 'y');
    expect([same.added, same.removed]).toEqual([0, 0]);
    expect(same.run.ghosts).toEqual(r.ghosts);
  });
  it('lists the macros the conditions test, with the numbers they are compared with', () => {
    const t = fs.readFileSync(path.join(ROOT, 'samples/configs/configs.cpp'), 'utf8');
    expect([...macrosTested(t)].map(([k, v]) => `${k}:${[...v].join(',')}`)).toEqual(['DEBUG:', 'BOARD:1,2', 'NO_CHECKS:']);
  });
});
