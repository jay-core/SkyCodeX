// The boxes view's model, pure so it can be tested: built from the run (the same one the sequence walks), files are
// boxes, the functions that run are rows in execution order, and every call between files is a line from the
// caller's row to the callee's row carrying the step numbers of the calls it stands for. Zoomed out, the same run is
// drawn as files, then folders. Also here: routes between two functions, a function's neighbourhood, how often a row
// runs, and where each line's numbers go so that none overlap at any zoom.
import type { Run, RunRow } from './flowrun';

export type Level = 'functions' | 'files' | 'folders';
export interface BoxRow { type: 'fn' | 'loop'; row: number; y: number; frame?: number }
export interface Call { a: number; b: number; rows: number[]; thread: boolean }   // caller step → callee step
export interface BoxModel {
  run: Run;
  files: string[];                     // in order of first appearance in the run
  dirs: string[];                      // their folders, the same way
  rowsOf: Map<string, number[]>;       // file → its step rows, by step number
  calls: Call[];
  dirOf: (file: string) => string;
}

const ROW_H = 21, LOOP_H = 16, HEAD = 36;
export const BOX_W: Record<Level, number> = { functions: 262, files: 300, folders: 400 };
/** The box a file is drawn in at a level: its own, or (folders) its folder's, keyed "dir:<folder>". */
export const nodeOf = (m: BoxModel, level: Level, file: string) => (level === 'folders' ? `dir:${m.dirOf(file)}` : file);
export const PAD = 28;
/** Zoomed out below these, the diagram is drawn one level coarser (semantic zoom), so text stays readable. */
export const LEVEL_AT = { functions: 0.7, files: 0.4 };   // function rows ≥ 9px on screen; files' words keep their size
export const levelFor = (k: number): Level => (k >= LEVEL_AT.functions ? 'functions' : k >= LEVEL_AT.files ? 'files' : 'folders');
/** A label's size in diagram units at zoom k: 1 at 100% and above, larger below so its numbers stay as big on screen. */
export const labelScale = (k: number) => Math.max(1, 0.95 / k);
/** The smallest scale: below it even folders would be specks. */
export const MIN_K = 0.3;

const targetOf = (R: RunRow[], i: number): number | null => (R[i].kind === 'step' ? i : R[i].kind === 'ref' ? R[i].ref! : null);
/** The step a row stands for: itself, the step a repeat refers to, or (an indirect call or a named function) its caller. */
export function stepOf(run: Run, i: number): number {
  const r = run.rows[i];
  return r.kind === 'step' ? i : r.kind === 'ref' ? r.ref! : r.caller ?? i;
}

export function boxModel(run: Run, root = ''): BoxModel {
  const R = run.rows, files: string[] = [], rowsOf = new Map<string, number[]>();
  for (let i = 0; i < R.length; i++) {
    if (R[i].kind !== 'step' || !R[i].file) continue;
    if (!rowsOf.has(R[i].file)) { rowsOf.set(R[i].file, []); files.push(R[i].file); }
    rowsOf.get(R[i].file)!.push(i);
  }
  for (const l of rowsOf.values()) l.sort((a, b) => R[a].n - R[b].n);
  const calls: Call[] = [];
  for (let i = 0; i < R.length; i++) {
    const t = targetOf(R, i), c = R[i].caller;
    if (t == null || c == null) continue;
    const e = calls.find((x) => x.a === c && x.b === t);
    if (e) e.rows.push(i); else calls.push({ a: c, b: t, rows: [i], thread: R[i].thread && !R[c].thread });
  }
  const rel = (f: string) => (root && f.startsWith(root + '/') ? f.slice(root.length + 1) : f);
  const dirOf = (f: string) => { const r = rel(f), k = r.lastIndexOf('/'); return k < 0 ? '' : r.slice(0, k); };
  const dirs: string[] = [];
  for (const f of files) if (!dirs.includes(dirOf(f))) dirs.push(dirOf(f));
  return { run, files, dirs, rowsOf, calls, dirOf };
}

/** Loops a function's own body holds, outermost first. */
export const loopsOwned = (run: Run, row: number) => run.frames.map((f, k) => ({ f, k })).filter(({ f }) => f.kind === 'loop' && f.owner === row).map(({ k }) => k);

