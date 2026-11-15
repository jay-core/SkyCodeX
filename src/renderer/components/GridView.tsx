import { For, Show, createSignal, createMemo, createEffect, on, onMount, onCleanup, JSX } from 'solid-js';
import { setWalkSpeed, seq, trail, status, runStatus, waitingText, analysisNote, stepMove, waysOut, setWaysOut, earlyExits, leavingCount, followed, setFollowed, hitWords, changed } from '../lib/flowstore';
import { root, settings } from '../lib/store';
import { api, basename } from '../lib/api';
import { lines, textTick } from '../lib/seqtext';
import { changedItems, notesByItem } from '../lib/runmarks';
import { move, loopsAt, Move, stepNumbers, most } from '../../shared/flowseq';
import { buildGrid, GridOrder, GridFn, passesOf } from '../../shared/gridmodel';
import { stepLinks, StepLinks, StepLink } from '../../shared/gridlinks';
import { hwheel } from '../lib/hwheel';
import { rounded } from '../lib/paths';
import { textBox, textHeight, styleOf, scrollbarWidth } from '../lib/measure';
import { routesBetween, frameWords, RouteInfo } from '../../shared/flowboxes';
import StepPreview, { openStep, StepSplit, stepW, setGridPick } from './StepPreview';
import Magnifier from './Magnifier';
import PlayControls from './PlayControls';
import { Skyline } from './Sequence';

const GAP = 4;
const EDGE = 4, PAD = 4, NAME_GAP = 6, BAND_TOP = 8, BAND_H = 16, BAND_X = 12, BAND_W = 20, TOT_GAP = 8, PX = 12;
const CROSS = 40, BAR_W = 28, BAR_H = 14, WIDE = 92, TALL = 28, NAME_LINES = 4, OPEN_ROWS = 6, SIDE_SHARE = 0.4, OPEN_SHARE = 0.6, RIGHT = 12;
const HEAD_NAMES = BAND_TOP + BAND_H + NAME_GAP, ROW_NAMES = BAND_X + BAND_W + 2 * PAD;
const PAL = ['#a3a8a0', '#8fa98a', '#c9b27a', '#6fa0a0', '#a8929e', '#c08a74', '#7a90c4', '#b07fa4', '#9aa86f', '#6f8fb8'];
const short = (n: string) => n.replace(/^.*::(?=[^:]+$)/, '');
const wrapName = (n: string) => n.replace(/_/g, '_​');
const load = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
interface Pos { at: number[]; w: number[]; size: number }
interface Rect { x: number; y: number; w: number; h: number }
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const overlapArea = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
interface Cell { i: number; j: number }
const DI = [1, 0, -1, 0], DJ = [0, 1, 0, -1];

function markLane(used: Uint8Array, nc: number, cells: Cell[]) {
  for (let k = 1; k < cells.length; k++) {
    const p = cells[k - 1], q = cells[k], axis = p.j === q.j ? 0 : 1;
    const steps = Math.max(Math.abs(q.i - p.i), Math.abs(q.j - p.j));
    for (let t = 0; t <= steps; t++) { const i = p.i + Math.sign(q.i - p.i) * t, j = p.j + Math.sign(q.j - p.j) * t; used[(j * nc + i) * 2 + axis] = 1; }
  }
}

function lane(occ: Uint8Array, used: Uint8Array, nc: number, nr: number, a: Cell, b: Cell): Cell[] | null {
  const N = nc * nr * 4, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), heap: [number, number][] = [];
  const push = (c: number, s: number) => { heap.push([c, s]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } }
    return top;
  };
  const free = (i: number, j: number) => i >= 0 && j >= 0 && i < nc && j < nr;
  const toll = (i: number, j: number) => (occ[j * nc + i] && !(i === b.i && j === b.j) ? CROSS : 0);
  for (let d = 0; d < 4; d++) { const i = a.i + DI[d], j = a.j + DJ[d]; if (!free(i, j)) continue; const st = (j * nc + i) * 4 + d; dist[st] = 1 + toll(i, j); prev[st] = -2; push(dist[st], st); }
  while (heap.length) {
    const [c, st] = pop();
    if (c > dist[st]) continue;
    const cell = st >> 2, d = st & 3, i = cell % nc, j = (cell / nc) | 0;
    if (i === b.i && j === b.j) { const out: Cell[] = []; for (let x = st; x >= 0; x = prev[x]) { const ce = x >> 2; out.push({ i: ce % nc, j: (ce / nc) | 0 }); } out.push(a); return out.reverse(); }
    for (let e = 0; e < 4; e++) {
      if (e === (d + 2) % 4) continue;
      const ni = i + DI[e], nj = j + DJ[e];
      if (!free(ni, nj)) continue;
      const ns = (nj * nc + ni) * 4 + e, cost = c + 1 + (e === d ? 0 : 3) + (used[(nj * nc + ni) * 2 + (e % 2)] ? 4 : 0) + toll(ni, nj);
      if (cost < dist[ns]) { dist[ns] = cost; prev[ns] = st; push(cost, ns); }
    }
  }
  return null;
}

function laneD(cells: Cell[], rect: (c: Cell) => Rect, k: number, area: Rect): { x: number; y: number }[] {
  const cs = cells.filter((q, n) => n === 0 || q.i !== cells[n - 1].i || q.j !== cells[n - 1].j);
  if (cs.length < 2) return [];
  const A = rect(cs[0]), B = rect(cs[cs.length - 1]), mid = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const n = cs.length, a0 = mid(A), b0 = mid(B);
  const s = { x: Math.sign(cs[1].i - cs[0].i), y: Math.sign(cs[1].j - cs[0].j) }, e = { x: Math.sign(cs[n - 1].i - cs[n - 2].i), y: Math.sign(cs[n - 1].j - cs[n - 2].j) };
  if (n === 2 && Math.abs(cs[1].i - cs[0].i) + Math.abs(cs[1].j - cs[0].j) === 1) {
    if (s.x === 0) {
      const dx = Math.min(10, A.w / 4), right = Math.max(A.x + A.w, B.x + B.w) + 1 + dx <= area.x + area.w;
      const ox = right ? Math.max(A.x + A.w, B.x + B.w) + 1 + dx : Math.min(A.x, B.x) - 1 - dx, ax = right ? A.x + A.w + 1 : A.x - 1, bx = right ? B.x + B.w + 2 : B.x - 2;
      return [{ x: ax, y: a0.y + k }, { x: ox, y: a0.y + k }, { x: ox, y: b0.y }, { x: bx, y: b0.y }];
    }
    const dy = Math.min(8, A.h / 3), below = Math.max(A.y + A.h, B.y + B.h) + 1 + dy <= area.y + area.h;
    const oy = below ? Math.max(A.y + A.h, B.y + B.h) + 1 + dy : Math.min(A.y, B.y) - 1 - dy, ay = below ? A.y + A.h + 1 : A.y - 1, by = below ? B.y + B.h + 2 : B.y - 2;
    return [{ x: a0.x + k, y: ay }, { x: a0.x + k, y: oy }, { x: b0.x, y: oy }, { x: b0.x, y: by }];
  }
  const last = cs[n - 1], onFinal = (q: Cell) => (e.x ? q.j === last.j : q.i === last.i);
  let t = n - 1;
  while (t > 0 && onFinal(cs[t - 1])) t--;
  const kx = (q: number) => (e.y && q >= t ? 0 : k), ky = (q: number) => (e.x && q >= t ? 0 : k);
  const pts = [{ x: a0.x + s.x * (A.w / 2 + 1) + (s.y ? kx(0) : 0), y: a0.y + s.y * (A.h / 2 + 1) + (s.x ? ky(0) : 0) }];
  for (let q = 1; q < n - 1; q++) { const c = mid(rect(cs[q])); pts.push({ x: c.x + kx(q), y: c.y + ky(q) }); }
  pts.push({ x: b0.x - e.x * (B.w / 2 + 2), y: b0.y - e.y * (B.h / 2 + 2) });
  return pts;
}

