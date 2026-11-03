// The sequence view, the flow page's default: the run of one entry point, time going down, one row per call.
// The selected step opens as a box on rows of its own, with the lines around its call; back and next are marked on
// their rows; the last steps keep a fading warmth; loops are teal frames with their label in a slot of its own; only
// the call chain you are in keeps its bars. The spine on the right is the whole run, in chapters. A big call folds
// into one row (⇧F); / finds a function and walks one of its paths from the start; T tours the run; a walk can be
// shared as a link or written out as a walkthrough. Every position comes from layoutSeq (src/shared/flowseq.ts),
// which never lets two rows or labels share space.
import { For, Show, createSignal, createMemo, createEffect, on, onMount, onCleanup, JSX } from 'solid-js';
import { seq, trail, setTrail, runStatus, status, entries, entryStart, setLane, changed, waysOut, setWaysOut, earlyExits, leavingCount, followed, setFollowed, hitWords } from '../lib/flowstore';
import { watch, journey, watchable, argName } from '../../shared/flowwatch';
import { entryKey as keyOfEntry } from '../lib/flow';
import {
  move, Move, layoutSeq, stepFacts, embers, loopsAt, leadingComment, ownFrames, stepWays, hiddenBy, foldable, chapters,
  encodeWalk, decodeWalk, walkthrough, whatIf, StepState, Fact, WhatIf, codeBlocks, Detail, findings } from '../../shared/flowseq';
import { routesBetween, RouteInfo } from '../../shared/flowboxes';
import type { RunFrame, Exit } from '../../shared/flowrun';
import { settings, root, flash } from '../lib/store';
import { api, basename } from '../lib/api';
import { lines, textTick } from '../lib/seqtext';
import { hlLine } from '../lib/hlcode';
import StepPreview, { openStep } from './StepPreview';
import Magnifier from './Magnifier';
import PlayControls from './PlayControls';
import SettingChip from './SettingChip';
import CompareChip from './CompareChip';

const ROW = 23, SLOT = 15, TOP = 30, SPINE = 16, SKY = 50;
const HINT = 'asdfjklghqwertyuiop';
/** Runs longer than this open around the step (A shows the whole run). */
const AROUND_AT = 400;
const load = <T,>(key: string, d: T): T => { try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const keep = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* kept for this run */ } };

/** The keys, as the ? overlay lists them. */
const KEYS: [string, string][] = [
  ['→ / ←', 'next step / back along the path walked'], ['⇧ →', 'step over: skip what runs inside'], ['↑', 'step out: finish this function'],
  ['R', 'another pass of the loop'], ['L', 'leave the loop'], ['⇧ ←', 'previous pass'], [']  [', 'next / previous call in the same function'],
  ['Home / End', 'start / end of the run'], ['G', 'go to a step number, or paste a shared walk'], ['/', 'find a function and its paths from the start'],
  ['A', 'around the step: its callers and two levels of calls, the rest folded'], ['D / ⇧ D', 'more code in this function / everywhere: calls, decisions, all code'], ['⇧ F', 'fold or unfold this call'], ['T', 'tour: plays and waits at each loop and decision'], ['J', 'jump: two letters on every row in view'],
  ['E', 'ways out: the usual path dims, every early return, throw and exit lights'], ['W', 'watch a variable: every step that sets or reads it, through renames'], ['V', 'a value’s journey from this step: a parameter or what its calls pass on'], ['N', 'a note on this step'], ['K', 'the depth skyline on or off'], ['M', 'the magnifier on or off'], ['Enter', 'open the code at this step'],
  ['Space', 'play; again to pause'], ['+ / −', 'play faster / slower'], ['Tab', 'switch to the boxes view'], ['?', 'this list'],
];