export function boxGeom(m: BoxModel, file: string, level: Level): { w: number; h: number; rows: BoxRow[] } {
  if (level !== 'functions') {
    // a box as tall as the lines meeting one of its sides need, so each line's numbers have room at the zooms it shows
    const ins = new Set<string>(), outs = new Set<string>(), R = m.run.rows;
    for (const c of m.calls) {
      if (!R[c.a].file || !R[c.b].file) continue;
      const a = nodeOf(m, level, R[c.a].file), b = nodeOf(m, level, R[c.b].file);
      if (a === b) continue;
      if (b === file) ins.add(a);
      if (a === file) outs.add(b);
    }
    const n = Math.max(ins.size, outs.size);
    const gap = level === 'files' ? 46 : 58;   // a label's height at the smallest zoom this level shows, and a little
    // titles keep their size on screen when zoomed out (styles.css: --inv), so a box is tall enough for them at the smallest zoom it shows
    return { w: BOX_W[level], h: Math.max(level === 'files' ? 150 : 176, gap * (n + 1)), rows: [] };
  }
  const rows: BoxRow[] = [];
  let y = HEAD;
  for (const i of m.rowsOf.get(file) ?? []) {
    rows.push({ type: 'fn', row: i, y }); y += ROW_H;
    for (const k of loopsOwned(m.run, i)) { rows.push({ type: 'loop', row: i, frame: k, y }); y += LOOP_H; }
  }
  return { w: BOX_W.functions, h: y + 10, rows };
}

/** The step numbers of the calls a line stands for: 15, →12 ×2 … (the first four, then +n). */
export function callNums(run: Run, rows: number[]): string {
  const R = run.rows, by: [string, number][] = [];
  for (const i of rows) {
    const t = targetOf(R, i)!, x = R[i].kind === 'step' ? String(R[i].n) : `→${R[t].n}`;
    const f = by.find((y) => y[0] === x);
    if (f) f[1]++; else by.push([x, 1]);
  }
  const parts = by.map(([x, n]) => (n > 1 ? `${x} ×${n}` : x));
  return parts.length > 4 ? `${parts.slice(0, 4).join(' · ')} +${parts.length - 4}` : parts.join(' · ');
}

// ---------- layout (ELK, as the app's other diagrams) ----------
export interface Pt { x: number; y: number }
export interface Line { id: string; a: number; b: number; fa: string; fb: string; rows: number[]; thread: boolean; pts: Pt[]; text: string; hub?: boolean }
export interface Lay { level: Level; pos: Record<string, { x: number; y: number; w: number; h: number }>; lines: Line[]; groups: { dir: string; x: number; y: number; w: number; h: number }[]; w: number; h: number; hubs: Record<string, number> }
/**
 * A box many others call (a string or logging utility) would draw a fan of lines across the whole diagram: in a
 * diagram of at least `boxes` boxes, the lines into a box called from `from` or more others are drawn only when they
 * matter (the step's chain, a route); the box says how many call it, and its rows keep their step numbers.
 */
export const HUB = { boxes: 15, from: 6 };
type Elk = { layout: (g: unknown) => Promise<any> };

/**
 * Functions level: every function row is a port (in on the left, out on the right, at the row's height), so each line
 * runs from the caller's row to the callee's row and ELK routes it around every box. Calls inside one file get no line:
 * the numbers already say the order. Files level: one line per pair of files, with all their numbers; folders level:
 * one box per folder and one line per pair of folders.
 */
