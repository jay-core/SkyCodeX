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
export interface GeomOpts { width: number; rowH: number; slotH: number; top: number; boxH: number; mode?: 'files' | 'depth'; laneMin?: number; maxLanes?: number }

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
  // label slots: each loop gets a thin row of its own above its first item (loops starting together stack, outermost first)
  const startsAt = new Map<number, number[]>();
  for (const [f, [a]] of s.span) if (s.run.frames[f].kind === 'loop') startsAt.set(a, [...(startsAt.get(a) ?? []), f]);
  for (const l of startsAt.values()) l.sort((p, q) => depthOf(s.run.frames, p) - depthOf(s.run.frames, q));
  const y: number[] = [], h: number[] = [], slotY = new Map<number, number>();
  let yy = o.top;
  for (let it = 0; it <= N; it++) {
    for (const f of startsAt.get(it) ?? []) { slotY.set(f, yy); yy += o.slotH; }
    y.push(yy);
    const hh = it === at ? o.rowH + o.boxH : o.rowH;
    h.push(hh);
    yy += hh;
  }
  return { mode, lanes, y, h, slotY, x, barX, height: yy };
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
  if (r.kind === 'value') out.push({ head: 'named', text: `${r.name} is passed on here, not called (a callback or a pointer)`, grade: 'proved' });
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
