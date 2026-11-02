// Watch a variable and a value's journey (src/shared/flowwatch.ts) on tinyhttp, recorded from clangd. Expected
// values read off the sources: server.cpp 13–19 and 38 (running_), metrics.cpp 20–21 (run), headers.cpp 4–6.
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { loadFixture } from './flowrun.fixture';
import { watch, journey, watchable, argName, Hit } from '../shared/flowwatch';
import type { Run } from '../shared/flowrun';

const ROOT = path.join(__dirname, '../..');
const { infos, run } = loadFixture(path.join(ROOT, 'src/tests/fixtures/tinyhttp-flow.json'), path.join(ROOT, 'samples/tinyhttp'));
const r: Run = run([...infos.keys()].find((k) => infos.get(k)!.name === 'main')!);
const short = (n: string) => n.replace(/^.*::/, '');
const show = (hs: Hit[]) => hs.map((h) => `${short(r.rows[h.row].name)}: ${h.how} ${h.as}${h.from ? ` (from ${h.from})` : ''}${h.copy ? ' [copy]' : ''}`);

describe('watch a variable', () => {
  it('running_: set and read in start, read by reference as running in Metrics::run on the flusher thread, set in stop', () => {
    expect(show(watch(r, { name: 'running_', owner: 'Server' }))).toEqual([
      'start: set running_', 'start: read running_', 'run: passed running (from running_)', 'run: read running', 'stop: set running_']);
  });
  it('lists what can be watched, most used first', () => {
    const w = watchable(r).map((x) => `${x.owner ?? ''}::${x.name}`);
    expect(w).toContain('Server::running_');
    expect(w).toContain('Metrics::counters_');
  });
});

describe('a value\'s journey', () => {
  const handle = r.rows.findIndex((x) => x.kind === 'step' && short(x.name) === 'handle');
  it('req.raw → raw in parse_headers → s in split, each a copy (string_view by value)', () => {
    expect(show(journey(r, handle, 'req.raw'))).toEqual([
      'parse_headers: passed raw (from req.raw) [copy]', 'parse_headers: read raw [copy]', 'split: passed s (from raw) [copy]', 'split: read s [copy]']);
  });
  // server.cpp 25, 28, 31: req.raw to parse_headers, req.path to route (→ match_path → split, router.cpp 8–19) and to
  // record (const std::string&: the caller's own string, not a copy)
  it('req: read in handle, its parts passed on and followed', () => {
    expect(show(journey(r, handle, 'req'))).toEqual([
      'handle: read req', 'parse_headers: passed raw (from req.raw) [copy]', 'parse_headers: read raw [copy]', 'split: passed s (from raw) [copy]', 'split: read s [copy]',
      'route: passed path (from req.path) [copy]', 'route: read path [copy]', 'match_path: passed path (from path) [copy]', 'match_path: read path [copy]',
      'split: passed s (from path) [copy]', 'split: read s [copy]', 'record: passed path (from req.path)', 'record: read path']);
  });
  it('reads an argument down to the name it passes', () => {
    expect(['&this->running_', 'std::ref(x)', '(*this).y', ' ( std::move(z) ) ', 'a.b'].map(argName)).toEqual(['running_', 'x', 'y', 'z', 'a.b']);
  });
});
