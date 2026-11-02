// The sequence view's model, pure so it can be tested: which rows show (one-line helpers folded into their caller's
// row), stepping through them (back along the path walked, loop passes, step over and out, siblings), the layout
// (one row per y, a slot of its own for every loop label, so no text can sit on other text), and what the selected
// step's box says — every sentence restating something the run proved.
import type { Run, RunRow, RunFrame } from './flowrun';

// ---------- the rows shown ----------

export interface Seq {
  run: Run;
  items: number[];                   // the run rows shown, in run order
  itemOf: number[];                  // run row → its item, or the item it is folded into
  uses: Map<number, number[]>;       // shown row → the rows folded into it
  span: Map<number, [number, number]>;   // frame → the first and last item inside it (frames with nothing shown are absent)
  lastItem: number[];                // item → the last item inside it (itself when nothing shown runs inside)
}

/**
 * One-line helpers (at most this many lines, calling nothing) fold into their caller's row — but only when they run
 * unconditionally there: a helper inside a loop or an if keeps its row, so no condition is ever hidden.
 */
export const FOLD_LINES = 3;

export function buildSeq(run: Run, opts: { fold: boolean } = { fold: true }): Seq {
  const R = run.rows;
  const folds = (i: number): boolean => {
    const r = R[i];
    if (!opts.fold || r.caller == null) return false;
    if (ownFrames(run, i).length) return false;
    if (r.kind === 'ref') return folds(r.ref!) || (r.ref! !== i && R[r.ref!].last === r.ref! && small(R[r.ref!]));
    return r.kind === 'step' && r.last === i && small(r);
  };
  const small = (r: RunRow) => /^operator\W/.test(r.name) || (r.lines > 0 && r.lines <= FOLD_LINES);
  const items: number[] = [], itemOf = new Array<number>(R.length).fill(-1), uses = new Map<number, number[]>();
  for (let i = 0; i < R.length; i++) {
    if (folds(i)) {
      // a folded row's caller always shows: a folded row calls nothing, so it is never anyone's caller
      const c = R[i].caller!;
      uses.set(c, [...(uses.get(c) ?? []), i]);
      itemOf[i] = itemOf[c];
      continue;
    }
    itemOf[i] = items.length;
    items.push(i);
  }
  const span = new Map<number, [number, number]>();
  items.forEach((row, it) => { for (const f of R[row].frames) { const s = span.get(f); if (s) s[1] = it; else span.set(f, [it, it]); } });
  const lastItem = items.map((row, it) => {
    let j = it;
    while (j + 1 < items.length && items[j + 1] <= R[row].last) j++;
    return j;
  });
  return { run, items, itemOf, uses, span, lastItem };
}

const rowAt = (s: Seq, it: number): RunRow | null => (it >= 0 && it < s.items.length ? s.run.rows[s.items[it]] : null);
/** Loop frames around an item that have shown rows, outermost first. */
export function loopsAt(s: Seq, it: number): number[] {
  const r = rowAt(s, it);
  return r ? r.frames.filter((f) => s.run.frames[f].kind === 'loop' && s.span.has(f)) : [];
}

// ---------- stepping ----------

export type How = 'start' | 'call' | 'next' | 'return' | 'again' | 'back' | 'jump' | 'end';
/** A place in the walk. at === items.length is the end of the run. passes: loop frame → which pass. */
export interface StepState { at: number; passes: Record<number, number>; how: How; key: string; what: string; why: string }
export type Move =
  | 'next' | 'back' | 'over' | 'out' | 'again' | 'leave' | 'prevPass' | 'nextSibling' | 'prevSibling' | 'home' | 'end'
  | { goto: number } | { jump: number };

export function startState(s: Seq): StepState {
  return { at: 0, passes: settle(s, 0, {}), how: 'start', key: '', what: 'start', why: s.items.length ? s.run.rows[s.items[0]].name : '' };
}

/** Passes of the loops around `at`: kept for loops still around it, 1 for loops just entered. */
function settle(s: Seq, at: number, passes: Record<number, number>): Record<number, number> {
  const out: Record<number, number> = {};
  for (const f of loopsAt(s, at)) out[f] = passes[f] ?? 1;
  return out;
}

const KEY: Record<string, string> = { next: '→', back: '←', over: '⇧ →', out: '↑', again: 'R', leave: 'L', prevPass: '⇧ ←', nextSibling: ']', prevSibling: '[', home: 'Home', end: 'End', goto: 'G', jump: '' };
const WHAT: Record<string, string> = { next: 'next', back: 'back', over: 'step over', out: 'step out', again: 'another pass', leave: 'leave the loop', prevPass: 'previous pass', nextSibling: 'next call here', prevSibling: 'previous call here', home: 'the start', end: 'the end', goto: 'go to step', jump: 'jump' };

/**
 * One move. Returns the new trail (the path walked; back pops it), or the same trail and a note saying why the move
 * cannot be made here.
 */
