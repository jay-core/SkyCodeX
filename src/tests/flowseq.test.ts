// The sequence view's model (src/shared/flowseq.ts) on tinyhttp's real run: rows shown, every move, the layout's
// no-overlap guarantee in every state, and the selected step's facts. Expectations worked out by hand from the source.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadFixture } from './flowrun.fixture';
import { buildSeq, startState, move, Move, StepState, layoutSeq, stepFacts, loopsAt, embers, leadingComment, Seq, hiddenBy, foldable, chapters, encodeWalk, decodeWalk, walkthrough, whatIf } from '../shared/flowseq';

const FIX = path.join(__dirname, 'fixtures'), TINY = path.resolve(__dirname, '../../samples/tinyhttp');
const run = loadFixture(path.join(FIX, 'tinyhttp-flow.json'), TINY).run('src/main.cpp#3');
const s = buildSeq(run);
const name = (sq: Seq, at: number) => (at >= sq.items.length ? 'END' : sq.run.rows[sq.items[at]].name);
const itemNamed = (n: string, nth = 0) => s.items.filter((r) => run.rows[r].name === n && run.rows[r].kind === 'step')[nth] ?? -1;
const at = (n: string) => s.itemOf[itemNamed(n)];
function walk(moves: Move[], from: StepState[] = [startState(s)]) {
  let t = from, note: string | undefined;
  for (const m of moves) ({ trail: t, note } = move(s, t, m));
  return { trail: t, cur: t[t.length - 1], note };
}

describe('rows shown', () => {
  it('a one-line helper that runs unconditionally folds into its caller; one inside an if keeps its row', () => {
    const stop = run.rows.findIndex((r) => r.name === 'stop');
    expect(s.uses.get(stop)?.map((i) => run.rows[i].kind + ' ' + run.rows[i].name)).toEqual(['ref close']);
    expect(itemNamed('close')).toBeGreaterThan(0);   // close itself: only when !keep_alive(headers)
    expect(itemNamed('is_space')).toBeGreaterThan(0);   // inside a loop and an &&
    expect(s.items.length).toBe(run.rows.length - 1);
  });
  it('helpers with no conditions fold, with their numbers kept', () => {
    const rules = loadFixture(path.join(FIX, 'rules-flow.json'), path.join(FIX, 'rules')).run('rules.cpp#13');   // nested: d(a())
    const q = buildSeq(rules);
    expect(q.items).toEqual([0]);
    expect(q.uses.get(0)?.map((i) => `${rules.rows[i].n} ${rules.rows[i].name}`)).toEqual(['2 a', '3 d']);
    expect(buildSeq(rules, { fold: false }).items).toEqual([0, 1, 2]);
  });
  it('every row maps to the item that shows it', () => {
    for (let i = 0; i < run.rows.length; i++) expect(s.itemOf[i]).toBeGreaterThanOrEqual(0);
  });
});

