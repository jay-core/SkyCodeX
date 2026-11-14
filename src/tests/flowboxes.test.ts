import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { loadFixture } from './flowrun.fixture';
import { routesBetween, frameWords } from '../shared/flowboxes';

const FIX = path.join(__dirname, 'fixtures');
const { run: runOf } = loadFixture(path.join(FIX, 'tinyhttp-flow.json'), path.resolve(__dirname, '../../samples/tinyhttp'));
const run = runOf('src/main.cpp#3');
const R = run.rows;
const step = (name: string) => R.findIndex((r) => r.kind === 'step' && r.name.endsWith(name));

describe('routes between two functions', () => {
  it('main to split: through parse_headers once, through route › match_path twice', () => {
    const rs = routesBetween(run, step('main'), 'split');
    const names = rs.map((r) => r.rows.map((i) => R[i].name.replace(/.*::/, '')).join(' › '));
    expect(names).toEqual(['main › start › handle › parse_headers › split', 'main › start › handle › route › match_path › split']);
    expect(rs.map((r) => r.at.length)).toEqual([1, 2]);
    expect(frameWords(run, rs[1].at[0])).toEqual(['in while (running_ && socket_.accept(req))', 'past if (headers.empty()) → return', 'in for (const auto& r : routes)']);
  });
  it('none from a function to one it never reaches, and none to itself', () => {
    expect(routesBetween(run, step('load_config'), 'split')).toEqual([]);
    expect(routesBetween(run, step('split'), 'split')).toEqual([]);
  });
});