export function move(s: Seq, trail: StepState[], m: Move): { trail: StepState[]; note?: string } {
  const cur = trail[trail.length - 1], R = s.run.rows, N = s.items.length;
  const name = typeof m === 'string' ? m : 'goto' in m ? 'goto' : 'jump';
  const go = (at: number, passes: Record<number, number>, why = '', how?: How) => {
    const p = settle(s, at, passes);
    const h: How = how ?? relation(s, cur.at, at);
    const w = why || (h === 'return' ? `back in ${R[R[s.items[at]].caller!].name}` : h === 'end' ? `${R[s.items[0]]?.name ?? 'the start'} returns` : '');
    return { trail: [...trail, { at, passes: p, how: h, key: KEY[name], what: WHAT[name], why: w }] };
  };
  const refuse = (note: string) => ({ trail, note });
  const r = rowAt(s, cur.at);
  // the first item after everything a row runs
  const after = (row: number) => { let j = s.itemOf[row] < 0 ? 0 : s.itemOf[row]; while (j < N && s.items[j] <= R[row].last) j++; return j; };

  if (name === 'back') return trail.length > 1 ? { trail: trail.slice(0, -1) } : refuse('this is where the walk started');
  if (name === 'home') return go(0, {}, '', 'jump');
  if (name === 'end') return go(N, {}, '', 'end');
  if (typeof m === 'object' && 'jump' in m) return m.jump >= 0 && m.jump <= N ? go(m.jump, cur.passes, '', m.jump === N ? 'end' : 'jump') : refuse('no such row');
  if (typeof m === 'object' && 'goto' in m) {
    const row = R.findIndex((x) => x.kind === 'step' && x.n === m.goto);
    if (row < 0) return refuse(`there is no step ${m.goto}`);
    const it = s.itemOf[row];
    return go(it, {}, s.items[it] !== row ? `${R[row].name} is folded into ${R[s.items[it]].name}` : '', 'jump');
  }
  if (cur.at >= N) return refuse('the end of the run');
  if (name === 'next') return go(cur.at + 1, cur.passes);
  if (name === 'over') {
    const to = after(s.items[cur.at]);
    const skipped = s.items.slice(cur.at + 1, to).filter((x) => R[x].kind === 'step').length;
    return go(to, cur.passes, skipped ? `skipped ${skipped} step${skipped > 1 ? 's' : ''} inside ${r!.name}` : `nothing runs inside ${r!.name}`);
  }
  if (name === 'out') {
    const fn = r!.caller;
    if (fn == null) return refuse(`${r!.name} is where the run starts`);
    const to = after(fn);
    return go(to, cur.passes, to >= N ? `finished ${R[fn].name}` : `finished ${R[fn].name} · back in ${R[R[s.items[to]].caller ?? fn].name}`);
  }
  if (name === 'nextSibling' || name === 'prevSibling') {
    const dir = name === 'nextSibling' ? 1 : -1, c = r!.caller;
    for (let j = cur.at + dir; j >= 0 && j < N; j += dir) {
      const row = s.items[j];
      if (c == null || (dir === 1 ? row > R[c].last : row <= c)) break;   // left the calling function
      if (R[row].caller === c) return go(j, cur.passes, '', 'next');
    }
    return refuse(name === 'nextSibling' ? `nothing else runs after this in ${r!.caller == null ? 'the run' : R[r!.caller].name}` : `this is the first call in ${r!.caller == null ? 'the run' : R[r!.caller].name}`);
  }
  const loops = loopsAt(s, cur.at);
  const inner = loops[loops.length - 1];
  if (name === 'again' || name === 'leave' || name === 'prevPass') {
    if (inner == null) return refuse('not inside a loop');
    const f = s.run.frames[inner], [a, b] = s.span.get(inner)!, p = cur.passes[inner] ?? 1;
    if (name === 'leave') {
      const left = f.count != null ? f.count - p : null;
      return go(b + 1, cur.passes, left === 0 ? 'that was its last pass' : left != null ? `skipped the other ${left} pass${left > 1 ? 'es' : ''}` : 'skipped its other passes');
    }
    if (name === 'again') {
      if (f.count != null && p >= f.count) return refuse(`that was the last of its ${f.count} passes`);
      // the passes of loops inside this one start again with it
      const kept: Record<number, number> = {};
      for (const k of loops) { kept[k] = cur.passes[k] ?? 1; if (k === inner) break; }
      kept[inner] = p + 1;
      return go(a, kept, `pass ${p + 1}${f.count != null ? ` of ${f.count}` : ''}`, 'again');
    }
    if (p <= 1) return refuse('this is its first pass');
    return go(cur.at, { ...cur.passes, [inner]: p - 1 }, `pass ${p - 1}${f.count != null ? ` of ${f.count}` : ''}`, 'again');
  }
  return refuse('unknown move');
}

/** How control gets from one item to another: into a call, on in the same function, or back out to a caller. */
function relation(s: Seq, from: number, to: number): How {
  if (to >= s.items.length) return 'end';
  const R = s.run.rows, a = rowAt(s, from), b = R[s.items[to]];
  if (!a) return 'jump';
  if (b.caller === s.items[from]) return 'call';
  if (b.caller === a.caller) return 'next';
  // b runs inside a's caller chain: control came back up
  for (let c = a.caller; c != null; c = R[c].caller) if (c === b.caller) return 'return';
  return 'jump';
}

/** The moves that do something at the current step, as their key and a word: shown under the step in both views. */
export function stepWays(s: Seq, trail: StepState[]): [string, string][] {
  const c = trail[trail.length - 1];
  if (!c || c.at >= s.items.length) return [];
  const out: [string, string][] = [['→', 'next']];
  const r = s.run.rows[s.items[c.at]];
  if (s.lastItem[c.at] > c.at) out.push(['⇧ →', 'step over']);
  if (r.caller != null) out.push(['↑', 'step out']);
  if (loopsAt(s, c.at).length) out.push(['R', 'another pass'], ['L', 'leave the loop']);
  if (trail.length > 1) out.push(['←', 'back']);
  return out;
}

