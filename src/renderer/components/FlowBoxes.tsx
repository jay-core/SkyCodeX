// The boxes view: the run of the chosen entry point (the one the sequence walks) drawn as files (boxes) holding the
// functions that run in them (rows, in execution order), with a line from each caller's row to each callee's row
// carrying the calls' step numbers. Any scale scrolls; zoomed out it is drawn as files, then folders, so text stays
// readable. The selected step is the sequence's (Tab keeps it). Shift-click a second function for every route between
// the two; Space plays the run as a marker moving along the lines. The model and layout: src/shared/flowboxes.ts.
import { For, Show, createSignal, createMemo, createEffect, on, onMount, onCleanup, JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import ELK from 'elkjs/lib/elk-api.js';
// @ts-expect-error vite turns the layout engine into a worker of its own (inline, so it loads like the page)
import ElkWorker from 'elkjs/lib/elk-worker.min.js?worker&inline';
import { seq, trail, graph, status, runStatus, stepMove, changed, waysOut, setWaysOut, earlyExits, leavingCount, followed, setFollowed, hitWords } from '../lib/flowstore';
import { root, settings, flash } from '../lib/store';
import { api, basename } from '../lib/api';
import {
  boxModel, layoutBoxes, boxGeom, placeLabels, labelScale, levelFor, LEVEL_AT, PAD, viewRect, meets, rowAt, routesBetween, frameWords,
  routePoints, walkPoints, neighbourhood, howOftenLevel, stepOf, nodeOf, MIN_K, Level, Lay, Line, RouteInfo, Pt,
} from '../../shared/flowboxes';
import { move, loopsAt, Move } from '../../shared/flowseq';
import StepPreview, { openStep } from './StepPreview';
import Magnifier from './Magnifier';
import PlayControls from './PlayControls';
import { setPalette } from '../lib/actions';

// the layout engine runs in a worker, so laying out a large run never holds up the window; it is the same code
// elk.bundled.js runs on the page, so every layout is the same
const elk = new ELK({ workerFactory: () => new ElkWorker() }) as unknown as { layout: (g: unknown) => Promise<any> };
type Zoom = 'all' | 'width' | '100' | '150' | '';
const short = (n: string) => n.replace(/^.*::(?=[^:]+$)/, '');
/** Metro motion: a quick start and a long, gentle settle. */
const METRO = (t: number) => 1 - Math.pow(1 - t, 4);
const LABEL_PX = 12, LABEL_CH = 7.2;
/** The zoom chosen last time, or null the first time. */
const storedZoom = (): Zoom | null => { try { const z = localStorage.getItem('flow.boxes.zoom'); return z === 'all' || z === 'width' || z === '100' || z === '150' || z === '' ? z : null; } catch { return null; } };

const ALT = navigator.platform.startsWith('Mac') ? '⌥' : 'Alt';

/** The three levels' layouts of a run, kept while that run is shown: switching views and back lays nothing out again. */
const layCache = new WeakMap<object, Partial<Record<Level, Lay>>>();

export default function FlowBoxes(props: { switcher: JSX.Element }) {
  let scroller!: HTMLDivElement, mini!: HTMLCanvasElement, canvasEl!: HTMLDivElement;
  const reduce = () => !!settings()['motion.reduce'];
  const S = () => seq();
  const R = () => S()!.run.rows;
  const model = createMemo(() => { const s = seq(); return s ? boxModel(s.run, root()) : null; });
  const [lays, setLays] = createSignal<Partial<Record<Level, Lay>>>({});
  const [k, setK] = createSignal(1);
  const chosen = storedZoom();
  const [zoom, setZoomRaw] = createSignal<Zoom>(chosen ?? 'width');
  const setZoom = (z: Zoom) => { setZoomRaw(z); try { localStorage.setItem('flow.boxes.zoom', z); } catch { /* kept for this run */ } };
  const [size, setSize] = createSignal({ w: 1000, h: 700 });
  const [view, setView] = createSignal({ x: 0, y: 0 });   // scroll position, for the minimap
  const level = createMemo(() => levelFor(k()));
  const lay = createMemo(() => lays()[level()] ?? null);

  // ---- layout: all three levels, once per run ----
  let gen = 0, fitted = false;
  createEffect(on(model, async (m) => {
    const g = ++gen;
    if (!m) { setLays({}); return; }
    let out = layCache.get(m.run);
    if (!out) {
      const fresh: Partial<Record<Level, Lay>> = {};
      for (const lv of ['functions', 'files', 'folders'] as Level[]) { fresh[lv] = await layoutBoxes(m, lv, elk); if (g !== gen) return; }
      layCache.set(m.run, out = fresh);
    }
    setLays(out);
    if (!fitted || zoom()) {
      // the first time: fit the width if the functions stay readable there, else 100% and scroll
      const z = !fitted && !chosen ? (fitK('width') >= LEVEL_AT.functions ? 'width' : '100') : zoom() || 'width';
      fitted = true;
      applyZoom(z, 0);
    }
  }));

  // ---- scale ----
  /** The largest scale that fits, on the level that scale draws: functions if they fit readably, else files, else folders. */
  function fitK(kind: 'width' | 'all'): number {
    const L = lays(), aw = size().w - 2 * PAD, ah = size().h - 2 * PAD;
    const f = (lv: Level) => { const l = L[lv]; return !l || !l.w ? 1 : kind === 'width' ? aw / l.w : Math.min(aw / l.w, ah / Math.max(1, l.h)); };
    const k1 = Math.min(1.5, f('functions'));
    if (k1 >= LEVEL_AT.functions) return k1;
    const k2 = Math.min(LEVEL_AT.functions - 0.001, f('files'));
    if (k2 >= LEVEL_AT.files) return k2;
    return Math.max(MIN_K, Math.min(LEVEL_AT.files - 0.001, f('folders')));
  }
  function applyZoom(z: Zoom, ms = 360) {
    setZoom(z);
    const k1 = z === '100' ? 1 : z === '150' ? 1.5 : z === 'all' || z === 'width' ? fitK(z) : k();
    zoomTo(k1, { ms, keep: true });
  }
  /** The place under a screen point, as a spot in a file's box: kept there whatever level the new scale draws. */
  function anchorAt(ax: number, ay: number) {
    const l = lay();
    if (!l) return null;
    const wx = (scroller.scrollLeft + ax - PAD) / k(), wy = (scroller.scrollTop + ay - PAD) / k();
    let best: { f: string; fx: number; fy: number } | null = null, bd = Infinity;
    for (const [f, p] of Object.entries(l.pos)) {
      const dx = Math.max(p.x - wx, 0, wx - p.x - p.w), dy = Math.max(p.y - wy, 0, wy - p.y - p.h), d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = { f, fx: (wx - p.x) / p.w, fy: (wy - p.y) / p.h }; }
    }
    return best;
  }
  function placeAnchor(a: { f: string; fx: number; fy: number }, ax: number, ay: number) {
    const p = lay()?.pos[a.f];
    if (!p) return;
    scroller.scrollLeft = (p.x + a.fx * p.w) * k() + PAD - ax;
    scroller.scrollTop = (p.y + a.fy * p.h) * k() + PAD - ay;
  }
  let zoomAnim = 0;
  function zoomTo(k1: number, o: { ax?: number; ay?: number; ms?: number; keep?: boolean } = {}) {
    k1 = Math.max(MIN_K, Math.min(2.5, k1));
    if (!o.keep) setZoom('');
    const ax = o.ax ?? size().w / 2, ay = o.ay ?? size().h / 2, a = scroller ? anchorAt(ax, ay) : null, k0 = k(), id = ++zoomAnim;
    if (reduce() || !o.ms) { setK(k1); if (a) placeAnchor(a, ax, ay); syncView(); return; }
    animate(o.ms, (t) => { if (id !== zoomAnim) return false; setK(k0 + (k1 - k0) * METRO(t)); if (a) placeAnchor(a, ax, ay); syncView(); return true; });
  }
  const syncView = () => { if (scroller) setView({ x: scroller.scrollLeft, y: scroller.scrollTop }); };

  // ---- smooth moves ----
  function animate(ms: number, f: (t: number) => boolean | void): Promise<void> {
    return new Promise((done) => {
      const t0 = performance.now();
      const tick = () => { const t = Math.min(1, (performance.now() - t0) / ms); if (f(t) === false || t >= 1) { done(); return; } requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
  }
  let scrollAnim = 0;
  function scrollTo(x: number, y: number, ms = 520): Promise<void> {
    const id = ++scrollAnim, x0 = scroller.scrollLeft, y0 = scroller.scrollTop;
    if (reduce() || ms <= 0) { scroller.scrollLeft = x; scroller.scrollTop = y; syncView(); return Promise.resolve(); }
    return animate(ms, (t) => { if (id !== scrollAnim) return false; scroller.scrollLeft = x0 + (x - x0) * METRO(t); scroller.scrollTop = y0 + (y - y0) * METRO(t); syncView(); return true; });
  }
  /** Brings a spot of the diagram into view: nothing moves if it is already comfortably in sight. */
  function reveal(r: { x: number; y: number; w: number; h: number }, ms = 520): Promise<void> {
    const m = 70, kk = k(), x = r.x * kk + PAD, y = r.y * kk + PAD, w = r.w * kk, h = r.h * kk;
    const vx = scroller.scrollLeft, vy = scroller.scrollTop, vw = scroller.clientWidth, vh = scroller.clientHeight;
    if (x >= vx + m && x + w <= vx + vw - m && y >= vy + m && y + h <= vy + vh - m) return Promise.resolve();
    const far = x + w < vx - vw || x > vx + 2 * vw || y + h < vy - vh || y > vy + 2 * vh;
    // close by: the least movement that brings it in; far: put it at a third of the view
    const nx = far ? x - vw / 3 : x < vx + m ? x - m : x + w > vx + vw - m ? x + w - vw + m : vx;
    const ny = far ? y - vh / 3 : y < vy + m ? y - m : y + h > vy + vh - m ? y + h - vh + m : vy;
    return scrollTo(Math.max(0, nx), Math.max(0, ny), ms);
  }

  // ---- the selected step (the sequence's) ----
  const cur = () => trail()[trail().length - 1];
  const selRow = createMemo(() => { const s = S(), c = cur(); return !s || !c || c.at >= s.items.length ? -1 : stepOf(s.run, s.items[c.at]); });
  const chain = createMemo(() => { const out = new Set<number>(); const s = S(); if (!s) return out; for (let i: number | null = selRow(); i != null && i >= 0; i = s.run.rows[i].caller) out.add(i); return out; });
  const nowKey = createMemo(() => { const s = S(), c = cur(); if (!s || !c || c.at >= s.items.length) return ''; const r = s.run.rows[s.items[c.at]]; return r.caller != null ? `${r.caller}>${selRow()}` : ''; });
  const loopHot = (f: number) => { const s = S(), c = cur(); return !!s && !!c && c.at < s.items.length && loopsAt(s, c.at).includes(f); };
  createEffect(on([selRow, lay], () => { if (!walking) revealRow(selRow(), 560); }, { defer: true }));
  function revealRow(row: number, ms: number) {
    const m = model(), l = lay();
    if (!m || !l || row < 0) return Promise.resolve();
    const r = rowAt(m, l, row);
    return r ? reveal({ x: r.x, y: r.y - 14, w: Math.min(r.w, 300), h: 28 }, ms) : Promise.resolve();
  }
  function jumpRow(row: number) {
    const s = S();
    if (!s) return;
    const it = s.itemOf[row];
    if (it >= 0) report(stepMove({ jump: it }));
  }

  // ---- routes between two functions, focus, how often ----
  const [route, setRoute] = createSignal<{ from: number; to: number; list: RouteInfo[]; only: number } | null>(null);
  const [focus, setFocus] = createSignal<number | null>(null);
  const [heat, setHeat] = createSignal(false);
  const [hot, setHot] = createSignal<Set<number>>(new Set());   // rows a walking marker has reached
  /** Rows and lines lit by a route or by focus; null when neither is on (then everything shows as usual). */
  const active = createMemo(() => {
    const m = model(), r = route(), f = focus();
    if (!m) return null;
    const rows = new Set<number>(), pairs = new Set<string>();
    if (r && r.list.length) {
      r.list.forEach((x, i) => { if (r.only >= 0 && i !== r.only) return; x.rows.forEach((q) => rows.add(q)); for (let j = 0; j + 1 < x.rows.length; j++) pairs.add(`${x.rows[j]}>${x.rows[j + 1]}`); });
    } else if (f != null) {
      for (const q of neighbourhood(m, f)) rows.add(q);
      for (const c of m.calls) if (rows.has(c.a) && rows.has(c.b)) pairs.add(`${c.a}>${c.b}`);
    } else return null;
    const files = new Set([...rows].map((q) => m.run.rows[q].file));
    const filePairs = new Set([...pairs].map((p) => { const [a, b] = p.split('>').map(Number); return `${m.run.rows[a].file}>${m.run.rows[b].file}`; }));
    return { rows, pairs, files, filePairs };
  });
  const lineOn = (l: Line) => {
    const a = active(), m = model();
    if (!a || !m) return null;
    if (level() === 'functions') return a.pairs.has(`${l.a}>${l.b}`);
    return [...a.filePairs].some((p) => { const [x, y] = p.split('>'); return nodeOf(m, level(), x) === l.fa && nodeOf(m, level(), y) === l.fb; });
  };
  function routeTo(row: number) {
    const s = S(), from = selRow();
    if (!s || from < 0) return;
    if (row === from) { say('', 'pick a different function', 'shift-click the end of the route'); return; }
    let list = routesBetween(s.run, from, s.run.rows[row].key), a = from, b = row;
    if (!list.length) { list = routesBetween(s.run, row, s.run.rows[from].key); a = row; b = from; }   // the other way round
    if (!list.length) { say('', `no route between ${short(s.run.rows[from].name)} and ${short(s.run.rows[row].name)}`, 'neither reaches the other in this run'); return; }
    setFocus(null);
    setRoute({ from: a, to: b, list, only: list.length === 1 ? 0 : -1 });
  }

  // ---- a marker along the lines ----
  const [marker, setMarker] = createSignal<{ at: Pt; path: Pt[] } | null>(null);
  const [playing, setPlaying] = createSignal(false);
  const [speed, setSpeed] = createSignal(1);
  let walking = false, walkId = 0;
  /** Moves the marker along a path at an even speed; the view follows it when it nears the edge. */
  async function travel(pts: Pt[], id: number): Promise<boolean> {
    if (pts.length < 2) return id === walkId;
    const seg = [0];
    for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const total = seg[seg.length - 1], ms = reduce() ? 0 : Math.max(260, Math.min(1500, (total * k()) / 0.9)) / speed();
    let following = false;
    await animate(Math.max(1, ms), (t) => {
      if (id !== walkId) return false;
      const d = total * t;
      let i = 1;
      while (i < seg.length - 1 && seg[i] < d) i++;
      const f = (d - seg[i - 1]) / Math.max(1e-6, seg[i] - seg[i - 1]);
      const p = { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f };
      setMarker({ at: p, path: [...pts.slice(0, i), p] });
      if (!following) {
        const sx = p.x * k() + PAD - scroller.scrollLeft, sy = p.y * k() + PAD - scroller.scrollTop, mg = 50;
        if (sx < mg || sy < mg || sx > scroller.clientWidth - mg || sy > scroller.clientHeight - mg) {
          following = true;
          scrollTo(Math.max(0, p.x * k() + PAD - scroller.clientWidth / 2), Math.max(0, p.y * k() + PAD - scroller.clientHeight / 2), 620).then(() => { following = false; });
        }
      }
      return true;
    });
    return id === walkId;
  }
  /** The next move when playing: another pass of a loop whose count is known until its last pass, else on. */
  function playMove(): Move | null {
    const s = S(), c = cur();
    if (!s || !c || c.at >= s.items.length) return null;
    const loops = loopsAt(s, c.at);
    for (let j = loops.length - 1; j >= 0; j--) {
      const f = loops[j], fr = s.run.frames[f], sp = s.span.get(f)!;
      if (sp[1] !== c.at) break;
      if (fr.count != null && (c.passes[f] ?? 1) < fr.count) return 'again';
    }
    return 'next';
  }
  async function playOne(id: number): Promise<boolean> {
    const s = S(), m = model(), l = lay(), c = cur();
    const mv = playMove();
    if (!s || !m || !l || !c || !mv) return false;
    const r = move(s, trail(), mv);
    if (r.note) return false;
    const to = r.trail[r.trail.length - 1].at;
    // a loop whose count is not known: one pass, then on — and say so
    const left = loopsAt(s, c.at).filter((f) => s.span.get(f)![1] === c.at && s.run.frames[f].count == null && !loopsAt(s, to).includes(f));
    if (to >= s.items.length) { report(stepMove(mv)); return false; }
    await revealRow(stepOf(s.run, s.items[to]), 420 / speed());
    if (!(await travel(walkPoints(m, l, s.items[c.at], s.items[to]), id))) return false;
    report(stepMove(mv), true);
    if (left.length) say('↻', `${s.run.frames[left[left.length - 1]].text}`, 'repeats — how often is known only when it runs');
    return true;
  }
  async function play() {
    if (walking) { stop(); return; }
    walking = true; setPlaying(true);
    const id = ++walkId;
    while (walking && id === walkId) {
      if (!(await playOne(id))) break;
      await new Promise((res) => setTimeout(res, 380 / speed()));
    }
    if (id === walkId) stop();
  }
  function stop() { walking = false; walkId++; setPlaying(false); setMarker(null); }
  async function walkRoute(i: number) {
    const m = model(), l = lay(), r = route();
    if (!m || !l || !r) return;
    stop(); walking = true;
    const id = walkId, x = r.list[i];
    setRoute({ ...r, only: i });
    setHot(new Set<number>());
    const pts = routePoints(m, l, x.rows);
    const at = (p: Pt) => { for (const q of x.rows) { const w = rowAt(m, l, q); if (w && Math.abs(p.y - w.y) < 2 && p.x >= w.x && p.x <= w.x + w.w && !hot().has(q)) setHot(new Set([...hot(), q])); } };
    const first = rowAt(m, l, x.rows[0]);
    if (first) await reveal({ x: first.x, y: first.y - 14, w: 200, h: 28 }, 420);
    const seg = [0];
    for (let j = 1; j < pts.length; j++) seg.push(seg[j - 1] + Math.hypot(pts[j].x - pts[j - 1].x, pts[j].y - pts[j - 1].y));
    // the marker lights each function as it reaches it
    const watch = setInterval(() => { const mk = marker(); if (mk) at(mk.at); }, 30);
    await travel(pts, id);
    clearInterval(watch);
    if (id === walkId) { at(pts[pts.length - 1]); jumpRow(x.at[0]); }
    walking = false; setMarker(null);
    setTimeout(() => setHot(new Set<number>()), 1600);
  }

  // ---- the change ripple: functions edited and not saved, and the calls that reach them ----
  const ripple = createMemo(() => {
    const s = S(), c = changed(), chainOf = new Set<number>();
    if (!s || !c.size) return { rows: c, chain: chainOf };
    s.run.rows.forEach((r, i) => { if (c.has(stepOf(s.run, i)) && r.kind !== 'indirect' && r.kind !== 'value') for (let p = r.caller; p != null; p = s.run.rows[p].caller) chainOf.add(p); });
    return { rows: c, chain: chainOf };
  });



  // ---- captions ----
  const [caption, setCaption] = createSignal<{ key: string; what: string; why: string } | null>(null);
  let capTimer: ReturnType<typeof setTimeout> | undefined;
  function say(key: string, what: string, why = '') { setCaption({ key, what, why }); clearTimeout(capTimer); capTimer = setTimeout(() => setCaption(null), 2600); }
  function report(r: ReturnType<typeof stepMove>, quiet = false) {
    if (r.note) say('', r.note);
    else if (r.state && !quiet) say(r.state.key, r.state.what, r.state.why);
  }
  onCleanup(() => { clearTimeout(capTimer); stop(); });

  // ---- keys ----
  function onKey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey) return;
    const key = e.key, sh = e.shiftKey;
    if (e.altKey && (key === '=' || key === '+' || key === '≠')) { e.preventDefault(); zoomTo(k() * 1.25, { ms: 260 }); return; }
    if (e.altKey && (key === '-' || key === '–')) { e.preventDefault(); zoomTo(k() / 1.25, { ms: 260 }); return; }
    if (e.altKey && (key === '0' || key === 'º')) { e.preventDefault(); applyZoom('width'); return; }
    const moves: Record<string, Move> = { ArrowRight: sh ? 'over' : 'next', ArrowLeft: sh ? 'prevPass' : 'back', ArrowUp: 'out', r: 'again', R: 'again', l: 'leave', L: 'leave', ']': 'nextSibling', '[': 'prevSibling', Home: 'home', End: 'end' };
    if (key === 'Tab') return;   // the flow page switches views
    if (key === ' ') { e.preventDefault(); play(); return; }
    if (key === '+' || key === '=') { setSpeed(Math.min(4, speed() * 1.5)); return; }
    if (key === '-') { setSpeed(Math.max(0.25, speed() / 1.5)); return; }
    if (key === 'Escape') { stop(); setFollowed(null); if (route() || focus() != null) { setRoute(null); setFocus(null); } return; }
    if (key === 'f' || key === 'F') { setRoute(null); setFocus(focus() === selRow() ? null : selRow() >= 0 ? selRow() : null); if (focus() != null) say('F', `focus ${short(R()[focus()!].name)}`, 'and two calls around it · Esc clears'); return; }
    if (key === 'h' || key === 'H') { setHeat(!heat()); return; }
    if (key === 'e' || key === 'E') { toggleWaysOut(); return; }
    if (key === 'Enter') { const r = route(); if (r) walkRoute(r.only >= 0 ? r.only : 0); else openStep(); e.preventDefault(); return; }
    if (route() && /^[1-9]$/.test(key)) { const r = route()!, i = Number(key) - 1; if (i < r.list.length) setRoute({ ...r, only: r.only === i ? -1 : i }); return; }
    const m = moves[key];
    if (!m) return;
    e.preventDefault();
    stop();
    report(stepMove(m));
  }

  // ---- pointer: scroll and zoom; drag empty space to pan ----
  const onWheel = (e: WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey || e.altKey)) return;   // plain wheel and trackpad scroll the view
    e.preventDefault();
    const r = scroller.getBoundingClientRect();
    zoomTo(k() * Math.exp(-e.deltaY / 300), { ax: e.clientX - r.left, ay: e.clientY - r.top });
  };
  let pan: { x: number; y: number; sx: number; sy: number } | null = null;
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('.fbox, .flab, .hit, .bxctl, .bxmini')) return;
    pan = { x: e.clientX, y: e.clientY, sx: scroller.scrollLeft, sy: scroller.scrollTop };
    scroller.setPointerCapture(e.pointerId); scroller.classList.add('drag');
  };
  const onMove = (e: PointerEvent) => { if (!pan) return; scroller.scrollLeft = pan.sx - (e.clientX - pan.x); scroller.scrollTop = pan.sy - (e.clientY - pan.y); };
  const onUp = () => { pan = null; scroller.classList.remove('drag'); };

  onMount(() => {
    // re-fit on the next frame (a fit can bring scrollbars, which resize the view again); scrollbars alone don't re-fit
    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const w = scroller.clientWidth, h = scroller.clientHeight, old = size();
        setSize({ w, h });
        if ((zoom() === 'width' || zoom() === 'all') && (Math.abs(w - old.w) > 12 || Math.abs(h - old.h) > 12)) applyZoom(zoom(), 0);
      });
    });
    ro.observe(scroller);
    onCleanup(() => ro.disconnect());
    canvasEl.focus();
  });

  // ---- what is drawn ----
  const labels = createMemo(() => (lay() ? placeLabels(lay()!, labelScale(k()), LABEL_CH) : []));
  const lineByKey = createMemo(() => new Map((lay()?.lines ?? []).map((l) => [`${l.a}>${l.b}`, l])));
  const labelOn = (keys: string[]) => { const a = active(); if (!a) return null; return keys.some((x) => { const l = lineByKey().get(x); return !!l && !!lineOn(l); }); };
  const rowOn = (row: number) => { const a = active(); return !a ? null : a.rows.has(row); };
  // ways out (E): functions that can leave early keep their strength, with how many ways; the rest fade
  const outs = (row: number) => (S() ? earlyExits(S()!.run, row) : []);
  // a value followed (W or V in the sequence view): the functions that touch it stay, saying how; the rest fade
  const touches = (row: number) => followed()?.hits.filter((h) => h.row === row || (R()[h.row]?.kind === 'ref' && R()[h.row].ref === row)) ?? [];
  const boxTouched = (node: string) => { const m = model(); return !!m && R().some((r, i) => r.kind === 'step' && nodeOf(m, level(), r.file) === node && touches(i).length > 0); };
  /** Values settled per call: why this step's call cannot happen (it sits in an arm its caller's values rule out). */
  const deadOf = (row: number) => { const s = S(), f = s?.run.rows[row]?.frames.find((k) => s.run.frames[k].dead); return f == null ? null : s!.run.frames[f].dead!; };
  const boxOut = (node: string) => { const m = model(); return !!m && R().some((r, i) => r.kind === 'step' && nodeOf(m, level(), r.file) === node && outs(i).length > 0); };
  function toggleWaysOut() {
    const on = !waysOut(), n = S() ? leavingCount(S()!.run) : 0;
    setWaysOut(on);
    say('E', on ? `ways out: ${n} function${n === 1 ? '' : 's'} can leave early` : 'the whole run', on ? 'the usual path fades · E again for all' : '');
  }
  const fileOn = (node: string) => { const a = active(), m = model(); return !a || !m ? null : [...a.files].some((f) => nodeOf(m, level(), f) === node); };
  /** The boxes drawn: files, or (folders level) folders, keyed as the layout keys them. */
  const nodes = createMemo(() => { const m = model(); return !m ? [] : level() === 'folders' ? m.dirs.map((d) => `dir:${d}`) : m.files; });
  // a very large diagram draws only the boxes and numbers in view (and a screen around it); small ones draw everything
  const CULL_AT = 120;
  const inView = () => viewRect(view(), size(), k());
  const shownNodes = createMemo(() => {
    const all = nodes(), l = lay();
    if (all.length <= CULL_AT || !l) return all;
    const r = inView();
    return all.filter((f) => !l.pos[f] || meets(r, l.pos[f]));
  });
  const shownLabels = createMemo(() => {
    const all = labels();
    if (nodes().length <= CULL_AT) return all;
    const r = inView();
    return all.filter((b) => meets(r, { x: b.x - b.w, y: b.y - b.h / 2, w: b.w, h: b.h }));
  });
  /** A box's files: itself, or a folder's. */
  const filesIn = (node: string) => { const m = model()!; return node.startsWith('dir:') ? m.files.filter((f) => `dir:${m.dirOf(f)}` === node) : [node]; };
  const selNode = () => { const m = model(), r = R()[selRow()]; return m && r ? nodeOf(m, level(), r.file) : ''; };
  const unreached = createMemo(() => { const g = graph(), m = model(); return g && m ? g.boxes.filter((b) => !m.rowsOf.has(b.file)).length : 0; });
  const startFile = () => (S()?.run.rows[0]?.file ?? '');
  const callersOf = (f: string) => { const m = model()!; return new Set(m.calls.filter((c) => R()[c.b].file === f && R()[c.a].file !== f).map((c) => R()[c.a].file)); };
  const rel = (f: string) => (f.startsWith(root() + '/') ? f.slice(root().length + 1) : f);
  /** The hovered file or folder box when zoomed out: its functions, drawn at screen size beside it, inside the window. */
  const [hoverAt, setHoverAt] = createSignal<{ rect: DOMRect; fns: number[] } | null>(null);
  // its rows are numbered in the run it was opened on: another run closes it
  createEffect(on(seq, () => setHoverAt(null), { defer: true }));
  const hoverStyle = (h: { rect: DOMRect; fns: number[] }) => {
    const below = window.innerHeight - h.rect.bottom, above = h.rect.top, down = below >= above;
    const room = Math.max(120, (down ? below : above) - 16);
    return { left: `${Math.max(8, Math.min(h.rect.left, window.innerWidth - 560))}px`, [down ? 'top' : 'bottom']: `${down ? h.rect.bottom + 6 : window.innerHeight - h.rect.top + 6}px`, 'max-height': `${room}px` };
  };
  /** How many of its rows fit in the room beside the box (a row is 23px); the rest are counted. */
  const hoverFits = (h: { rect: DOMRect; fns: number[] }) => {
    const room = Math.max(120, Math.max(window.innerHeight - h.rect.bottom, h.rect.top) - 16);
    const n = Math.max(3, Math.floor((room - 16) / 23));
    return h.fns.length <= n ? h.fns.length : n - 1;
  };

  // minimap: the whole diagram and the part in view, when the diagram is larger than the view
  const over = createMemo(() => { const l = lay(); return !!l && (l.w * k() + 2 * PAD > size().w + 2 || l.h * k() + 2 * PAD > size().h + 2); });
  createEffect(on([lay, k, view, size, over, selRow], () => {
    const l = lay();
    if (!mini || !l || !over()) return;
    const W = 180, sc = W / (l.w + 2 * PAD), H = Math.max(30, (l.h + 2 * PAD) * sc), dpr = window.devicePixelRatio || 1;
    mini.width = W * dpr; mini.height = H * dpr; mini.style.width = `${W}px`; mini.style.height = `${H}px`;
    const x = mini.getContext('2d')!;
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
    for (const [f, p] of Object.entries(l.pos)) { x.fillStyle = chain().has(selRow()) && R()[selRow()]?.file === f ? '#5a5442' : '#2c302c'; x.fillRect((p.x + PAD) * sc, (p.y + PAD) * sc, Math.max(1, p.w * sc), Math.max(1, p.h * sc)); }
    const v = view(), kk = k();
    x.strokeStyle = '#ad9b6f'; x.lineWidth = 1;
    x.strokeRect(v.x / kk * sc + 0.5, v.y / kk * sc + 0.5, Math.min(W - 1, size().w / kk * sc), Math.min(H - 1, size().h / kk * sc));
  }));
  const onMini = (e: PointerEvent) => {
    const l = lay();
    if (!l) return;
    const go = (ev: PointerEvent) => {
      const r = mini.getBoundingClientRect(), sc = 180 / (l.w + 2 * PAD);
      scroller.scrollLeft = ((ev.clientX - r.left) / sc) * k() - size().w / 2;
      scroller.scrollTop = ((ev.clientY - r.top) / sc) * k() - size().h / 2;
      syncView();
    };
    go(e);
    const up = () => { window.removeEventListener('pointermove', go); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', go); window.addEventListener('pointerup', up);
  };

  // ---- export: the diagram as it is drawn, as an SVG picture ----
  /** The diagram as drawn, as an SVG picture (null before it is laid out). */
  function svgText(): { out: string; W: number; H: number; level: string } | null {
    const m = model(), l = lay();
    if (!m || !l) return null;
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const W = l.w + 2 * PAD, H = l.h + 2 * PAD + (unreached() ? 30 : 0);
    let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Selawik, Segoe UI, sans-serif"><rect width="100%" height="100%" fill="#171817"/><g transform="translate(${PAD} ${PAD})">`;
    for (const g of l.groups) out += `<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" fill="#1a2020" stroke="#263030"/><text x="${g.x + 10}" y="${g.y + 22}" font-size="15" fill="#4f6a6a">${esc(g.dir.toUpperCase() || 'TOP FOLDER')}</text>`;
    for (const x of l.lines) out += `<polyline points="${x.pts.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="#4a504a" ${x.thread ? 'stroke-dasharray="5 4"' : ''}/>`;
    for (const f of m.files) {
      const p = l.pos[f];
      out += `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="#1a1b1a" stroke="#3a3f3a"/><text x="${p.x + 12}" y="${p.y + 23}" font-size="${l.level === 'functions' ? 15 : 20}" fill="#c9cdc5">${esc(basename(f))}</text>`;
      if (l.level === 'functions') for (const r of boxGeom(m, f, 'functions').rows) {
        const y = p.y + r.y + 15;
        out += r.type === 'fn'
          ? `<text x="${p.x + 32}" y="${y}" font-size="12" text-anchor="end" fill="#a39467" font-family="monospace">${R()[r.row].n}</text><text x="${p.x + 40}" y="${y}" font-size="12" fill="#a3a8a0" font-family="monospace">${esc(short(R()[r.row].name))}</text>`
          : `<text x="${p.x + 44}" y="${y - 2}" font-size="11" fill="#4f6a6a">↻ ${esc(m.run.frames[r.frame!].text)}</text>`;
      }
    }
    for (const b of placeLabels(l, 1, LABEL_CH)) out += `<rect x="${b.x - b.w}" y="${b.y - b.h / 2}" width="${b.w}" height="${b.h}" fill="#171817"/><text x="${b.x - 5}" y="${b.y + 4}" font-size="12" text-anchor="end" fill="#c9b98f" font-family="monospace">${esc(b.text)}</text>`;
    out += '</g></svg>';
    return { out, W, H, level: l.level };
  }
  async function exportSvg() {
    const x = svgText();
    if (!x) return;
    const file = (await api.fs.saveDialog(`${root()}/${basename(root()) || 'flow'}-${x.level}.svg`)) as string | null;
    if (!file) return;
    await api.fs.write(file, x.out);
    flash(`saved ${basename(file)}`, 3000);
  }
  /** The same picture as a PNG, drawn at twice its size (less when that would pass 16,000 pixels a side). */
  async function exportPng() {
    const x = svgText();
    if (!x) return;
    const file = (await api.fs.saveDialog(`${root()}/${basename(root()) || 'flow'}-${x.level}.png`)) as string | null;
    if (!file) return;
    const scale = Math.min(2, 16000 / x.W, 16000 / x.H);
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(x.out)}`;
    try { await img.decode(); } catch { flash('could not draw the picture', 4000); return; }
    const c = document.createElement('canvas');
    c.width = Math.round(x.W * scale); c.height = Math.round(x.H * scale);
    const g = c.getContext('2d')!;
    g.scale(scale, scale); g.drawImage(img, 0, 0);
    await api.fs.writeBase64(file, c.toDataURL('image/png').split(',')[1]);
    flash(`saved ${basename(file)} · ${c.width} × ${c.height}`, 3000);
  }

  // ---- the header: where the walk is ----
  const header = createMemo(() => {
    const s = S(), c = cur();
    if (!s || !c) return '';
    const steps = s.run.rows.filter((r) => r.kind === 'step').length;
    if (c.at >= s.items.length) return `${steps} / ${steps} · end`;
    const r = R()[selRow()];
    return r ? `${r.n} / ${steps} · ${short(r.name)}` : '';
  });

  const lv = () => level();
  const W = () => (lay()?.w ?? 0) * k() + 2 * PAD, H = () => (lay()?.h ?? 0) * k() + 2 * PAD;
  return (
    <div class="body" style={{ height: '100%' }}>
      <Show when={lv() !== 'functions' && hoverAt()}>{(h) => (
        <Portal><div class="hpop" style={hoverStyle(h())}>
          <For each={h().fns.slice(0, hoverFits(h()))}>{(i) => <div><span class="n">{R()[i].n}</span><span class="nm">{short(R()[i].name)}</span><Show when={lv() === 'folders'}><span class="no">{basename(R()[i].file)}</span></Show></div>}</For>
          <Show when={hoverFits(h()) < h().fns.length}><div class="more">+{h().fns.length - hoverFits(h())} more · click the box to step into it</div></Show>
        </div></Portal>
      )}</Show>
      <div class="pane" style={{ flex: 1 }}>
        <div class="ph wrap" style={{ padding: '0 22px' }}>
          <span>{status()}</span>
          <Show when={header()}><span class="seqk" style={{ 'margin-left': '14px' }}>{header()}</span></Show>
          <span class="grow" />
          <Show when={runStatus()}><span class="sub">{runStatus()}</span></Show>
          <PlayControls playing={playing()} speed={speed()} setSpeed={setSpeed} toggle={() => play()}
            restart={() => { stop(); report(stepMove('home')); play(); }} step={() => { stop(); report(stepMove('next')); }} />
          {props.switcher}
          <button class="chip" classList={{ on: heat() }} aria-pressed={heat()} title="shade each row by how often it runs, from the loops around it (H)" onClick={() => setHeat(!heat())}>how often</button>
          <button class="chip" title="save the diagram as drawn: an SVG picture or a PNG image" onClick={() => setPalette({ placeholder: 'export the diagram as…', items: [{ label: 'PNG image', detail: 'twice the size on screen', run: exportPng }, { label: 'SVG picture', detail: 'scales without blur', run: exportSvg }] })}>export</button>
        </div>
        <div class="flow bxv" ref={canvasEl} data-ms={graph()?.ms} tabindex="0" role="application" aria-label="the run as files and the functions in them" onKeyDown={onKey}>
          <div class="bxs" ref={scroller} onScroll={() => { syncView(); setHoverAt(null); }} onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            <div class="bxsz" style={{ width: `${W()}px`, height: `${H()}px` }}>
              <Show when={lay()} fallback={<div class="empty" style={{ position: 'absolute', inset: 0 }}>{runStatus() || status() || 'building…'}</div>}>
                <div class="bxw" classList={{ [`lv-${lv()}`]: true }} style={{ transform: `scale(${k()})`, left: `${PAD}px`, top: `${PAD}px`, '--inv': String(1 / k()) }}>
                  <For each={lay()!.groups}>{(g) => <div class="bxgrp" style={{ left: `${g.x}px`, top: `${g.y}px`, width: `${g.w}px`, height: `${g.h}px` }}><span>{g.dir || 'top folder'}</span></div>}</For>
                  <svg class="bxed" width={lay()!.w + 40} height={lay()!.h + 40}>
                    <For each={lay()!.lines}>{(l) => {
                      const d = `M${l.pts.map((p) => `${p.x} ${p.y}`).join(' L')}`, q = l.pts[l.pts.length - 1];
                      const cls = () => ({ thread: l.thread, now: `${l.a}>${l.b}` === nowKey() && lv() === 'functions', chain: lv() === 'functions' && chain().has(l.a) && chain().has(l.b), on: lineOn(l) === true, dim: lineOn(l) === false });
                      // into a much-called box: drawn only on the step's chain or a chosen route
                      const shown = () => !l.hub || cls().now || cls().chain || lineOn(l) === true;
                      return (
                        <Show when={shown()}><g classList={cls()}>
                          <path class="ln" d={d} />
                          <path class="ah" d={`M${q.x - 6} ${q.y - 3.5} L${q.x} ${q.y} L${q.x - 6} ${q.y + 3.5} Z`} />
                          <path class="hit" d={d} onClick={() => { stop(); jumpRow(selRow() === l.b ? l.a : l.rows[0]); canvasEl.focus(); }}><title>{l.text}</title></path>
                        </g></Show>
                      );
                    }}</For>
                    <Show when={marker()}><path class="walk" d={`M${marker()!.path.map((p) => `${p.x} ${p.y}`).join(' L')}`} /></Show>
                  </svg>
                  <For each={shownNodes()}>{(f) => {
                    const p = () => lay()!.pos[f];
                    const fns = () => filesIn(f).flatMap((x) => model()!.rowsOf.get(x) ?? []);
                    return (
                      <Show when={p()}>
                        <div class="fbox" classList={{ cur: selNode() === f, fade: fileOn(f) === false || (waysOut() && !boxOut(f)) || (!!followed() && !boxTouched(f)), start: filesIn(f).includes(startFile()) }}
                          style={{ left: `${p()!.x}px`, top: `${p()!.y}px`, width: `${p()!.w}px`, height: `${p()!.h}px` }}
                          onMouseEnter={(e) => { setHoverAt({ rect: e.currentTarget.getBoundingClientRect(), fns: fns().sort((a, b) => R()[a].n - R()[b].n) }); }} onMouseLeave={() => setHoverAt(null)}
                          onClick={(e) => { if (lv() !== 'functions') { const first = fns().sort((a, b) => R()[a].n - R()[b].n)[0]; if (first != null) { if (e.shiftKey) routeTo(first); else jumpRow(first); } } }}
                          onDblClick={() => { if (lv() !== 'functions') { const r = scroller.getBoundingClientRect(), b = (scroller.querySelector(`.fbox[data-f="${CSS.escape(f)}"]`) as HTMLElement).getBoundingClientRect(); zoomTo(Math.max(LEVEL_AT.functions, 0.8), { ax: b.left + b.width / 2 - r.left, ay: b.top + b.height / 2 - r.top, ms: 420 }); } }}
                          data-f={f}>
                          <Show when={lay()!.hubs[f]}><div class="hubt" title="called from this many other boxes: its lines are drawn on the step's chain or a chosen route">← from {lay()!.hubs[f]}</div></Show>
                          <div class="t" title={f.startsWith('dir:') ? f.slice(4) || 'the top folder' : rel(f)}>{f.startsWith('dir:') ? f.slice(4) || 'top folder' : basename(f)}<Show when={lv() === 'functions' || lv() === 'files' ? model()!.dirOf(f) : ''}><i>{model()!.dirOf(f)}</i></Show></div>
                          <Show when={filesIn(f).includes(startFile())}><span class="start">start ▸</span></Show>
                          <Show when={fns().reduce((a, i) => a + S()!.run.frames.filter((x) => x.kind === 'loop' && x.owner === i).length, 0)}>{(n) => <div class="lc">↻ {n()}</div>}</Show>
                          <Show when={lv() === 'files'}>
                            <div class="s">{fns().length} function{fns().length === 1 ? '' : 's'} run</div>
                            <Show when={callersOf(f).size > 1}><div class="s s2">used by {callersOf(f).size} files</div></Show>
                          </Show>
                          <Show when={lv() === 'folders'}>
                            <div class="s">{fns().length} function{fns().length === 1 ? '' : 's'} run</div>
                            <div class="s s2">{filesIn(f).length} file{filesIn(f).length === 1 ? '' : 's'}</div>
                          </Show>
                          <Show when={lv() === 'functions'}>
                            <For each={boxGeom(model()!, f, 'functions').rows}>{(r) => r.type === 'fn'
                              ? (
                                <div class="fr" classList={{ sel: r.row === selRow(), chain: r.row !== selRow() && chain().has(r.row), on: rowOn(r.row) === true || hot().has(r.row), dim: rowOn(r.row) === false || (waysOut() && !outs(r.row).length) || (!!followed() && !touches(r.row).length) || (!!deadOf(r.row) && r.row !== selRow()), wx: (waysOut() && outs(r.row).length > 0) || (!!followed() && touches(r.row).length > 0), hot: hot().has(r.row), chg: ripple().rows.has(r.row), chgc: ripple().chain.has(r.row) && !ripple().rows.has(r.row) }}
                                  style={{ top: `${r.y}px`, background: heat() && howOftenLevel(S()!.run, r.row).level ? `rgba(111,158,158,${[0, 0.1, 0.2, 0.32, 0.4][Math.min(4, howOftenLevel(S()!.run, r.row).level)]})` : undefined }}
                                  onClick={(e) => { e.stopPropagation(); if (e.shiftKey) routeTo(r.row); else jumpRow(r.row); canvasEl.focus(); }} title={`${short(R()[r.row].name)} · ${basename(f)}:${R()[r.row].line + 1}${waysOut() ? outs(r.row).map((x) => `\nline ${x.line + 1}: ${[...x.when, x.kind === 'noreturn' ? `${x.text} (${x.callee} never returns)` : x.text].join(' → ')}`).join('') : ''}${followed() ? touches(r.row).map((h) => `\n${hitWords(h)}`).join('') : ''}${deadOf(r.row) ? `\nnot in this call · ${deadOf(r.row)}` : ''}`}>
                                  <span class="n">{R()[r.row].n}</span><span class="nm">{short(R()[r.row].name)}</span>
                                  <Show when={heat() && !(waysOut() && outs(r.row).length) && !(followed() && touches(r.row).length)}><span class="c">{howOftenLevel(S()!.run, r.row).text}</span></Show>
                                  <Show when={waysOut() && outs(r.row).length}><span class="c x">{outs(r.row).length} out</span></Show>
                                  <Show when={!waysOut() && followed() && touches(r.row).length}><span class="c">{[...new Set(touches(r.row).map((h) => (h.how === 'set' ? (h.copy ? 'sets a copy' : 'sets') : h.how === 'read' ? 'reads' : h.how === 'returns' ? 'returns' : '')).filter(Boolean))].join(' · ')}</span></Show>
                                </div>
                              )
                              : <div class="lpl" classList={{ hot: loopHot(r.frame!), dim: rowOn(r.row) === false }} style={{ top: `${r.y}px` }}>↻ {S()!.run.frames[r.frame!].count != null ? `×${S()!.run.frames[r.frame!].count} · ` : ''}{S()!.run.frames[r.frame!].text}{loopHot(r.frame!) ? ` · pass ${cur()!.passes[r.frame!] ?? 1}` : ''}</div>}
                            </For>
                          </Show>
                        </div>
                      </Show>
                    );
                  }}</For>
                  <For each={shownLabels()}>{(b) => (
                    <div class="flab" classList={{ t: b.thread, lit: b.keys.includes(nowKey()) && lv() === 'functions', on: labelOn(b.keys) === true, dim: labelOn(b.keys) === false }}
                      style={{ left: `${b.x - b.w}px`, top: `${b.y - b.h / 2}px`, width: `${b.w}px`, height: `${b.h}px`, 'font-size': `${LABEL_PX * (b.h / 15)}px`, 'line-height': `${b.h}px` }} title={b.full}>{b.text}</div>
                  )}</For>
                  <Show when={marker()}><div class="bxdot" style={{ left: `${marker()!.at.x}px`, top: `${marker()!.at.y}px` }} /></Show>
                </div>
              </Show>
            </div>
          </div>
          <canvas class="bxmini" ref={mini} style={{ display: over() ? 'block' : 'none' }} onPointerDown={onMini} />
          <Show when={route()}>{(r) => (
            <div class="bxroute">
              <span class="h">route</span> from <b>{short(R()[r().from].name)}</b> to <b>{short(R()[r().to].name)}</b> · {r().list.length} route{r().list.length === 1 ? '' : 's'}<span class="esc">Enter walks it · Esc clears</span>
            </div>
          )}</Show>
          <div class="bxctl">
            <span class="lvl">{lv() === 'functions' ? 'functions' : lv() === 'files' ? 'files' : 'folders'}<Show when={unreached()}> · {unreached()} file{unreached() === 1 ? '' : 's'} not reached from this start</Show></span>
            <span class="grow" />
            <Show when={S() && leavingCount(S()!.run)}><button class="chip" classList={{ on: waysOut() }} aria-pressed={waysOut()} title="ways out: the usual path fades, functions that can leave early stay, with how many ways; hover one for them (E)" onClick={() => { toggleWaysOut(); canvasEl.focus(); }}>ways out</button></Show>
            <For each={[['all', 'fit all'], ['width', 'fit width'], ['100', '100%'], ['150', '150%']] as [Zoom, string][]}>{([z, t]) => <button class="chip" classList={{ on: zoom() === z }} onClick={() => { applyZoom(z); canvasEl.focus(); }}>{t}</button>}</For>
            <button class="chip" title={`zoom out (${ALT} −)`} onClick={() => zoomTo(k() / 1.25, { ms: 260 })}>−</button>
            <span class="ro">{Math.round(k() * 100)}%</span>
            <button class="chip" title={`zoom in (${ALT} +)`} onClick={() => zoomTo(k() * 1.25, { ms: 260 })}>+</button>
          </div>
          <Magnifier host={() => scroller} source={() => { const z = scroller?.querySelector('.bxsz') as HTMLElement | null; if (!z) return null; const r = scroller.getBoundingClientRect(); return { el: z, x: r.left - scroller.scrollLeft, y: r.top - scroller.scrollTop, w: z.offsetWidth, h: z.offsetHeight }; }} />
          <Show when={caption()}><div class="scap"><Show when={caption()!.key}><span class="key">{caption()!.key}</span></Show>{caption()!.what}<Show when={caption()!.why}><span class="why">{caption()!.why}</span></Show></div></Show>
        </div>
      </div>
      <Show when={route()} fallback={<StepPreview />}>{(r) => (
        <div class="pane prev" style={{ width: '440px', flex: 'none' }}>
          <div class="ph" style={{ padding: '0 20px' }}><span style={{ color: 'var(--bright)' }}>{r().list.length} route{r().list.length === 1 ? '' : 's'} · {short(R()[r().from].name)} → {short(R()[r().to].name)}</span><span class="grow" /><button class="chip" onClick={() => setRoute(null)}>clear</button></div>
          <For each={r().list}>{(x, i) => (
            <div class="bxr" classList={{ on: r().only === i(), dim: r().only >= 0 && r().only !== i() }} onClick={() => setRoute({ ...r(), only: r().only === i() ? -1 : i() })}>
              <div class="t"><b>{i() + 1}</b><For each={x.rows}>{(q, j) => <><Show when={j() > 0}><i>›</i></Show>{short(R()[q].name)}</>}</For></div>
              <div class="w">{x.rows.length - 1} call{x.rows.length > 2 ? 's' : ''}{x.at.length > 1 ? ` · taken ×${x.at.length}` : ''}<button class="lnk" onClick={(e) => { e.stopPropagation(); walkRoute(i()); }}>walk it</button></div>
              <For each={frameWords(S()!.run, x.at[0])}>{(w) => <div class="f">{w}</div>}</For>
            </div>
          )}</For>
          <div class="ways pv"><span><b>1–{Math.min(9, r().list.length)}</b> one route</span><span><b>Enter</b> walk it</span><span><b>Esc</b> clear</span></div>
        </div>
      )}</Show>
    </div>
  );
}