export async function layoutBoxes(m: BoxModel, level: Level, elk: Elk, hub = HUB): Promise<Lay> {
  const R = m.run.rows;
  const nodes = (level === 'folders' ? m.dirs.map((d) => `dir:${d}`) : m.files).map((f) => {
    const g = boxGeom(m, f, level), node: any = { id: f, width: g.w, height: g.h, layoutOptions: {} };
    // zoomed out, a line's numbers are drawn larger: each line meets the box at a port of its own, far enough apart
    if (level !== 'functions') Object.assign(node.layoutOptions, { 'elk.portConstraints': 'FIXED_SIDE', 'elk.spacing.portPort': '46', 'elk.nodeSize.constraints': 'PORTS MINIMUM_SIZE', 'elk.nodeSize.minimum': `(${g.w}, ${g.h})` }, {});
    if (level === 'functions') {
      node.layoutOptions['elk.portConstraints'] = 'FIXED_POS';
      node.ports = g.rows.filter((r) => r.type === 'fn').flatMap((r) => [
        { id: `in${r.row}`, x: 0, y: r.y + 10, width: 1, height: 1, layoutOptions: { 'elk.port.side': 'WEST' } },
        { id: `out${r.row}`, x: g.w - 1, y: r.y + 10, width: 1, height: 1, layoutOptions: { 'elk.port.side': 'EAST' } }]);
    }
    return node;
  });
  const edges: any[] = [], meta: Omit<Line, 'pts'>[] = [];
  const byPair = new Map<string, Omit<Line, 'pts'>>();
  for (const c of m.calls) {
    if (!R[c.a].file || !R[c.b].file) continue;
    const fa = nodeOf(m, level, R[c.a].file), fb = nodeOf(m, level, R[c.b].file);
    if (fa === fb) continue;
    if (level === 'functions') {
      const id = `e${edges.length}`;
      edges.push({ id, sources: [`out${c.a}`], targets: [`in${c.b}`] });
      meta.push({ id, a: c.a, b: c.b, fa, fb, rows: c.rows, thread: c.thread, text: callNums(m.run, c.rows) });
      continue;
    }
    const k = `${fa}>${fb}`, e = byPair.get(k);
    if (e) { e.rows.push(...c.rows); e.thread &&= c.thread; continue; }
    const id = `e${edges.length}`, x = { id, a: c.a, b: c.b, fa, fb, rows: [...c.rows], thread: c.thread, text: '' };
    byPair.set(k, x); meta.push(x);
    edges.push({ id, sources: [`${k}:out`], targets: [`${k}:in`] });
    const na = nodes.find((n) => n.id === fa), nb = nodes.find((n) => n.id === fb);
    (na.ports ??= []).push({ id: `${k}:out`, width: 1, height: 1, layoutOptions: { 'elk.port.side': 'EAST' } });
    (nb.ports ??= []).push({ id: `${k}:in`, width: 1, height: 1, layoutOptions: { 'elk.port.side': 'WEST' } });
  }
  for (const x of meta) if (!x.text) x.text = x.thread ? 'thread' : callNums(m.run, x.rows.sort((p, q) => p - q));
  // room between columns for the widest label, at the size it is drawn at the smallest zoom this level shows
  const sMax = labelScale(level === 'functions' ? LEVEL_AT.functions : level === 'files' ? LEVEL_AT.files : MIN_K);
  const widest = Math.max(0, ...meta.map((x) => Math.min(x.text.length, condensed(x.text).length)));
  const gapX = Math.max(level === 'functions' ? 96 : 84, Math.round((widest * 7.2 + 10) * sMax + 24 * sMax));
  const left = Math.round(64 * (level === 'functions' ? 1 : sMax));   // the start marker, left of the first box
  const children: any[] = nodes;
  const g = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.edgeRouting': 'ORTHOGONAL',
      'elk.padding': `[top=12,left=${left},bottom=12,right=12]`, 'elk.layered.spacing.nodeNodeBetweenLayers': String(gapX), 'elk.spacing.nodeNode': level === 'functions' ? '26' : '24', 'elk.layered.spacing.edgeNodeBetweenLayers': '22',
      'elk.spacing.edgeEdge': level === 'functions' ? '12' : '36', 'elk.layered.spacing.edgeEdgeBetweenLayers': level === 'functions' ? '10' : '30', 'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES', 'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    },
    children, edges,
  });
  const pos: Lay['pos'] = {}, groups: Lay['groups'] = [];
  for (const c of g.children ?? []) {
    if (c.children) { groups.push({ dir: c.id.slice(4), x: c.x, y: c.y, w: c.width, h: c.height }); for (const k of c.children) pos[k.id] = { x: c.x + k.x, y: c.y + k.y, w: k.width, h: k.height }; }
    else pos[c.id] = { x: c.x, y: c.y, w: c.width, h: c.height };
  }
  // an edge's points are relative to the folder that holds it
  const all = [...(g.edges ?? []), ...(g.children ?? []).flatMap((c: any) => c.edges ?? [])];
  const lines: Line[] = [];
  for (const e of all) {
    const x = meta.find((q) => q.id === e.id);
    const sc = e.sections?.[0];
    if (!x || !sc) continue;
    const off = e.container && e.container !== 'root' ? groups.find((q) => `dir:${q.dir}` === e.container) : null;
    const pts = [sc.startPoint, ...(sc.bendPoints ?? []), sc.endPoint].map((q: Pt) => (off ? { x: q.x + off.x, y: q.y + off.y } : { x: q.x, y: q.y }));
    lines.push({ ...x, pts });
  }
  const hubs: Record<string, number> = {};
  if (Object.keys(pos).length >= hub.boxes) {
    const from = new Map<string, Set<string>>();
    for (const l of lines) { const a = nodeOf(m, level, l.fa), b = nodeOf(m, level, l.fb); if (a !== b) from.set(b, (from.get(b) ?? new Set()).add(a)); }
    for (const [b, set] of from) if (set.size >= hub.from) hubs[b] = set.size;
    for (const l of lines) if (hubs[nodeOf(m, level, l.fb)] && nodeOf(m, level, l.fa) !== nodeOf(m, level, l.fb)) l.hub = true;
  }
  return { level, pos, lines, groups, w: g.width ?? 0, h: g.height ?? 0, hubs };
}