/** The walk the trail stands for, as the last few distinct items before the current one (the ember trail). */
export function embers(trail: StepState[], n = 4): number[] {
  if (!trail.length) return [];   // before the run is ready
  const out: number[] = [], cur = trail[trail.length - 1].at;
  for (let k = trail.length - 2; k >= 0 && out.length < n; k--) { const a = trail[k].at; if (a !== cur && !out.includes(a)) out.push(a); }
  return out;
}

// ---------- layout ----------

export interface SeqGeom {
  mode: 'files' | 'depth';
  lanes: string[];                   // files mode: one column per file, in order of first appearance
  y: number[]; h: number[];          // per item; then the end-of-run row at index items.length
  slotY: Map<number, number>;        // loop frame → the y of its label's own row
  x: number[];                       // per item: where its text starts
  barX: number[];                    // per item: where the bar of a running function is drawn
  height: number;
}
export interface GeomOpts { width: number; rowH: number; slotH: number; top: number; boxH: number; mode?: 'files' | 'depth'; laneMin?: number; maxLanes?: number; folded?: Set<number>; skip?: [number, number]; extra?: Map<number, number> }

/** Columns, rows and label slots. Every row and every label has its own y band; no two overlap (checked in tests). */
export function layoutSeq(s: Seq, at: number, o: GeomOpts): SeqGeom {
  const R = s.run.rows, N = s.items.length;
  const fileOf = (row: number): string => { const r = R[row]; return r.kind === 'step' || r.kind === 'ref' ? r.file : r.caller != null ? R[r.caller].file : r.file; };
  const lanes: string[] = [];
  for (const row of s.items) { const f = fileOf(row); if (!lanes.includes(f)) lanes.push(f); }
  const fits = lanes.length <= (o.maxLanes ?? 8) && (o.width - 40) / lanes.length >= (o.laneMin ?? 150);
  const mode = o.mode ?? (fits ? 'files' : 'depth');
  const laneW = mode === 'files' ? Math.floor((o.width - 40) / Math.max(1, lanes.length)) : 0;
  // how many functions of the same column are still running around a row (files mode: they nest by a few pixels)
  const nestOf = new Array<number>(N).fill(0);
  if (mode === 'files') {
    const open: number[] = [];   // items whose rows are still running
    s.items.forEach((row, it) => {
      while (open.length && R[s.items[open[open.length - 1]]].last < row) open.pop();
      nestOf[it] = open.filter((o2) => fileOf(s.items[o2]) === fileOf(row)).length;
      open.push(it);
    });
  }
  const depthX = (d: number) => 20 + Math.min(d, 24) * 16 + Math.max(0, d - 24) * 3;
  const x: number[] = [], barX: number[] = [];
  s.items.forEach((row, it) => {
    if (mode === 'files') {
      const lx = 34 + lanes.indexOf(fileOf(row)) * laneW;
      x.push(lx + 12 + nestOf[it] * 6 + (R[row].kind === 'indirect' || R[row].kind === 'value' ? 6 : 0));
      barX.push(lx + 3 + nestOf[it] * 6);
    } else {
      x.push(depthX(R[row].depth) + 10);
      barX.push(depthX(R[row].depth) + 3);
    }
  });
  // folded calls: what runs inside one is drawn as a single row under it (hidden items take no space)
  const hidden = hiddenBy(s, o.folded);
  // what-if: the items a condition would skip take no space; a row under the item before them says so
  if (o.skip) for (let i = o.skip[0]; i <= o.skip[1]; i++) hidden.add(i);
  // label slots: each loop gets a thin row of its own above its first item (loops starting together stack, outermost first)
  const startsAt = new Map<number, number[]>();
  for (const [f, [a]] of s.span) if (s.run.frames[f].kind === 'loop' && !hidden.has(a)) startsAt.set(a, [...(startsAt.get(a) ?? []), f]);
  for (const l of startsAt.values()) l.sort((p, q) => depthOf(s.run.frames, p) - depthOf(s.run.frames, q));
  const y: number[] = [], h: number[] = [], slotY = new Map<number, number>();
  let yy = o.top;
  for (let it = 0; it <= N; it++) {
    for (const f of startsAt.get(it) ?? []) { slotY.set(f, yy); yy += o.slotH; }
    y.push(yy);
    const hh = hidden.has(it) ? 0 : (it === at ? o.rowH + o.boxH : o.rowH) + (o.folded?.has(it) && !hidden.has(it) ? o.rowH : 0) + (o.skip && it === o.skip[0] - 1 ? o.rowH : 0) + (o.extra?.get(it) ?? 0);
    h.push(hh);
    yy += hh;
  }
  return { mode, lanes, y, h, slotY, x, barX, height: yy };
}
/** The items folded calls hide: everything that runs inside each folded item (the folded item itself shows). */
export function hiddenBy(s: Seq, folded?: Set<number>): Set<number> {
  const out = new Set<number>();
  for (const f of folded ?? []) for (let i = f + 1; i <= (s.lastItem[f] ?? f); i++) out.add(i);
  for (const f of folded ?? []) if (out.has(f)) for (let i = f + 1; i <= s.lastItem[f]; i++) out.add(i);
  return out;
}
/** Whether a call has anything inside it to fold. */
export const foldable = (s: Seq, it: number) => it >= 0 && it < s.items.length && s.lastItem[it] > it;