describe('stepping', () => {
  it('next goes into calls and says when control comes back up', () => {
    const { trail } = walk(['next', 'next', 'next']);
    expect(trail.map((x) => `${name(s, x.at)}:${x.how}`)).toEqual(['main:start', 'load_config:call', 'read_env:call', 'Server:return']);
    expect(trail[3].why).toBe('back in main');
  });
  it('a loop: another pass up to its exact count, then refused; leave skips the rest', () => {
    const to = walk([{ goto: 3 }]);
    expect(name(s, to.cur.at)).toBe('read_env');
    const f = loopsAt(s, to.cur.at)[0];
    expect(to.cur.passes).toEqual({ [f]: 1 });
    const p4 = walk(['again', 'again', 'again'], to.trail);
    expect(p4.cur.passes[f]).toBe(4);
    expect(p4.cur.why).toBe('pass 4 of 4');
    expect(walk(['again'], p4.trail).note).toBe('that was the last of its 4 passes');
    const left = walk(['leave'], walk(['back', 'back'], p4.trail).trail);
    expect(name(s, left.cur.at)).toBe('Server');
    expect(left.cur.why).toBe('skipped the other 2 passes');
    expect(left.cur.passes).toEqual({});
  });
  it('back retraces the path exactly, passes included; ⇧← is the previous pass of the same step', () => {
    const p3 = walk([{ goto: 3 }, 'again', 'again']);
    expect(walk(['back'], p3.trail).cur.passes).toEqual(walk([{ goto: 3 }, 'again']).cur.passes);
    const prev = walk(['prevPass'], p3.trail);
    expect(prev.cur.at).toBe(p3.cur.at);
    expect(Object.values(prev.cur.passes)).toEqual([2]);
    expect(walk(['prevPass', 'prevPass'], p3.trail).note).toBeUndefined();   // 3 → 2 → 1
    expect(walk(['prevPass', 'prevPass', 'prevPass'], p3.trail).note).toBe('this is its first pass');
    expect(walk(['back']).note).toBe('this is where the walk started');
  });
  it('step over skips everything inside; step out finishes the function', () => {
    const over = walk([{ goto: 5 }, 'over']);
    expect(name(s, over.cur.at)).toBe('stop');
    expect(over.cur.why).toBe('skipped 17 steps inside start');
    const out = walk([{ goto: 9 }, 'out']);   // accept, inside start's loop
    expect(name(s, out.cur.at)).toBe('stop');
    expect(out.cur.why).toBe('finished start · back in main');
    expect(walk(['out']).note).toBe('main is where the run starts');
  });
  it('siblings: the next and previous call made by the same function', () => {
    const r = walk([{ goto: 15 }]);   // route, called by handle
    expect(run.rows[s.items[walk(['nextSibling'], r.trail).cur.at]]).toMatchObject({ kind: 'indirect', text: 'handler' });
    expect(name(s, walk(['prevSibling'], r.trail).cur.at)).toBe('parse_headers');
    expect(walk([{ goto: 23 }, 'nextSibling']).note).toBe('nothing else runs after this in main');
  });
  it('the end of the run is a place of its own', () => {
    const e = walk(['end']);
    expect(e.cur.at).toBe(s.items.length);
    expect(e.cur.why).toBe('main returns');
    expect(walk(['next'], e.trail).note).toBe('the end of the run');
    expect(walk([{ goto: 99 }]).note).toBe('there is no step 99');
  });
  it('passes reset when a loop is entered anew', () => {
    const t = walk([{ goto: 10 }]);   // handle, inside start's while
    const outer = loopsAt(s, t.cur.at)[0];
    const twice = walk(['again'], t.trail);
    expect(twice.cur.passes[outer]).toBe(2);
    expect(name(s, twice.cur.at)).toBe('accept');   // the loop's first row: its condition
    expect(walk(['next', 'next', 'next', 'next'], twice.trail).cur.passes[outer]).toBe(2);
  });
  it('the ember trail: the last four places, newest first, without the current one', () => {
    const t = walk(['next', 'next', 'next', 'next', 'next', 'back']).trail;
    expect(name(s, t[t.length - 1].at)).toBe('start');
    expect(embers(t).map((a) => name(s, a))).toEqual(['Server', 'read_env', 'load_config', 'main']);
    expect(embers([])).toEqual([]);
  });
});

describe('layout', () => {
  const states = [...Array(s.items.length + 1).keys()];
  for (const width of [900, 1500]) {
    it(`no two rows or labels share space, in every state (width ${width})`, () => {
      for (const a of states) {
        const g = layoutSeq(s, a, { width, rowH: 23, slotH: 15, top: 46, boxH: 120 });
        const bands: [number, number, string][] = g.y.map((y, i) => [y, y + g.h[i], `row ${i}`]);
        for (const [f, y] of g.slotY) bands.push([y, y + 15, `slot ${f}`]);
        bands.sort((p, q) => p[0] - q[0]);
        for (let i = 1; i < bands.length; i++) expect(bands[i][0], `${bands[i - 1][2]} overlaps ${bands[i][2]} at state ${a}`).toBeGreaterThanOrEqual(bands[i - 1][1]);
        // every loop label sits right above its loop's first row
        for (const [f, y] of g.slotY) expect(y).toBeLessThan(g.y[s.span.get(f)![0]]);
        expect(g.h[a]).toBe(23 + 120);
      }
    });
  }
  it('columns are files when they fit, call depth when they do not', () => {
    expect(layoutSeq(s, 0, { width: 1500, rowH: 23, slotH: 15, top: 46, boxH: 0 }).mode).toBe('files');
    expect(layoutSeq(s, 0, { width: 900, rowH: 23, slotH: 15, top: 46, boxH: 0 }).mode).toBe('depth');
    const g = layoutSeq(s, 0, { width: 1500, rowH: 23, slotH: 15, top: 46, boxH: 0 });
    expect(g.lanes[0]).toBe('src/main.cpp');
    expect(g.lanes).toHaveLength(8);
  });
  it('a call deeper in the tree starts further right (depth columns)', () => {
    const g = layoutSeq(s, 0, { width: 900, rowH: 23, slotH: 15, top: 46, boxH: 0 });
    expect(g.x[at('handle')]).toBeGreaterThan(g.x[at('start')]);
    expect(g.x[at('start')]).toBeGreaterThan(g.x[0]);
  });
});