/** Where a function row is in the functions layout: its box's left edge, the row's middle, the box's width. */
export function rowAt(m: BoxModel, lay: Lay, row: number): { x: number; y: number; w: number } | null {
  const f = m.run.rows[row]?.file, p = f ? lay.pos[nodeOf(m, lay.level, f)] : null;
  if (!p) return null;
  if (lay.level !== 'functions') return { x: p.x, y: p.y + p.h / 2, w: p.w };
  const g = boxGeom(m, f, 'functions').rows.find((r) => r.type === 'fn' && r.row === row);
  return g ? { x: p.x, y: p.y + g.y + 10, w: p.w } : null;
}

// ---------- the numbers on the lines ----------
/** A label's short form: its first and last numbers and how many calls (15 · →12 ×2 · 21 → 15…21 ·3). */
export function condensed(text: string): string {
  const parts = text.split(' · '), nums = parts.flatMap((x) => x.split(' ')).filter((x) => /\d/.test(x) && !/^[×+]/.test(x));
  return nums.length < 2 || parts.length < 2 ? text : `${nums[0]}…${nums[nums.length - 1]} ·${parts.length}`;
}
export interface Label { keys: string[]; text: string; full: string; x: number; y: number; w: number; h: number; thread: boolean }
/**
 * One label per line end, always on its own line: first just before the arrowhead, right-aligned so it never enters
 * the box; when that spot is taken, further back along a straight stretch of the same line. Lines that end at the
 * same place share one label. s is the label's size factor in diagram units (1 at 100%, larger when zoomed out so the
 * numbers keep their size on screen). x is a label's right edge, y its middle.
 */