// ---------- what if a condition went the other way ----------
export interface WhatIf { frame: number; skip: [number, number]; ask: string; says: string; then: string; rows: number }
/**
 * The steps that run only because a condition went one way, and what happens instead if it goes the other: past an
 * early exit (`if (headers.empty()) return`) everything after it is skipped and the function returns (or the loop
 * goes on, or is left); inside an if's arm or the right side of && / ||, the arm's steps are skipped. Null when the
 * frame is not a condition or nothing shown runs under it.
 */
export function whatIf(s: Seq, frame: number): WhatIf | null {
  const f = s.run.frames[frame], sp = s.span.get(frame);
  if (!f || !sp || (f.kind !== 'guard' && f.kind !== 'arm') || sp[0] === 0) return null;
  const R = s.run.rows, owner = f.owner != null ? R[f.owner]?.name.replace(/^.*::(?=[^:]+$)/, '') ?? '' : '';
  const rows = sp[1] - sp[0] + 1;
  const cond = f.text.replace(/^if \((.*)\)$/, '$1');
  let ask: string, says: string;
  if (f.kind === 'guard') {
    ask = `what if ${cond} is true?`;
    says = f.label === 'return' ? `${owner} returns here` : f.label === 'continue' ? 'the loop goes on to its next pass' : f.label === 'break' ? 'the loop is left here' : `${f.label} here`;
  } else {
    const m = /^(&&|\|\|) (.*)$/.exec(f.label);
    if (m) { ask = `what if ${cond} is ${m[1] === '&&' ? 'false' : 'true'}?`; says = `${m[2]} is not evaluated`; }
    else if (f.label === 'else') { ask = `what if ${cond} is true?`; says = 'the else branch does not run'; }
    else { ask = `what if ${cond} is false?`; says = `the ${f.label === 'then' ? 'if' : f.label} branch does not run`; }
  }
  // where control goes instead: out of the function, round its loop, or on to what follows the skipped steps
  const short = (n: string) => n.replace(/^.*::(?=[^:]+$)/, '');
  const caller = f.owner != null ? R[f.owner]?.caller : null;
  const loop = f.parent != null ? s.run.frames[f.parent] : null;
  let then: string;
  if (f.kind === 'guard' && f.label === 'return') then = caller != null ? `back in ${short(R[caller].name)}` : 'the end of the run';
  else if (f.kind === 'guard' && (f.label === 'continue' || f.label === 'break') && loop?.kind === 'loop') then = f.label === 'continue' ? `the next pass of ${loop.text}` : `on after ${loop.text}`;
  else then = sp[1] + 1 < s.items.length ? `${R[s.items[sp[1] + 1]].kind === 'step' ? R[s.items[sp[1] + 1]].n + ' ' : ''}${short(R[s.items[sp[1] + 1]].name)}` : 'the end of the run';
  return { frame, skip: [sp[0], sp[1]], ask, says, then, rows };
}

// ---------- chapters: the run's parts, for the spine ----------
export interface Chapter { from: number; to: number; label: string; depth: number }
/**
 * The run's parts: each call the entry function makes (and each loop in its own body) is a chapter; a chapter that is
 * more than a quarter of the run is split the same way one level down. Only what the run states.
 */
export function chapters(s: Seq): Chapter[] {
  const R = s.run.rows, N = s.items.length, out: Chapter[] = [];
  if (!N) return out;
  const parts = (owner: number, from: number, to: number, depth: number) => {
    const res: Chapter[] = [];
    const loops = s.run.frames.map((f, k) => ({ f, k })).filter(({ f, k }) => f.kind === 'loop' && f.owner === owner && s.span.has(k));
    for (let it = from; it <= to; it++) {
      const row = s.items[it];
      if (R[row].caller !== owner) continue;
      const loop = loops.find(({ k }) => s.span.get(k)![0] === it);
      if (loop) { const [a, b] = s.span.get(loop.k)!; res.push({ from: a, to: b, label: `↻ ${loop.f.text}`, depth }); it = b; continue; }
      res.push({ from: it, to: s.lastItem[it], label: R[row].name.replace(/^.*::(?=[^:]+$)/, ''), depth });
      it = s.lastItem[it];
    }
    return res;
  };
  for (const c of parts(s.items[0], 1, N - 1, 0)) {
    out.push(c);
    if (c.to - c.from + 1 > N / 4) {
      const owner = c.label.startsWith('↻') ? R[s.items[c.from]].caller! : s.items[c.from];
      out.push(...parts(owner, c.label.startsWith('↻') ? c.from : c.from + 1, c.to, 1));
    }
  }
  return out;
}

