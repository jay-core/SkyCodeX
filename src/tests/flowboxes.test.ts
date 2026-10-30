// The boxes view's model on a real run (tinyhttp, recorded from clangd): rows, lines and their numbers, labels that
// never overlap at any zoom, routes between two functions, a function's neighbourhood, how often a row runs.
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import ELK from 'elkjs/lib/elk.bundled.js';
import { loadFixture } from './flowrun.fixture';
import { boxModel, layoutBoxes, placeLabels, labelScale, levelFor, routesBetween, routePoints, neighbourhood, howOftenLevel, frameWords, rowAt, Level, Lay, viewRect, meets, nodeOf } from '../shared/flowboxes';

const FIX = path.join(__dirname, 'fixtures');
const { run: runOf } = loadFixture(path.join(FIX, 'tinyhttp-flow.json'), path.resolve(__dirname, '../../samples/tinyhttp'));
const run = runOf('src/main.cpp#3');
const R = run.rows;
const m = boxModel(run);
const step = (name: string) => R.findIndex((r) => r.kind === 'step' && r.name.endsWith(name));
const elk = new (ELK as any)();
const lays: Partial<Record<Level, Lay>> = {};
const lay = async (l: Level) => (lays[l] ??= await layoutBoxes(m, l, elk));

describe('boxes from the run', () => {
  it('one box per file that runs, its functions in step order', () => {
    expect(m.files.map((f) => f.split('/').pop())).toEqual(['main.cpp', 'config.cpp', 'server.cpp', 'io.cpp', 'metrics.cpp', 'headers.cpp', 'strings.cpp', 'router.cpp']);
    expect(m.rowsOf.get('src/server.cpp')!.map((i) => `${R[i].n} ${R[i].name.replace(/.*::/, '')}`)).toEqual(['4 Server', '5 start', '10 handle', '23 stop']);
    expect(m.rowsOf.get('src/util/strings.cpp')!.map((i) => R[i].n)).toEqual([12, 13, 14, 21]);
  });
  it('a line for every call between files, from the caller\'s row to the callee\'s, with its step numbers', async () => {
    const l = await lay('functions');
    const text = (a: string, b: string) => l.lines.find((x) => x.a === step(a) && x.b === step(b))?.text;
    expect(text('match_path', 'split')).toBe('→12 ×2');
    expect(text('handle', 'route')).toBe('15');
    expect(text('handle', 'close')).toBe('22');
    expect(text('stop', 'close')).toBe('→22');
    expect(text('start', 'handle')).toBeUndefined();   // inside one file: the numbers say the order
    // every call between files has its line
    const cross = m.calls.filter((c) => R[c.a].file !== R[c.b].file);
    expect(l.lines.length).toBe(cross.length);
    for (const x of l.lines) expect(x.pts.length).toBeGreaterThanOrEqual(2);
    expect(l.lines.find((x) => x.b === step('run'))!.thread).toBe(true);
  });
  it('files level: one line per pair of files with all its numbers', async () => {
    const l = await lay('files');
    expect(l.lines.find((x) => x.fa.endsWith('server.cpp') && x.fb.endsWith('io.cpp'))!.text).toBe('6 · 9 · 17 · 22 +1');
    expect(new Set(l.lines.map((x) => `${x.fa}>${x.fb}`)).size).toBe(l.lines.length);
  });
  it('folders level: a box per folder, a line per pair of folders', async () => {
    const l = await lay('folders');
    expect(Object.keys(l.pos).sort()).toEqual(['dir:src', 'dir:src/http', 'dir:src/net', 'dir:src/util']);
    expect(l.lines.map((x) => `${x.fa} > ${x.fb}: ${x.text}`).sort()).toEqual([
      'dir:src > dir:src/http: 11 · 20', 'dir:src > dir:src/net: 6 · 9 · 17 · 22 +1', 'dir:src > dir:src/util: →12 ×2', 'dir:src/http > dir:src/util: 12 · 13 · →13 · 21']);
  });
});