describe('the selected step’s box', () => {
  const facts = (n: string, passes: Record<number, number> = {}) => stepFacts(s, at(n), passes).map((f) => `${f.head}: ${f.text}`);
  it('a step inside a counted loop', () => {
    const f = loopsAt(s, at('read_env'))[0];
    expect(facts('read_env', { [f]: 1 })).toEqual(['called from: 2 load_config · line 13', 'calls: nothing in the project', 'repeats: ↻ for (int i = 0; i < 4; ++i) · ×4 · pass 1 of 4', 'runs: 4 times']);
  });
  it('conditions say exactly when a step runs', () => {
    expect(facts('to_lower')).toContain('when: only when it != h.end() is true');
    expect(facts('route')).toContain('when: only when if (headers.empty()) did not return');
    expect(facts('close')).toContain('when: only when if (!keep_alive(headers)) holds');
    expect(facts('accept')).toContain('when: only when running_ is true');
  });
  it('how often: certain only when it is', () => {
    expect(facts('main')).toEqual(['called from: the start of the run', 'calls: 2 load_config · 4 Server · 5 start · 23 stop', 'runs: once']);
    expect(facts('to_lower').at(-1)).toBe('runs: once per pass of while (running_ && socket_.accept(req)), when its conditions hold · how many passes depends on the run');
    expect(stepFacts(s, at('to_lower'), {}).at(-1)?.grade).toBe('unknown');
  });
  it('folded helpers, the thread, indirect calls and the compiler’s choice of order are said', () => {
    expect(facts('stop')).toContain('uses: 22 close');
    expect(facts('run')).toContain('when: on a new thread');
    expect(facts('trim')).toContain('order: another argument of the same call also calls a project function; which runs first is the compiler’s choice');
    const ind = s.itemOf[run.rows.findIndex((r) => r.kind === 'indirect')];
    expect(stepFacts(s, ind, {}).map((f) => f.text)).toContain('through a std::function · which function it holds is known only at run time');
  });
  it('the summary is the function’s own comment, verbatim', () => {
    const lines = fs.readFileSync(path.join(TINY, 'src/server.cpp'), 'utf8').split('\n');
    expect(leadingComment(lines, run.rows[itemNamed('handle')].start)).toBe('Handles one client request end-to-end.');
    expect(leadingComment(lines, run.rows[itemNamed('start')].start)).toBe('');
    expect(leadingComment(['/**', ' * Two', ' * lines.', ' */', 'int f();'], 4)).toBe('Two lines.');
  });
});

describe('folding a call', () => {
  it('what runs inside takes no space, the call gets one row more for its summary, and nothing overlaps', () => {
    for (let f = 0; f < s.items.length; f++) {
      if (!foldable(s, f)) continue;
      const folded = new Set([f]), hidden = hiddenBy(s, folded);
      expect(hidden.size).toBe(s.lastItem[f] - f);
      for (const a of [0, f, s.items.length]) {
        if (hidden.has(a)) continue;
        const g = layoutSeq(s, a, { width: 900, rowH: 23, slotH: 15, top: 46, boxH: 120, folded });
        for (const i of hidden) expect(g.h[i]).toBe(0);
        expect(g.h[f]).toBe(23 + 23 + (a === f ? 120 : 0));
        const bands: [number, number, string][] = g.y.map((y, i) => [y, y + g.h[i], `row ${i}`] as [number, number, string]).filter(([y0, y1]) => y1 > y0);
        for (const [fr, y] of g.slotY) bands.push([y, y + 15, `slot ${fr}`]);
        bands.sort((p, q) => p[0] - q[0]);
        for (let i = 1; i < bands.length; i++) expect(bands[i][0], `fold ${f}, state ${a}: ${bands[i - 1][2]} overlaps ${bands[i][2]}`).toBeGreaterThanOrEqual(bands[i - 1][1]);
      }
    }
  });
});