// ---------- walks to share ----------
/** A walk as text that reopens it: the entry point's key and the places walked (item, then loop passes). */
export function encodeWalk(entry: string, trail: StepState[], keep = 40, notes: Record<number, string> = {}): string {
  const states = trail.slice(-keep).map((t) => [t.at, ...Object.entries(t.passes).filter(([, p]) => p > 1).map(([f, p]) => `${f}-${p}`)].join('.'));
  const ns = Object.entries(notes).filter(([, t]) => t.trim()).map(([it, t]) => `${it}:${encodeURIComponent(t)}`).join(',');
  return `skycodex:walk?entry=${encodeURIComponent(entry)}&at=${states.join(',')}${ns ? `&notes=${encodeURIComponent(ns)}` : ''}`;
}
/** The places a shared walk names, checked against this run; null when it is not a walk or names places that do not exist. */
export function decodeWalk(s: Seq, text: string): { entry: string; trail: StepState[]; notes: Record<number, string> } | null {
  const m = /^skycodex:walk\?entry=([^&]*)&at=([\d.,-]+)(?:&notes=([^&]*))?$/.exec(text.trim());
  if (!m) return null;
  const trail: StepState[] = [];
  for (const part of m[2].split(',')) {
    const [a, ...ps] = part.split('.');
    const at = Number(a);
    if (!Number.isInteger(at) || at < 0 || at > s.items.length) return null;
    const passes: Record<number, number> = {};
    for (const f of loopsAt(s, at)) passes[f] = 1;
    for (const p of ps) { const [f, n] = p.split('-').map(Number); if (!(f in passes) || !(n >= 1)) return null; const c = s.run.frames[f].count; if (c != null && n > c) return null; passes[f] = n; }
    trail.push({ at, passes, how: trail.length ? 'jump' : 'start', key: '', what: '', why: '' });
  }
  const notes: Record<number, string> = {};
  if (m[3]) for (const part of decodeURIComponent(m[3]).split(',')) {
    const k = part.indexOf(':'), it = Number(part.slice(0, k));
    if (k < 1 || !Number.isInteger(it) || it < 0 || it >= s.items.length) return null;
    notes[it] = decodeURIComponent(part.slice(k + 1));
  }
  return trail.length ? { entry: decodeURIComponent(m[1]), trail, notes } : null;
}
/**
 * A walk written out as a walkthrough to read or send: each place in the order walked, what runs there, where it is,
 * who calls it and the loops and conditions around it — each line restating what the run proved.
 */
export function walkthrough(s: Seq, trail: StepState[], title: string, rel: (file: string) => string, lineOf: (file: string, line: number) => string, notes: Record<number, string> = {}): string {
  const R = s.run.rows, out = [`# ${title}`, '', `${trail.length} places, in the order walked.`, ''];
  const seen = new Set<string>();
  let k = 0;
  for (const t of trail) {
    const key = `${t.at}|${JSON.stringify(t.passes)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (t.at >= s.items.length) { out.push(`${++k}. **end of the run** — ${R[s.items[0]]?.name ?? 'the entry point'} returns`, ''); continue; }
    const r = R[s.items[t.at]], short = (n: string) => n.replace(/^.*::(?=[^:]+$)/, '');
    const head = r.kind === 'step' ? `step ${r.n} · ${short(r.name)}` : r.kind === 'ref' ? `${short(r.name)} again (step ${R[r.ref!].n})` : r.kind === 'indirect' ? `call through ${r.via}` : `${r.name}, named not called`;
    out.push(`${++k}. **${head}**${r.kind === 'step' || r.kind === 'ref' ? ` — \`${rel(r.file)}:${r.line + 1}\`` : ''}`);
    if (r.caller != null && r.at) {
      const cf = R[r.caller];
      out.push(`   called from ${short(cf.name)} (\`${rel(cf.file)}:${r.at.line + 1}\`): \`${lineOf(cf.file, r.at.line).trim()}\``);
    }
    for (const f of r.frames.map((i) => ({ i, fr: s.run.frames[i] }))) {
      if (f.fr.kind === 'loop') out.push(`   in the loop \`${f.fr.text}\`${t.passes[f.i] ? ` · pass ${t.passes[f.i]}${f.fr.count != null ? ` of ${f.fr.count}` : ''}` : ''}`);
      else if (f.fr.kind === 'guard') out.push(`   only past \`${f.fr.text}\` (it can ${f.fr.label})`);
      else if (f.fr.kind === 'arm') out.push(`   only when \`${f.fr.text}\`${f.fr.label === 'else' ? ' is false' : ''}`);
      else if (f.fr.kind === 'thread') out.push('   on a new thread');
    }
    if (notes[t.at]?.trim()) out.push(`   > note: ${notes[t.at].trim()}`);
    out.push('');
  }
  return out.join('\n');
}
function depthOf(frames: RunFrame[], f: number): number { let d = 0; for (let p = frames[f].parent; p != null; p = frames[p].parent) d++; return d; }

// ---------- what the selected step's box says ----------

export interface Fact { head: string; text: string; grade: 'proved' | 'possible' | 'unknown'; steps?: number[] }

/** Frames around a row that its caller is not already inside: what is particular about this call. */
export function ownFrames(run: Run, row: number): number[] {
  const r = run.rows[row];
  const outer = new Set(r.caller == null ? [] : run.rows[r.caller].frames);
  return r.frames.filter((f) => !outer.has(f));
}

