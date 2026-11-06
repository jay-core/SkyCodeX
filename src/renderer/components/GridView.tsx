// The grid view of the run: called functions down the side (CALLED ↓), calling functions across the top (CALLER →),
// both grouped under their files; each square holds the steps where that call happens, in run order. The grid fits
// the pane, totals stay in sight (TIMES CALLED at the end of each row, CALLS IT MAKES under each column), a square
// opens in place when chosen, and its details fill the card in the right pane. Tab switches to the metro.
import { For, Show, createSignal, createMemo, createEffect, on, onMount, onCleanup, JSX } from 'solid-js';
import { setWalkSpeed, seq, trail, status, runStatus, stepMove, waysOut, setWaysOut, earlyExits, leavingCount, followed, setFollowed, hitWords, changed } from '../lib/flowstore';
import { root, flash, settings } from '../lib/store';
import { api, basename } from '../lib/api';
import { lines } from '../lib/seqtext';
import { move, loopsAt, Move, stepNumbers } from '../../shared/flowseq';
import { buildGrid, GridOrder, GridFn } from '../../shared/gridmodel';
import { routesBetween, frameWords, RouteInfo } from '../../shared/flowboxes';
import StepPreview, { openStep, StepSplit, stepW, setGridPick } from './StepPreview';
import Magnifier from './Magnifier';
import PlayControls from './PlayControls';
import { Skyline } from './Sequence';