type Pt = { x: number; y: number };
const TIP = 5, STUB = TIP + 1;
interface End { b: Rect; sq: Rect; others: Rect[]; boxes: Rect[]; snap: (v: number, across: boolean, toward: number) => number }
function reach(p: Pt[], at: End): Pt[] {
  const { b, sq } = at, n = p.length, e = p[n - 1], q = p[n - 2], mx = b.x + b.w / 2, my = b.y + b.h / 2;
  const across = Math.abs(e.x - q.x) >= Math.abs(e.y - q.y);
  if (across) {
    const lo = q.x < e.x ? sq.x : b.x + b.w, hi = q.x < e.x ? b.x : sq.x + sq.w;
    if (at.others.some((o) => o.x < hi && o.x + o.w > lo && o.y < b.y + b.h && o.y + o.h > b.y)) {
      const lyOf = (u: boolean) => (u ? Math.min((sq.y + b.y) / 2, b.y - 1 - STUB) : Math.max((b.y + b.h + sq.y + sq.h) / 2, b.y + b.h + 1 + STUB));
      const runClear = (y: number) => !at.boxes.some((o) => o !== b && o.y - 1 <= y && y <= o.y + o.h + 1 && o.x < Math.max(q.x, mx) && o.x + o.w > Math.min(q.x, mx));
      const want = q.y <= my, up = runClear(lyOf(want)) || !runClear(lyOf(!want)) ? want : !want, ly = lyOf(up);
      const r = p[n - 3], bend = !!r && Math.abs(r.x - q.x) < 0.5;
      const tip = { x: mx, y: up ? b.y - 1 : b.y + b.h + 1 };
      return bend ? [...p.slice(0, n - 2), { x: q.x, y: ly }, { x: mx, y: ly }, tip] : [...p.slice(0, n - 1), { x: q.x, y: ly }, { x: mx, y: ly }, tip];
    }
  }
  const tip = across ? { x: q.x < e.x ? b.x - 1 : b.x + b.w + 1, y: my } : { x: mx, y: q.y < e.y ? b.y - 1 : b.y + b.h + 1 };
  const r = p[n - 3], bend = !!r && (across ? Math.abs(r.x - q.x) < 0.5 : Math.abs(r.y - q.y) < 0.5);
  if (bend) return [...p.slice(0, n - 2), across ? { x: q.x, y: my } : { x: mx, y: q.y }, tip];
  if (across ? Math.abs(q.y - my) < 0.5 : Math.abs(q.x - mx) < 0.5) return [...p.slice(0, n - 1), tip];
  const j = at.snap(across ? (q.x + tip.x) / 2 : (q.y + tip.y) / 2, across, across ? tip.x : tip.y);
  return [...p.slice(0, n - 1), ...(across ? [{ x: j, y: q.y }, { x: j, y: my }] : [{ x: q.x, y: j }, { x: mx, y: j }]), tip];
}
function endOn(p: Pt[], at: End): Pt[] {
  return settle(reach(p, at), at.b);
}
function settle(out: Pt[], b: Rect): Pt[] {
  const t = out[out.length - 1], l = out[out.length - 2];
  const d = t.y < b.y ? { x: 0, y: 1 } : t.y > b.y + b.h ? { x: 0, y: -1 } : t.x < b.x ? { x: 1, y: 0 } : { x: -1, y: 0 };
  if (!l || (d.x ? Math.abs(l.y - t.y) < 0.5 && (t.x - l.x) * d.x >= STUB : Math.abs(l.x - t.x) < 0.5 && (t.y - l.y) * d.y >= STUB)) return out;
  const pre = { x: t.x - d.x * STUB, y: t.y - d.y * STUB }, base = out.slice(0, -1);
  while (base.length > 1 && (base[base.length - 1].x - pre.x) * d.x + (base[base.length - 1].y - pre.y) * d.y > 0) base.pop();
  const k = base[base.length - 1], behind = d.x ? (pre.x - k.x) * d.x >= 0 : (pre.y - k.y) * d.y >= 0;
  const elbow = behind === !!d.x ? { x: k.x, y: pre.y } : { x: pre.x, y: k.y };
  return [...base, elbow, pre, t];
}
function attach(pts: Pt[], from: End | undefined, to: End | undefined): Pt[] {
  if (pts.length < 2) return pts;
  let out = to ? endOn(pts, to) : pts;
  if (from) out = endOn([...out].reverse(), from).reverse();
  return to && from ? settle(out, to.b) : out;
}