/** A frame, said as a condition on the row inside it. */
export function frameText(f: RunFrame, pass?: number): string {
  switch (f.kind) {
    case 'loop': return `↻ ${f.text}${f.count != null ? ` · ×${f.count}` : ''}${pass ? ` · pass ${pass}${f.count != null ? ` of ${f.count}` : ''}` : ''}`;
    case 'arm': {
      const m = /^(&&|\|\|) (.*)$/.exec(f.label);
      if (m) return `only when ${f.text} is ${m[1] === '&&' ? 'true' : 'false'}`;
      if (f.label === 'then') return /^if\b/.test(f.text) ? `only when ${f.text} holds` : `only when ${f.text} is true`;
      if (f.label === 'else') return /^if\b/.test(f.text) ? `only when ${f.text} does not hold` : `only when ${f.text} is false`;
      if (/^catch\b/.test(f.label)) return `only when the try throws · ${f.label}`;
      return `only in ${f.label} of ${f.text}${f.fallsThrough ? ' · falls through to the next case' : ''}`;
    }
    case 'guard': return `only when ${f.text} did not ${f.label === 'throw' ? 'throw' : f.label}`;
    case 'thread': return 'on a new thread';
    case 'lambda': return 'in a lambda · runs when the lambda is called';
    case 'once': return 'the first time only · a static initializer';
    case 'virtual': return `virtual · ${f.text}`;
  }
}

/** How often a row runs per run of the entry point, as far as it is certain. */
export function howOften(run: Run, row: number): Fact {
  const fr = run.rows[row].frames.map((f) => run.frames[f]);
  const loops = fr.filter((f) => f.kind === 'loop');
  const conditional = fr.some((f) => f.kind === 'arm' || f.kind === 'guard' || f.kind === 'once' || f.kind === 'lambda' || f.kind === 'virtual');
  const counted = loops.every((f) => f.count != null);
  const times = loops.reduce((a, f) => a * (f.count ?? 1), 1);
  const say = (n: number) => (n === 1 ? 'once' : `${n} times`);
  if (!loops.length) return { head: 'runs', text: conditional ? 'at most once' : 'once', grade: 'proved' };
  if (counted) return { head: 'runs', text: conditional ? `at most ${say(times)}` : say(times), grade: 'proved' };
  const inner = [...loops].reverse().find((f) => f.count == null)!;
  return { head: 'runs', text: `once per pass of ${inner.text}${conditional ? ', when its conditions hold' : ''} · how many passes depends on the run`, grade: 'unknown' };
}

/** The facts the selected step's box shows, in order. Each one restates the run; none is inferred. */
export function stepFacts(s: Seq, at: number, passes: Record<number, number>): Fact[] {
  const R = s.run.rows, row = s.items[at], r = R[row];
  const out: Fact[] = [];
  const num = (i: number) => (R[i].kind === 'step' ? R[i].n : R[i].kind === 'ref' ? R[R[i].ref!].n : 0);
  if (r.caller != null) out.push({ head: 'called from', text: `${R[r.caller].n} ${R[r.caller].name}${r.at ? ` · line ${r.at.line + 1}` : ''}`, grade: 'proved', steps: [r.caller] });
  else out.push({ head: 'called from', text: 'the start of the run', grade: 'proved' });
  if (r.kind === 'ref') out.push({ head: 'again', text: r.recursive ? `a call back into step ${R[r.ref!].n}, which is still running` : `the same function as step ${R[r.ref!].n}, running again here`, grade: 'proved', steps: [r.ref!] });
  if (r.kind === 'indirect') out.push({ head: 'target', text: VIA[r.via ?? ''] ?? 'not known here', grade: 'unknown' });
  if (r.kind === 'indirect' && r.could?.length) out.push({ head: 'could be', text: `${r.could.slice(0, 6).join(' · ')}${r.could.length > 6 ? ` +${r.could.length - 6}` : ''} — functions whose address the code takes`, grade: 'possible' });
  if (r.kind === 'value') out.push({ head: 'named', text: `${r.name} is passed on here, not called (a callback or a pointer)`, grade: 'proved' });
  const e = r.kind === 'step' ? s.run.effects?.[r.key] : undefined;
  if (e) {
    const ch = [...e.writes, ...e.globalWrites.map((g) => `global ${g}`)];
    if (ch.length) out.push({ head: 'changes', text: ch.join(' · '), grade: 'proved' });
    if (e.locks.length) out.push({ head: 'locks', text: e.locks.join(' · '), grade: 'proved' });
    if (e.allocates.length) out.push({ head: 'allocates', text: e.allocates.join(' · '), grade: 'proved' });
    if (e.throws.length) out.push({ head: 'throws', text: e.throws.join(' · '), grade: 'proved' });
  }
  for (const f of findings(s.run)) if (f.rows.includes(row)) out.push({ head: f.kind === 'race' ? 'two threads' : 'result unused', text: f.text, grade: f.grade, steps: f.rows });
  if (r.kind === 'step') {
    const kids = R.map((x, i) => ({ x, i })).filter(({ x }) => x.caller === row);
    if (kids.length) out.push({ head: 'calls', text: kids.map(({ x, i }) => (x.kind === 'step' ? `${x.n} ${x.name}` : x.kind === 'ref' ? `→ ${num(i)} ${x.name}` : x.kind === 'indirect' ? `⇢ ${x.text}` : `${x.name} (named)`)).join(' · '), grade: 'proved', steps: kids.map(({ i }) => i) });
    else out.push({ head: 'calls', text: 'nothing in the project', grade: 'proved' });
  }
  const own = ownFrames(s.run, row);
  for (const f of own) out.push({ head: s.run.frames[f].kind === 'loop' ? 'repeats' : 'when', text: frameText(s.run.frames[f], passes[f]), grade: 'proved' });
  if (r.kind === 'step' || r.kind === 'ref') out.push(howOften(s.run, row));
  if (r.unsequenced) out.push({ head: 'order', text: 'another argument of the same call also calls a project function; which runs first is the compiler’s choice', grade: 'possible' });
  if (r.approx) out.push({ head: 'where', text: 'inside a macro: placed at its statement, the finest position clangd gives', grade: 'possible' });
  const folded = s.uses.get(row);
  if (folded?.length) out.push({ head: 'uses', text: folded.map((i) => `${num(i)} ${R[i].name}`).join(' · '), grade: 'proved', steps: folded });
  return out;
}
const VIA: Record<string, string> = {
  'std::function': 'through a std::function · which function it holds is known only at run time',
  pointer: 'through a function pointer · its target is known only at run time',
  'member pointer': 'through a pointer to a member function · its target is known only at run time',
  dependent: 'inside a template · the target depends on the types it is instantiated with',
  unresolved: 'the compiler could not resolve this call · check this file’s build settings (include paths, defines)',
};