// SIDE: file label + ƒ + row name; HEAD: file band + ƒ + two-line column name; TOT: times called; FOOT: calls it makes
const SIDE = 236, HEAD = 84, TOT = 76, FOOT = 46, GAP = 4, OPEN_W = 270, LINE_H = 23, BIG = 1800, SKY = 62;
const PAL = ['#a3a8a0', '#8fa98a', '#c9b27a', '#6fa0a0', '#a8929e', '#c08a74', '#7a90c4', '#b07fa4', '#9aa86f', '#6f8fb8'];
const short = (n: string) => n.replace(/^.*::(?=[^:]+$)/, '');
const stem = (f: string) => basename(f).replace(/\.(c|cc|cpp|cxx|h|hpp)$/, '');
const wrapName = (n: string) => n.replace(/_/g, '_​');   // a long name breaks after an underscore first
const load = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
interface Pos { at: number[]; w: number[]; size: number }
interface Rect { x: number; y: number; w: number; h: number }
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export default function GridView(props: { switcher: JSX.Element }) {
  const S = () => seq();
  const cur = () => trail()[trail().length - 1];
  const curAt = () => cur()?.at ?? -1;
  const R = () => S()!.run.rows;
  const nums = createMemo(() => (S() ? stepNumbers(S()!) : []));
  const [order, setOrderRaw] = createSignal<GridOrder>(load('grid.order', 'file') as GridOrder);
  const setOrder = (o: GridOrder) => { setOrderRaw(o); try { localStorage.setItem('grid.order', o); } catch { /* kept for this run */ } };
  const model = createMemo(() => (S() ? buildGrid(S()!, nums(), order()) : null));
  const col = createMemo(() => { const m = new Map<string, string>(); model()?.files.forEach((f, i) => m.set(f, PAL[i % PAL.length])); return m; });
  // a large run opens on files × files; a click on a block opens its functions
  const [drill, setDrill] = createSignal<{ rowFile: string; colFile: string } | null>(null);
  // the chosen square (opens in place, fills the card) and the square under the pointer
  const [pick, setPick] = createSignal<{ c: string; r: string } | null>(null);
  const [hover, setHover] = createSignal<{ c: string; r: string } | null>(null);
  createEffect(on(S, () => { setDrill(null); setPick(null); setHover(null); }, { defer: true }));
  const big = () => { const m = model(); return !!m && m.rows.length * m.cols.length > BIG; };
  const filesMode = () => big() && !drill();
  const rows = createMemo(() => { const m = model(), d = drill(); return !m ? [] : d ? m.rows.filter((r) => r.file === d.rowFile) : m.rows; });
  const cols = createMemo(() => { const m = model(), d = drill(); return !m ? [] : d ? m.cols.filter((c) => c.file === d.colFile) : m.cols; });
  const cellAt = (c: string, r: string) => model()?.cells.get(`${c}>${r}`);
  const pickCell = createMemo(() => { const p = pick(); return p ? cellAt(p.c, p.r) ?? [] : []; });

  // ---- the pane's size and scroll: the grid fits it; the totals follow the scroll so they stay in sight ----
  let scroller!: HTMLDivElement, canvas!: HTMLDivElement;
  const [vw, setVw] = createSignal(900), [vh, setVh] = createSignal(600), [sl, setSl] = createSignal(0), [st, setSt] = createSignal(0);
  onMount(() => {
    // sizes are applied on the next frame, so the layout they cause never feeds back into this same observation
    let f = 0;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(f); f = requestAnimationFrame(() => { setVw(scroller.clientWidth); setVh(scroller.clientHeight - SKY); }); });
    onCleanup(() => cancelAnimationFrame(f));
    ro.observe(scroller); onCleanup(() => ro.disconnect());
    requestAnimationFrame(() => canvas?.focus());   // keys work as soon as the grid opens (Tab from the metro)
  });
  const place = (list: GridFn[], size: (i: number) => number): Pos => {
    const at: number[] = [], w: number[] = []; let x = 0;
    list.forEach((g, i) => { if (i && list[i - 1].file !== g.file) x += GAP; at.push(x); w.push(size(i)); x += size(i); });
    return { at, w, size: x };
  };
  const breaks = (list: GridFn[]) => list.reduce((n, g, i) => n + (i && list[i - 1].file !== g.file ? 1 : 0), 0);
  const geo = createMemo(() => {
    const cs = cols(), rs = rows(), p = pick();
    const pc = p ? cs.findIndex((c) => c.key === p.c) : -1, pr = p ? rs.findIndex((r) => r.key === p.r) : -1;
    const openH = pr >= 0 ? 8 + Math.min(6, pickCell().length) * LINE_H : 0;
    const nc = cs.length - (pc >= 0 ? 1 : 0), nr = rs.length - (pr >= 0 ? 1 : 0);
    const cw = Math.max(44, Math.min(92, nc ? Math.floor((vw() - SIDE - TOT - 12 - breaks(cs) * GAP - (pc >= 0 ? OPEN_W : 0)) / nc) : 92));
    // rows as short as 19 px (a step chip is 16 px) before the grid scrolls under its sticky totals
    const rh = Math.max(19, Math.min(28, nr ? Math.floor((vh() - HEAD - FOOT - breaks(rs) * GAP - openH) / nr) : 28));
    const x = place(cs, (i) => (i === pc ? Math.max(OPEN_W, cw) : cw)), y = place(rs, (j) => (j === pr ? Math.max(openH, rh) : rh));
    return { cw, rh, pc, pr, x, y };
  });
  const colIdx = createMemo(() => new Map(cols().map((c, i) => [c.key, i])));
  const rowIdx = createMemo(() => new Map(rows().map((r, j) => [r.key, j])));
  const rectOf = (i: number, j: number): Rect => ({ x: SIDE + geo().x.at[i], y: HEAD + geo().y.at[j], w: geo().x.w[i] - 2, h: geo().y.w[j] - 2 });
  // the totals: at the end of the grid, or at the pane's edge when the grid is wider or taller than the pane
  const totX = () => Math.min(SIDE + geo().x.size + 8, sl() + vw() - TOT);
  const footY = () => Math.min(HEAD + geo().y.size + 6, st() + vh() - FOOT);
  const maxRow = createMemo(() => Math.max(1, ...rows().map((r) => r.count)));
  const maxCol = createMemo(() => Math.max(1, ...cols().map((c) => c.count)));

  // ---- the summary line ----
  const summary = createMemo(() => {
    const m = model(), s = S();
    if (!m || !s) return null;
    let calls = 0, cross = 0;
    s.items.forEach((row) => { const r = s.run.rows[row]; if (r.caller == null) return; calls++; const cf = s.run.rows[r.caller].file, f = r.kind === 'ref' && r.ref != null ? s.run.rows[r.ref].file : r.kind === 'step' ? r.file : cf; if (cf !== f) cross++; });
    const most = [...m.rows].filter((r) => r.count > 1).sort((a, b) => b.count - a.count || a.first - b.first).slice(0, 3);
    return { fns: m.rows.length, callers: m.cols.length, calls, cross: calls ? Math.round((cross / calls) * 100) : 0, most };
  });

  // the current call: its square is lit, its row and column get a crosshair
  const curCell = createMemo(() => { const m = model(), c = cur(); return m && c && c.at < S()!.items.length ? m.cellOf[c.at] : ''; });
  // the chosen square fills the card: the current call when it is in the square, else its first
  createEffect(() => { const p = pick(), v = pickCell(), a = curAt(); setGridPick(p && v.length ? { at: v.includes(a) ? a : v[0], cell: v } : null); });
  const [heat, setHeat] = createSignal(false);
  const [focus, setFocus] = createSignal(false);
  const [route, setRoute] = createSignal<{ from: number; to: number; list: RouteInfo[]; only: number } | null>(null);
  const routePairs = createMemo(() => {
    const r = route(), s = S(), out = new Set<string>();
    if (!r || !s) return out;
    for (const [i, x] of r.list.entries()) if (r.only < 0 || r.only === i) for (let k = 1; k < x.rows.length; k++) out.add(`${R()[x.rows[k - 1]].key}>${R()[x.rows[k]].key}`);
    return out;
  });
  const leaves = (key: string) => { const s = S(); if (!s) return false; const row = s.run.rows.findIndex((r) => r.kind === 'step' && r.key === key); return row >= 0 && earlyExits(s.run, row).length > 0; };
  const maxCell = createMemo(() => { let m = 1; for (const v of model()?.cells.values() ?? []) m = Math.max(m, v.length); return m; });
  // what a function's name says, as in the metro: a value followed (W, V) and how; called only where its values rule
  // the call out; added or changed against a commit; edited and not saved
  const marks = createMemo(() => {
    const s = S(), m = new Map<string, { fw?: string; dim?: boolean; add?: boolean; chg?: boolean; edit?: boolean }>();
    if (!s) return m;
    const R0 = s.run.rows, f = followed(), ed = changed(), get = (k: string) => { let g = m.get(k); if (!g) m.set(k, (g = {})); return g; };
    const calls = new Map<string, { all: number; dead: number }>();
    s.items.forEach((row) => {
      const r = R0[row];
      if (r.caller == null) return;
      const k = r.kind === 'ref' && r.ref != null ? R0[r.ref].key : r.key, c = calls.get(k) ?? { all: 0, dead: 0 };
      c.all++; if (r.frames.some((fr) => s.run.frames[fr].dead)) c.dead++; calls.set(k, c);
    });
    for (const [k, c] of calls) if (c.dead === c.all) get(k).dim = true;
    R0.forEach((r, i) => { if (r.kind !== 'step') return; if (r.change === 'added') get(r.key).add = true; if (r.change === 'changed') get(r.key).chg = true; if (ed.has(i)) get(r.key).edit = true; });
    if (f) for (const h of f.hits) { const g = get(R0[h.row].key); if (!g.fw) g.fw = hitWords(h); }
    return m;
  });
  const mk = (key: string) => marks().get(key);
  // file outlines: only around a file's own block when its functions call each other, and only when it is one block
  const boxes = createMemo(() => {
    const out: (Rect & { c: string })[] = [], cs = cols(), rs = rows();
    for (const f of model()?.files ?? []) {
      const ci = cs.flatMap((c, i) => (c.file === f ? [i] : [])), ri = rs.flatMap((r, j) => (r.file === f ? [j] : []));
      if (!ci.length || !ri.length || ci[ci.length - 1] - ci[0] + 1 !== ci.length || ri[ri.length - 1] - ri[0] + 1 !== ri.length) continue;
      if (!ci.some((i) => ri.some((j) => cellAt(cs[i].key, rs[j].key)))) continue;
      const a = rectOf(ci[0], ri[0]), b = rectOf(ci[ci.length - 1], ri[ri.length - 1]);
      out.push({ x: a.x - 2, y: a.y - 2, w: b.x + b.w - a.x + 3, h: b.y + b.h - a.y + 3, c: col().get(f)! });
    }
    return out;
  });

  // ---- the hover tag: above the square, else below, placed so it covers no square that holds a call ----
  const tag = createMemo(() => {
    const h = hover(), v = h && cellAt(h.c, h.r);
    if (!h || !v) return null;
    const i = colIdx().get(h.c), j = rowIdx().get(h.r);
    if (i == null || j == null) return null;
    const cname = short(cols()[i].name), rname = short(rows()[j].name), open = pick()?.c === h.c && pick()?.r === h.r;
    const text = `${cname} → ${rname} · step${v.length > 1 ? 's' : ''} ${v.map((it) => it + 1).join(' · ')} · click to ${open ? 'close' : 'open'}`;
    const w = Math.round(text.length * 6.3 + 18), a = rectOf(i, j), hh = 20;
    const filled: Rect[] = [];
    for (const k of model()!.cells.keys()) {
      const [ck, rk] = [k.slice(0, k.indexOf('>')), k.slice(k.indexOf('>') + 1)], ci = colIdx().get(ck), rj = rowIdx().get(rk);
      if (ci != null && rj != null && !(ci === i && rj === j)) filled.push(rectOf(ci, rj));
    }
    const tries: Rect[] = [
      { x: a.x + a.w - w, y: a.y - hh - 3, w, h: hh }, { x: a.x, y: a.y - hh - 3, w, h: hh },
      { x: a.x + a.w - w, y: a.y + a.h + 3, w, h: hh }, { x: a.x, y: a.y + a.h + 3, w, h: hh },
    ];
    const ok = tries.find((t) => t.x >= SIDE - 40 && t.y >= HEAD - 24 && !filled.some((f) => overlaps(t, f))) ?? tries[0];
    return { text, x: Math.max(4, ok.x), y: ok.y };
  });

  // ---- captions ----
  const [caption, setCaption] = createSignal<{ key: string; what: string; why: string } | null>(null);
  let capTimer: ReturnType<typeof setTimeout> | undefined;
  const say = (key: string, what: string, why = '') => { setCaption({ key, what, why }); clearTimeout(capTimer); capTimer = setTimeout(() => setCaption(null), 2600); };
  const report = (r: ReturnType<typeof stepMove>, quiet = false) => { if (r.note) say('', r.note); else if (r.state && !quiet) say(r.state.key, r.state.what, r.state.why); };

  // ---- play: one step at a time, at the chosen speed ----
  const [playing, setPlaying] = createSignal(false);
  const [speed, setSpeed] = createSignal(1);
  let playId = 0;
  const playMove = (): Move | null => {
    const s = S(), c = cur();
    if (!s || !c || c.at >= s.items.length) return null;
    for (const f of [...loopsAt(s, c.at)].reverse()) { const fr = s.run.frames[f], sp = s.span.get(f)!; if (sp[1] !== c.at) break; if (fr.count != null && (c.passes[f] ?? 1) < fr.count) return 'again'; }
    return 'next';
  };
  async function play() {
    if (playing()) { stop(); return; }
    setPlaying(true);
    const id = ++playId;
    while (id === playId) {
      const m = playMove(), s = S();
      if (!m || !s) break;
      const r = move(s, trail(), m);
      if (r.note || r.trail[r.trail.length - 1].at >= s.items.length) { report(stepMove(m)); break; }
      report(stepMove(m), true);
      await new Promise((res) => setTimeout(res, 650 / speed()));
    }
    if (id === playId) setPlaying(false);
  }
  const stop = () => { playId++; setPlaying(false); };
  createEffect(() => setWalkSpeed(playing() ? speed() : 0));
  onCleanup(() => { stop(); clearTimeout(capTimer); setWalkSpeed(0); setGridPick(null); });

  // ---- routes: ⇧-click two functions ----
  let routeFrom = -1;
  function pickRoute(key: string) {
    const s = S();
    if (!s) return;
    const row = s.run.rows.findIndex((r) => r.kind === 'step' && r.key === key);
    if (row < 0) return;
    if (routeFrom < 0 || routeFrom === row) { routeFrom = row; say('⇧', `from ${short(s.run.rows[row].name)}`, 'shift-click the other end of the route'); return; }
    let list = routesBetween(s.run, routeFrom, s.run.rows[row].key), a = routeFrom, b = row;
    if (!list.length) { list = routesBetween(s.run, row, s.run.rows[routeFrom].key); a = row; b = routeFrom; }
    routeFrom = -1;
    if (!list.length) { say('', `no route between ${short(s.run.rows[a].name)} and ${short(s.run.rows[b].name)}`, 'neither reaches the other in this run'); return; }
    setRoute({ from: a, to: b, list, only: list.length === 1 ? 0 : -1 });
  }

  // the current (or chosen) square glides into view when it is outside the pane
  createEffect(on([curCell, pick], () => requestAnimationFrame(() => {
    const el = (scroller?.querySelector('.gcell.pk') ?? scroller?.querySelector('.gcell.on')) as HTMLElement | null;
    if (!el) return;
    const a = el.getBoundingClientRect(), b = scroller.getBoundingClientRect(), m = 40;
    if (a.left < b.left + SIDE || a.right > b.right - TOT || a.top < b.top + HEAD || a.bottom > b.bottom - FOOT - SKY)
      scroller.scrollTo({ left: scroller.scrollLeft + a.left - b.left - b.width / 2 + a.width / 2, top: scroller.scrollTop + a.top - b.top - b.height / 2 + a.height / 2 + m / 2, behavior: settings()['motion.reduce'] ? 'auto' : 'smooth' });
  })));

  function onKey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key, sh = e.shiftKey;
    if (key === 'Tab') return;
    if (key === ' ') { e.preventDefault(); play(); return; }
    if (key === '+' || key === '=') { setSpeed(Math.min(3, speed() * 1.5)); return; }
    if (key === '-') { setSpeed(Math.max(0.25, speed() / 1.5)); return; }
    if (key === 'Escape') { stop(); if (pick()) { setPick(null); return; } setFollowed(null); setRoute(null); setFocus(false); routeFrom = -1; if (drill() && !route()) setDrill(null); return; }
    if (key === 'f' || key === 'F') { setFocus(!focus()); say('F', focus() ? 'focus: the current call’s row and column' : 'the whole grid'); return; }
    if (key === 'h' || key === 'H') { setHeat(!heat()); return; }
    if (key === 'e' || key === 'E') { const on = !waysOut(), n = S() ? leavingCount(S()!.run) : 0; setWaysOut(on); say('E', on ? `ways out: ${n} function${n === 1 ? '' : 's'} can leave early` : 'the whole run'); return; }
    if (key === 'Enter') { e.preventDefault(); openStep(); return; }
    if (route() && /^[1-9]$/.test(key)) { const r = route()!, i = Number(key) - 1; if (i < r.list.length) setRoute({ ...r, only: r.only === i ? -1 : i }); return; }
    const moves: Record<string, Move> = { ArrowRight: sh ? 'over' : 'next', ArrowLeft: sh ? 'prevPass' : 'back', ArrowUp: 'out', r: 'again', R: 'again', l: 'leave', L: 'leave', ']': 'nextSibling', '[': 'prevSibling', Home: 'home', End: 'end' };
    const m = moves[key];
    if (!m) return;
    e.preventDefault(); stop(); report(stepMove(m));
  }

  // ---- export: the grid as a PNG, drawn from the same model and layout ----
  async function exportPng() {
    const m = model(); if (!m) return;
    const file = (await api.fs.saveDialog(`${root()}/${basename(root()) || 'flow'}-grid.png`)) as string | null;
    if (!file) return;
    const G = geo(), W = SIDE + G.x.size + TOT + 20, H = HEAD + G.y.size + FOOT + 10, sc = Math.min(2, 16000 / W, 16000 / H);
    const c = document.createElement('canvas'); c.width = Math.round(W * sc); c.height = Math.round(H * sc);
    const g = c.getContext('2d')!; g.scale(sc, sc); g.fillStyle = '#171817'; g.fillRect(0, 0, W, H);
    g.font = '12px "ArX F1", monospace'; g.textBaseline = 'middle';
    cols().forEach((cc, i) => { g.fillStyle = col().get(cc.file)!; g.fillRect(SIDE + G.x.at[i], HEAD - 6, G.x.w[i] - 2, 2); g.fillStyle = '#9ea39b'; g.fillText(cc.name.slice(0, Math.max(4, Math.floor(G.x.w[i] / 7.5))), SIDE + G.x.at[i] + 4, HEAD - 18); });
    rows().forEach((rr, j) => { g.fillStyle = col().get(rr.file)!; g.fillRect(36, HEAD + G.y.at[j], 2, G.y.w[j] - 2); g.fillStyle = '#9ea39b'; g.fillText(rr.name, 46, HEAD + G.y.at[j] + G.rh / 2); g.fillText(`×${rr.count}`, SIDE + G.x.size + 14, HEAD + G.y.at[j] + G.rh / 2); });
    cols().forEach((cc, i) => { g.fillStyle = '#9ea39b'; g.fillText(String(cc.count), SIDE + G.x.at[i] + 4, HEAD + G.y.size + 20); rows().forEach((rr, j) => { const v = m.cells.get(`${cc.key}>${rr.key}`); if (!v) return; g.fillStyle = '#1f211f'; g.fillRect(SIDE + G.x.at[i], HEAD + G.y.at[j], G.x.w[i] - 2, G.y.w[j] - 2); g.fillStyle = '#c9cec6'; g.fillText(v.map((it) => it + 1).join(' · '), SIDE + G.x.at[i] + 6, HEAD + G.y.at[j] + G.rh / 2); }); });
    await api.fs.writeBase64(file, c.toDataURL('image/png').split(',')[1]);
    flash(`saved ${basename(file)} · ${c.width} × ${c.height}`, 3000);
  }

  const go = (it: number) => { stop(); report(stepMove({ jump: it })); canvas.focus(); };
  const choose = (c: string, r: string) => { const p = pick(); setPick(p && p.c === c && p.r === r ? null : { c, r }); canvas.focus(); };
  const callLine = (it: number) => { const r = R()[S()!.items[it]]; if (r.caller == null || !r.at) return { code: '', line: 0 }; return { code: lines(R()[r.caller].file)?.[r.at.line]?.trim() ?? '', line: r.at.line + 1 }; };
  const chip = (it: number, c: string, r: string) => (
    <i classList={{ now: curAt() === it, dn: it < curAt() }} title={`step ${it + 1} · click to go there`} onClick={(e) => { e.stopPropagation(); setPick({ c, r }); go(it); }}>{it + 1}</i>
  );
  const header = createMemo(() => { const s = S(), c = cur(); if (!s || !c) return ''; if (c.at >= s.items.length) return `Step ${s.items.length} of ${s.items.length} · end`; const n = nums()[c.at], r = R()[s.items[c.at]]; return `Step ${c.at + 1} of ${s.items.length} · ${n?.fn ? `ƒ${n.fn} ` : ''}${short(r.kind === 'ref' ? R()[r.ref!].name : r.kind === 'indirect' ? (r.text ?? r.name) : r.name)}`; });
  // the key's examples are the run's own: a step already run, the current one, the next
  const keySteps = () => { const a = curAt(), n = S()?.items.length ?? 0; return { done: Math.max(1, a), now: a + 1, next: Math.min(n, a + 2) }; };

  return (
    <div class="body" style={{ height: '100%' }}>
      <div class="pane" style={{ flex: 1 }}>
        <div class="ph wrap" style={{ padding: '0 22px' }}>
          <Show when={header()} fallback={<span>{status()}</span>}><span class="ghd">{header()}</span></Show>
          <span class="grow" />
          <Show when={runStatus()}><span class="sub">{runStatus()}</span></Show>
          <PlayControls playing={playing()} speed={speed()} setSpeed={setSpeed} toggle={() => play()} restart={() => { stop(); report(stepMove('home')); }} step={() => { stop(); report(stepMove('next')); }} />
          {props.switcher}
          <button class="chip" classList={{ on: heat() }} aria-pressed={heat()} title="shade each square by how many calls it holds (H)" onClick={() => setHeat(!heat())}>how often</button>
          <button class="chip" title="save the grid as a PNG image" onClick={exportPng}>export</button>
        </div>
        <div class="gview" classList={{ heat: heat(), focus: focus(), waysout: waysOut(), routed: !!route(), following: !!followed() }} ref={canvas} tabindex="0" role="application" aria-label="the run as a grid: who calls whom" onKeyDown={onKey}>
          <Show when={summary()}>{(sm) => (
            <div class="gtop">
              <span><b>{sm().fns}</b>functions called</span><span><b>{sm().callers}</b>callers</span><span><b>{sm().calls}</b>calls</span>
              <span class="xf"><b>{sm().cross}%</b>cross a file</span>
              <Show when={sm().most.length}><span class="mc">most called: <For each={sm().most}>{(r, i) => <><Show when={i() > 0}>, </Show><b>{r.name} ×{r.count}</b></>}</For></span></Show>
              <Show when={drill()}><button class="chip" onClick={() => setDrill(null)}>← all files</button></Show>
              <span class="grow" />
              <Show when={S() && leavingCount(S()!.run)}><button class="chip" classList={{ on: waysOut() }} onClick={() => { setWaysOut(!waysOut()); canvas.focus(); }}>ways out</button></Show>
              <span class="seg"><For each={[['file', 'by file'], ['run', 'run order'], ['count', 'most called']] as [GridOrder, string][]}>{([o, t]) => <button classList={{ on: order() === o }} title={o === 'file' ? 'grouped by file; within a file, by ƒ number (the order each function first ran)' : o === 'run' ? 'by ƒ number: the order each function first ran' : 'most called first'} onClick={() => { setOrder(o); canvas.focus(); }}>{t}</button>}</For></span>
            </div>
          )}</Show>
          <div class="gkey">
            <span class="sws"><For each={model()?.files ?? []}>{(f) => <i style={{ background: col().get(f) }} />}</For></span><span>colour = file</span>
            <span class="kt">numbers in squares = steps (1–{S()?.items.length ?? 0}) · ƒ = function</span>
            <i class="kc dn">{keySteps().done}</i><span>run</span>
            <i class="kc now">{keySteps().now}</i><span>now</span>
            <i class="kc">{keySteps().next}</i><span>to come</span>
            <span class="kt">· calls in a square in order: <b>4 · 9</b></span>
            <span class="dots"><b class="dn" /><b class="dn" /><b class="now" /><b /><b /><em>5</em></span><span>4 or more calls: a dot each</span>
          </div>
          <div class="gscroll" ref={scroller} onScroll={() => { setSl(scroller.scrollLeft); setSt(scroller.scrollTop); }} onMouseLeave={() => setHover(null)}>
            <Show when={model()} fallback={<div class="empty">{runStatus() || status() || 'building…'}</div>}>
              <Show when={!filesMode()} fallback={<FilesGrid model={model()!} col={col()} onOpen={(rowFile, colFile) => setDrill({ rowFile, colFile })} />}>
                <div class="gsz" style={{ width: `${SIDE + geo().x.size + TOT + 12}px`, height: `${HEAD + geo().y.size + FOOT + 8}px` }}>
                  <div class="gax" style={{ left: `${SIDE - 92}px`, top: `${HEAD - 40}px` }}>caller →</div>
                  <div class="gax" style={{ left: '40px', top: `${HEAD - 16}px` }}>called ↓</div>
                  {/* file bands and column heads */}
                  <For each={cols()}>{(c, i) => (
                    <>
                      <Show when={i() === 0 || cols()[i() - 1].file !== c.file}>{(() => { const last = () => { let k = i(); while (k + 1 < cols().length && cols()[k + 1].file === c.file) k++; return k; }; return <div class="gfb" style={{ left: `${SIDE + geo().x.at[i()]}px`, width: `${geo().x.at[last()] + geo().x.w[last()] - geo().x.at[i()] - 2}px`, '--c': col().get(c.file) }}>{stem(c.file)}</div>; })()}</Show>
                      <div class="gch" classList={{ on: curCell().startsWith(`${c.key}>`), pk: pick()?.c === c.key, lv: waysOut() && leaves(c.key), fw: !!mk(c.key)?.fw, dim: !!mk(c.key)?.dim, cadd: !!mk(c.key)?.add, cchg: !!mk(c.key)?.chg, chg: !!mk(c.key)?.edit }} style={{ left: `${SIDE + geo().x.at[i()]}px`, width: `${geo().x.w[i()] - 2}px` }} title={`${c.name} · ${basename(c.file)} · ⇧-click: a route`} onClick={(e) => { if (e.shiftKey) pickRoute(c.key); }}>
                        <span>{c.fn ? `ƒ${c.fn}` : ''}</span><b>{wrapName(c.name)}</b>
                      </div>
                    </>
                  )}</For>
                  {/* row heads, grouped by file */}
                  <For each={rows()}>{(r, j) => (
                    <>
                      <Show when={j() === 0 || rows()[j() - 1].file !== r.file}>{(() => { const last = () => { let k = j(); while (k + 1 < rows().length && rows()[k + 1].file === r.file) k++; return k; }; return <div class="grb" style={{ top: `${HEAD + geo().y.at[j()]}px`, height: `${geo().y.at[last()] + geo().y.w[last()] - geo().y.at[j()] - 2}px`, '--c': col().get(r.file) }}><span>{stem(r.file)}</span></div>; })()}</Show>
                      <div class="grh" classList={{ on: curCell().endsWith(`>${r.key}`), pk: pick()?.r === r.key, lv: waysOut() && leaves(r.key), fw: !!mk(r.key)?.fw, dim: !!mk(r.key)?.dim, cadd: !!mk(r.key)?.add, cchg: !!mk(r.key)?.chg, chg: !!mk(r.key)?.edit }} style={{ top: `${HEAD + geo().y.at[j()]}px`, height: `${geo().rh - 2}px` }} title={`${r.name} · ${basename(r.file)}${mk(r.key)?.dim ? ' · called only where its values rule the call out' : ''} · ⇧-click: a route`} onClick={(e) => { if (e.shiftKey) pickRoute(r.key); }}>
                        <span>{r.fn ? `ƒ${r.fn}` : r.key.startsWith('indirect:') ? '→' : ''}</span><b>{r.name}</b><Show when={mk(r.key)?.fw}><em class="gw">{mk(r.key)!.fw}</em></Show>
                      </div>
                    </>
                  )}</For>
                  {/* file outlines, under the squares */}
                  <For each={boxes()}>{(b) => <div class="gbox" style={{ left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px`, '--c': b.c }} />}</For>
                  {/* the squares */}
                  <For each={cols()}>{(c, i) => (
                    <For each={rows()}>{(r, j) => {
                      const key = `${c.key}>${r.key}`, v = () => model()!.cells.get(key);
                      const isPick = () => pick()?.c === c.key && pick()?.r === r.key;
                      const on = () => curCell() === key, x = () => curCell().startsWith(`${c.key}>`) || curCell().endsWith(`>${r.key}`);
                      const hl = () => { const h = hover(); return !!h && (h.c === c.key || h.r === r.key); };
                      const pl = () => { const p = pick(); return !!p && (p.c === c.key || p.r === r.key); };
                      const rc = () => rectOf(i(), j());
                      return (
                        <div class="gcell" classList={{ has: !!v(), same: c.file === r.file, on: on(), x: x(), hl: hl(), pl: pl(), hv: hover()?.c === c.key && hover()?.r === r.key, pk: isPick(), rt: routePairs().has(key) }}
                          style={{ left: `${rc().x}px`, top: `${rc().y}px`, width: `${rc().w}px`, height: `${rc().h}px`, '--c': col().get(c.file), '--h': heat() && v() ? String(0.08 + (v()!.length / maxCell()) * 0.5) : '0' }}
                          onMouseEnter={() => setHover({ c: c.key, r: r.key })}
                          onClick={() => { if (v()) choose(c.key, r.key); }}>
                          <Show when={v()} fallback={<s />}>{(l) => (
                            <Show when={isPick()} fallback={
                              <Show when={l().length < 4} fallback={<span class="dots"><For each={l().slice(0, 8)}>{(it) => <b classList={{ dn: it < curAt(), now: it === curAt() }} />}</For><em>{l().length}</em></span>}>
                                <For each={l()}>{(it, k) => <><Show when={k() > 0}><span class="sep">·</span></Show>{chip(it, c.key, r.key)}</>}</For>
                              </Show>
                            }>
                              <For each={l()}>{(it) => { const cl = callLine(it); return (
                                <div class="gstep" classList={{ now: curAt() === it, dn: it < curAt() }} title={`step ${it + 1} · click to go there`} onClick={(e) => { e.stopPropagation(); go(it); }}>
                                  <i>step {it + 1}</i><code>{cl.code}</code><small>:{cl.line}</small>
                                </div>
                              ); }}</For>
                            </Show>
                          )}</Show>
                        </div>
                      );
                    }}</For>
                  )}</For>
                  <Show when={tag()}>{(t) => <div class="gtag" style={{ left: `${t().x}px`, top: `${t().y}px` }}>{t().text}</div>}</Show>
                  {/* TIMES CALLED: the end of each row, kept in sight */}
                  {/* opaque from the top, so columns scrolled under it never show through its label */}
                  <div class="gtot" style={{ left: `${totX()}px`, top: '0px', height: `${HEAD + geo().y.size + 4}px` }}>
                    <div class="gax w2" style={{ left: '6px', top: `${HEAD - 30}px` }}>times called</div>
                    <For each={rows()}>{(r, j) => <div class="t" classList={{ pk: pick()?.r === r.key }} style={{ top: `${HEAD + geo().y.at[j()]}px`, height: `${geo().rh - 2}px` }}><i style={{ width: `${Math.max(4, Math.round((r.count / maxRow()) * 28))}px` }} />×{r.count}</div>}</For>
                  </div>
                  {/* CALLS IT MAKES: under each column, kept in sight */}
                  <div class="gmk" style={{ top: `${footY()}px`, width: `${SIDE + geo().x.size}px` }}>
                    <div class="gax" style={{ left: '80px', top: '18px' }}>calls it makes →</div>
                    <For each={cols()}>{(c, i) => <div class="m" classList={{ pk: pick()?.c === c.key }} style={{ left: `${SIDE + geo().x.at[i()]}px`, width: `${geo().x.w[i()] - 2}px` }}><i style={{ height: `${Math.max(3, Math.round((c.count / maxCol()) * 14))}px` }} />{c.count}</div>}</For>
                  </div>
                </div>
              </Show>
            </Show>
          </div>
          <Magnifier host={() => scroller} source={() => { const z = scroller?.querySelector('.gsz') as HTMLElement | null; if (!z) return null; const r = scroller.getBoundingClientRect(); return { el: z, x: r.left - scroller.scrollLeft, y: r.top - scroller.scrollTop, w: z.offsetWidth, h: z.offsetHeight }; }} />
          <Show when={caption()}><div class="scap"><Show when={caption()!.key}><span class="key">{caption()!.key}</span></Show>{caption()!.what}<Show when={caption()!.why}><span class="why">{caption()!.why}</span></Show></div></Show>
          <Show when={S()}><Skyline at={cur()?.at ?? 0} changedItems={new Set()} notes={{}} onScrub={(it) => { stop(); stepMove({ jump: it }); }} read="" /></Show>
        </div>
      </div>
      <StepSplit />
      <Show when={route()} fallback={<StepPreview />}>{(r) => (
        <div class="pane prev" style={{ width: `${stepW()}px`, flex: 'none' }}>
          <div class="ph" style={{ padding: '0 20px' }}><span style={{ color: 'var(--bright)' }}>{r().list.length} route{r().list.length === 1 ? '' : 's'} · {short(R()[r().from].name)} → {short(R()[r().to].name)}</span><span class="grow" /><button class="chip" onClick={() => setRoute(null)}>clear</button></div>
          <For each={r().list}>{(x, i) => (
            <div class="bxr" classList={{ on: r().only === i(), dim: r().only >= 0 && r().only !== i() }} onClick={() => setRoute({ ...r(), only: r().only === i() ? -1 : i() })}>
              <div class="t"><b>{i() + 1}</b><For each={x.rows}>{(q, j) => <><Show when={j() > 0}><i>›</i></Show>{short(R()[q].name)}</>}</For></div>
              <div class="w">{x.rows.length - 1} call{x.rows.length > 2 ? 's' : ''}{x.at.length > 1 ? ` · taken ×${x.at.length}` : ''}<button class="lnk" onClick={(e) => { e.stopPropagation(); const st2 = S()!.itemOf[x.at[0]]; if (st2 != null) go(st2); }}>go there</button></div>
              <For each={frameWords(S()!.run, x.at[0])}>{(w) => <div class="f">{w}</div>}</For>
            </div>
          )}</For>
          <div class="ways pv"><span><b>1–{Math.min(9, r().list.length)}</b> one route</span><span><b>Esc</b> clear</span></div>
        </div>
      )}</Show>
    </div>
  );
}

/** A large run first: files × files, each block the number of calls from one file into another; a click opens it. */
function FilesGrid(props: { model: ReturnType<typeof buildGrid>; col: Map<string, string>; onOpen: (rowFile: string, colFile: string) => void }) {
  const files = () => props.model.files;
  const counts = createMemo(() => {
    const m = new Map<string, number>(), cf = new Map(props.model.cols.map((c) => [c.key, c.file])), rf = new Map(props.model.rows.map((r) => [r.key, r.file]));
    for (const [k, v] of props.model.cells) { const i = k.indexOf('>'); const key = `${rf.get(k.slice(i + 1))}|${cf.get(k.slice(0, i))}`; m.set(key, (m.get(key) ?? 0) + v.length); }
    return m;
  });
  const W = 96, H = 28;
  return (
    <div class="gsz" style={{ width: `${SIDE + files().length * W + 40}px`, height: `${HEAD + files().length * H + 40}px` }}>
      <div class="gnote">a large run: files × files first · click a block for its functions</div>
      <For each={files()}>{(f, i) => <div class="gch" style={{ left: `${SIDE + i() * W}px`, width: `${W - 2}px` }}><b style={{ color: props.col.get(f) }}>{basename(f)}</b></div>}</For>
      <For each={files()}>{(rf, j) => (
        <>
          <div class="grh" style={{ top: `${HEAD + j() * H}px`, height: `${H - 2}px` }}><b style={{ color: props.col.get(rf) }}>{basename(rf)}</b></div>
          <For each={files()}>{(cf, i) => { const n = counts().get(`${rf}|${cf}`) ?? 0; return <div class="gcell" classList={{ has: n > 0, same: rf === cf }} style={{ left: `${SIDE + i() * W}px`, top: `${HEAD + j() * H}px`, width: `${W - 2}px`, height: `${H - 2}px`, '--c': props.col.get(cf) }} onClick={() => n && props.onOpen(rf, cf)}>{n ? <i>{n}</i> : <s />}</div>; }}</For>
        </>
      )}</For>
    </div>
  );
}