export default function Sequence(props: { switcher: JSX.Element }) {
  let canvas!: HTMLDivElement, band: HTMLDivElement | undefined, spineEl!: HTMLCanvasElement;
  const [width, setWidth] = createSignal(1000), [height, setHeight] = createSignal(700);
  const [boxH, setBoxH] = createSignal(140);
  const [manual, setManual] = createSignal(0);
  const [caption, setCaption] = createSignal<{ key: string; what: string; why: string } | null>(null);
  const [gotoOpen, setGotoOpen] = createSignal(false);
  const [help, setHelp] = createSignal(false);
  const [playing, setPlaying] = createSignal(false);
  const [speed, setSpeed] = createSignal(1);
  const [folded, setFolded] = createSignal<Set<number>>(new Set());   // folded by hand (⇧F)
  const reduce = () => !!settings()['motion.reduce'];

  const S = () => seq();
  const cur = (): StepState | undefined => trail()[trail().length - 1];
  const N = () => S()?.items.length ?? 0;
  const R = () => S()!.run.rows;
  const rowOf = (it: number) => R()[S()!.items[it]];
  const atEnd = () => (cur()?.at ?? 0) >= N();
  // a new run: nothing folded, no path
  createEffect(on(seq, () => { setFolded(new Set<number>()); setPath(null); setWhat(null); }, { defer: true }));
  // what if a condition went the other way: the steps it would skip, and what happens instead
  const [what, setWhat] = createSignal<WhatIf | null>(null);
  const [whatMenu, setWhatMenu] = createSignal<{ it: number; options: WhatIf[] } | null>(null);
  const [compare, setCompare] = createSignal(false);
  const whatOptions = (it: number) => { const s = S()!; return ownFrames(s.run, s.items[it]).filter((f) => s.span.get(f)?.[0] === it).map((f) => whatIf(s, f)).filter((w): w is WhatIf => !!w); };
  // ---- what you've read: the functions you have been to, kept per folder and start ----
  const store = (kind: string) => `flow.${kind}:${root()}:${entryStart()}`;
  const [read, setRead] = createSignal<Set<string>>(new Set());
  createEffect(on([seq, root], () => setRead(new Set(load<string[]>(store('read'), [])))));
  createEffect(on(() => cur()?.at, (a) => {
    const s = S();
    if (!s || a == null || a >= s.items.length) return;
    const k = s.run.rows[s.items[a]].key;
    if (!k || read().has(k)) return;
    const r = new Set(read()); r.add(k); setRead(r); keep(store('read'), [...r]);
  }));
  const readCount = createMemo(() => { const s = S(); if (!s) return null; const steps = s.run.rows.filter((r) => r.kind === 'step'); return { n: steps.filter((r) => read().has(r.key)).length, of: steps.length }; });

  // ---- notes on steps: kept per folder and start, by function and which of its calls ----
  const noteKey = (it: number) => { const s = S()!, k = s.run.rows[s.items[it]].key; let occ = 0; for (let i = 0; i < it; i++) if (s.run.rows[s.items[i]].key === k) occ++; return `${k}|${occ}`; };
  const [noteStore, setNoteStore] = createSignal<Record<string, string>>({});
  createEffect(on([seq, root], () => setNoteStore(load<Record<string, string>>(store('notes'), {}))));
  const notesByItem = createMemo(() => { const s = S(), out: Record<number, string> = {}; if (!s) return out; const ns = noteStore(); if (!Object.keys(ns).length) return out; for (let i = 0; i < s.items.length; i++) { const t = ns[noteKey(i)]; if (t) out[i] = t; } return out; });
  function setNote(it: number, text: string) {
    const n = { ...noteStore() }, k = noteKey(it);
    if (text.trim()) n[k] = text.trim(); else delete n[k];
    setNoteStore(n); keep(store('notes'), n);
  }
  const [noteOpen, setNoteOpen] = createSignal(false);

  // ---- jump letters: two letters on every row in view ----
  const [jump, setJump] = createSignal<{ typed: string } | null>(null);
  const hints = createMemo(() => {
    if (!jump()) return [] as { it: number; k: string }[];
    const g = geom()!, lo = scroll(), hi = scroll() + viewH() - ROW;
    const rows = visible().filter((it) => g.y[it] >= lo && g.y[it] <= hi && it !== cur()?.at);
    return rows.map((it, i) => ({ it, k: HINT[Math.floor(i / HINT.length) % HINT.length] + HINT[i % HINT.length] }));
  });

  // ---- the change ripple: functions edited and not saved, and every chain that reaches them ----
  const changedItems = createMemo(() => { const s = S(), c = changed(), out = new Set<number>(); if (!s || !c.size) return out; s.items.forEach((row, it) => { const r = s.run.rows[row]; if (c.has(r.kind === 'ref' ? r.ref! : row)) out.add(it); }); return out; });
  const rippleChain = createMemo(() => { const s = S(), out = new Set<number>(); if (!s) return out; for (const it of changedItems()) for (let i: number | null = s.run.rows[s.items[it]].caller; i != null; i = s.run.rows[i].caller) out.add(s.itemOf[i]); return out; });

  function askWhat(w: WhatIf) {
    setWhatMenu(null); setCompare(false); setWhat(w);
    const c = cur();
    if (c && c.at >= w.skip[0] && c.at <= w.skip[1]) go({ jump: w.skip[0] - 1 }, true);
    say({ key: '?', what: w.ask.replace(/\?$/, ''), why: `${w.says} · ${w.rows} row${w.rows > 1 ? 's' : ''} would not run · Esc ends it` });
    canvas.focus();
  }

  // detail levels: calls only (the default), with decisions, or all code — everywhere (⇧D) or per function (D)
  const LEVELS: Detail[] = ['calls', 'decisions', 'all'];
  const [detailAll, setDetailAll] = createSignal<Detail>(load('flow.detail', 'calls'));
  const [detailFn, setDetailFn] = createSignal<Map<string, Detail>>(new Map());
  const detailOf = (row: number) => detailFn().get(R()[row].key) ?? detailAll();
  const nextLevel = (d: Detail) => LEVELS[(LEVELS.indexOf(d) + 1) % LEVELS.length];
  const levelWord = (d: Detail) => (d === 'calls' ? 'calls only' : d === 'decisions' ? 'calls and decisions' : 'all code');
  function cycleDetail(everywhere: boolean) {
    if (everywhere) { const d = nextLevel(detailAll()); setDetailAll(d); setDetailFn(new Map()); keep('flow.detail', d); say({ key: '⇧ D', what: `everywhere: ${levelWord(d)}`, why: d === 'calls' ? '' : 'code rows are for reading; → still steps call to call' }); return; }
    const c = cur(), s = S();
    if (!c || !s || atEnd()) return;
    let row = s.items[c.at];
    if (R()[row].kind !== 'step') row = R()[row].caller ?? row;
    const d = nextLevel(detailOf(row)), m = new Map(detailFn());
    m.set(R()[row].key, d); setDetailFn(m);
    say({ key: 'D', what: `${short(R()[row].name)}: ${levelWord(d)}`, why: 'D again for more · ⇧D everywhere' });
  }
  // what the run shows without running it (src/shared/flowseq.ts findings)
  const found = createMemo(() => (S() ? findings(S()!.run) : []));
  const [foundOpen, setFoundOpen] = createSignal(false);
  // ways out (E): every early return, throw, break, goto and call that never returns, with what leads there
  const exitsAt = (it: number): Exit[] => { const s = S(); return s ? earlyExits(s.run, s.items[it]) : []; };
  const leaving = createMemo(() => { const s = S(); return s ? leavingCount(s.run) : 0; });
  /** One way out as written: the condition it sits under, then the statement (or the call that never returns). */
  const exitWords = (x: Exit) => `${x.when.length ? `${x.when[x.when.length - 1]} → ` : ''}${x.kind === 'noreturn' ? `${x.callee} — never returns` : x.text}`;
  // watch a variable (W) and a value's journey (V): a picker, then the steps that touch it stay lit, saying how
  const [pick, setPick] = createSignal<{ kind: 'W' | 'V'; q: string; options: { label: string; note: string; go: () => void }[] } | null>(null);
  /** Values settled per call: the arm around this row that cannot happen in its call (first: the row that says why). */
  const deadAt = (it: number) => {
    const s = S();
    if (!s) return null;
    const f = s.run.rows[s.items[it]].frames.find((k) => s.run.frames[k].dead);
    if (f == null) return null;
    const fr = s.run.frames[f], before = it > 0 ? s.items[it - 1] : -1;
    return { why: fr.dead!, first: !(before >= fr.from && before <= fr.to) };
  };
  const hitsAt = (it: number) => { const f = followed(), s = S(); return f && s ? f.hits.filter((h) => h.row === s.items[it]) : []; };
  function openWatch() {
    const s = S();
    if (!s) return;
    if (followed() || pick()) { setFollowed(null); setPick(null); say({ key: 'W', what: 'the whole run', why: '' }); return; }
    setPick({ kind: 'W', q: '', options: watchable(s.run).map((v) => ({ label: `${v.owner ? `${short(v.owner)}::` : ''}${v.name}`, note: `${v.uses} function${v.uses === 1 ? '' : 's'}`, go: () => showFollow(`${v.owner ? `${short(v.owner)}::` : ''}${v.name}`, watch(s.run, v)) })) });
  }
  function openJourney() {
    const s = S(), c = cur();
    if (!s || !c || atEnd()) return;
    if (followed() || pick()) { setFollowed(null); setPick(null); say({ key: 'V', what: 'the whole run', why: '' }); return; }
    let row = s.items[c.at];
    if (R()[row].kind !== 'step') row = R()[row].caller ?? row;
    const e = s.run.effects?.[R()[row].key], names: string[] = [];
    for (const p of e?.params ?? []) names.push(p.name);
    R().forEach((r) => { if (r.caller === row) for (const a of r.args ?? []) { const n = argName(a); if (/^[A-Za-z_][\w.>-]*$/.test(n) && !names.includes(n)) names.push(n); } });
    if (!names.length) { say({ key: 'V', what: `${short(R()[row].name)} takes and passes on nothing to follow`, why: '' }); return; }
    setPick({ kind: 'V', q: '', options: names.map((n) => ({ label: n, note: e?.params?.some((p) => p.name === n) ? `a parameter of ${short(R()[row].name)}` : `passed on by ${short(R()[row].name)}`, go: () => showFollow(`${n} from ${short(R()[row].name)}`, journey(s.run, row, n)) })) });
  }
  function showFollow(label: string, hits: ReturnType<typeof watch>) {
    setPick(null);
    setFollowed({ label, hits });
    const steps = new Set(hits.map((h) => h.row)).size;
    say({ key: '·', what: `${label}: ${steps} step${steps === 1 ? '' : 's'} touch it`, why: steps ? 'the rest is dimmed · Esc for all' : 'nothing in this run sets or reads it' });
    canvas.focus();
  }
  function toggleWaysOut() {
    const on = !waysOut();
    setWaysOut(on);
    say({ key: 'E', what: on ? `ways out: ${leaving()} function${leaving() === 1 ? '' : 's'} can leave early` : 'the whole run', why: on ? 'the usual path is dimmed · E again for all' : '' });
  }
  const CODE_H = 18;
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  /** Ghosts (not in this build): a faint dotted line in place, below the row before them, with why. */
  const code = createMemo(() => {
    const s = S();
    if (!s) return new Map();
    const m = codeBlocks(s, detailOf, (f) => lines(f));
    for (const g of s.run.ghosts ?? []) {
      const it = s.itemOf[g.after], owner = s.itemOf[g.owner];
      if (it == null || it < 0 || owner == null || owner < 0) continue;
      const b = { owner, lines: [{ n: -1, depth: 0, text: `<span class="gh${g.kind === 'removed' ? ' gone' : ''}">${esc(g.names.map((n) => n.replace(/^.*::(?=[^:]+$)/, '')).join(' · '))}</span><span class="ghw">${esc(g.why)}</span>` }] };
      m.set(it, [...(m.get(it) ?? []), b]);
    }
    return m;
  });
  const codeExtra = createMemo(() => new Map([...code()].map(([it, bs]) => [it, bs.reduce((n: number, b: { lines: unknown[] }) => n + b.lines.length, 0) * CODE_H + 4])));
  // around the step (A, on by itself for very long runs): its callers and two levels of callees in full, every other
  // call folded to its own row; a call opened by hand stays open
  const [around, setAround] = createSignal<boolean | null>(null);
  const [opened, setOpened] = createSignal<Set<number>>(new Set());
  const aroundOn = () => around() ?? (S()?.items.length ?? 0) > AROUND_AT;
  const aroundSet = createMemo(() => {
    const s = S(), c = cur(), out = new Set<number>();
    if (!s || !c || !aroundOn()) return out;
    const at = Math.min(c.at, s.items.length - 1), anc = new Set<number>();
    for (let r: number | null = s.items[at]; r != null; r = s.run.rows[r].caller) anc.add(s.itemOf[r]);
    const d0 = s.run.rows[s.items[at]].depth;
    for (let it = 0; it < s.items.length; it++) {
      if (anc.has(it) || !foldable(s, it) || opened().has(it)) continue;
      const inside = it > at && it <= s.lastItem[at];
      if (!inside || s.run.rows[s.items[it]].depth - d0 >= 2) out.add(it);
    }
    return out;
  });
  const foldedAll = createMemo(() => (aroundOn() ? new Set([...aroundSet(), ...folded()]) : folded()));
  const hidden = createMemo(() => { const h = S() ? hiddenBy(S()!, foldedAll()) : new Set<number>(); const w = what(); if (w) for (let i = w.skip[0]; i <= w.skip[1]; i++) h.add(i); return h; });
  const geom = createMemo(() => {
    const s = S(), c = cur();
    if (!s || !c) return null;
    return layoutSeq(s, c.at, { width: width() - SPINE, rowH: ROW, slotH: SLOT, top: TOP, boxH: c.at < s.items.length ? boxH() : 0, folded: foldedAll(), skip: what()?.skip, extra: codeExtra() });
  });
  const [skyOn, setSkyOn] = createSignal(load('flow.skyline', true));
  const viewH = () => height() - (skyOn() ? SKY : 0);
  const scroll = createMemo(() => {
    const g = geom(), c = cur();
    if (!g || !c) return 0;
    const target = g.y[c.at] - viewH() * 0.36;
    return Math.max(0, Math.min(target + manual(), g.height + 120 - viewH()));
  });
  // only what is near the viewport is drawn: a run of any size stays fast
  const visible = createMemo(() => {
    const g = geom();
    if (!g) return [] as number[];
    const lo = scroll() - 400, hi = scroll() + height() + 400, out: number[] = [];
    let a = 0, b = N() - 1;
    while (a < b) { const m = (a + b) >> 1; if (g.y[m] + g.h[m] < lo) a = m + 1; else b = m; }
    for (let i = a; i < N() && g.y[i] <= hi; i++) if (!hidden().has(i)) out.push(i);
    return out;
  });

  // ---- what each row is, in this state ----
  const chain = createMemo(() => {
    const c = cur(), s = S(), set = new Set<number>();
    if (!s || !c || c.at >= s.items.length) return set;
    for (let i: number | null = s.items[c.at]; i != null; i = s.run.rows[i].caller) set.add(i);
    return set;
  });
  const ember = createMemo(() => embers(trail()));
  const prevAt = () => (trail().length > 1 ? trail()[trail().length - 2].at : -1);
  const nextAt = () => (cur() && cur()!.at < N() ? cur()!.at + 1 : -1);
  const nextIsReturn = createMemo(() => {
    const c = cur(), s = S();
    if (!s || !c || c.at >= s.items.length - 1) return '';
    const a = s.run.rows[s.items[c.at]], b = s.run.rows[s.items[c.at + 1]];
    return b.caller !== s.items[c.at] && b.caller !== a.caller && b.caller != null ? s.run.rows[b.caller].name : '';
  });
  const num = (it: number) => { const r = rowOf(it); return r.kind === 'step' ? String(r.n) : r.kind === 'ref' ? `→${R()[r.ref!].n}` : r.kind === 'indirect' ? '⇢' : '·'; };
  const short = (n: string) => n.replace(/^.*::(?=[^:]+$)/, '');
  // (after num and short, which it uses as soon as the view opens with unsaved edits)
  const rippleNote = createMemo(() => {
    const s = S(), c = changed();
    if (!s || !c.size) return '';
    const names = [...c].map((r) => short(s.run.rows[r].name));
    const at = [...changedItems()].map((it) => num(it));
    return `edited, not saved: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3}` : ''} · runs at ${at.slice(0, 6).join(', ')}${at.length > 6 ? ' …' : ''}`;
  });
  /** Notes a row carries itself: the conditions that start at it (loops have their own label slot instead). */
  const notes = (it: number) => {
    const s = S()!, r = rowOf(it), out: string[] = [];
    for (const f of ownFrames(s.run, s.items[it])) {
      const sp = s.span.get(f);
      if (!sp || sp[0] !== it) continue;
      const fr = s.run.frames[f];
      if (fr.kind !== 'loop') out.push(rowNote(fr));
    }
    if (markOf(r)) out.push(markOf(r));
    if (r.unsequenced) out.push('order: compiler’s choice');
    if (r.approx) out.push('~ in a macro');
    return out.join('   ');
  };
  const uses = (it: number) => (S()!.uses.get(S()!.items[it]) ?? []).map((i) => { const r = R()[i]; return `${short(r.name)} ${r.kind === 'step' ? r.n : R()[r.ref!].n}`; }).join(' · ');
  /** What a row says about itself when compared: another setting's (`only with DEBUG`), or a change's (`added`, `◆ changed · 2 lines`). */
  const markOf = (r: { only?: string; change?: string; changeNote?: string }) => r.only ?? (r.changeNote ? (r.change === 'changed' ? `◆ ${r.changeNote}` : r.changeNote) : '');
  /** The same for the calls folded into a row's "uses", grouped: `only with DEBUG: log_line`, `added: validate, check_size`. */
  const usesMarks = (it: number) => {
    const by = new Map<string, string[]>();
    for (const i of S()!.uses.get(S()!.items[it]) ?? []) { const w = markOf(R()[i]); if (w) by.set(w, [...(by.get(w) ?? []), short(R()[i].name)]); }
    return [...by].map(([w, ns]) => ({ text: `${w}: ${ns.join(', ')}`, added: w === 'added' }));
  };

  // ---- moves ----
  let capTimer: ReturnType<typeof setTimeout> | undefined;
  function say(c: { key: string; what: string; why: string }, ms = 2600) {
    setCaption(c);
    clearTimeout(capTimer);
    if (ms) capTimer = setTimeout(() => setCaption(null), ms);
  }
  function go(m: Move, quiet = false) {
    const s = S();
    if (!s || !trail().length) return;
    // a folded call: next goes past what runs inside it
    if (m === 'next' && foldedAll().has(cur()!.at)) m = 'over';
    // following a path: next is the path's next place
    const p = path();
    if (m === 'next' && p) {
      const after = p.items.find((it) => it > cur()!.at);
      if (after == null) { say({ key: '→', what: 'the end of this path', why: `${p.target} · Esc leaves the path` }); return; }
      m = { jump: after };
    }
    const r = move(s, trail(), m);
    if (r.note) { say({ key: '', what: r.note, why: '' }); return; }
    const c = r.trail[r.trail.length - 1];
    // a place inside a folded call opens it; one a what-if skips ends the what-if
    const w = what();
    if (w && c.at >= w.skip[0] && c.at <= w.skip[1]) { setWhat(null); setCompare(false); }
    if (hidden().has(c.at)) setFolded(new Set([...folded()].filter((f) => !(c.at > f && c.at <= s.lastItem[f]))));
    const from = cur()!.at;
    setTrail(r.trail);
    setManual(0);
    if (c.how === 'return') showReturn(from, c.at);
    if (p && typeof m === 'object' && 'jump' in m) say({ key: '→', what: `path ${p.index + 1}`, why: `${p.items.indexOf(c.at) + 1} of ${p.items.length} · ${short(R()[s.items[c.at]].name)}` });
    else if (!quiet && m !== 'back') say({ key: c.key, what: c.what, why: c.why });
    if (m === 'back') say({ key: '←', what: 'back', why: 'along the path you walked' });
  }

  // play: one step at a strict cadence; any other key stops it
  let timer: ReturnType<typeof setInterval> | undefined;
  createEffect(on([playing, speed], ([p, k]) => {
    clearInterval(timer);
    if (!p) return;
    timer = setInterval(() => { if (atEnd()) { setPlaying(false); return; } go('next', true); }, 900 / k);
  }));
  onCleanup(() => { clearInterval(timer); clearInterval(tourTimer); clearTimeout(capTimer); clearTimeout(peekTimer); });

  // ---- the return route: a dashed line back up the bars of what finished, into the caller, then on ----
  const [ret, setRet] = createSignal<{ d: string; head: string; key: number } | null>(null);
  let retKey = 0;
  function showReturn(from: number, to: number) {
    if (reduce()) return;
    const key = ++retKey;
    requestAnimationFrame(() => {
      const s = S(), g = geom();
      if (!s || !g || from >= s.items.length || to >= s.items.length || hidden().has(from)) return;
      const R0 = s.run.rows, back = R0[s.items[to]].caller;
      // the function that finished: the one on the old chain called by the function control is back in
      let child: number | null = s.items[from];
      while (child != null && R0[child].caller !== back) child = R0[child].caller;
      if (child == null || back == null) return;
      const ci = s.itemOf[child], bi = s.itemOf[back];
      if (ci < 0 || bi < 0) return;
      const y1 = g.y[from] + 11.5, y2 = g.y[to] + 11.5, xa = g.barX[ci] + 1.5, xb = g.barX[bi] + 1.5;
      const ybot = Math.min(y2 - 6, g.y[s.lastItem[ci]] + g.h[s.lastItem[ci]] - 4);
      const x0 = g.x[from] - 8, x2 = g.x[to] - 8;
      const d = `M${x0} ${y1} L${xa} ${y1} L${xa} ${ybot} L${xb} ${ybot} L${xb} ${y2} L${x2} ${y2}`;
      setRet({ d, head: `M${x2 - 6} ${y2 - 3.5} L${x2} ${y2} L${x2 - 6} ${y2 + 3.5}`, key });
      setTimeout(() => { if (ret()?.key === key) setRet(null); }, 1700);
    });
  }

  // ---- folding ----
  function toggleAround() {
    const on = !aroundOn();
    setAround(on); setOpened(new Set<number>());
    say({ key: 'A', what: on ? 'around the step' : 'the whole run', why: on ? 'its callers and two levels of calls in full, the rest folded · A again for all' : '' });
  }
  function toggleFold(it: number) {
    const s = S();
    if (!s) return;
    if (aroundSet().has(it)) { setOpened(new Set<number>([...opened(), it])); say({ key: '⇧ F', what: `unfolded ${short(R()[s.items[it]].name)}`, why: 'it stays open while you walk around it' }); return; }
    const f = new Set(folded());
    if (f.has(it)) { f.delete(it); say({ key: '⇧ F', what: `unfolded ${short(R()[s.items[it]].name)}`, why: '' }); }
    else if (foldable(s, it)) { f.add(it); say({ key: '⇧ F', what: `folded ${short(R()[s.items[it]].name)}`, why: `${foldSteps(it)} steps inside · ⇧F or a click opens it` }); }
    else { say({ key: '⇧ F', what: 'nothing runs inside this call', why: '' }); return; }
    setFolded(f);
  }
  const foldSteps = (it: number) => { const s = S()!; let n = 0; for (let i = it + 1; i <= s.lastItem[it]; i++) if (R()[s.items[i]].kind === 'step') n++; return n; };
  const foldNames = (it: number) => { const s = S()!, out: string[] = []; for (let i = it + 1; i <= s.lastItem[it]; i++) { const r = R()[s.items[i]]; if (r.caller === s.items[it] && r.kind === 'step' && !out.includes(short(r.name))) out.push(short(r.name)); } return out; };

  // ---- search and paths ----
  const [find, setFind] = createSignal<{ q: string; sel: number; fn: string | null; routes: RouteInfo[] } | null>(null);
  const [path, setPath] = createSignal<{ index: number; target: string; items: number[]; names: string } | null>(null);
  const matches = createMemo(() => {
    const f = find(), s = S();
    if (!f || !s || f.fn) return [] as { key: string; name: string; steps: string }[];
    const q = f.q.trim().toLowerCase(), by = new Map<string, { key: string; name: string; steps: string[] }>();
    for (const r of s.run.rows) {
      if (r.kind !== 'step' || (q && !short(r.name).toLowerCase().includes(q))) continue;
      const e = by.get(r.key) ?? { key: r.key, name: short(r.name), steps: [] };
      e.steps.push(String(r.n)); by.set(r.key, e);
    }
    for (const r of s.run.rows) if (r.kind === 'ref' && by.has(r.key)) by.get(r.key)!.steps.push(`→${R()[r.ref!].n}`);
    return [...by.values()].slice(0, 9).map((e) => ({ ...e, steps: e.steps.join(' · ') }));
  });
  function pickFunction(key: string) {
    const s = S();
    if (!s) return;
    const routes = routesBetween(s.run, s.items[0], key);
    const name = short(s.run.rows.find((r) => r.key === key)?.name ?? key);
    if (!routes.length) { // the start itself
      setFind(null); go({ jump: s.itemOf[s.run.rows.findIndex((r) => r.key === key)] }); return;
    }
    if (routes.length === 1) { followPath(routes[0], 0, name); return; }
    setFind({ q: name, sel: 0, fn: name, routes });
  }
  function followPath(r: RouteInfo, index: number, target: string) {
    const s = S()!;
    const items = [...new Set([...r.rows.slice(0, -1), ...r.at].map((row) => s.itemOf[row]))].filter((it) => it >= 0).sort((a, b) => a - b);
    setFind(null);
    setPath({ index, target, items, names: r.rows.map((q) => short(s.run.rows[q].name)).join(' › ') });
    say({ key: '/', what: `following path ${index + 1} to ${target}`, why: '→ goes along it · Esc leaves it' });
    canvas.focus();
  }
  const onPath = (it: number) => { const p = path(); return !p || p.items.includes(it); };

  // ---- tour: plays, naming each step, and waits at each loop and decision ----
  const [tour, setTour] = createSignal<'on' | 'waiting' | null>(null);
  let tourTimer: ReturnType<typeof setInterval> | undefined;
  function tell() {
    const s = S(), c = cur();
    if (!s || !c) return;
    if (c.at >= s.items.length) { say({ key: 'tour', what: 'the end of the run', why: `${short(R()[s.items[0]].name)} returns` }, 0); return; }
    const r = R()[s.items[c.at]], by = r.caller != null ? short(R()[r.caller].name) : '';
    const loop = r.frames.map((f) => s.run.frames[f]).filter((f) => f.kind === 'loop').pop();
    say({ key: 'tour', what: `${num(c.at)} ${r.kind === 'indirect' ? r.text : short(r.name)}`, why: `${by ? `called by ${by}` : 'the start of the run'}${loop ? ` · ${loop.count != null ? `×${loop.count}` : 'in a loop'}` : ' · once'}` }, 0);
  }
  /** What the tour stops at: a loop starting at the next place, or a condition the next place runs under. */
  function decisionAhead(): string {
    const s = S(), c = cur();
    if (!s || !c || c.at + 1 >= s.items.length) return '';
    const nx = c.at + 1;
    for (const f of s.run.rows[s.items[nx]].frames) {
      const sp = s.span.get(f), fr = s.run.frames[f];
      if (!sp || sp[0] !== nx) continue;
      if (fr.kind === 'loop') return `a loop: ${fr.text}`;
      if (fr.kind === 'arm' || fr.kind === 'guard') return `a decision: ${rowNote(fr).replace(/^\? /, '')}`;
    }
    return '';
  }
  function tourStep() {
    if (atEnd()) { stopTour(); return; }
    const d = decisionAhead();
    if (d && tour() === 'on') { setTour('waiting'); say({ key: 'tour waits', what: d, why: '↵ go on · R another pass · L leave · Esc stops' }, 0); return; }
    if (tour() !== 'on') return;
    go('next', true);
    tell();
  }
  function startTour() {
    setPlaying(false);
    setTour('on');
    tell();
    clearInterval(tourTimer);
    tourTimer = setInterval(tourStep, 1500 / speed());
  }
  function stopTour() { clearInterval(tourTimer); setTour(null); setCaption(null); }

  // ---- sharing ----
  const [share, setShare] = createSignal(false);
  const entryKey = () => entryStart();
  async function copyLink() {
    setShare(false);
    const t = encodeWalk(entryKey(), trail(), 40, notesByItem());
    try { await navigator.clipboard.writeText(t); flash('link to this walk copied · paste it into G (go to) to reopen it', 4000); }
    catch { flash(`couldn't copy: ${t}`, 8000); }
  }
  async function saveWalkthrough() {
    setShare(false);
    const s = S();
    if (!s) return;
    const rel = (f: string) => (f.startsWith(root() + '/') ? f.slice(root().length + 1) : f);
    const lineOf = (f: string, l: number) => lines(f)?.[l] ?? '';
    // the files a walkthrough quotes are read first
    const files = new Set(trail().flatMap((t) => (t.at < s.items.length ? [R()[s.items[t.at]].caller] : [])).filter((c): c is number => c != null).map((c) => R()[c].file));
    for (const f of files) lines(f);
    await new Promise((r) => setTimeout(r, 300));
    const md = walkthrough(s, trail(), `${basename(root())} · from ${short(R()[s.items[0]].name)}`, rel, lineOf, notesByItem());
    const file = (await api.fs.saveDialog(`${root()}/${basename(root())}-walk.md`)) as string | null;
    if (!file) return;
    await api.fs.write(file, md);
    flash(`saved ${basename(file)}`, 3000);
  }
  async function openWalk(text: string): Promise<boolean> {
    let s = S();
    if (!s || !text.trim().startsWith('skycodex:walk')) return false;
    const entry = /entry=([^&]*)/.exec(text)?.[1];
    const want = entry ? decodeURIComponent(entry) : '';
    const li = entries().findIndex((e) => keyOfEntry(e) === want);
    if (want && want !== entryStart() && li < 0) { say({ key: 'G', what: 'this walk starts somewhere this folder does not have', why: want }); return true; }
    if (want && want !== entryStart()) { await setLane(li); s = S(); }
    const w = s ? decodeWalk(s, text) : null;
    if (!w) { say({ key: 'G', what: 'this walk does not match the run as it is now', why: 'the code changed since it was shared' }); return true; }
    setFolded(new Set<number>()); setPath(null);
    for (const [it, t] of Object.entries(w.notes)) setNote(Number(it), t);
    setTrail(w.trail);
    say({ key: 'G', what: 'walk reopened', why: `${w.trail.length} places` });
    return true;
  }

  // ---- keys ----
  function onKey(e: KeyboardEvent) {
    if (gotoOpen() || find() || noteOpen() || pick() || e.metaKey || e.ctrlKey) return;
    const k = e.key, sh = e.shiftKey;
    if (jump()) {
      e.preventDefault(); e.stopPropagation();
      if (k === 'Escape' || k === 'Backspace' && !jump()!.typed) { setJump(null); return; }
      if (k.length !== 1 || !HINT.includes(k.toLowerCase())) return;
      const t = jump()!.typed + k.toLowerCase(), hit = hints().find((h) => h.k === t);
      if (hit) { setJump(null); go({ jump: hit.it }); return; }
      if (!hints().some((h) => h.k.startsWith(t))) { setJump(null); say({ key: 'J', what: 'no row has those letters', why: '' }); return; }
      setJump({ typed: t });
      return;
    }
    if (tour() && k === 'Enter') { e.preventDefault(); if (tour() === 'waiting') { setTour('on'); go('next', true); tell(); } return; }
    if (tour() && (k === 'r' || k === 'R' || k === 'l' || k === 'L')) { e.preventDefault(); go(k.toLowerCase() === 'r' ? 'again' : 'leave', true); setTour('on'); tell(); return; }
    if (tour() && k !== 'Tab') { stopTour(); if (k === 'Escape' || k === 't' || k === 'T') { e.preventDefault(); return; } }
    const map: Record<string, Move | (() => void)> = {
      ArrowRight: sh ? 'over' : 'next', ArrowLeft: sh ? 'prevPass' : 'back', ArrowUp: 'out',
      ArrowDown: () => say({ key: '↓', what: 'no indirect call here', why: '' }),
      r: 'again', R: 'again', l: 'leave', L: 'leave', ']': 'nextSibling', '[': 'prevSibling', Home: 'home', End: 'end',
      g: () => setGotoOpen(true), G: () => setGotoOpen(true), Enter: () => openStep(), '?': () => setHelp(!help()),
      '/': () => setFind({ q: '', sel: 0, fn: null, routes: [] }), t: () => startTour(), T: () => startTour(),
      F: () => { if (cur()) toggleFold(cur()!.at); },
      d: () => cycleDetail(false), D: () => cycleDetail(true),
      a: () => toggleAround(), A: () => toggleAround(),
      e: () => toggleWaysOut(), E: () => toggleWaysOut(),
      w: () => openWatch(), W: () => openWatch(), v: () => openJourney(), V: () => openJourney(),
      j: () => setJump({ typed: '' }), J: () => setJump({ typed: '' }),
      n: () => { if (cur() && !atEnd()) setNoteOpen(true); }, N: () => { if (cur() && !atEnd()) setNoteOpen(true); },
      k: () => { setSkyOn(!skyOn()); keep('flow.skyline', skyOn()); }, K: () => { setSkyOn(!skyOn()); keep('flow.skyline', skyOn()); },
      ' ': () => setPlaying(!playing()), '+': () => setSpeed(Math.min(4, speed() * 1.5)), '=': () => setSpeed(Math.min(4, speed() * 1.5)), '-': () => setSpeed(Math.max(0.25, speed() / 1.5)),
      Escape: () => { setHelp(false); setFollowed(null); setPick(null); setPlaying(false); setShare(false); setWhatMenu(null); if (what()) { setWhat(null); setCompare(false); say({ key: 'Esc', what: 'as the code runs again', why: '' }); } else if (path()) { setPath(null); say({ key: 'Esc', what: 'left the path', why: '' }); } },
    };
    if (k === 'ArrowDown' && cur() && !atEnd() && rowOf(cur()!.at).kind === 'indirect') { say({ key: '↓', what: 'step into', why: 'where it goes is known only at run time' }); e.preventDefault(); return; }
    if (k === 'Tab') return;   // the flow page switches views (components/Flow.tsx)
    if (k === 'f' && sh) { e.preventDefault(); if (cur()) toggleFold(cur()!.at); return; }
    const a = map[k];
    if (!a || (k === 'F' && !sh)) return;
    e.preventDefault();
    if (k !== ' ' && k !== '+' && k !== '=' && k !== '-') setPlaying(false);
    if (typeof a === 'function') a(); else go(a);
  }

  // ---- size, focus, the box's own height ----
  onMount(() => {
    const ro = new ResizeObserver(() => { setWidth(canvas.clientWidth); setHeight(canvas.clientHeight); });
    ro.observe(canvas);
    onCleanup(() => ro.disconnect());
    canvas.focus();
  });
  // the box is as tall as what it says: measured after it is drawn
  createEffect(on([() => cur()?.at, textTick, width], () => requestAnimationFrame(() => {
    if (!band) return;
    const h = (band.firstElementChild as HTMLElement | null)?.scrollHeight ?? 0;
    if (h && Math.abs(h + 26 - boxH()) > 1) setBoxH(h + 26);
  })));

  // ---- the spine: the whole run, in chapters ----
  const chaps = createMemo(() => (S() ? chapters(S()!) : []));
  const [chapPop, setChapPop] = createSignal<number | null>(null);   // the y the chapter list opens at
  createEffect(on([geom, () => cur()?.at, height, chaps, changedItems, notesByItem], () => drawSpine()));
  function drawSpine() {
    const s = S(), c = cur(), el = spineEl;
    if (!el || !s) return;
    const H = Math.max(1, height() - 16), dpr = window.devicePixelRatio || 1;
    el.width = 9 * dpr; el.height = H * dpr;
    const x = el.getContext('2d')!;
    x.scale(dpr, dpr);
    x.clearRect(0, 0, 9, H);
    const n = s.items.length, yOf = (i: number) => Math.round((i / Math.max(1, n)) * (H - 6)) + 3;
    // each top-level chapter: a hairline beside the ticks, alternating, with a gap between chapters
    chaps().filter((ch) => ch.depth === 0).forEach((ch, k) => {
      x.fillStyle = k % 2 ? '#4f6a6a' : '#5a5442';
      x.fillRect(0, yOf(ch.from) + 1, 1, Math.max(1, yOf(ch.to + 1) - yOf(ch.from) - 3));
    });
    for (let i = 0; i < n; i++) {
      x.fillStyle = changedItems().has(i) ? '#79c9ae' : loopsAt(s, i).length ? '#355a5a' : '#3a3f3a';
      x.fillRect(4, yOf(i), 3, changedItems().has(i) ? 2 : 1);
    }
    x.fillStyle = '#ad9b6f';
    for (const it of Object.keys(notesByItem())) x.fillRect(1, yOf(Number(it)) - 1, 3, 3);
    if (c) {
      x.fillStyle = '#ad9b6f';
      x.beginPath(); x.arc(5.5, yOf(Math.min(c.at, n)), 3.5, 0, Math.PI * 2); x.fill();
    }
  }
  const spineAt = (clientY: number) => { const r = spineEl.getBoundingClientRect(); return Math.max(0, Math.min(N() - 1, Math.round(((clientY - r.top - 3) / Math.max(1, r.height - 6)) * N()))); };
  const onSpine = (e: MouseEvent) => { setChapPop(null); go({ jump: spineAt(e.clientY) }); canvas.focus(); };
  let chapTimer: ReturnType<typeof setTimeout> | undefined;
  const chapAt = (it: number) => chaps().filter((ch) => it >= ch.from && it <= ch.to).pop();
  const stepNo = (it: number) => { const r = rowOf(it); return r.kind === 'step' ? r.n : r.kind === 'ref' ? R()[r.ref!].n : r.caller != null ? R()[r.caller].n : 0; };

  // ---- peek: hover a row to read its code; the selected step stays ----
  const [peek, setPeek] = createSignal<{ it: number; up: boolean } | null>(null);
  let peekTimer: ReturnType<typeof setTimeout> | undefined;
  const peekCode = createMemo(() => {
    const p = peek(), s = S();
    if (!p || !s) return null;
    const r = R()[s.items[p.it]];
    const fn = r.kind === 'ref' ? R()[r.ref!] : r.kind === 'step' ? r : null;
    if (!fn) return null;
    const L = lines(fn.file);
    if (!L) return null;
    const n = Math.max(1, Math.min(fn.lines || 8, 9));
    return { head: `${fn.n} ${short(fn.name)}`, loc: `${basename(fn.file)}:${fn.line + 1}`, lines: L.slice(fn.start, fn.start + n).map((t, k) => ({ n: fn.start + k + 1, html: hlLine(t) })), more: (fn.lines || 0) > n };
  });

  // ---- the header: where we are, and the whole call chain ----
  const [crumbsAll, setCrumbsAll] = createSignal(false);
  const header = createMemo(() => {
    const s = S(), c = cur();
    if (!s || !c) return null;
    const steps = s.run.rows.filter((r) => r.kind === 'step').length;
    if (c.at >= s.items.length) return { k: `${steps} / ${steps} · end`, loop: '', chain: [] as { name: string; it: number }[] };
    const r = s.run.rows[s.items[c.at]];
    const n = r.kind === 'step' ? r.n : r.kind === 'ref' ? s.run.rows[r.ref!].n : r.caller != null ? s.run.rows[r.caller].n : 0;
    const L = loopsAt(s, c.at), inner = L[L.length - 1];
    const f = inner != null ? s.run.frames[inner] : null;
    const loop = f ? `pass ${c.passes[inner] ?? 1}${f.count != null ? ` of ${f.count}` : ''} · ${f.text.length > 34 ? f.text.slice(0, 33) + '…' : f.text}${L.length > 1 ? ` · in ${L.length - 1} more loop${L.length > 2 ? 's' : ''}` : ''}` : '';
    const chain: { name: string; it: number }[] = [];
    for (let i: number | null = s.items[c.at]; i != null; i = s.run.rows[i].caller) chain.unshift({ name: r.kind === 'indirect' && i === s.items[c.at] ? r.text ?? '' : short(s.run.rows[i].name), it: s.itemOf[i] });
    return { k: `${n} / ${steps}`, loop, chain };
  });
  /** The chain as shown: all of it, or its first name and last four when it is long. */
  const crumbs = createMemo(() => {
    const h = header();
    if (!h) return [];
    const c = h.chain;
    if (crumbsAll() || c.length <= 6) return c;
    return [c[0], { name: '…', it: -1 }, ...c.slice(-4)];
  });

  // ---- the selected step's box ----
  const facts = createMemo((): Fact[] => {
    const s = S(), c = cur();
    if (!s || !c || c.at >= s.items.length) return [];
    return stepFacts(s, c.at, c.passes);
  });
  const summary = createMemo(() => {
    const c = cur();
    if (!c || c.at >= N()) return { text: '', code: false };
    const r = rowOf(c.at);
    if (r.kind === 'indirect') return { text: r.text ?? '', code: true };
    if (r.kind === 'value') return { text: `${r.name}`, code: true };
    const L = lines(r.file);
    if (!L) return { text: '', code: false };
    const cm = leadingComment(L, r.start);
    if (cm) return { text: cm, code: false };
    const sig = L.slice(r.start, r.line + 1).join(' ').replace(/\s*\{.*$/, '').replace(/\s+/g, ' ').trim();
    return { text: sig, code: true };
  });
  /** The lines around the call, in the caller: the step itself in context. */
  const callCode = createMemo(() => {
    const c = cur(), s = S();
    if (!c || !s || c.at >= s.items.length) return null;
    const r = s.run.rows[s.items[c.at]];
    if (r.caller == null || !r.at) return null;
    const cf = s.run.rows[r.caller], L = lines(cf.file);
    if (!L) return null;
    const a = Math.max(cf.start, r.at.line - 1), b = Math.min(L.length - 1, r.at.line + 1, cf.start + Math.max(1, cf.lines) - 1);
    const out = [];
    for (let l = a; l <= b; l++) out.push({ n: l + 1, html: hlLine(L[l]), hit: l === r.at.line });
    return { from: `from ${short(cf.name)} · ${basename(cf.file)}:${r.at.line + 1}`, lines: out };
  });
  const ways = createMemo(() => (S() ? stepWays(S()!, trail()) : []));

  const frameX = (f: number) => { const g = geom()!, [a, b] = S()!.span.get(f)!; let m = Infinity; for (let i = a; i <= b; i++) if (!hidden().has(i)) m = Math.min(m, g.x[i]); return m - 12; };
  const visFrames = createMemo(() => {
    const s = S(), g = geom();
    if (!s || !g) return [] as number[];
    const lo = scroll() - 400, hi = scroll() + height() + 400;
    return [...s.span.entries()].filter(([f, [a, b]]) => s.run.frames[f].kind === 'loop' && !hidden().has(a) && g.y[a] <= hi && g.y[b] + g.h[b] >= lo).map(([f]) => f);
  });
  const visBars = createMemo(() => visible().filter((it) => S()!.lastItem[it] > it));
  const hotFrame = (f: number) => { const c = cur(), sp = S()!.span.get(f)!; return !!c && c.at >= sp[0] && c.at <= sp[1]; };
  const laneOf = (it: number) => { const r = rowOf(it); return r.kind === 'step' || r.kind === 'ref' ? r.file : r.caller != null ? R()[r.caller].file : r.file; };
  const arrows = createMemo(() => {
    const g = geom(), s = S();
    if (!g || !s || g.mode !== 'files') return [] as number[];
    return visible().filter((it) => { const r = rowOf(it); return r.caller != null && laneOf(s.itemOf[r.caller]) !== laneOf(it); });
  });
  const foldRows = createMemo(() => visible().filter((it) => foldedAll().has(it)));

  return (
    <div class="body" style={{ height: '100%' }}>
      <div class="pane" style={{ flex: 1 }}>
        <div class="ph wrap" style={{ padding: '0 22px' }}>
          <Show when={header()} fallback={<span>{runStatus() || status()}</span>}>
            <span class="seqk">{header()!.k}</span>
            <Show when={header()!.loop}><span class="seqloop">{header()!.loop}</span></Show>
            <span class="seqpath">
              <For each={crumbs()}>{(c, i) => (
                <><Show when={i() > 0}><span class="csep">›</span></Show>
                  <button class="crumb" classList={{ last: i() === crumbs().length - 1 }} title={c.it < 0 ? 'show the whole chain' : `go to ${c.name}`}
                    onClick={() => { if (c.it < 0) setCrumbsAll(true); else { go({ jump: c.it }); canvas.focus(); } }}>{c.name}</button></>
              )}</For>
            </span>
            <Show when={path()}><span class="seqpth">path {path()!.index + 1} → {path()!.target}</span></Show>
            <Show when={rippleNote()}><span class="seqchg" title="functions whose unsaved code differs from the file on disk, and the calls that reach them">{rippleNote()}</span></Show>
          </Show>
          <span class="grow" />
          <Show when={header() && runStatus()}><span class="sub">{runStatus()}</span></Show>
          <Show when={found().length}>
            <span class="sfnd">
              <button class="chip" classList={{ on: foundOpen() }} title="what the code shows without running it: results thrown away, state two threads touch without a lock, locks, memory and files left open at a way out" onClick={() => setFoundOpen(!foundOpen())}>{found().length} finding{found().length > 1 ? 's' : ''}</button>
              <Show when={foundOpen()}>
                <div class="sfndl" ref={(el) => requestAnimationFrame(() => { const r = el.getBoundingClientRect(); if (r.left < 8) el.style.transform = `translateX(${Math.ceil(8 - r.left)}px)`; })}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setFoundOpen(false); canvas.focus(); } }}>
                  <For each={found()}>{(f) => (
                    <button classList={{ race: f.kind === 'race' || f.kind === 'pair' }} onClick={() => { setFoundOpen(false); const it = S()!.itemOf[f.rows[0]]; if (it >= 0) go({ jump: it }); canvas.focus(); }}>
                      <span class="g">{f.grade === 'proved' ? 'proved' : 'possible'}</span><span>{f.text}</span>
                    </button>
                  )}</For>
                </div>
              </Show>
            </span>
          </Show>
          <Show when={leaving()}><button class="chip" classList={{ on: waysOut() }} aria-pressed={waysOut()} title="ways out: the usual path dims, every early return, throw, break, goto and call that never returns lights, with what leads there (E)" onClick={() => { toggleWaysOut(); canvas.focus(); }}>ways out</button></Show>
          <SettingChip />
          <CompareChip />
          <Show when={aroundOn() || N() > 150}><button class="chip" classList={{ on: aroundOn() }} aria-pressed={aroundOn()} title="around the step: its callers and two levels of calls in full, every other call folded to one row (A)" onClick={() => { toggleAround(); canvas.focus(); }}>around</button></Show>
          <button class="chip" classList={{ on: detailAll() !== 'calls' || detailFn().size > 0 }} title="how much code to show between calls: calls only, with decisions, or all code (⇧D everywhere, D for the current function)" onClick={() => { cycleDetail(true); canvas.focus(); }}>{detailAll() === 'calls' ? 'calls' : detailAll() === 'decisions' ? 'decisions' : 'all code'}</button>
          <PlayControls playing={playing()} speed={speed()} setSpeed={setSpeed} toggle={() => { stopTour(); setPlaying(!playing()); canvas.focus(); }}
            restart={() => { stopTour(); setPlaying(false); go('home'); setPlaying(true); canvas.focus(); }} step={() => { stopTour(); setPlaying(false); go('next'); canvas.focus(); }} />
          <Show when={tour()}><span class="sub">tour · Esc stops</span></Show>
          {props.switcher}
          <span class="shr">
            <button class="chip" classList={{ on: share() }} title="copy a link to this walk, or save it as a walkthrough" onClick={() => setShare(!share())}>share</button>
            <Show when={share()}>
              <div class="smenu">
                <button onClick={copyLink}>copy a link to this walk</button>
                <button onClick={saveWalkthrough}>save a walkthrough (.md)</button>
              </div>
            </Show>
          </span>
        </div>
        <div class="seqv" classList={{ still: reduce(), onpath: !!path(), waysout: waysOut(), following: !!followed() }} ref={canvas} tabindex="0" role="application" aria-label="the run, one step per row"
          onKeyDown={onKey} onWheel={(e) => { e.preventDefault(); setManual(manual() + e.deltaY); setPeek(null); }}>
          <Show when={S() && geom()} fallback={<div class="empty" style={{ position: 'absolute', inset: 0 }}>{runStatus() || status() || 'building…'}</div>}>
            <Show when={geom()!.mode === 'files'}>
              <For each={geom()!.lanes}>{(f, i) => <div class="slane" style={{ left: `${34 + i() * Math.floor((width() - SPINE - 40) / geom()!.lanes.length)}px` }} title={f}>{basename(f)}</div>}</For>
            </Show>
            <div class="seqin" style={{ transform: `translateY(${-scroll()}px)` }}>
              <For each={visFrames()}>{(f) => {
                const fr = () => S()!.run.frames[f] as RunFrame;
                const sp = () => S()!.span.get(f)!;
                return (
                  <div class="sframe" classList={{ hot: hotFrame(f) }} style={{ left: `${frameX(f)}px`, top: `${geom()!.y[sp()[0]] + 1}px`, height: `${geom()!.y[sp()[1]] + geom()!.h[sp()[1]] - geom()!.y[sp()[0]] - 2}px` }}>
                    <span style={{ top: `${(geom()!.slotY.get(f) ?? 0) - geom()!.y[sp()[0]] - 1}px`, 'max-width': `${width() - SPINE - frameX(f) - 30}px` }}>
                      ↻ {fr().count != null ? `×${fr().count} · ` : ''}{fr().text}{hotFrame(f) ? ` · pass ${cur()!.passes[f] ?? 1}${fr().count != null ? ` of ${fr().count}` : ''}` : ''}
                    </span>
                  </div>
                );
              }}</For>
              <For each={visBars()}>{(it) => (
                <div class="sbar" classList={{ on: chain().has(S()!.items[it]) }} style={{ left: `${geom()!.barX[it]}px`, top: `${geom()!.y[it] + 4}px`, height: `${geom()!.y[S()!.lastItem[it]] + geom()!.h[S()!.lastItem[it]] - geom()!.y[it] - 8}px` }} />
              )}</For>
              <For each={arrows()}>{(it) => {
                const c = () => S()!.itemOf[rowOf(it).caller!];
                return <div class="sarw" classList={{ hot: it === cur()?.at, thread: rowOf(it).thread && !R()[rowOf(it).caller!].thread, dim: it !== cur()?.at && !chain().has(S()!.items[it]) }}
                  style={{ left: `${geom()!.barX[c()] + 3}px`, top: `${geom()!.y[it] + 11}px`, width: `${Math.max(0, geom()!.x[it] - 6 - geom()!.barX[c()] - 3)}px` }} />;
              }}</For>
              <Show when={ret()} keyed>{(r) => (
                <svg class="sret" width="10" height="10" ref={(el) => requestAnimationFrame(() => {
                  // drawn from the step it left, back up and into the caller, then gone
                  const arc = el.querySelector('.arc') as SVGPathElement, len = arc.getTotalLength();
                  arc.style.strokeDasharray = `3 3`;
                  arc.animate([{ clipPath: `inset(0 0 100% 0)` }, { clipPath: 'inset(0 0 0 0)' }], { duration: 650, easing: 'ease-out' });
                  el.animate([{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 1700, fill: 'forwards' });
                  (el.querySelector('.hd') as SVGPathElement).animate([{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }], { duration: Math.max(400, len * 8) });
                })}><path class="arc" d={r.d} /><path class="hd" d={r.head} /></svg>
              )}</Show>
              <For each={[...code()].filter(([it]) => !hidden().has(it) && visible().includes(it))}>{([it, blocks]) => {
                const top = () => geom()!.y[it] + geom()!.h[it] - codeExtra().get(it)! + 2;
                const flat = () => (blocks as { owner: number; lines: { n: number; text: string; depth: number }[] }[]).flatMap((b) => b.lines.map((l) => ({ ...l, x: geom()!.x[b.owner] + 22 + l.depth * 12 })));
                return <For each={flat()}>{(l, i) => <div class="sline" style={{ top: `${top() + i() * CODE_H}px`, left: `${l.x}px`, 'max-width': `${Math.max(80, width() - SPINE - l.x - 14)}px` }}>{l.n >= 0 ? <span class="ln">{l.n + 1}</span> : null}<span class="tx" innerHTML={l.n >= 0 ? hlLine(l.text) : l.text} /></div>}</For>;
              }}</For>
              <For each={visible()}>{(it) => {
                const r = () => rowOf(it);
                const e = () => ember().indexOf(it);
                const sel = () => cur()?.at === it;
                const tag = () => (sel() ? '' : it === prevAt() ? '← back' : it === nextAt() ? (nextIsReturn() ? `next → · back in ${short(nextIsReturn())}` : 'next →') : '');
                return (
                  <div class={`srow k-${r().kind}`} classList={{ sel: sel(), near: !!tag(), [`e${e() + 1}`]: e() >= 0 && !sel(), far: !sel() && !tag() && e() < 0 && !chain().has(S()!.items[it]), thread: r().thread, off: !onPath(it) && !sel(), pathed: !!path() && onPath(it), chg: changedItems().has(it), chgc: rippleChain().has(it) && !changedItems().has(it), wx: waysOut() && exitsAt(it).length > 0, wq: waysOut() && !exitsAt(it).length && !sel(), fw: !!followed() && hitsAt(it).length > 0, fq: !!followed() && !hitsAt(it).length && !sel(), sdead: !!deadAt(it) && !sel(), cadd: r().change === 'added', cchg: r().change === 'changed' }}
                    style={{ left: `${geom()!.x[it]}px`, top: `${geom()!.y[it]}px`, width: `${Math.max(60, width() - SPINE - geom()!.x[it] - 10)}px` }}
                    onClick={() => { setPeek(null); go({ jump: it }); canvas.focus(); }}
                    onMouseEnter={(ev) => { clearTimeout(peekTimer); if (sel()) return; const up = (ev.currentTarget as HTMLElement).getBoundingClientRect().top > canvas.getBoundingClientRect().top + height() * 0.5; peekTimer = setTimeout(() => setPeek({ it, up }), 450); }}
                    onMouseLeave={() => { clearTimeout(peekTimer); setPeek(null); }}>
                    <span class="n">{num(it)}</span>
                    <span class="nm">{r().kind === 'indirect' ? r().text : short(r().name)}</span>
                    <Show when={!sel() && geom()!.mode === 'depth' && (r().kind === 'step' || r().kind === 'ref')}><span class="loc">{basename(r().file)}</span></Show>
                    <Show when={sel() && (r().kind === 'step' || r().kind === 'ref')}><span class="loc">{basename(r().file)}:{r().line + 1}</span></Show>
                    <Show when={r().kind === 'indirect'}><span class="nt" title={r().could?.length ? `could be: ${r().could!.join(', ')} — functions whose address the code takes` : undefined}>{r().via}{r().could?.length ? ` · could be ${r().could!.slice(0, 3).join(', ')}${r().could!.length > 3 ? ` +${r().could!.length - 3}` : ''}` : ''}</span></Show>
                    <Show when={r().kind === 'value'}><span class="nt">named, not called</span></Show>
                    <Show when={notes(it)}><span class="nt" classList={{ ask: whatOptions(it).length > 0 }} title={whatOptions(it).length ? 'what if this went the other way?' : undefined}
                      onClick={(e) => { const o = whatOptions(it); if (!o.length) return; e.stopPropagation(); setWhatMenu(whatMenu()?.it === it ? null : { it, options: o }); }}>{notes(it)}</span></Show>
                    <Show when={waysOut() && exitsAt(it).length}>
                      <span class="sx" title={exitsAt(it).map((x) => `line ${x.line + 1}: ${[...x.when, x.kind === 'noreturn' ? `${x.text} (${x.callee} never returns)` : x.text].join(' → ')}`).join('\n')}>
                        {exitWords(exitsAt(it)[0])}<span class="ln"> · {exitsAt(it)[0].line + 1}</span>{exitsAt(it).length > 1 ? ` · +${exitsAt(it).length - 1} more` : ''}
                      </span>
                    </Show>
                    <Show when={deadAt(it)?.first}><span class="sd" title={`cannot happen in this call: ${deadAt(it)!.why}`}>not in this call · {deadAt(it)!.why}</span></Show>
                    <Show when={followed() && hitsAt(it).length}><span class="sw">{hitsAt(it).map(hitWords).join(' · ')}</span></Show>
                    <Show when={!sel() && uses(it)}><span class="u">uses {uses(it)}</span></Show>
                    <For each={usesMarks(it)}>{(m) => <span class="nt sonly" classList={{ cadd: m.added }}>{m.text}</span>}</For>
                    <Show when={tag()}><span class="tag">{tag()}</span></Show>
                    <Show when={notesByItem()[it]}><span class="snote" title={notesByItem()[it]}>✎ {notesByItem()[it]}</span></Show>
                  </div>
                );
              }}</For>
              <For each={visible()}>{(it) => <Show when={read().has(R()[S()!.items[it]].key) && cur()?.at !== it}><span class="stick" style={{ top: `${geom()!.y[it]}px` }} title="you have been here">✓</span></Show>}</For>
              <For each={hints()}>{(h) => <span class="shint" classList={{ dim: !!jump()?.typed && !h.k.startsWith(jump()!.typed) }} style={{ left: `${geom()!.x[h.it] - 4}px`, top: `${geom()!.y[h.it] + 3}px` }}>{h.k}</span>}</For>
              <For each={foldRows()}>{(it) => (
                <div class="srow sfold" style={{ left: `${geom()!.x[it] + 14}px`, top: `${geom()!.y[it] + geom()!.h[it] - ROW - (codeExtra().get(it) ?? 0)}px`, width: `${Math.max(60, width() - SPINE - geom()!.x[it] - 24)}px` }}
                  onClick={() => toggleFold(it)} title="unfold (⇧F)">
                  <span class="pl">+</span><span class="nm">{foldSteps(it)} steps</span><span class="nt">{foldNames(it).join(' · ')}</span>
                  <span class="mini">{Array.from({ length: Math.min(40, S()!.lastItem[it] - it) }, (_, k) => <i style={{ height: `${Math.min(14, 2 + (rowOf(it + 1 + k).depth - rowOf(it).depth) * 3)}px` }} />)}</span>
                </div>
              )}</For>
              <Show when={what()}>{(w) => {
                const a = () => w().skip[0] - 1;
                return (
                  <div class="srow swhat" style={{ left: `${geom()!.x[w().skip[0]]}px`, top: `${geom()!.y[a()] + geom()!.h[a()] - ROW - (codeExtra().get(a()) ?? 0)}px`, width: `${Math.max(60, width() - SPINE - geom()!.x[w().skip[0]] - 10)}px` }}>
                    <span class="pl">?</span><span class="nm">{w().ask.replace(/^what if /, 'if ').replace(/\?$/, '')}: {w().says}</span>
                    <span class="nt">{w().rows} row{w().rows > 1 ? 's' : ''} would not run</span>
                    <button class="chip" onClick={(e) => { e.stopPropagation(); setCompare(!compare()); }}>{compare() ? 'hide compare' : 'compare ⇄'}</button>
                  </div>
                );
              }}</Show>
              <Show when={whatMenu()}>{(m) => (
                <div class="swmenu" style={{ left: `${geom()!.x[m().it] + 30}px`, top: `${geom()!.y[m().it] + ROW}px` }}>
                  <For each={m().options}>{(o) => <button onClick={(e) => { e.stopPropagation(); askWhat(o); }}>{o.ask}</button>}</For>
                </div>
              )}</Show>
              <Show when={compare() ? what() : null}>{(wa) => {
                const w = wa();
                const ran = () => { const out: { n: string; name: string }[] = []; for (let i = w.skip[0]; i <= w.skip[1] && out.length < 8; i++) out.push({ n: num(i), name: rowOf(i).kind === 'indirect' ? rowOf(i).text ?? '' : short(rowOf(i).name) }); return out; };

                return (
                  <div class="scmp" style={{ top: `${geom()!.y[w.skip[0] - 1] + geom()!.h[w.skip[0] - 1] - ROW - 4 - (codeExtra().get(w.skip[0] - 1) ?? 0)}px`, right: `${SPINE + 14}px` }}>
                    <div class="col"><div class="h">as it runs</div><For each={ran()}>{(r) => <div><span class="n">{r.n}</span>{r.name}</div>}</For><Show when={w.rows > 8}><div class="no">+{w.rows - 8} more</div></Show></div>
                    <div class="col"><div class="h">{w.ask.replace(/\?$/, '')}</div><div class="rt">{w.says}</div><div class="no">{w.rows} row{w.rows > 1 ? 's' : ''} skipped</div><div class="no">then: {w.then}</div></div>
                  </div>
                );
              }}</Show>
              <Show when={geom()!.y[N()] < scroll() + height() + 400}>
                <div class="srow send" classList={{ sel: atEnd(), near: nextAt() === N() }} style={{ left: `${geom()!.x[0] ?? 20}px`, top: `${geom()!.y[N()]}px` }} onClick={() => go('end')}>
                  <span class="n">■</span><span class="nm">end of the run</span><span class="nt">{S()!.run.rows[0] ? `${short(S()!.run.rows[0].name)} returns` : ''}</span>
                  <Show when={nextAt() === N() && !atEnd()}><span class="tag">next →</span></Show>
                </div>
              </Show>
              <Show when={cur() && !atEnd()}>
                <div class="sband" ref={band} style={{ top: `${geom()!.y[cur()!.at] + ROW}px`, height: `${boxH() - 6}px`, right: `${SPINE + 4}px` }}>
                  <div class="in">
                    <Show when={summary().text}><div class="sum" classList={{ code: summary().code }}>{summary().text}</div></Show>
                    <Show when={callCode()}>{(cc) => (
                      <div class="scall">
                        <div class="from">{cc().from}</div>
                        <For each={cc().lines}>{(l) => <div classList={{ hit: l.hit }}><span class="ln">{l.n}</span><span innerHTML={l.html || ' '} /></div>}</For>
                      </div>
                    )}</Show>
                    <div class="facts">
                      <For each={facts()}>{(f) => (
                        <>
                          <span class="h">{f.head}</span>
                          <span class={`g-${f.grade}`}>
                            <Show when={f.steps?.length && f.head !== 'called from'} fallback={f.text}>
                              <For each={f.steps!}>{(row, k) => <><Show when={k() > 0}><span class="sep"> · </span></Show><button class="schip" onClick={(e) => { e.stopPropagation(); go({ jump: S()!.itemOf[row] }); canvas.focus(); }}>{f.text.split(' · ')[k()]}</button></>}</For>
                            </Show>
                          </span>
                        </>
                      )}</For>
                    </div>
                    <div class="ways"><For each={ways()}>{([k, w]) => <span><b>{k}</b> {w}</span>}</For><Show when={foldable(S()!, cur()!.at)}><span><b>⇧ F</b> {foldedAll().has(cur()!.at) ? 'unfold' : 'fold'}</span></Show></div>
                  </div>
                </div>
              </Show>
              <Show when={peek() && peekCode()}>
                <div class="speek" classList={{ up: peek()!.up }} style={{ left: `${Math.min(geom()!.x[peek()!.it] + 220, width() - SPINE - 560)}px`, top: `${peek()!.up ? geom()!.y[peek()!.it] - 4 : geom()!.y[peek()!.it] + ROW + 2}px` }}>
                  <div class="h">{peekCode()!.head}<i>{peekCode()!.loc}</i><span class="lk">peek</span></div>
                  <For each={peekCode()!.lines}>{(l) => <div class="l"><span class="ln">{l.n}</span><span innerHTML={l.html || ' '} /></div>}</For>
                  <Show when={peekCode()!.more}><div class="more">…</div></Show>
                </div>
              </Show>
            </div>
            <canvas class="sspine" ref={spineEl} style={{ height: `${height() - 16}px` }} onClick={onSpine}
              onMouseMove={(e) => { const y = e.clientY - canvas.getBoundingClientRect().top; clearTimeout(chapTimer); chapTimer = setTimeout(() => setChapPop(y), 250); }}
              onMouseLeave={() => { clearTimeout(chapTimer); chapTimer = setTimeout(() => setChapPop(null), 400); }} />
            <Show when={chapPop() != null && chaps().length > 1}>
              <div class="schap" style={{ top: `${Math.max(8, Math.min(chapPop()! - 20, height() - 40 - chaps().length * 24))}px`, right: `${SPINE + 10}px` }}
                onMouseEnter={() => clearTimeout(chapTimer)} onMouseLeave={() => setChapPop(null)}>
                <For each={chaps()}>{(ch) => (
                  <button classList={{ sub: ch.depth > 0, on: chapAt(cur()?.at ?? -1) === ch }} onClick={() => { setChapPop(null); go({ jump: ch.from }); canvas.focus(); }}>
                    <b>{stepNo(ch.from)}{stepNo(ch.to) !== stepNo(ch.from) ? `–${stepNo(ch.to)}` : ''}</b>{ch.label}
                  </button>
                )}</For>
              </div>
            </Show>
          </Show>
          <Magnifier host={() => canvas} source={() => { const el = canvas?.querySelector('.seqin') as HTMLElement | null; if (!el) return null; const r = canvas.getBoundingClientRect(); return { el, x: r.left, y: r.top, w: canvas.clientWidth, h: geom()?.height ?? canvas.clientHeight }; }} />
          <Show when={caption()}><div class="scap"><Show when={caption()!.key}><span class="key">{caption()!.key}</span></Show>{caption()!.what}<Show when={caption()!.why}><span class="why">{caption()!.why}</span></Show></div></Show>
          <Show when={pick()}>{(p) => {
            const shown = () => p().options.filter((o) => o.label.toLowerCase().includes(pick()!.q.toLowerCase())).slice(0, 12);
            return (
              <div class="scap spick"><span class="key">{p().kind}</span>{p().kind === 'W' ? 'watch' : 'follow'}
                <input class="sgoto" type="text" placeholder={p().kind === 'W' ? 'a member or global' : 'a parameter or what it passes on'} ref={(el) => setTimeout(() => el.focus())}
                  onInput={(e) => setPick({ ...pick()!, q: (e.target as HTMLInputElement).value })}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') shown()[0]?.go(); if (e.key === 'Escape') { setPick(null); canvas.focus(); } }} />
                <div class="spickl"><For each={shown()}>{(o) => <button onMouseDown={(e) => { e.preventDefault(); o.go(); }}><span>{o.label}</span><span class="why">{o.note}</span></button>}</For></div>
              </div>
            );
          }}</Show>
          <Show when={gotoOpen()}>
            <div class="scap"><span class="key">G</span>go to step <input class="sgoto" type="text" placeholder="number, or a shared walk" ref={(el) => setTimeout(() => el.focus())}
              onKeyDown={async (e) => {
                e.stopPropagation();
                const v = (e.target as HTMLInputElement).value;
                if (e.key === 'Enter') { setGotoOpen(false); if (!(await openWalk(v))) { const n = Number(v); if (n) go({ goto: n }); } canvas.focus(); }
                if (e.key === 'Escape') { setGotoOpen(false); canvas.focus(); }
              }} /></div>
          </Show>
          <Show when={noteOpen()}>
            <div class="scap"><span class="key">N</span>note on {num(cur()!.at)} {short(rowOf(cur()!.at).name)}
              <input class="snoteedit" type="text" value={notesByItem()[cur()!.at] ?? ''} placeholder="kept with this step and its shared link" ref={(el) => setTimeout(() => el.focus())}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { setNote(cur()!.at, e.currentTarget.value); setNoteOpen(false); canvas.focus(); } if (e.key === 'Escape') { setNoteOpen(false); canvas.focus(); } }} /></div>
          </Show>
          <Show when={skyOn() && S() && geom()}>
            <Skyline at={cur()?.at ?? 0} changedItems={changedItems()} notes={notesByItem()} onScrub={(it) => go({ jump: it }, true)}
              read={readCount() && readCount()!.n > 1 ? `read ${readCount()!.n} of ${readCount()!.of}` : ''} />
          </Show>
          <Show when={find()}>{(f) => (
            <div class="sfind">
              <div class="in"><span class="q">/</span>
                <Show when={!f().fn} fallback={<span class="fn">{f().fn} · {f().routes.length} paths from {short(R()[S()!.items[0]].name)}</span>}>
                  <input type="text" placeholder="a function in this run" value={f().q} ref={(el) => setTimeout(() => el.focus())}
                    onInput={(e) => setFind({ ...f(), q: e.currentTarget.value, sel: 0 })}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      const n = matches().length;
                      if (e.key === 'ArrowDown') { e.preventDefault(); setFind({ ...f(), sel: Math.min(n - 1, f().sel + 1) }); }
                      if (e.key === 'ArrowUp') { e.preventDefault(); setFind({ ...f(), sel: Math.max(0, f().sel - 1) }); }
                      if (e.key === 'Enter' && n) pickFunction(matches()[f().sel].key);
                      if (e.key === 'Escape') { setFind(null); canvas.focus(); }
                    }} />
                </Show>
              </div>
              <Show when={!f().fn}>
                <For each={matches()}>{(m, i) => <button class="opt" classList={{ on: i() === f().sel }} onClick={() => pickFunction(m.key)}><span class="nm">{m.name}</span><span class="w">runs at {m.steps}</span></button>}</For>
                <Show when={!matches().length}><div class="none">no function by that name runs from here</div></Show>
              </Show>
              <Show when={f().fn}>
                <div class="paths" tabindex="0" ref={(el) => setTimeout(() => el.focus())} onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'ArrowDown') { e.preventDefault(); setFind({ ...f(), sel: Math.min(f().routes.length - 1, f().sel + 1) }); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setFind({ ...f(), sel: Math.max(0, f().sel - 1) }); }
                  if (/^[1-9]$/.test(e.key) && Number(e.key) <= f().routes.length) followPath(f().routes[Number(e.key) - 1], Number(e.key) - 1, f().fn!);
                  if (e.key === 'Enter') followPath(f().routes[f().sel], f().sel, f().fn!);
                  if (e.key === 'Escape') { setFind(null); canvas.focus(); }
                }}>
                  <For each={f().routes}>{(r, i) => (
                    <button class="opt" classList={{ on: i() === f().sel }} onClick={() => followPath(r, i(), f().fn!)}>
                      <b>{i() + 1}</b><span class="nm">{r.rows.map((q) => short(R()[q].name)).join('  ›  ')}</span>
                      <span class="w">{r.at.length > 1 ? `×${r.at.length}` : ''}</span>
                    </button>
                  )}</For>
                </div>
              </Show>
            </div>
          )}</Show>
          <Show when={help()}>
            <div class="skeys" onClick={() => setHelp(false)}><For each={KEYS}>{([k, w]) => <div><b>{k}</b><span>{w}</span></div>}</For></div>
          </Show>
        </div>
      </div>
      <StepPreview />
    </div>
  );
}