export default function GridView(props: { switcher: JSX.Element }) {
  const S = () => seq();
  const cur = () => trail()[trail().length - 1];
  const curAt = () => cur()?.at ?? -1;
  const R = () => S()!.run.rows;
  const nums = createMemo(() => (S() ? stepNumbers(S()!) : []));
  const [order, setOrderRaw] = createSignal<GridOrder>(load('grid.order', 'file') as GridOrder);
  const setOrder = (o: GridOrder) => { setOrderRaw(o); try { localStorage.setItem('grid.order', o); } catch {  } };
  const model = createMemo(() => (S() ? buildGrid(S()!, nums(), order()) : null));
  const col = createMemo(() => { const m = new Map<string, string>(); model()?.files.forEach((f, i) => m.set(f, PAL[i % PAL.length])); return m; });
  const [pick, setPick] = createSignal<{ c: string; r: string } | null>(null);
  const [hover, setHover] = createSignal<{ c: string; r: string } | null>(null);
  createEffect(on(S, () => { setPick(null); setHover(null); }, { defer: true }));
  const rows = createMemo(() => model()?.rows ?? []);
  const cols = createMemo(() => model()?.cols ?? []);
  const recRows = createMemo(() => { const s = S(), out = new Set<string>(); if (!s) return out; s.items.forEach((row) => { const r = s.run.rows[row]; if (r.recursive) out.add(r.kind === 'ref' && r.ref != null ? s.run.rows[r.ref].key : r.key); }); return out; });
  const cellMarks = createMemo(() => {
    const s = S(), m = model(), out = new Map<string, { text: string; title: string }>();
    if (!s || !m) return out;
    const R0 = s.run.rows;
    for (const [k, l] of m.cells) {
      const rows0 = l.map((it) => R0[s.items[it]]), bits: string[] = [], why: string[] = [];
      if (l.length > 1 && l.length < 4) { bits.push(`×${l.length}`); why.push(`${l.length} calls`); }
      const looped = l.filter((it) => R0[s.items[it]].frames.some((f) => s.run.frames[f].kind === 'loop' && !s.run.frames[f].dead));
      if (looped.length) { const ps = l.map((it) => passesOf(s, it)), known = ps.every((p) => p.known), n = ps.reduce((a, p) => a + p.n, 0); bits.push(known ? `↻${n}` : '↻'); why.push(known ? `in a loop: ${n} runs` : 'in a loop whose count is not known'); }
      if (rows0.some((r) => r.recursive)) { bits.push('⟲'); why.push('calls back into a function that is still running'); }
      if (rows0.some((r) => r.thread && r.caller != null && !R0[r.caller].thread)) { bits.push('⇢'); why.push('starts on a new thread'); }
      const folded = l.flatMap((it) => s.uses.get(s.items[it]) ?? []);
      if (folded.length) { bits.push(`+${folded.length}`); why.push(`uses ${folded.map((i) => `${short(R0[i].name)}${R0[i].at ? ` :${R0[i].at!.line + 1}` : ''}`).join(', ')}`); }
      if (bits.length) out.set(k, { text: bits.join(' '), title: why.join(' · ') });
    }
    return out;
  });
  const entryUses = createMemo(() => { const s = S(); if (!s || !s.items.length) return null; const R0 = s.run.rows, l = s.uses.get(s.items[0]) ?? []; return l.length ? { name: short(R0[s.items[0]].name), names: l.map((i) => `${short(R0[i].name)}${R0[i].at ? ` (line ${R0[i].at!.line + 1})` : ''}`).join(', ') } : null; });
  const cellAt = (c: string, r: string) => model()?.cells.get(`${c}>${r}`);
  const pickCell = createMemo(() => { const p = pick(); return p ? cellAt(p.c, p.r) ?? [] : []; });

  let scroller!: HTMLDivElement, canvas!: HTMLDivElement;
  const [vw, setVw] = createSignal(900), [fullH, setFullH] = createSignal(600), [skyH, setSkyH] = createSignal(0), [sl, setSl] = createSignal(0), [st, setSt] = createSignal(0);
  const vh = () => fullH() - skyH();
  onMount(() => {
    let f = 0;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(f); f = requestAnimationFrame(() => { setVw(scroller.clientWidth); setFullH(scroller.clientHeight); setSkyH(canvas.querySelector('.ssky')?.getBoundingClientRect().height ?? 0); }); });
    onCleanup(() => cancelAnimationFrame(f));
    ro.observe(scroller); onCleanup(() => ro.disconnect());
    createEffect(on(S, () => requestAnimationFrame(() => { const sky = canvas?.querySelector('.ssky'); if (sky) ro.observe(sky); setSkyH(sky?.getBoundingClientRect().height ?? 0); })));
    createEffect(on([vw, keySteps, model, () => flowLinks().error], () => requestAnimationFrame(() => canvas?.querySelectorAll<HTMLElement>('.gkey').forEach(keyEdges))));
    requestAnimationFrame(() => canvas?.focus());
  });
  const keyEdges = (el: HTMLElement) => { el.classList.toggle('fl', el.scrollLeft > 0); el.classList.toggle('fr', el.scrollLeft < el.scrollWidth - el.clientWidth - 1); };
  const place = (list: GridFn[], size: (i: number) => number, gap: number, lead: boolean): Pos => {
    const at: number[] = [], w: number[] = []; let x = lead && list.length ? gap : 0;
    list.forEach((g, i) => { if (i && list[i - 1].file !== g.file) x += gap; at.push(x); w.push(size(i)); x += size(i); });
    return { at, w, size: x };
  };
  const breaks = (list: GridFn[]) => list.reduce((n, g, i) => n + (i && list[i - 1].file !== g.file ? 1 : 0), 0);
  const [fontsOk, setFontsOk] = createSignal(0);
  onMount(() => { document.fonts?.ready.then(() => setFontsOk(1)); });
  const need = createMemo(() => {
    fontsOk();
    const m = model(), col = new Map<string, number>(), row = new Map<string, number>();
    if (!m) return { col, row };
    const chip = textBox('gcell', 'i'), sep = textBox('gcell', 'span.sep')('·'), gap = parseFloat(styleOf('gcell').columnGap) || 0;
    const dot = styleOf('dots', 'b'), dotW = (parseFloat(dot.width) || 0) + (parseFloat(dot.borderLeftWidth) || 0) + (parseFloat(dot.borderRightWidth) || 0);
    const dotGap = parseFloat(styleOf('dots').columnGap) || 0, em = textBox('dots', 'em'), emGap = parseFloat(styleOf('dots', 'em').marginLeft) || 0;
    const h = textHeight('gcell', 'i')('0', 100) + EDGE, widths = new Map<string, number>();
    const chipW = (t: string) => { let w = widths.get(t); if (w == null) widths.set(t, (w = chip(t))); return w; }, markW = textBox('gcell', 'em.gm');
    for (const [k, l] of m.cells) {
      let w = 0;
      if (l.length < 4) { for (const it of l) w += chipW(String(it + 1)); w += (l.length - 1) * (sep + 2 * gap); }
      else { const n = Math.min(8, l.length); w = n * dotW + (n - 1) * dotGap + emGap + em(String(l.length)); }
      const mark = cellMarks().get(k);
      if (mark) w += gap + markW(mark.text);
      const p = k.indexOf('>'), ck = k.slice(0, p), rk = k.slice(p + 1);
      col.set(ck, Math.max(col.get(ck) ?? 0, Math.ceil(w) + 2 * EDGE)); row.set(rk, h);
    }
    return { col, row };
  });
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
  const callLine = (it: number) => { const r = R()[S()!.items[it]]; if (r.caller == null || !r.at) return { code: '', line: 0 }; return { code: lines(R()[r.caller].file)?.[r.at.line]?.trim() ?? '', line: r.at.line + 1 }; };
  const fnText = (r: GridFn) => (r.fn ? `ƒ${r.fn}` : r.key.startsWith('indirect:') ? '→' : r.key.startsWith('value:') ? '&' : '');
  const timesText = (r: GridFn) => `×${r.runs}${r.atLeast ? '+' : ''}`;
  const lay = createMemo(() => {
    fontsOk();
    const rs = rows(), cs = cols();
    const fW = textBox('grh', 'span'), bW = textBox('grh', 'b'), gW = textBox('grh', 'em.gw'), axW = textBox('gax'), fileW = textBox('grf');
    const fn = most(rs, (r) => fW(fnText(r)));
    const rW = textBox('grh', 'em.gr'), name = most(rs, (r) => { const w = mk(r.key)?.fw; return bW(r.name) + (recRows().has(r.key) ? NAME_GAP + rW('⟲') : 0) + (w ? NAME_GAP + gW(w) : 0); });
    const files = most([...new Set(rs.map((r) => r.file))], (f) => fileW(basename(f)));
    const corner = ROW_NAMES + axW('called ↓') + 2 * NAME_GAP + axW('caller →') + NAME_GAP;
    const sideNeed = Math.max(corner, ROW_NAMES + fn + NAME_GAP + name + NAME_GAP, BAND_X + files + NAME_GAP);
    const sideMax = Math.max(corner, Math.floor(vw() * SIDE_SHARE));
    const tW = textBox('gtot', 'div.t'), mW = textBox('gmk', 'div.m'), mGap = parseFloat(styleOf('gmk', 'div.m').rowGap) || 0, mTop = parseFloat(styleOf('gmk', 'div.m').top) || 0;
    const tot = NAME_GAP + BAR_W + NAME_GAP + most(rs, (r) => tW(timesText(r))) + NAME_GAP;
    const mH = BAR_H + mGap + textHeight('gmk', 'div.m')('0', 100), footH = mTop + mH + NAME_GAP;
    const stepH = Math.max(textHeight('gstep', 'code')('x', 1000), textHeight('gstep', 'i')('x', 1000), textHeight('gstep', 'small')('x', 1000)) + 2 * PAD;
    const pkGap = parseFloat(styleOf('gcell pk').rowGap) || 0, pkPad = parseFloat(styleOf('gcell pk').paddingTop) || 0;
    const fileShare = new Map<string, number>(), bandW = textBox('gfb');
    cs.forEach((c, i) => { if (i && cs[i - 1].file === c.file) return; let k = i; while (k + 1 < cs.length && cs[k + 1].file === c.file) k++; const per = Math.ceil(bandW(basename(c.file)) / (k - i + 1)) + 2; for (let q = i; q <= k; q++) fileShare.set(cs[q].key, per); });
    return {
      side: Math.min(sideMax, sideNeed), sideBound: sideNeed > sideMax, fn, tot, mH, footH, foot: footH + NAME_GAP, stepH, lineH: stepH + pkGap, pkPad,
      nameH: textHeight('grh', 'b')('x', 1000), spanH: textHeight('gch', 'span')('ƒ1', 100), lineCH: textHeight('gch', 'b')('x', 1000), fileH: textHeight('grf')('x', 1000) + EDGE / 2,
      count: new Map(cs.map((c) => [c.key, mW(String(c.count)) + EDGE / 2])), fileShare, fileFit: (f: string, w: number) => fileW(basename(f)) <= w,
    };
  });
  const openNeed = createMemo(() => {
    const v = pickCell();
    if (!v.length) return { w: 0, bound: false };
    fontsOk();
    const iW = textBox('gstep', 'i'), cW = textBox('gstep', 'code'), sW = textBox('gstep', 'small'), pad = textBox('gstep')(''), gap = parseFloat(styleOf('gstep').columnGap) || 0;
    const w = most(v, (it) => { const cl = callLine(it); return pad + iW(`step ${it + 1}`) + gap + cW(cl.code) + gap + sW(`:${cl.line}`); }) + 2 * lay().pkPad + PAD + (v.length > OPEN_ROWS ? scrollbarWidth('gcell pk') : 0);
    const max = Math.floor(vw() * OPEN_SHARE);
    return { w: Math.min(max, w), bound: w > max };
  });
  const geo = createMemo(() => {
    const cs = cols(), rs = rows(), p = pick(), L = lay(), N = need();
    const pc = p ? cs.findIndex((c) => c.key === p.c) : -1, pr = p ? rs.findIndex((r) => r.key === p.r) : -1;
    const openH = pr >= 0 ? 2 * L.pkPad + 2 + Math.min(OPEN_ROWS, pickCell().length) * L.lineH : 0, openW = pc >= 0 ? openNeed().w : 0;
    const nc = cs.length - (pc >= 0 ? 1 : 0), nr = rs.length - (pr >= 0 ? 1 : 0);
    const fit = nc ? Math.floor((vw() - L.side - L.tot - RIGHT - breaks(cs) * GAP - openW) / nc) : WIDE;
    const colW = (i: number) => Math.max(N.col.get(cs[i].key) ?? 0, L.count.get(cs[i].key) ?? 0, L.fileShare.get(cs[i].key) ?? 0, Math.min(WIDE, fit));
    const x = place(cs, (i) => (i === pc ? Math.max(openW, colW(i)) : colW(i)), GAP, false);
    const nameLines = textHeight('gch', 'b'), wanted = cs.map((c, i) => Math.round(nameLines(wrapName(c.name), x.w[i] - 2 - PAD) / L.lineCH));
    const lines = Math.max(1, Math.min(NAME_LINES, most(wanted, (n) => n)));
    const head = HEAD_NAMES + L.spanH + lines * L.lineCH + NAME_GAP, boundCols = new Set(cs.filter((c, i) => wanted[i] > lines).map((c) => c.key));
    const fitH = nr ? Math.floor((vh() - head - L.foot - (breaks(rs) + 1) * L.fileH - openH) / nr) : TALL;
    const rowH = (j: number) => Math.max(N.row.get(rs[j].key) ?? 0, L.nameH + EDGE / 2, Math.min(TALL, fitH));
    const y = place(rs, (j) => (j === pr ? Math.max(openH, rowH(j)) : rowH(j)), L.fileH, true);
    return { cw: x.w.reduce((a, b) => Math.min(a, b), WIDE), rh: y.w.reduce((a, b) => Math.min(a, b), TALL), pc, pr, x, y, head, lines, boundCols, side: L.side, tot: L.tot, foot: L.foot };
  });
  const side = () => geo().side, head = () => geo().head, tot = () => geo().tot, foot = () => geo().foot;
  const colIdx = createMemo(() => new Map(cols().map((c, i) => [c.key, i])));
  const rowIdx = createMemo(() => new Map(rows().map((r, j) => [r.key, j])));
  const rectOf = (i: number, j: number): Rect => ({ x: side() + geo().x.at[i], y: head() + geo().y.at[j], w: geo().x.w[i] - 2, h: geo().y.w[j] - 2 });
  const totX = () => Math.min(side() + geo().x.size + TOT_GAP, sl() + vw() - tot());
  const footY = () => Math.min(head() + geo().y.size + NAME_GAP, st() + vh() - foot());
  const span = (p: Pos, lo: number, hi: number) => {
    let a = 0, b = p.at.length;
    while (a < b) { const m = (a + b) >> 1; if (p.at[m] + p.w[m] < lo) a = m + 1; else b = m; }
    let e = a;
    while (e < p.at.length && p.at[e] <= hi) e++;
    return [a, e] as const;
  };
  const win = createMemo(() => {
    const g = geo(), x0 = sl() - g.side, y0 = st() - g.head, [i0, i1] = span(g.x, x0 - vw(), x0 + 2 * vw()), [j0, j1] = span(g.y, y0 - fullH(), y0 + 2 * fullH());
    return { cs: cols().slice(i0, i1), rs: rows().slice(j0, j1) };
  }, undefined, { equals: (a, b) => a.cs.length === b.cs.length && a.rs.length === b.rs.length && a.cs.every((c, i) => c === b.cs[i]) && a.rs.every((r, j) => r === b.rs[j]) });
  const maxRow = createMemo(() => most(rows(), (r) => r.runs, 1));
  const maxCol = createMemo(() => most(cols(), (c) => c.count, 1));

  const summary = createMemo(() => {
    const m = model(), s = S();
    if (!m || !s) return null;
    let calls = 0, cross = 0;
    s.items.forEach((row) => { const r = s.run.rows[row]; if (r.caller == null) return; calls++; const cf = s.run.rows[r.caller].file, f = r.kind === 'ref' && r.ref != null ? s.run.rows[r.ref].file : r.kind === 'step' ? r.file : cf; if (cf !== f) cross++; });
    const most = [...m.rows].filter((r) => r.runs > 1).sort((a, b) => b.runs - a.runs || a.first - b.first).slice(0, 3);
    return { fns: m.rows.length, callers: m.cols.length, calls, cross: calls ? Math.round((cross / calls) * 100) : 0, most };
  });

  const curCell = createMemo(() => { const m = model(), c = cur(); return m && c && c.at < S()!.items.length ? m.cellOf[c.at] : ''; });
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
  const [ends, setEnds] = createSignal<Map<number, Rect>>(new Map());
  const measureEnds = () => {
    const z = scroller?.querySelector('.gsz') as HTMLElement | null, m = new Map<number, Rect>();
    if (z) {
      const o = z.getBoundingClientRect();
      const box = (e: Element): Rect => { const r = e.getBoundingClientRect(); return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height }; };
      for (const e of z.querySelectorAll('.gcell [data-it]')) m.set(Number((e as HTMLElement).dataset.it), box(e));
      for (const e of z.querySelectorAll('.gcell [data-all]')) { const b = box(e); for (const it of (e as HTMLElement).dataset.all!.split(' ')) if (!m.has(Number(it))) m.set(Number(it), b); }
    }
    setEnds(m);
  };
  let measureFrame = 0;
  createEffect(on([model, geo, pick, curAt, order, win], () => { cancelAnimationFrame(measureFrame); measureFrame = requestAnimationFrame(measureEnds); }));
  onMount(() => { document.fonts?.ready.then(() => measureEnds()); });
  onCleanup(() => cancelAnimationFrame(measureFrame));
  const flowLinks = createMemo((): { L: StepLinks | null; error: string } => {
    const s = S(), c = cur();
    textTick();
    if (!s || !c || c.at >= s.items.length || !model() || route()) return { L: null, error: '' };
    try { return { L: stepLinks(s, c.at, (f) => lines(f)), error: '' }; } catch (e) { return { L: null, error: e instanceof Error ? e.message : String(e) }; }
  });
  const nameAt = (it: number) => { const r = R()[S()!.items[it]]; return short(r.kind === 'ref' ? R()[r.ref!].name : r.kind === 'indirect' ? (r.text ?? r.name) : r.name); };
  const drawn = createMemo(() => {
    const L = flowLinks().L, m = model(), c = cur(), E = ends();
    if (!L || !m || !c) return null;
    const cs = cols(), rs = rows(), nc = cs.length, nr = rs.length, ci = colIdx(), ri = rowIdx();
    if (!nc || !nr) return null;
    const occ = new Uint8Array(nc * nr), filled: Rect[] = [];
    cs.forEach((cc, i) => rs.forEach((rr, j) => { if (m.cells.get(`${cc.key}>${rr.key}`)) { occ[j * nc + i] = 1; filled.push(rectOf(i, j)); } }));
    const at = (item: number): Cell | null => { const k = m.cellOf[item]; if (!k) return null; const p = k.indexOf('>'), i = ci.get(k.slice(0, p)), j = ri.get(k.slice(p + 1)); return i == null || j == null ? null : { i, j }; };
    const sel = at(c.at);
    const rect = (q: Cell) => rectOf(q.i, q.j);
    const bandsX = geo().x.at.map((a, i) => [side() + a, side() + a + geo().x.w[i] - 2]), bandsY = geo().y.at.map((a, j) => [head() + a, head() + a + geo().y.w[j] - 2]);
    const snap = (v: number, across: boolean, toward: number) => {
      const bands = across ? bandsX : bandsY;
      if (bands.some(([s0, e0]) => v >= s0 && v <= e0)) return v;
      const near = bands.filter(([s0, e0]) => (toward >= v ? s0 > v : e0 < v)).sort((p, q2) => (toward >= v ? p[0] - q2[0] : q2[1] - p[1]))[0];
      return near ? (toward >= v ? near[0] + 1 : near[1] - 1) : v;
    };
    const endAt = (it: number, q: Cell): End | undefined => {
      const b = E.get(it);
      if (!b) return undefined;
      const sq = rect(q), inside = (r: Rect) => r.x >= sq.x - 0.5 && r.y >= sq.y - 0.5 && r.x + r.w <= sq.x + sq.w + 0.5 && r.y + r.h <= sq.y + sq.h + 0.5;
      return { b, sq, snap, boxes: [...E.values()], others: [...E.values()].filter((r) => r !== b && inside(r) && !(r.x <= b.x && r.x + r.w >= b.x + b.w)) };
    };
    const paths: { d: string; kind: string; title: string }[] = [], labels: (Rect & { text: string; kind: string; full?: string })[] = [], placed: Rect[] = [];
    const labW = textBox('glab'), area: Rect = { x: side(), y: head(), w: geo().x.size, h: geo().y.size };
    const within = (t: Rect) => t.x >= area.x && t.y >= area.y && t.x + t.w <= area.x + area.w && t.y + t.h <= area.y + area.h;
    const lines: Rect[] = [];
    const covered = (t: Rect) => [...filled, ...placed, ...lines].reduce((n, f) => n + overlapArea(t, f), 0) + (within(t) ? 0 : t.w * t.h - overlapArea(t, area));
    const label = (nears: Cell[], full: string, kind: string) => {
      let text = full;
      if (labW(full) > area.w) { let n = full.length; while (n > 1 && labW(`${full.slice(0, n)}…`) > area.w) n--; text = `${full.slice(0, n)}…`; }
      const w = labW(text), h = 15, tries: Rect[] = [];
      for (const near of nears) for (let k = 0; k < 3; k++) {
        const r = rect(near), my = r.y + (r.h - h) / 2; const dy = k * (h + 3); tries.push({ x: r.x + r.w + 6, y: my - dy, w, h }, { x: r.x - w - 6, y: my - dy, w, h }, { x: r.x, y: r.y - h - 3 - dy, w, h }, { x: r.x, y: r.y + r.h + 3 + dy, w, h }, { x: r.x + r.w - w, y: r.y - h - 3 - dy, w, h }, { x: r.x + r.w - w, y: r.y + r.h + 3 + dy, w, h }, { x: r.x + r.w + 6, y: my + dy, w, h }, { x: r.x - w - 6, y: my + dy, w, h });
      }
      const clear = (t: Rect) => !filled.some((f) => overlaps(t, f)) && !placed.some((p) => overlaps(t, p)) && !lines.some((l) => overlaps(t, l));
      const beyond = side() + geo().x.size + TOT_GAP + tot() + NAME_GAP, room: Rect = { x: beyond, y: area.y, w: vw() - beyond, h: area.h };
      const aside = nears.map((near) => { const r = rect(near); return { x: beyond, y: r.y + (r.h - h) / 2, w, h }; }).filter((t) => t.x + t.w <= room.x + room.w && t.y >= room.y && t.y + t.h <= room.y + room.h);
      const ok = tries.find((t) => within(t) && clear(t)) ?? aside.find(clear) ?? tries.reduce((a, b) => (covered(b) < covered(a) ? b : a));
      placed.push(ok); labels.push({ ...ok, text, kind, full: text === full ? undefined : full });
    };
    const titleOf = (l: StepLink) => (l.kind === 'in' ? `where an input came from: ${l.label}` : l.kind === 'out' ? `who reads its result: ${l.label}` : `the call to ${nameAt(l.to)} · step ${l.to + 1}`);
    const push = (pts: Pt[], l: StepLink, d = '') => {
      if (!pts.length) return;
      paths.push({ d: d || rounded(pts), kind: l.kind, title: titleOf(l) });
      for (let q = 1; q < pts.length; q++) { const p0 = pts[q - 1], p1 = pts[q]; lines.push({ x: Math.min(p0.x, p1.x) - 1.5, y: Math.min(p0.y, p1.y) - 1.5, w: Math.abs(p1.x - p0.x) + 3, h: Math.abs(p1.y - p0.y) + 3 }); }
    };
    if (!sel) {
      const r0 = R()[S()!.items[c.at]], ec = ci.get(r0.key);
      const targets: Cell[] = [];
      if (ec != null) for (const l of L.links) {
        const b = at(l.to);
        if (l.kind !== 'call' || !b) continue;
        targets.push(b);
        const sq = rect(b), box = E.get(l.to) ?? sq, x0 = side() + geo().x.at[ec] + EDGE / 2, my = box.y + box.h / 2;
        const end = endAt(l.to, b), pts = [{ x: x0, y: head() + 1 }, { x: x0, y: my }, { x: box.x + box.w / 2, y: my }];
        push(end ? endOn(pts, end) : pts, l);
      }
      if (targets.length) { if (L.calls) label(targets, L.calls, 'call'); for (const d of L.decisions) label(targets, `◆ ${d.text} · :${d.line + 1}`, 'dec'); }
      return { paths, labels };
    }
    const used = new Uint8Array(nc * nr * 2), count: Record<string, number> = { in: 0, out: 0, call: 0 }, total: Record<string, number> = { in: 0, out: 0, call: 0 };
    const todo = L.links.flatMap((l) => { const a = at(l.from), b = at(l.to); if (!a || !b) return []; total[l.kind]++; return [{ l, a, b }]; });
    const band = Math.min(geo().cw, geo().rh) / 2 - TIP / 2 - 0.5, step = Math.min(3, band / Math.max(1, total.in, total.call, Math.ceil(total.out / 2)));
    const shift = (kind: string) => { const n = count[kind]++; return kind === 'in' ? -step * (1 + n) : kind === 'call' ? step * (1 + n) : (n % 2 ? -step : step) / 2 * Math.ceil(n / 2); };
    let callSaid = false;
    const asks: [Cell[], string, string][] = [], callCells = todo.filter((t) => t.l.kind === 'call').map((t) => t.b);
    for (const { l, a, b } of todo) {
      if (a.i === b.i && a.j === b.j) {
        const A0 = E.get(l.from), B0 = E.get(l.to);
        if (A0 && B0) {
          const ax = A0.x + A0.w / 2, bx = B0.x + B0.w / 2, ay = A0.y - 1, by = B0.y - 1, ly = Math.min(A0.y, B0.y) - 1 - 2 * STUB;
          push([{ x: ax, y: ay }, { x: ax, y: ly }, { x: bx, y: ly }, { x: bx, y: by }], l, `M${ax} ${ay} C${ax} ${ly} ${bx} ${ly} ${bx} ${by}`);
        }
      } else {
        const cells = lane(occ, used, nc, nr, a, b) ?? [a, { i: b.i, j: a.j }, b];
        markLane(used, nc, cells.filter((q, n) => n === 0 || q.i !== cells[n - 1].i || q.j !== cells[n - 1].j));
        push(attach(laneD(cells, rect, shift(l.kind), area), endAt(l.from, a), endAt(l.to, b)), l);
      }
      if (l.kind === 'call') { if (!callSaid && L.calls) { asks.push([[sel, ...callCells], L.calls, 'call']); callSaid = true; } }
      else if (l.label) asks.push([l.kind === 'in' ? [a, b] : [b, a], l.label, l.kind]);
    }
    for (const [nears, text, kind] of asks) label(nears, text, kind);
    for (const d of L.decisions) label([sel], `◆ ${d.text} · :${d.line + 1}`, 'dec');
    return { paths, labels };
  });
  const leaves = (key: string) => { const s = S(); if (!s) return false; const row = s.run.rows.findIndex((r) => r.kind === 'step' && r.key === key); return row >= 0 && earlyExits(s.run, row).length > 0; };
  const maxCell = createMemo(() => { let m = 1; for (const v of model()?.cells.values() ?? []) m = Math.max(m, v.length); return m; });
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

  const tag = createMemo(() => {
    const h = hover(), v = h && cellAt(h.c, h.r);
    if (!h || !v) return null;
    const i = colIdx().get(h.c), j = rowIdx().get(h.r);
    if (i == null || j == null) return null;
    const cname = short(cols()[i].name), rname = short(rows()[j].name), open = pick()?.c === h.c && pick()?.r === h.r;
    const steps = v.length > 6 ? `${v.slice(0, 4).map((it) => it + 1).join(' · ')} · … · ${v[v.length - 1] + 1} (${v.length} calls)` : v.map((it) => it + 1).join(' · ');
    const text = `${cname} → ${rname} · step${v.length > 1 ? 's' : ''} ${steps} · click to ${open ? 'close' : 'open'}`;
    const most0 = Math.max(80, vw() - 2 * EDGE), w = Math.min(textBox('gtag')(text), most0), a = rectOf(i, j), hh = textHeight('gtag')(text, w);
    const filled: Rect[] = [];
    for (const k of model()!.cells.keys()) {
      const [ck, rk] = [k.slice(0, k.indexOf('>')), k.slice(k.indexOf('>') + 1)], ci = colIdx().get(ck), rj = rowIdx().get(rk);
      if (ci != null && rj != null && !(ci === i && rj === j)) filled.push(rectOf(ci, rj));
    }
    const tries: Rect[] = [
      { x: a.x + a.w - w, y: a.y - hh - 3, w, h: hh }, { x: a.x, y: a.y - hh - 3, w, h: hh },
      { x: a.x + a.w - w, y: a.y + a.h + 3, w, h: hh }, { x: a.x, y: a.y + a.h + 3, w, h: hh },
      { x: a.x + a.w + 6, y: a.y + (a.h - hh) / 2, w, h: hh }, { x: a.x - w - 6, y: a.y + (a.h - hh) / 2, w, h: hh },
    ];
    const dr = drawn(), lab = dr?.labels ?? [], view: Rect = { x: sl(), y: st(), w: vw(), h: vh() };
    const free = (t: Rect) => t.x >= view.x && t.y >= view.y && t.x + t.w <= view.x + view.w && t.y + t.h <= view.y + view.h && !filled.some((f) => overlaps(t, f)) && !lab.some((f) => overlaps(t, f));
    const cover = (t: Rect) => [...filled, ...lab].reduce((n, f) => n + overlapArea(t, f), 0) + (t.w * t.h - overlapArea(t, view));
    const ok = tries.find(free) ?? tries.reduce((p, q) => (cover(q) < cover(p) ? q : p));
    return { text, w, x: Math.max(sl() + EDGE, Math.min(ok.x, sl() + vw() - w - EDGE)), y: ok.y };
  });

  const [caption, setCaption] = createSignal<{ key: string; what: string; why: string } | null>(null);
  const say = (key: string, what: string, why = '') => setCaption({ key, what, why });
  const report = (r: ReturnType<typeof stepMove>, quiet = false) => { if (r.note) say('', r.note); else if (r.state && !quiet) say(r.state.key, r.state.what, r.state.why); };

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
  onCleanup(() => { stop(); setWalkSpeed(0); setGridPick(null); });

  let routeFrom = -1;
  function pickRoute(key: string) {
    const s = S();
    if (!s) return;
    const row = s.run.rows.findIndex((r) => r.kind === 'step' && r.key === key);
    if (row < 0) { say('⇧', `no route from ${short(key.replace(/^[a-z]+:|@.*$/g, ''))}`, key.startsWith('indirect:') ? 'a call through a pointer has no steps of its own' : key.startsWith('value:') ? 'a function passed as a value is not called here' : 'it has no steps of its own'); return; }
    if (routeFrom < 0 || routeFrom === row) { routeFrom = row; say('⇧', `from ${short(s.run.rows[row].name)}`, 'shift-click the other end of the route'); return; }
    let list = routesBetween(s.run, routeFrom, s.run.rows[row].key), a = routeFrom, b = row;
    if (!list.length) { list = routesBetween(s.run, row, s.run.rows[routeFrom].key); a = row; b = routeFrom; }
    routeFrom = -1;
    if (!list.length) { say('', `no route between ${short(s.run.rows[a].name)} and ${short(s.run.rows[b].name)}`, 'neither reaches the other in this run'); return; }
    setRoute({ from: a, to: b, list, only: list.length === 1 ? 0 : -1 });
  }

  createEffect(on([curCell, pick], () => requestAnimationFrame(() => {
    const p = pick(), k = p ? `${p.c}>${p.r}` : curCell(), sep = k.indexOf('>'), i = colIdx().get(k.slice(0, sep)), j = rowIdx().get(k.slice(sep + 1));
    if (!scroller || !k || i == null || j == null) return;
    const q = rectOf(i, j), b = scroller.getBoundingClientRect(), a = { left: b.left + q.x - scroller.scrollLeft, top: b.top + q.y - scroller.scrollTop, width: q.w, height: q.h, right: b.left + q.x - scroller.scrollLeft + q.w, bottom: b.top + q.y - scroller.scrollTop + q.h }, edge = (sel: string) => scroller.querySelector(sel)?.getBoundingClientRect();
    const L = edge('.gstrip.side')?.right ?? b.left, T = edge('.gstrip.top')?.bottom ?? b.top, Rt = edge('.gtot')?.left ?? b.right, B = Math.min(edge('.gmk')?.top ?? b.bottom, b.bottom - skyH());
    if (a.left < L || a.right > Rt || a.top < T || a.bottom > B)
      scroller.scrollTo({ left: scroller.scrollLeft + a.left + a.width / 2 - (L + Rt) / 2, top: scroller.scrollTop + a.top + a.height / 2 - (T + B) / 2, behavior: settings()['motion.reduce'] ? 'auto' : 'smooth' });
  })));

  function onKey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    setCaption(null);
    const key = e.key, sh = e.shiftKey;
    if (key === 'Tab') return;
    if (key === ' ') { e.preventDefault(); play(); return; }
    if (key === '+' || key === '=') { setSpeed(Math.min(3, speed() * 1.5)); return; }
    if (key === '-') { setSpeed(Math.max(0.25, speed() / 1.5)); return; }
    if (key === 'Escape') { stop(); routeFrom = -1; if (pick()) setPick(null); else if (route()) setRoute(null); else if (followed()) setFollowed(null); else if (focus()) setFocus(false); return; }
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

  async function exportPng() {
    const m = model(); if (!m) return;
    const file = (await api.fs.saveDialog(`${root()}/${basename(root()) || 'flow'}-grid.png`)) as string | null;
    if (!file) return;
    const G = geo(), probe = document.createElement('canvas').getContext('2d')!;
    probe.font = `${PX}px "ArX F1", monospace`;
    const fm = probe.measureText('Mg'), LH = Math.ceil(fm.fontBoundingBoxAscent + fm.fontBoundingBoxDescent);
    const wrap = (t: string, w: number) => { const out: string[] = []; let cur = ''; for (const ch of t) { if (cur && probe.measureText(cur + ch).width > w) { out.push(cur); cur = ch; } else cur += ch; } if (cur) out.push(cur); return out; };
    const names = cols().map((cc, i) => wrap(cc.name, G.x.w[i] - 2 - PAD)), top = Math.max(head(), NAME_GAP + most(names, (l) => l.length, 1) * LH + 2 * NAME_GAP);
    const W = side() + G.x.size + tot() + RIGHT + TOT_GAP, H = top + G.y.size + foot() + RIGHT, sc = 2, TILE = 16000;
    const TW = Math.round(W * sc), TH = Math.round(H * sc), nx = Math.ceil(TW / TILE), ny = Math.ceil(TH / TILE), saved: string[] = [];
    for (let ty = 0; ty < ny; ty++) for (let tx = 0; tx < nx; tx++) {
    const c = document.createElement('canvas'); c.width = Math.min(TILE, TW - tx * TILE); c.height = Math.min(TILE, TH - ty * TILE);
    const g = c.getContext('2d')!; g.setTransform(sc, 0, 0, sc, -tx * TILE, -ty * TILE); g.fillStyle = '#171817'; g.fillRect(0, 0, W, H);
    g.font = probe.font; g.textBaseline = 'middle';
    cols().forEach((cc, i) => { g.fillStyle = col().get(cc.file)!; g.fillRect(side() + G.x.at[i], top - NAME_GAP, G.x.w[i] - 2, 2); g.fillStyle = '#9ea39b'; names[i].forEach((ln, k) => g.fillText(ln, side() + G.x.at[i] + PAD, top - 2 * NAME_GAP - (names[i].length - k - 0.5) * LH)); });
    rows().forEach((rr, j) => { const my = top + G.y.at[j] + (G.y.w[j] - 2) / 2; g.fillStyle = col().get(rr.file)!; g.fillRect(BAND_X + BAND_W - 2, top + G.y.at[j], 2, G.y.w[j] - 2); g.fillStyle = '#9ea39b'; g.fillText(rr.name, ROW_NAMES + NAME_GAP, my); g.fillText(`×${rr.count}`, side() + G.x.size + TOT_GAP + NAME_GAP, my); });
    cols().forEach((cc, i) => { g.fillStyle = '#9ea39b'; g.fillText(String(cc.count), side() + G.x.at[i] + PAD, top + G.y.size + foot() / 2); rows().forEach((rr, j) => { const v = m.cells.get(`${cc.key}>${rr.key}`); if (!v) return; g.fillStyle = '#1f211f'; g.fillRect(side() + G.x.at[i], top + G.y.at[j], G.x.w[i] - 2, G.y.w[j] - 2); g.fillStyle = '#c9cec6'; g.fillText(v.map((it) => it + 1).join(' · '), side() + G.x.at[i] + NAME_GAP, top + G.y.at[j] + (G.y.w[j] - 2) / 2); }); });
    const out = nx * ny === 1 ? file : file.replace(/(\.png)?$/i, `-${ty + 1}-${tx + 1}.png`);
    await api.fs.writeBase64(out, c.toDataURL('image/png').split(',')[1]);
    saved.push(basename(out));
    }
    say('PNG', `saved ${nx * ny === 1 ? saved[0] : `${saved.length} images, ${ny} rows × ${nx} columns: ${saved[0]} … ${saved[saved.length - 1]}`}`, `${TW} × ${TH} px`);
  }

  const go = (it: number) => { stop(); setCaption(null); report(stepMove({ jump: it })); canvas.focus(); };
  const choose = (c: string, r: string) => { const p = pick(); setPick(p && p.c === c && p.r === r ? null : { c, r }); canvas.focus(); };
  const chip = (it: number, c: string, r: string) => (
    <i data-it={it} classList={{ now: curAt() === it, dn: it < curAt() }} title={`step ${it + 1} · click to go there`} onClick={(e) => { e.stopPropagation(); setPick({ c, r }); go(it); }}>{it + 1}</i>
  );
  const header = createMemo(() => { const s = S(), c = cur(); if (!s || !c) return ''; if (c.at >= s.items.length) return `Step ${s.items.length} of ${s.items.length} · end`; const n = nums()[c.at], r = R()[s.items[c.at]]; return `Step ${c.at + 1} of ${s.items.length} · ${n?.fn ? `ƒ${n.fn} ` : ''}${short(r.kind === 'ref' ? R()[r.ref!].name : r.kind === 'indirect' ? (r.text ?? r.name) : r.name)}`; });
  const keySteps = () => { const a = curAt(), n = S()?.items.length ?? 0; return { done: Math.max(1, a), now: a + 1, next: Math.min(n, a + 2) }; };

  return (
    <div class="body" style={{ height: '100%' }}>
      <div class="pane" style={{ flex: 1 }}>
        <div class="ph wrap" style={{ padding: '0 22px' }}>
          <Show when={header()} fallback={<span>{status()}</span>}><span class="ghd" title={header()}><i class="selmk" />{header()}</span></Show>
          <Show when={analysisNote()}>{(a) => <span class="seqchg warn" title={a().full}>{a().text}</span>}</Show>
          <Show when={entryUses()}>{(u) => <span class="seqchg" title={`${u().name} uses ${u().names}: short helpers, folded into its step`}>{u().name} uses {u().names}</span>}</Show>
          <span class="grow" />
          <Show when={runStatus()}><span class="sub">{runStatus()}</span></Show>
          <PlayControls playing={playing()} speed={speed()} setSpeed={setSpeed} toggle={() => play()} restart={() => { stop(); report(stepMove('home')); }} step={() => { stop(); report(stepMove('next')); }} />
          {props.switcher}
          <button class="chip" classList={{ on: heat() }} aria-pressed={heat()} title="shade each square by how many calls it holds (H)" onClick={() => setHeat(!heat())}>how often</button>
          <button class="chip" title="save the grid as a PNG image" onClick={exportPng}>export</button>
        </div>
        <div class="gview" classList={{ heat: heat(), focus: focus(), waysout: waysOut(), routed: !!route(), following: !!followed() }} style={{ '--sky-h': `${skyH()}px` }} onPointerDown={() => setCaption(null)} ref={canvas} tabindex="0" role="application" aria-label="the run as a grid: who calls whom" onKeyDown={onKey}>
          <Show when={summary()}>{(sm) => (
            <div class="gtop" onWheel={hwheel}>
              <span><b>{sm().fns}</b>functions called</span><span><b>{sm().callers}</b>callers</span><span><b>{sm().calls}</b>calls</span>
              <span class="xf"><b>{sm().cross}%</b>cross a file</span>
              <Show when={sm().most.length}><span class="mc">most called: <For each={sm().most}>{(r, i) => <><Show when={i() > 0}>, </Show><b>{r.name} {timesText(r)}</b></>}</For></span></Show>
              <span class="grow" />
              <Show when={S() && leavingCount(S()!.run)}><button class="chip" classList={{ on: waysOut() }} onClick={() => { setWaysOut(!waysOut()); canvas.focus(); }}>ways out</button></Show>
              <span class="seg"><For each={[['file', 'by file'], ['run', 'run order'], ['count', 'most called']] as [GridOrder, string][]}>{([o, t]) => <button classList={{ on: order() === o }} title={o === 'file' ? 'grouped by file; within a file, by ƒ number (the order each function first ran)' : o === 'run' ? 'by ƒ number: the order each function first ran' : 'most called first'} onClick={() => { setOrder(o); canvas.focus(); }}>{t}</button>}</For></span>
            </div>
          )}</Show>
          <div class="gkey" onWheel={hwheel} onScroll={(e) => keyEdges(e.currentTarget)}>
            <span>numbers in squares = steps (1–{S()?.items.length ?? 0}) · ƒ = function</span>
            <i class="kc dn">{keySteps().done}</i><span>run</span>
            <i class="kc now">{keySteps().now}</i><span>now</span>
            <i class="kc">{keySteps().next}</i><span>to come</span>
            <span class="kt">· calls in a square in order: <b>4 · 9</b></span>
            <span class="dots"><b class="dn" /><b class="dn" /><b class="now" /><b /><b /><em>5</em></span><span>4 or more calls: a dot each</span>
            <span class="sws"><For each={model()?.files ?? []}>{(f) => <i style={{ background: col().get(f) }} />}</For></span><span>colours separate neighbouring files; each file is named</span>
          </div>
          <div class="gkey" onWheel={hwheel} onScroll={(e) => keyEdges(e.currentTarget)}>
            <span>marks in squares and names:</span>
            <i class="km">×3</i><span>3 calls here</span>
            <i class="km">↻6</i><span>in a loop, 6 runs (↻ alone: count not known)</span>
            <i class="km">⟲</i><span>calls back into a function that is still running</span>
            <i class="km">⇢</i><span>starts on a new thread</span>
            <i class="km">+2</i><span>2 short calls folded in, names on hover</span>
            <i class="km">→</i><span>called through a pointer</span>
            <i class="km">&amp;</i><span>passed as a value, not called here</span>
            <i class="km">×5+</i><span>times called, at least 5</span>
          </div>
          <div class="gkey ar" onWheel={hwheel} onScroll={(e) => keyEdges(e.currentTarget)}>
            <span>arrows from the current step:</span>
            <Show when={flowLinks().error}><span class="gerr">could not be worked out: {flowLinks().error}</span></Show>
            <i class="ka in">⟵</i><span>where an input came from</span>
            <i class="ka out">⟶</i><span>who reads its result</span>
            <i class="ka call">⟶</i><span>the calls it makes</span>
          </div>
          <div class="gscroll" style={{ 'padding-bottom': `${skyH()}px` }} ref={scroller} onScroll={() => { setSl(scroller.scrollLeft); setSt(scroller.scrollTop); }} onMouseLeave={() => setHover(null)}>
            <Show when={model()} fallback={<div class="empty">{waitingText()}</div>}>
              <Show when={!model()!.cells.size}><div class="empty">{S() ? `${short(S()!.run.rows[S()!.items[0]].name)} calls no other project function as a step of its own${entryUses() ? ` · it uses ${entryUses()!.names}, short helpers folded into its step` : ''}` : ''}</div></Show>
                <div class="gsz" style={{ width: `${side() + geo().x.size + tot() + 12}px`, height: `${head() + geo().y.size + foot() + 8}px` }}>
                  <div class="gstrip top" style={{ left: '0px', top: `${st()}px`, width: `${side() + geo().x.size + 8}px`, height: `${head() - EDGE}px` }} />
                  <div class="gstrip side" style={{ left: `${sl()}px`, top: '0px', width: `${side() - EDGE}px`, height: `${head() + geo().y.size + EDGE}px` }} />
                  <div class="gcorner" style={{ left: `${sl()}px`, top: `${st()}px`, width: `${side() - EDGE}px`, height: `${head() - EDGE}px` }}>
                    <div class="gax" style={{ right: `${NAME_GAP}px`, top: `${(HEAD_NAMES + head() - NAME_GAP) / 2}px`, transform: 'translateY(-50%)' }}>caller →</div>
                    <div class="gax" style={{ left: `${ROW_NAMES}px`, bottom: '0px' }}>called ↓</div>
                  </div>
                  <For each={cols()}>{(c, i) => (
                    <>
                      <Show when={i() === 0 || cols()[i() - 1].file !== c.file}>{(() => { const last = () => { let k = i(); while (k + 1 < cols().length && cols()[k + 1].file === c.file) k++; return k; }; return <div class="gfb" title={c.file} style={{ top: `${st() + BAND_TOP}px`, height: `${BAND_H}px`, left: `${side() + geo().x.at[i()]}px`, width: `${geo().x.at[last()] + geo().x.w[last()] - geo().x.at[i()] - 2}px`, '--c': col().get(c.file) }}>{basename(c.file)}</div>; })()}</Show>
                      <div class="gch" classList={{ on: curCell().startsWith(`${c.key}>`), pk: pick()?.c === c.key, lv: waysOut() && leaves(c.key), fw: !!mk(c.key)?.fw, dim: !!mk(c.key)?.dim, cadd: !!mk(c.key)?.add, cchg: !!mk(c.key)?.chg, chg: !!mk(c.key)?.edit }} style={{ top: `${st() + HEAD_NAMES}px`, height: `${head() - HEAD_NAMES - NAME_GAP}px`, left: `${side() + geo().x.at[i()]}px`, width: `${geo().x.w[i()] - 2}px` }} data-bound={geo().boundCols.has(c.key) ? '' : undefined} title={`${c.name} · ${basename(c.file)} · ⇧-click: a route`} onClick={(e) => { if (e.shiftKey) pickRoute(c.key); }}>
                        <span>{c.fn ? `ƒ${c.fn}` : ''}</span><b style={{ '-webkit-line-clamp': String(geo().lines) }}>{wrapName(c.name)}</b>
                      </div>
                    </>
                  )}</For>
                  <For each={rows()}>{(r, j) => (
                    <>
                      <Show when={j() === 0 || rows()[j() - 1].file !== r.file}>{(() => { const last = () => { let k = j(); while (k + 1 < rows().length && rows()[k + 1].file === r.file) k++; return k; }; const fw = () => side() - BAND_X - NAME_GAP; return <><div class="grf" title={r.file} data-bound={lay().fileFit(r.file, fw()) ? undefined : ''} style={{ left: `${sl() + BAND_X}px`, width: `${fw()}px`, top: `${head() + geo().y.at[j()] - lay().fileH}px`, height: `${lay().fileH}px`, '--c': col().get(r.file) }}>{basename(r.file)}</div><div class="grb" title={r.file} style={{ left: `${sl() + BAND_X}px`, width: `${BAND_W}px`, top: `${head() + geo().y.at[j()]}px`, height: `${geo().y.at[last()] + geo().y.w[last()] - geo().y.at[j()] - 2}px`, '--c': col().get(r.file) }} /></>; })()}</Show>
                      <div class="grh" classList={{ on: curCell().endsWith(`>${r.key}`), pk: pick()?.r === r.key, lv: waysOut() && leaves(r.key), fw: !!mk(r.key)?.fw, dim: !!mk(r.key)?.dim, cadd: !!mk(r.key)?.add, cchg: !!mk(r.key)?.chg, chg: !!mk(r.key)?.edit }} data-bound={lay().sideBound ? '' : undefined} style={{ left: `${sl() + ROW_NAMES}px`, width: `${side() - ROW_NAMES - NAME_GAP}px`, top: `${head() + geo().y.at[j()]}px`, height: `${geo().y.w[j()] - 2}px`, gap: `${NAME_GAP}px` }} title={`${r.name}${mk(r.key)?.fw ? ` · ${mk(r.key)!.fw}` : ''} · ${basename(r.file)}${mk(r.key)?.dim ? ' · called only where its values rule the call out' : ''} · ⇧-click: a route`} onClick={(e) => { if (e.shiftKey) pickRoute(r.key); }}>
                        <span style={{ width: `${lay().fn}px` }}>{fnText(r)}</span><b>{r.name}</b><Show when={recRows().has(r.key)}><em class="gr" title="called again while it is still running">⟲</em></Show><Show when={mk(r.key)?.fw}><em class="gw">{mk(r.key)!.fw}</em></Show>
                      </div>
                    </>
                  )}</For>
                  <For each={boxes()}>{(b) => <div class="gbox" style={{ left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px`, '--c': b.c }} />}</For>
                  <For each={win().cs}>{(c) => (
                    <For each={win().rs}>{(r) => {
                      const i = () => colIdx().get(c.key) ?? 0, j = () => rowIdx().get(r.key) ?? 0;
                      const key = `${c.key}>${r.key}`, v = () => model()!.cells.get(key);
                      const isPick = () => pick()?.c === c.key && pick()?.r === r.key;
                      const on = () => curCell() === key, x = () => curCell().startsWith(`${c.key}>`) || curCell().endsWith(`>${r.key}`);
                      const hl = () => { const h = hover(); return !!h && (h.c === c.key || h.r === r.key); };
                      const pl = () => { const p = pick(); return !!p && (p.c === c.key || p.r === r.key); };
                      const rc = () => rectOf(i(), j());
                      return (
                        <div class="gcell" classList={{ has: !!v(), same: c.file === r.file, on: on(), x: x(), hl: hl(), pl: pl(), hv: hover()?.c === c.key && hover()?.r === r.key, pk: isPick(), rt: routePairs().has(key) }} data-c={c.key} data-r={r.key} data-bound={isPick() && openNeed().bound ? '' : undefined}
                          style={{ left: `${rc().x}px`, top: `${rc().y}px`, width: `${rc().w}px`, height: `${rc().h}px`, '--c': col().get(c.file), '--h': heat() && v() ? String(0.08 + (v()!.length / maxCell()) * 0.5) : '0' }}
                          onMouseEnter={() => setHover({ c: c.key, r: r.key })}
                          onClick={() => { if (v()) choose(c.key, r.key); }}>
                          <Show when={v()} fallback={<s />}>{(l) => (
                            <Show when={isPick()} fallback={<>
                              <Show when={l().length < 4} fallback={<span class="dots" data-all={l().join(' ')}><For each={l().slice(0, 8)}>{(it) => <b data-it={it} classList={{ dn: it < curAt(), now: it === curAt() }} />}</For><em>{l().length}</em></span>}>
                                <For each={l()}>{(it, k) => <><Show when={k() > 0}><span class="sep">·</span></Show>{chip(it, c.key, r.key)}</>}</For>
                              </Show>
                              <Show when={cellMarks().get(key)}>{(mk2) => <em class="gm" title={mk2().title}>{mk2().text}</em>}</Show>
                            </>}>
                              <For each={l()}>{(it) => { const cl = callLine(it); return (
                                <div class="gstep" data-it={it} style={{ height: `${lay().stepH}px` }} classList={{ now: curAt() === it, dn: it < curAt() }} title={`step ${it + 1} · click to go there`} onClick={(e) => { e.stopPropagation(); go(it); }}>
                                  <i>step {it + 1}</i><code title={cl.code}>{cl.code}</code><small>:{cl.line}</small>
                                </div>
                              ); }}</For>
                            </Show>
                          )}</Show>
                        </div>
                      );
                    }}</For>
                  )}</For>
                  <Show when={drawn()}>{(dr) => (
                    <>
                      <svg class="glinks" width={side() + geo().x.size + 8} height={head() + geo().y.size + 8} aria-hidden="true">
                        <defs>
                          <marker id="glk-in" markerUnits="userSpaceOnUse" viewBox={`0 0 ${TIP} 4`} refX={TIP} refY="2" markerWidth={TIP} markerHeight="4" orient="auto"><path d={`M0 0 L${TIP} 2 L0 4 z`} style={{ fill: 'var(--grid-in)' }} /></marker>
                          <marker id="glk-out" markerUnits="userSpaceOnUse" viewBox={`0 0 ${TIP} 4`} refX={TIP} refY="2" markerWidth={TIP} markerHeight="4" orient="auto"><path d={`M0 0 L${TIP} 2 L0 4 z`} style={{ fill: 'var(--grid-out)' }} /></marker>
                          <marker id="glk-call" markerUnits="userSpaceOnUse" viewBox={`0 0 ${TIP} 4`} refX={TIP} refY="2" markerWidth={TIP} markerHeight="4" orient="auto"><path d={`M0 0 L${TIP} 2 L0 4 z`} style={{ fill: 'var(--grid-call)' }} /></marker>
                        </defs>
                        <For each={dr().paths}>{(p) => <><path class="hit" d={p.d}><title>{p.title}</title></path><path class={`ln ${p.kind}`} d={p.d} marker-end={`url(#glk-${p.kind})`}><title>{p.title}</title></path></>}</For>
                      </svg>
                      <For each={dr().labels}>{(l) => <div class={`glab ${l.kind}`} title={l.full} style={{ left: `${l.x}px`, top: `${l.y}px`, 'pointer-events': l.full ? 'auto' : undefined }}>{l.text}</div>}</For>
                    </>
                  )}</Show>
                  <Show when={tag()}>{(t) => <div class="gtag" style={{ left: `${t().x}px`, top: `${t().y}px`, width: `${t().w}px` }}>{t().text}</div>}</Show>
                  <div class="gtot" style={{ left: `${totX()}px`, top: '0px', width: `${tot() - 2}px`, height: `${head() + geo().y.size + foot() + 8}px` }}>
                    <div class="gtothd" style={{ top: `${st()}px`, height: `${head() - EDGE}px` }}><div class="gax w2" style={{ left: `${NAME_GAP}px`, bottom: `${NAME_GAP - EDGE}px` }}>times called</div></div>
                    <For each={rows()}>{(r, j) => <div class="t" classList={{ pk: pick()?.r === r.key }} style={{ top: `${head() + geo().y.at[j()]}px`, height: `${geo().y.w[j()] - 2}px`, left: `${NAME_GAP}px`, gap: `${NAME_GAP}px` }}><i style={{ width: `${Math.max(4, Math.round((r.runs / maxRow()) * BAR_W))}px` }} />{timesText(r)}</div>}</For>
                  </div>
                  <div class="gcorner foot" style={{ left: `${sl()}px`, top: `${footY()}px`, width: `${side() - EDGE}px`, height: `${lay().footH}px` }}>
                    <div class="gax" style={{ right: `${NAME_GAP}px`, bottom: `${NAME_GAP}px` }}>calls it makes →</div>
                  </div>
                  <div class="gmk" style={{ top: `${footY()}px`, width: `${side() + geo().x.size}px`, height: `${Math.max(lay().footH, st() + vh() - footY())}px` }}>
                    <For each={cols()}>{(c, i) => <div class="m" classList={{ pk: pick()?.c === c.key }} style={{ left: `${side() + geo().x.at[i()]}px`, width: `${geo().x.w[i()] - 2}px`, height: `${lay().mH}px` }}><i style={{ height: `${Math.max(3, Math.round((c.count / maxCol()) * BAR_H))}px` }} />{c.count}</div>}</For>
                  </div>
                </div>
            </Show>
          </div>
          <Magnifier host={() => scroller} source={() => { const z = scroller?.querySelector('.gsz') as HTMLElement | null; if (!z) return null; const r = scroller.getBoundingClientRect(); return { el: z, x: r.left - scroller.scrollLeft, y: r.top - scroller.scrollTop, w: z.offsetWidth, h: z.offsetHeight }; }} />
          <Show when={caption()}><div class="scap"><Show when={caption()!.key}><span class="key">{caption()!.key}</span></Show>{caption()!.what}<Show when={caption()!.why}><span class="why">{caption()!.why}</span></Show></div></Show>
          <Show when={S()}><Skyline at={cur()?.at ?? 0} changedItems={changedItems()} notes={notesByItem()} onScrub={(it) => { stop(); stepMove({ jump: it }); }} read="" /></Show>
        </div>
      </div>
      <StepSplit />
      <Show when={route()} fallback={<StepPreview />}>{(r) => (
        <div class="pane prev" style={{ width: `${stepW()}px`, flex: 'none' }}>
          <div class="ph" style={{ padding: '0 20px' }}><span style={{ color: 'var(--bright)' }}>{r().list.length} route{r().list.length === 1 ? '' : 's'} · {short(R()[r().from].name)} → {short(R()[r().to].name)}</span><span class="grow" /><button class="chip" onClick={() => setRoute(null)}>clear</button></div>
          <For each={r().list}>{(x, i) => (
            <div class="bxr" classList={{ on: r().only === i(), dim: r().only >= 0 && r().only !== i() }} onClick={() => setRoute({ ...r(), only: r().only === i() ? -1 : i() })}>
              <div class="t" title={x.rows.map((q) => R()[q].name).join(' › ')}><b>{i() + 1}</b><For each={x.rows}>{(q, j) => <><Show when={j() > 0}><i>›</i></Show>{short(R()[q].name)}</>}</For></div>
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