export function placeLabels(lay: Lay, s = 1, charW = 7.2): Label[] {
  const at = new Map<string, { b: Label; pts: Pt[] }>();
  for (const l of lay.lines) {
    if (l.hub) continue;   // into a much-called box: its rows carry the numbers
    const q = l.pts[l.pts.length - 1], k = `${Math.round(q.x)},${Math.round(q.y)}`, e = at.get(k);
    if (e) { e.b.keys.push(`${l.a}>${l.b}`); e.b.text = e.b.full = `${e.b.full} · ${l.text}`; continue; }
    at.set(k, { b: { keys: [`${l.a}>${l.b}`], text: l.text, full: l.text, x: q.x - 12 * s, y: q.y, w: 0, h: 0, thread: l.thread }, pts: l.pts });
  }
  const todo = [...at.values()];
  for (const { b } of todo) { b.w = (b.text.length * charW + 10) * s; b.h = 15 * s; }
  const rect = (b: Label) => ({ x: b.x - b.w, y: b.y - b.h / 2, w: b.w, h: b.h });
  const area = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
    Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const boxes = Object.values(lay.pos);
  const placed: Label[] = [];
  // spots along a line's straight horizontal stretches, from the arrowhead back to where the line starts
  const spotsOf = new Map<Label, [number, number][]>();
  for (const { b, pts } of todo) {
    const spots: [number, number][] = [];
    for (let i = pts.length - 1; i > 0; i--) {
      const p0 = pts[i - 1], p1 = pts[i];
      if (Math.abs(p0.y - p1.y) > 0.5) continue;
      const lo = Math.min(p0.x, p1.x), hi = Math.max(lo, Math.max(p0.x, p1.x) - (i === pts.length - 1 ? 12 * s : 0));
      for (let x = hi; x >= lo - 0.01; x -= 6 * s) spots.push([x, p0.y]);
    }
    spotsOf.set(b, spots.length ? spots : [[b.x, b.y]]);
  }
  /** The free-est spot for a label: no other label at all if possible, then as little box as possible. Returns what it still covers. */
  const put = (b: Label) => {
    let best = spotsOf.get(b)![0], cost = Infinity, left = Infinity, onBox = Infinity;
    for (const [x, y] of spotsOf.get(b)!) {
      b.x = x; b.y = y;
      const r = rect(b);
      let lab = 0, box = 0;
      for (const o of placed) if (o !== b) lab += area(r, rect(o));
      for (const o of boxes) box += area(r, o);
      const c = lab * 10 + box;
      if (c < cost - 0.01) { cost = c; left = lab; onBox = box; best = [x, y]; }
      if (c === 0) break;
    }
    [b.x, b.y] = best;
    return { lab: left, box: onBox };
  };
  /** No room for every number: the first and the last, and how many (the full list stays in its tooltip). */
  const condense = (b: Label) => {
    if (b.text !== b.full) return false;
    const c = condensed(b.full);
    if (c === b.full) return false;
    b.text = c;
    b.w = (b.text.length * charW + 10) * s;
    return true;
  };
  // the longest first (they have the fewest places), then from the top
  for (const { b } of todo.sort((p, q) => q.b.w - p.b.w || p.b.y - q.b.y)) {
    const first = put(b);
    if (first.lab > 0 || first.box > 0) {
      // make room: shorten this label, or the labels in its way, and place them again
      const r = rect(b), inWay = placed.filter((o) => area(r, rect(o)) > 0);
      const again = condense(b) ? put(b) : first;
      if (again.lab > 0) for (const o of inWay) if (condense(o)) put(o);
      put(b);
    }
    placed.push(b);
  }
  return placed;
}

// ---------- routes between two functions ----------
export interface RouteInfo { rows: number[]; at: number[] }   // the steps from a to b; the run rows where b is reached this way
/** Every way the run reaches a function named or keyed b from the step a: the chain of steps, and how often it is taken. */
export function routesBetween(run: Run, a: number, b: string): RouteInfo[] {
  const R = run.rows, out: RouteInfo[] = [];
  for (let i = 0; i < R.length; i++) {
    if ((R[i].kind !== 'step' && R[i].kind !== 'ref') || (R[i].key !== b && R[i].name !== b)) continue;
    const chain = [targetOf(R, i)!];
    for (let c = R[i].caller; c != null; c = R[c].caller) chain.unshift(c);
    const k = chain.indexOf(a);
    if (k < 0 || k === chain.length - 1) continue;   // not reached from a, or a itself
    const rows = chain.slice(k), key = rows.join('>'), e = out.find((x) => x.rows.join('>') === key);
    if (e) e.at.push(i); else out.push({ rows, at: [i] });
  }
  return out;
}
/** The loops and early exits a row is inside, as the run states them. */
export const frameWords = (run: Run, row: number) => run.rows[row].frames.map((k) => run.frames[k]).filter((f) => f.kind === 'loop' || f.kind === 'guard').map((f) => (f.kind === 'loop' ? `in ${f.text}` : `past ${f.text} → ${f.label}`));