describe('the numbers on the lines', () => {
  it('never cover each other, at every zoom from 30% to 250%, on the level drawn there', async () => {
    for (let k = 0.3; k <= 2.5; k += 0.05) {
      const lv = levelFor(k), l = await lay(lv);
      {
        const labels = placeLabels(l, labelScale(k));
        const r = (b: typeof labels[0]) => ({ x: b.x - b.w, y: b.y - b.h / 2, w: b.w, h: b.h });
        for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
          const a = r(labels[i]), b = r(labels[j]);
          expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h, `${lv} @${k.toFixed(2)}: "${labels[i].text}" over "${labels[j].text}"`).toBe(false);
        }
      }
    }
  });
  it('stay about the same size on screen when zoomed out (at least 100% of their size at 95%)', () => {
    for (const k of [0.3, 0.4, 0.6, 0.95]) expect(labelScale(k) * k).toBeCloseTo(0.95, 5);
    expect(labelScale(1.5)).toBe(1);
  });
  it('never cover a box, at every zoom from 30% to 250%', async () => {
    for (let k = 0.3; k <= 2.5; k += 0.05) {
      const l = await lay(levelFor(k));
      for (const b of placeLabels(l, labelScale(k))) for (const [f, p] of Object.entries(l.pos)) {
        const x = b.x - b.w, y = b.y - b.h / 2;
        const hit = x < p.x + p.w - 0.5 && p.x < x + b.w - 0.5 && y < p.y + p.h - 0.5 && p.y < y + b.h - 0.5;
        expect(hit, `${levelFor(k)} @${k.toFixed(2)}: "${b.text}" covers ${f}`).toBe(false);
      }
    }
  });
  it('always sit on a straight stretch of their own line, never off it', async () => {
    for (let k = 0.3; k <= 2.5; k += 0.1) {
      const l = await lay(levelFor(k));
      for (const b of placeLabels(l, labelScale(k))) {
        const own = l.lines.filter((x) => b.keys.includes(`${x.a}>${x.b}`));
        const on = own.some((x) => x.pts.some((p, i) => i > 0 && Math.abs(p.y - b.y) < 0.5 && Math.abs(x.pts[i - 1].y - b.y) < 0.5 && b.x <= Math.max(p.x, x.pts[i - 1].x) + 0.5 && b.x >= Math.min(p.x, x.pts[i - 1].x) - 0.5));
        expect(on, `${levelFor(k)} @${k.toFixed(1)}: "${b.text}" is off its line`).toBe(true);
      }
    }
  });
  it('lines that end at the same row share one label', async () => {
    const labels = placeLabels(await lay('functions'));
    const intoClose = labels.find((x) => x.keys.includes(`${step('handle')}>${step('close')}`))!;
    expect(intoClose.keys).toContain(`${step('stop')}>${step('close')}`);
    expect(intoClose.text).toBe('22 · →22');
  });
});

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
  it('the marker\'s path starts at the first row and ends at the last', async () => {
    const l = await lay('functions'), rs = routesBetween(run, step('main'), 'split');
    const pts = routePoints(m, l, rs[1].rows);
    const a = rowAt(m, l, step('main'))!, b = rowAt(m, l, step('split'))!;
    expect(pts[0].y).toBe(a.y);
    expect(pts[pts.length - 1]).toEqual({ x: b.x + 34, y: b.y });
  });
});

describe('focus and how often', () => {
  it('parse_headers and two calls around it', () => {
    const n = [...neighbourhood(m, step('parse_headers'))].map((i) => R[i].name.replace(/.*::/, '')).sort();
    expect(n).toEqual(['handle', 'is_space', 'parse_headers', 'split', 'start', 'trim']);
  });
  it('from the loops around each row', () => {
    expect(howOftenLevel(run, step('main')).text).toBe('once');
    expect(howOftenLevel(run, step('read_env')).text).toBe('×4');
    expect(howOftenLevel(run, step('is_space')).text).toBe('3 loops');
  });
});

describe('the walk marker', () => {
  it('returns up the lines it came in on, then goes down to the next call', async () => {
    const { walkPoints } = await import('../shared/flowboxes');
    const l = await lay('functions');
    // trim (strings.cpp) returns to parse_headers, then handle calls route (router.cpp)
    const from = R.findIndex((r) => r.kind === 'ref' && r.name.endsWith('trim')), to = step('route');
    const pts = walkPoints(m, l, from, to);
    const ph = rowAt(m, l, step('parse_headers'))!, rt = rowAt(m, l, to)!, hd = rowAt(m, l, step('handle'))!;
    expect(pts.some((p) => p.y === ph.y && p.x >= ph.x && p.x <= ph.x + ph.w)).toBe(true);   // through parse_headers' row
    expect(pts.some((p) => p.y === hd.y && p.x >= hd.x && p.x <= hd.x + hd.w)).toBe(true);   // and handle's
    expect(pts[pts.length - 1]).toEqual({ x: rt.x + 34, y: rt.y });
  });
});

describe('drawing only what is in view', () => {
  it('every box that meets the view (and a screen around it) is drawn; those far away are not', () => {
    const r = viewRect({ x: 2000, y: 0 }, { w: 1000, h: 800 }, 1, 600);
    expect(meets(r, { x: 2500, y: 100, w: 260, h: 80 })).toBe(true);            // on screen
    expect(meets(r, { x: 1200, y: 100, w: 260, h: 80 })).toBe(true);            // within a screen to the left
    expect(meets(r, { x: 100, y: 100, w: 260, h: 80 })).toBe(false);            // far left
    expect(meets(r, { x: 2500, y: 3000, w: 260, h: 80 })).toBe(false);          // far below
    const z = viewRect({ x: 0, y: 0 }, { w: 1000, h: 800 }, 0.5, 600);          // zoomed out: more of the diagram is in view
    expect(meets(z, { x: 2800, y: 100, w: 260, h: 80 })).toBe(true);
  });
});

describe('a much-called box', () => {
  it('lines into it are marked and carry no numbers; the box says how many call it', async () => {
    const l = await layoutBoxes(m, 'files', elk, { boxes: 2, from: 2 });
    const hubs = Object.keys(l.hubs);
    expect(hubs.length).toBeGreaterThan(0);
    for (const x of l.lines) expect(!!x.hub).toBe(!!l.hubs[nodeOf(m, 'files', x.fb)] && nodeOf(m, 'files', x.fa) !== nodeOf(m, 'files', x.fb));
    const labelled = new Set(placeLabels(l, 1).flatMap((b) => b.keys));
    for (const x of l.lines.filter((y) => y.hub)) expect(labelled.has(`${x.a}>${x.b}`)).toBe(false);
    // the default threshold leaves tinyhttp (8 files) as it was
    expect(Object.keys((await layoutBoxes(m, 'files', elk)).hubs)).toEqual([]);
  });
});