/** The comment right above a function, verbatim, else nothing. lines: the file's lines; start: the function's first line. */
export function leadingComment(lines: string[], start: number): string {
  let k = start - 1;
  const out: string[] = [];
  if (k >= 0 && /\*\/\s*$/.test(lines[k])) {
    while (k >= 0) { out.unshift(lines[k]); if (/\/\*/.test(lines[k])) break; k--; }
    return out.join('\n').replace(/^\s*\/\*+\s?|\s*\*+\/\s*$/g, '').split('\n').map((l) => l.replace(/^\s*\*\s?/, '').trim()).filter(Boolean).join(' ');
  }
  while (k >= 0 && /^\s*\/\//.test(lines[k])) { out.unshift(lines[k].replace(/^\s*\/\/+\s?/, '').trim()); k--; }
  return out.filter(Boolean).join(' ');
}

// ---------- detail levels: the code between calls ----------
export type Detail = 'calls' | 'decisions' | 'all';
export interface CodeLine { n: number; text: string; depth: number }
/** Code lines of one function (the item it runs as), shown after another item. */
export interface CodeBlock { owner: number; lines: CodeLine[] }
const DECISION = /^(?:\}\s*)?(?:if|else|switch|case|default|return|break|continue|throw|goto|for|while|do|co_return|co_yield|try|catch)\b/;
const MAX_BLOCK = 40;

/**
 * The code a function runs between its calls, for the functions shown at more than calls: each block of lines goes
 * after the row where the function is running again (its own row, or the last row inside the call before them).
 * decisions: conditions, loops, returns and jumps; all: every line but blank ones and lone braces. Read-only rows —
 * stepping stays on calls. text(file) gives a file's lines (null while it is read).
 */
export function codeBlocks(s: Seq, detail: (row: number) => Detail, text: (file: string) => string[] | null): Map<number, CodeBlock[]> {
  const R = s.run.rows, out = new Map<number, CodeBlock[]>();
  const kids = new Map<number, number[]>();
  R.forEach((r, i) => { if (r.caller != null && r.at) kids.set(r.caller, [...(kids.get(r.caller) ?? []), i]); });
  s.items.forEach((row, it) => {
    const r = R[row];
    if (r.kind !== 'step' || !r.lines || detail(row) === 'calls') return;
    const L = text(r.file);
    if (!L) return;
    const lvl = detail(row), first = r.start, last = r.start + r.lines - 1;
    // the body starts after the line holding the opening brace
    let from = first;
    while (from < last && !(L[from] ?? '').includes('{')) from++;
    from++;
    const calls = (kids.get(row) ?? []).filter((c) => s.itemOf[c] >= 0).sort((a, b) => R[a].at!.line - R[b].at!.line);
    const callLines = new Set(calls.map((c) => R[c].at!.line));
    const base = (L[from] ?? '').search(/\S/);
    const take = (a: number, b: number, after: number) => {
      const rows: CodeLine[] = [];
      for (let n = a; n <= b && n < last; n++) {
        const raw = L[n] ?? '', t = raw.trim();
        if (!t || /^[{}]+;?$/.test(t) || callLines.has(n)) continue;
        if (lvl === 'decisions' && !DECISION.test(t)) continue;
        rows.push({ n, text: t, depth: Math.max(0, Math.round((raw.search(/\S/) - Math.max(0, base)) / 4)) });
      }
      if (!rows.length) return;
      const shown = rows.length > MAX_BLOCK ? [...rows.slice(0, MAX_BLOCK - 1), { n: -1, text: `… ${rows.length - MAX_BLOCK + 1} more lines`, depth: 0 }] : rows;
      out.set(after, [...(out.get(after) ?? []), { owner: it, lines: shown }]);
    };
    let at = from, after = it;
    for (const c of calls) {
      const cl = R[c].at!.line;
      if (cl < at) { after = s.lastItem[s.itemOf[c]] ?? after; continue; }
      take(at, cl - 1, after);
      at = cl + 1;
      after = s.lastItem[s.itemOf[c]] ?? s.itemOf[c];
    }
    take(at, last, after);
  });
  // where blocks share a place, the innermost function's code comes first: it finishes before its caller goes on
  for (const bs of out.values()) bs.sort((a, b) => b.owner - a.owner);
  return out;
}