describe('chapters', () => {
  it('main\'s own calls, and the big one split one level down', () => {
    const c = chapters(s).map((x) => `${x.depth}:${x.label} ${x.from}-${x.to}`);
    expect(c).toEqual([
      `0:load_config ${at('load_config')}-${at('read_env')}`, `0:Server ${at('Server')}-${at('Server')}`, `0:start ${at('start')}-${s.lastItem[at('start')]}`,
      `1:listen ${at('listen')}-${at('listen')}`, `1:run ${at('run')}-${at('flush')}`, `1:↻ while (running_ && socket_.accept(req)) ${at('accept')}-${s.lastItem[at('start')]}`,
      `0:stop ${at('stop')}-${s.items.length - 1}`,
    ]);
  });
});

describe('sharing a walk', () => {
  it('a link reopens the same places, passes included', () => {
    const w = walk(['next', 'next', 'again', 'again', 'next']).trail;
    const back = decodeWalk(s, encodeWalk('src/main.cpp#3', w))!;
    expect(back.entry).toBe('src/main.cpp#3');
    expect(back.trail.map((t) => [t.at, t.passes])).toEqual(w.map((t) => [t.at, t.passes]));
  });
  it('notes travel with the link and into the walkthrough', () => {
    const w = walk(['next', 'next']).trail;
    const back = decodeWalk(s, encodeWalk('e', w, 40, { [at('read_env')]: 'reads TINY_PORT, then 3 more, a, b & c' }))!;
    expect(back.notes).toEqual({ [at('read_env')]: 'reads TINY_PORT, then 3 more, a, b & c' });
    expect(walkthrough(s, w, 't', (f) => f, () => '', back.notes)).toContain('   > note: reads TINY_PORT, then 3 more, a, b & c');
  });
  it('a link naming places this run does not have is refused', () => {
    expect(decodeWalk(s, 'skycodex:walk?entry=x&at=999')).toBeNull();
    expect(decodeWalk(s, `skycodex:walk?entry=x&at=${at('read_env')}.0-9`)).toBeNull();   // the loop runs 4 times
    expect(decodeWalk(s, 'https://example.com')).toBeNull();
  });
  it('a walkthrough states each place, its caller and what is around it', () => {
    const w = walk(['next', 'next', 'again']).trail;
    const md = walkthrough(s, w, 'tinyhttp', (f) => f, (f, l) => fs.readFileSync(path.join(TINY, f), 'utf8').split('\n')[l]);
    expect(md).toContain('**step 3 · read_env** — `src/config.cpp:');
    expect(md).toContain('in the loop `for (int i = 0; i < 4; ++i)` · pass 2 of 4');
    expect(md).toMatch(/called from load_config \(`src\/config.cpp:\d+`\): `const char\* v = read_env\(keys\[i\]\);`/);
  });
});

describe('what if', () => {
  const frameOf = (kind: string, text: string) => run.frames.findIndex((f) => f.kind === kind && f.text === text);
  it('past an early return: everything after it is skipped and the function returns', () => {
    const w = whatIf(s, frameOf('guard', 'if (headers.empty())'))!;
    expect(w.ask).toBe('what if headers.empty() is true?');
    expect(w.says).toBe('handle returns here');
    expect(w.then).toBe('back in start');
    expect(name(s, w.skip[0])).toBe('route');
    expect(w.skip[1]).toBe(s.lastItem[at('handle')]);
  });
  it('the right side of && is not evaluated when the left is false', () => {
    const w = whatIf(s, run.frames.findIndex((f) => f.kind === 'arm' && f.label.startsWith('&& to_lower')))!;
    expect(w.ask).toBe('what if it != h.end() is false?');
    expect(name(s, w.skip[0])).toBe('to_lower');
    expect(w.rows).toBe(1);
    expect(w.then).toBe('22 close');
  });
  it('the skipped rows take no space and nothing overlaps', () => {
    const w = whatIf(s, frameOf('guard', 'if (headers.empty())'))!;
    const g = layoutSeq(s, at('handle'), { width: 900, rowH: 23, slotH: 15, top: 46, boxH: 120, skip: w.skip });
    for (let i = w.skip[0]; i <= w.skip[1]; i++) expect(g.h[i]).toBe(0);
    const bands: [number, number][] = g.y.map((y, i) => [y, y + g.h[i]] as [number, number]).filter(([a, b]) => b > a);
    for (const [, y] of g.slotY) bands.push([y, y + 15]);
    bands.sort((p, q) => p[0] - q[0]);
    for (let i = 1; i < bands.length; i++) expect(bands[i][0]).toBeGreaterThanOrEqual(bands[i - 1][1]);
  });
  it('a loop is not a condition', () => {
    expect(whatIf(s, frameOf('loop', 'for (int i = 0; i < 4; ++i)'))).toBeNull();
  });
});