function rowNote(f: RunFrame): string {
  switch (f.kind) {
    case 'arm': {
      const m = /^(&&|\|\|) /.exec(f.label);
      if (m) return `? ${f.text} ${m[1]}`;
      if (f.label === 'then') return `? ${f.text}`;
      if (f.label === 'else') return `? else of ${f.text}`;
      if (/^catch\b/.test(f.label)) return `? ${f.label}`;
      return `? ${f.label}${f.fallsThrough ? ' · falls through' : ''}`;
    }
    case 'guard': return `past ${f.text} → ${f.label}`;
    case 'thread': return '⇢ on a new thread';
    case 'lambda': return 'λ runs when called';
    case 'once': return 'once · static';
    case 'virtual': return `virtual · ${f.text}`;
    default: return '';
  }
}

/** The whole run as a profile of call depth, along the bottom: loops shaded, edits and notes marked; drag to scrub. */
function Skyline(props: { at: number; changedItems: Set<number>; notes: Record<number, string>; onScrub: (it: number) => void; read: string }) {
  let el!: HTMLCanvasElement, box!: HTMLDivElement;
  const [w, setW] = createSignal(800);
  onMount(() => { const ro = new ResizeObserver(() => setW(box.clientWidth)); ro.observe(box); onCleanup(() => ro.disconnect()); });
  createEffect(() => {
    const s = seq(), W = w(), H = SKY - 14, dpr = window.devicePixelRatio || 1;
    if (!s || !el) return;
    el.width = W * dpr; el.height = H * dpr; el.style.width = `${W}px`; el.style.height = `${H}px`;
    const x = el.getContext('2d')!;
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
    const n = s.items.length, bw = W / Math.max(1, n), maxD = Math.max(1, ...s.items.map((r) => s.run.rows[r].depth));
    for (let i = 0; i < n; i++) {
      const r = s.run.rows[s.items[i]], loops = r.frames.filter((f) => s.run.frames[f].kind === 'loop').length;
      if (loops) { x.fillStyle = `rgba(111,158,158,${Math.min(0.28, 0.06 + loops * 0.06)})`; x.fillRect(i * bw, 0, Math.ceil(bw), H); }
      const h = 3 + (r.depth / maxD) * (H - 6);
      x.fillStyle = i === props.at ? '#ad9b6f' : props.changedItems.has(i) ? '#79c9ae' : r.kind === 'step' ? '#4a504a' : '#33373a';
      x.fillRect(i * bw + (bw > 3 ? 0.5 : 0), H - h, Math.max(1, bw - (bw > 3 ? 1 : 0)), h);
      if (props.notes[i]) { x.fillStyle = '#ad9b6f'; x.fillRect(i * bw, 0, Math.max(2, bw), 2); }
    }
  });
  const itAt = (clientX: number) => { const r = el.getBoundingClientRect(), n = seq()?.items.length ?? 0; return Math.max(0, Math.min(n - 1, Math.floor(((clientX - r.left) / Math.max(1, r.width)) * n))); };
  const down = (e: PointerEvent) => {
    let last = -1;
    const go = (ev: PointerEvent) => { const it = itAt(ev.clientX); if (it !== last) { last = it; props.onScrub(it); } };
    go(e);
    el.setPointerCapture(e.pointerId);
    const up = () => { el.removeEventListener('pointermove', go); el.removeEventListener('pointerup', up); };
    el.addEventListener('pointermove', go); el.addEventListener('pointerup', up);
  };
  return <div class="ssky" ref={box} title="the run as a profile of call depth · drag to scrub · K hides it"><canvas ref={el} onPointerDown={down} /><Show when={props.read}><span class="seqread" title="functions you have been to in this run (kept between sessions)">{props.read}</span></Show></div>;
}