// ---------- findings: what the run shows without running it (src/shared/flowfacts.ts gives the facts) ----------
export interface Finding { kind: 'race' | 'dropped' | 'pair'; text: string; grade: 'proved' | 'possible'; rows: number[] }

/** The thread a row runs on: the step that started it (its first row on that thread), or -1 for the entry's own. */
export function threadOf(run: Run, row: number): number {
  let r = row;
  while (run.rows[r].thread) { const c = run.rows[r].caller; if (c == null || !run.rows[c].thread) return r; r = c; }
  return -1;
}

/**
 * Two kinds, both exact restatements of the code: a call whose result the statement throws away when the function
 * returns a value (proved), and state one thread changes while another uses it with no lock on either side
 * (possible: whether they meet in time depends on the run).
 */
const findingsOf = new WeakMap<Run, Finding[]>();
export function findings(run: Run): Finding[] {
  const hit = findingsOf.get(run);
  if (hit) return hit;
  const out = findingsIn(run);
  findingsOf.set(run, out);
  return out;
}
function findingsIn(run: Run): Finding[] {
  const R = run.rows, fx = run.effects ?? {}, out: Finding[] = [];
  const short = (n: string) => n.replace(/^.*::(?=[^:]+$)/, '');
  const within = (p: { line: number; character: number }, r: { start: { line: number; character: number }; end: { line: number; character: number } }) =>
    (p.line > r.start.line || (p.line === r.start.line && p.character >= r.start.character)) && (p.line < r.end.line || (p.line === r.end.line && p.character <= r.end.character));
  // results thrown away
  const seen = new Set<string>();
  R.forEach((r, i) => {
    if ((r.kind !== 'step' && r.kind !== 'ref') || r.caller == null || !r.at) return;
    const callee = fx[r.key], caller = fx[R[r.caller].key];
    if (!callee?.returnsValue || !caller?.dropped.some((d) => within(r.at!, d))) return;
    const k = `${R[r.caller].key}@${r.at.line}:${r.at.character}`;
    if (seen.has(k)) return;
    seen.add(k);
    const n = r.kind === 'step' ? r.n : R[r.ref!].n;
    out.push({ kind: 'dropped', grade: 'proved', rows: [i, r.caller], text: `${short(R[r.caller].name)} drops what ${n} ${short(r.name)} returns (line ${r.at.line + 1})` });
  });
  // state used on two threads, written on at least one, with no lock in either function
  const uses = new Map<string, { row: number; thread: number; write: boolean; locked: boolean }[]>();
  R.forEach((r, i) => {
    if (r.kind !== 'step') return;
    const e = fx[r.key];
    if (!e) return;
    const t = threadOf(run, i), locked = e.locks.length > 0;
    const put = (k: string, write: boolean) => uses.set(k, [...(uses.get(k) ?? []), { row: i, thread: t, write, locked }]);
    for (const m of e.writes) put(`${e.owner ?? r.file}::${m}`, true);
    for (const m of e.reads) put(`${e.owner ?? r.file}::${m}`, false);
    for (const g of e.globalWrites) put(`::${g}`, true);
    for (const g of e.globalReads) put(`::${g}`, false);
  });
  for (const [k, us] of uses) {
    const w = us.find((u) => u.write && !u.locked);
    if (!w) continue;
    const o = us.find((u) => u.thread !== w.thread && !u.locked);
    if (!o) continue;
    const name = k.startsWith('::') ? k.slice(2) : k;
    const where = (u: typeof w) => `${R[u.row].n} ${short(R[u.row].name)} (${u.thread < 0 ? 'the main thread' : `the thread ${R[u.thread].n} ${short(R[u.thread].name)} starts`})`;
    out.push({ kind: 'race', grade: 'possible', rows: [w.row, o.row], text: `${name}: changed by ${where(w)}, ${o.write ? 'changed' : 'used'} by ${where(o)} — no lock on either side` });
  }
  // something a function opens and leaves open at a way out (src/shared/flowpairs.ts): possible, the path's
  // conditions decide whether it runs
  R.forEach((r, i) => {
    if (r.kind !== 'step') return;
    for (const u of run.pairs?.[r.key] ?? []) {
      const [took, kept] = u.what === 'lock' ? ['taken', 'released'] : u.what === 'memory' ? ['allocated', 'freed'] : ['opened', 'closed'];
      const how = u.exit.kind === 'end' ? 'by its end' : `if it ${u.exit.kind === 'throw' ? 'throws' : 'returns'} at line ${u.exit.line + 1}`;
      // the same condition tested twice on the path: the path may never run
      const conds = u.path.map((p) => p.replace(/ · (?:not taken|then|else|pass)$/, ''));
      const twice = conds.find((c, j) => conds.indexOf(c) !== j);
      const path = u.path.length ? ` (${u.path.join(', then ')})` : '';
      out.push({ kind: 'pair', grade: 'possible', rows: [i], text: `${short(r.name)}: ${u.what} ${u.name} ${took} on line ${u.opened.line + 1} · not ${kept} ${how}${path}${twice ? ` — the path tests ${twice} twice, so it may never run` : ''}` });
    }
  });
  return out;
}