/** The path a marker follows along a chain of steps: along the lines between files, down the box's edge inside one. */
export function routePoints(m: BoxModel, lay: Lay, rows: number[]): Pt[] {
  const pts: Pt[] = [];
  const add = (p: Pt) => { const l = pts[pts.length - 1]; if (!l || Math.abs(l.x - p.x) > 0.5 || Math.abs(l.y - p.y) > 0.5) pts.push(p); };
  for (let k = 0; k + 1 < rows.length; k++) {
    const a = rows[k], b = rows[k + 1], ra = rowAt(m, lay, a), rb = rowAt(m, lay, b);
    if (!ra || !rb) continue;
    const e = lay.lines.find((x) => (lay.level === 'functions' ? x.a === a && x.b === b : x.fa === nodeOf(m, lay.level, m.run.rows[a].file) && x.fb === nodeOf(m, lay.level, m.run.rows[b].file)));
    if (e) { add({ x: ra.x + ra.w - 30, y: ra.y }); for (const q of e.pts) add(q); add({ x: rb.x + 34, y: rb.y }); }
    else { add({ x: ra.x + 34, y: ra.y }); add({ x: ra.x + 10, y: ra.y }); add({ x: rb.x + 10, y: rb.y }); add({ x: rb.x + 34, y: rb.y }); }
  }
  return pts;
}

/**
 * The way control goes from one run row to another, for a marker to follow: up the lines it came in on to the step
 * both are inside, then down to the other (a return, the next call, another pass of a loop).
 */
export function walkPoints(m: BoxModel, lay: Lay, from: number, to: number): Pt[] {
  const R = m.run.rows;
  const chain = (r: number) => { const out = [stepOf(m.run, r)]; for (let c = R[r].caller; c != null; c = R[c].caller) if (c !== out[out.length - 1]) out.push(c); return out; };
  const A = chain(from), B = chain(to), common = A.find((x) => B.includes(x));
  if (common == null) return [];
  const climb = A.slice(0, A.indexOf(common) + 1), descend = B.slice(0, B.indexOf(common) + 1).reverse();
  const pts: Pt[] = [];
  const add = (q: Pt[]) => { for (const p of q) { const l = pts[pts.length - 1]; if (!l || Math.abs(l.x - p.x) > 0.5 || Math.abs(l.y - p.y) > 0.5) pts.push(p); } };
  for (let k = 0; k + 1 < climb.length; k++) add(routePoints(m, lay, [climb[k + 1], climb[k]]).reverse());
  for (let k = 0; k + 1 < descend.length; k++) add(routePoints(m, lay, [descend[k], descend[k + 1]]));
  if (!pts.length) { const r = rowAt(m, lay, stepOf(m.run, to)); if (r) pts.push({ x: r.x + 34, y: r.y }); }
  return pts;
}

// ---------- focus and how often ----------
/** A step and the steps up to `depth` calls above and below it. */
export function neighbourhood(m: BoxModel, row: number, depth = 2): Set<number> {
  const keep = new Set([row]);
  let up = [row], dn = [row];
  for (let d = 0; d < depth; d++) {
    up = up.flatMap((i) => m.calls.filter((c) => c.b === i).map((c) => c.a)); up.forEach((i) => keep.add(i));
    dn = dn.flatMap((i) => m.calls.filter((c) => c.a === i).map((c) => c.b)); dn.forEach((i) => keep.add(i));
  }
  return keep;
}
/** How often a step runs, from the loops around it: 0 once, 1 for one loop (or a known count), more for deeper. */
export function howOftenLevel(run: Run, row: number): { level: number; text: string } {
  const loops = run.rows[row].frames.map((f) => run.frames[f]).filter((f) => f.kind === 'loop');
  if (!loops.length) return { level: 0, text: 'once' };
  if (loops.length === 1 && loops[0].count != null) return { level: 1, text: `×${loops[0].count}` };
  return { level: loops.length, text: `${loops.length} loop${loops.length > 1 ? 's' : ''}` };
}

/** The part of the diagram in view (diagram units), with a screen's margin around it so scrolling finds boxes drawn. */
export function viewRect(scroll: { x: number; y: number }, size: { w: number; h: number }, k: number, margin = 600): { x0: number; y0: number; x1: number; y1: number } {
  const m = margin / k;
  return { x0: (scroll.x - PAD) / k - m, y0: (scroll.y - PAD) / k - m, x1: (scroll.x + size.w - PAD) / k + m, y1: (scroll.y + size.h - PAD) / k + m };
}
/** Whether a box meets that part. */
export const meets = (r: { x0: number; y0: number; x1: number; y1: number }, b: { x: number; y: number; w: number; h: number }) => b.x + b.w >= r.x0 && b.x <= r.x1 && b.y + b.h >= r.y0 && b.y <= r.y1;
