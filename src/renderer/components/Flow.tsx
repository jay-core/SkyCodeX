import { For, Show, createSignal, createEffect, on, onMount } from 'solid-js';
import ELK from 'elkjs/lib/elk.bundled.js';
import { buildFlow, FlowGraph, FlowBox, shortName, fileToUri } from '../lib/flow';
import { root, settings } from '../lib/store';
import { indexEpoch, lspState } from '../lib/lsp';
import { api, basename } from '../lib/api';
import Card from './Card';
import { PAL } from '../lib/lines';
import { routeEdges, folderFrames, Route, Rect } from '../lib/flowlayout';
import type { Card as CardData } from '../lib/preview';
import { t } from '../lib/i18n';

const BW = 190, BH = 66;
const elk = new ELK();

interface Placed { box: FlowBox; x: number; y: number; pinned: boolean }
type Routed = Route;

const [graph, setGraph] = createSignal<FlowGraph | null>(null);
const [status, setStatus] = createSignal('');
let builtFor = '';
const [grouped, setGrouped] = createSignal((() => { try { return localStorage.getItem('flow.group') === '1'; } catch { return false; } })());

export default function Flow() {
  const [placed, setPlaced] = createSignal<Placed[]>([]);
  const [routes, setRoutes] = createSignal<Routed[]>([]);
  const [hover, setHover] = createSignal<string | null>(null);
  const [sel, setSel] = createSignal<string | null>(null);
  const [view, setView] = createSignal({ x: 40, y: 50, k: 1 });
  const [selCards, setSelCards] = createSignal<CardData[]>([]);
  const [frames, setFrames] = createSignal<(Rect & { folder: string })[]>([]);
  const folderOf = (file: string) => { const r = shortName(root(), file); const i = r.lastIndexOf('/'); return i < 0 ? '' : r.slice(0, i); };
  let canvas!: HTMLDivElement;

  async function rebuild() {
    if (!root() || lspState() !== 'ready') return;
    if (builtFor !== root()) firstBuild = Date.now();
    builtFor = root();
    setStatus(t('tracing calls from main…'));
    const g = await buildFlow(root(), (n) => setStatus(`tracing calls from main… ${n} functions`));
    setGraph(g);
    if (canvas) canvas.dataset.ms = String(g.ms);   // build time, read by the smoke run
    await layout(g);
    const files = g.boxes.filter((b) => !b.dead).length, stop = g.truncated ? ` · stopped at ${g.limit} functions` : '';
    setStatus(g.note || (g.library
      ? `from the public API (${g.library} functions) · ${g.fns.length} functions reached · ${files} files${stop}`
      : `${g.entries.length > 1 ? `${g.entries.length} entry points · ` : ''}${g.fns.length} functions · ${files} files${stop}`));
    // clangd may still be loading its index: rebuild until every call resolves to a definition (30 s at most)
    if (g.unresolved && Date.now() - firstBuild < 30000) setTimeout(rebuild, 2000);
  }
  let firstBuild = Date.now();

  async function layout(g: FlowGraph, fit = true) {
    const live = g.boxes.filter((b) => !b.dead);
    const node = (b: FlowBox) => ({ id: b.file, width: BW, height: BH + (b.loops.length ? 44 : 0) });   // room for a two-line loop note under the box
    const folders = [...new Set(live.map((b) => folderOf(b.file)))];
    const res = await elk.layout({
      id: 'root',
      layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.layered.spacing.nodeNodeBetweenLayers': '120', 'elk.spacing.nodeNode': '56', 'elk.edgeRouting': 'SPLINES', 'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES', ...(grouped() ? { 'elk.hierarchyHandling': 'INCLUDE_CHILDREN' } : {}) },
      children: grouped()
        ? folders.map((f) => ({ id: `dir:${f}`, layoutOptions: { 'elk.padding': '[top=44,left=30,bottom=30,right=30]' }, children: live.filter((b) => folderOf(b.file) === f).map(node) }))
        : live.map(node),
      edges: g.edges.map((e, i) => ({ id: `e${i}`, sources: [e.from], targets: [e.to] })),
    } as any);
    // positions inside a folder are relative to it
    const pos = new Map<string, { x: number; y: number }>();
    for (const c of (res.children ?? []) as any[]) {
      if (c.children) for (const k of c.children) pos.set(k.id, { x: (c.x ?? 0) + (k.x ?? 0), y: (c.y ?? 0) + (k.y ?? 0) });
      else pos.set(c.id, { x: c.x ?? 0, y: c.y ?? 0 });
    }
    const pins = loadPins();
    const out: Placed[] = live.map((b) => ({ box: b, ...(pins[b.file] ?? pos.get(b.file) ?? { x: 0, y: 0 }), pinned: !!pins[b.file] }));
    const maxY = Math.max(0, ...out.map((p) => p.y + BH + 40));
    // the shelf of files no entry point reaches: as wide as the diagram above it (4 to 10 boxes a row)
    const liveW = Math.max(0, ...out.map((p) => p.x + BW));
    const per = Math.min(10, Math.max(4, Math.floor((liveW + 30) / (BW + 30))));
    g.boxes.filter((b) => b.dead).forEach((b, i) => out.push({ box: b, ...(pins[b.file] ?? { x: (i % per) * (BW + 30), y: maxY + 60 + Math.floor(i / per) * (BH + 30) }), pinned: !!pins[b.file] }));
    setPlaced(out);
    reroute(out);
    if (!fit) return;
    // fit what runs in view (the shelf below it is a scroll away); with nothing running, the shelf's first rows
    const shown = out.some((p) => !p.box.dead) ? out.filter((p) => !p.box.dead) : out.slice(0, per * 4);
    const w = Math.max(...shown.map((p) => p.x + BW)) + 60, h = Math.max(...shown.map((p) => p.y + BH)) + 80;
    const cw = canvas?.clientWidth || 900, ch = canvas?.clientHeight || 600;
    const k = Math.max(0.35, Math.min(1, (cw - 80) / w, (ch - 60) / h));   // never too small to read; a larger diagram pans
    const x0 = Math.min(0, ...shown.map((p) => p.x)), y0 = Math.min(0, ...shown.map((p) => p.y));
    setView({ k, x: 60 - x0 * k, y: 40 - y0 * k });
  }

  const boxAt = (p: Placed) => ({ id: p.box.file, x: p.x, y: p.y, w: BW, h: BH, extra: { left: p.box.entries.length ? 46 : 0, top: p.box.thread || p.pinned ? 20 : 0, bottom: p.box.loops.length ? 44 : 0 } });
  function reroute(list = placed()) {
    const g = graph();
    if (!g) return;
    // an arrow that carries many calls shows the first four numbers; the box's list has them all
    const nums = (n: string[]) => (n.length > 4 ? `${n.slice(0, 4).join(' · ')} +${n.length - 4}` : n.join(' · '));
    setRoutes(routeEdges(list.map(boxAt), g.edges.map((e) => ({ from: e.from, to: e.to, thread: e.thread, text: e.thread ? t('spawns thread') : nums(e.nums) }))));
    setFrames(grouped() ? folderFrames(list.filter((p) => !p.box.dead).map((p) => ({ ...boxAt(p), folder: folderOf(p.box.file) }))) : []);
  }

  // ---- pins: a box dragged somewhere stays there, for this folder, until unpinned ----
  const pinKey = () => `flow.pins:${root()}`;
  function loadPins(): Record<string, { x: number; y: number }> { try { return JSON.parse(localStorage.getItem(pinKey()) || '{}'); } catch { return {}; } }
  function savePins(list: Placed[]) {
    const o: Record<string, { x: number; y: number }> = {};
    for (const p of list) if (p.pinned) o[p.box.file] = { x: Math.round(p.x), y: Math.round(p.y) };
    try { localStorage.setItem(pinKey(), JSON.stringify(o)); } catch { /* pins last for this run only */ }
  }
  function unpin(file?: string) {
    const list = placed().map((p) => (!file || p.box.file === file ? { ...p, pinned: false } : p));
    savePins(list);
    const g = graph();
    if (g) layout(g, false);
  }

  onMount(() => { if (builtFor !== root()) rebuild(); else if (graph()) layout(graph()!); });
  createEffect(on([indexEpoch, lspState, root], () => rebuild(), { defer: true }));

  // ---- select a box: its functions open in the preview pane, in execution order ----
  createEffect(on(sel, async (file) => {
    const g = graph();
    const box = g?.boxes.find((b) => b.file === file);
    if (!file || !g || !box) { setSelCards([]); return; }
    const text = ((await api.fs.read(file).catch(() => '')) as string).split('\n');
    const rows = box.dead ? box.fns : box.fns.filter((f) => f.num);
    setSelCards(rows.map((f) => {
      const pos = { line: f.line, character: 0 };
      const item = { name: f.name, kind: 12, uri: fileToUri(file), range: { start: pos, end: { line: f.endLine, character: 0 } }, selectionRange: { start: pos, end: pos } };
      return { key: `${file}#${f.line}`, item, file, name: f.name, startLine: f.line, text: text.slice(f.line, f.endLine + 1).join('\n'), fromRanges: [], std: false, kind: 'call', num: f.num } as CardData & { num: string };
    }));
  }));

  // ---- pan and zoom; dragging a box moves and pins it ----
  let drag: { x: number; y: number; vx: number; vy: number } | null = null;
  let boxDrag: { file: string; x: number; y: number; bx: number; by: number; moved: boolean } | null = null;
  let justDragged = false;
  // pointers: mouse, touch and pen alike; two fingers pinch to zoom
  const fingers = new Map<number, { x: number; y: number }>();
  let pinch: { d: number; k: number } | null = null;
  const onDown = (e: PointerEvent) => {
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 2) { const [a, b] = [...fingers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view().k }; drag = null; boxDrag = null; return; }
    if ((e.target as HTMLElement).closest('.fbox')) return;
    canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, vx: view().x, vy: view().y }; canvas.classList.add('drag');
  };
  const onBoxDown = (e: PointerEvent, p: Placed) => { if (e.button !== 0) return; boxDrag = { file: p.box.file, x: e.clientX, y: e.clientY, bx: p.x, by: p.y, moved: false }; };
  const onMove = (e: PointerEvent) => {
    if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && fingers.size === 2) {
      const [a, b] = [...fingers.values()], r = canvas.getBoundingClientRect(), v = view();
      const k = Math.min(2.5, Math.max(0.3, pinch.k * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
      const cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top;
      setView({ k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k });
      return;
    }
    if (boxDrag) {
      const dx = (e.clientX - boxDrag.x) / view().k, dy = (e.clientY - boxDrag.y) / view().k;
      if (!boxDrag.moved && Math.hypot(dx, dy) < 4) return;
      boxDrag.moved = true;
      canvas.classList.add('drag');
      const f = boxDrag.file, nx = boxDrag.bx + dx, ny = boxDrag.by + dy;
      const list = placed().map((p) => (p.box.file === f ? { ...p, x: nx, y: ny, pinned: true } : p));
      setPlaced(list);
      reroute(list);
      return;
    }
    if (drag) setView({ ...view(), x: drag.vx + e.clientX - drag.x, y: drag.vy + e.clientY - drag.y });
  };
  const onUp = (e?: PointerEvent) => {
    if (e) fingers.delete(e.pointerId);
    if (fingers.size < 2) pinch = null;
    if (boxDrag?.moved) { savePins(placed()); justDragged = true; setTimeout(() => (justDragged = false), 0); }
    boxDrag = null; drag = null; canvas.classList.remove('drag');
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const v = view();
    if (e.ctrlKey || e.metaKey) {
      const r = canvas.getBoundingClientRect(), k = Math.min(2.5, Math.max(0.3, v.k * Math.exp(-e.deltaY / 400)));
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      setView({ k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k });
    } else setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
  };

  // a box fades in the first time it appears; rebuilds while clangd indexes leave the boxes already shown in place
  const shownBoxes = new Set<string>();
  createEffect(on(root, () => shownBoxes.clear()));
  const enter = (p: Placed, i: number) => {
    if (reduce() || p.pinned || shownBoxes.has(p.box.file)) return 'none';
    shownBoxes.add(p.box.file);
    return `fadeUp .45s cubic-bezier(.16,1,.3,1) ${Math.min(i, 16) * 50}ms backwards`;
  };
  const touches = (r: Routed) => { const f = hover() ?? sel(); return !f || r.from === f || r.to === f; };
  const run = (b: FlowBox) => b.fns.filter((f) => f.num).length;
  const reduce = () => !!settings()['motion.reduce'];

  return (
    <div class="body" style={{ height: '100%' }}>
      <div class="pane" style={{ flex: 1 }}>
        <div class="ph" style={{ padding: '0 22px' }}><span>{status()}</span><span class="grow" /><Show when={placed().some((p) => p.pinned)}><button class="chip" title={t('let the layout place every box again')} onClick={() => unpin()}>{t('unpin all')}</button></Show>
          <button class="chip" classList={{ on: grouped() }} aria-pressed={grouped()} title={t("draw a frame around each folder's files")} onClick={() => { setGrouped(!grouped()); try { localStorage.setItem('flow.group', grouped() ? '1' : '0'); } catch { /* kept for this run */ } const g = graph(); if (g) layout(g); }}>{t('group by folder')}</button>
          <button class="chip" onClick={rebuild}>{t('refresh')}</button><button class="chip" onClick={() => { const g = graph(); if (g) layout(g); }}>{t('fit')}</button></div>
        <div class="flow" ref={canvas} style={{ 'touch-action': 'none' }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
          <div style={{ position: 'absolute', left: 0, top: 0, 'transform-origin': '0 0', transform: `translate(${view().x}px, ${view().y}px) scale(${view().k})` }}>
            <For each={frames()}>{(f) => <div class="fgroup" style={{ left: `${f.x}px`, top: `${f.y}px`, width: `${f.w}px`, height: `${f.h}px` }}><span>{f.folder || t('top folder')}</span></div>}</For>
            <svg width="4000" height="3000" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
              <For each={routes()}>{(r) => (
                <g opacity={touches(r) ? 1 : 0.25}>
                  <path d={r.d} fill="none" stroke={touches(r) && (hover() || sel()) ? 'var(--accent)' : '#5f665f'} stroke-width="1.5" stroke-dasharray={r.thread ? '5 4' : undefined} />
                  <path d="M0 0 L-9 -5 L-9 5 Z" transform={`translate(${r.head.x} ${r.head.y}) rotate(${r.head.ang})`} fill={touches(r) && (hover() || sel()) ? 'var(--accent)' : '#5f665f'} />
                </g>
              )}</For>
            </svg>
            {/* zoomed out, the call numbers show only on the arrows of the box pointed at or selected */}
            <For each={routes()}>{(r) => <Show when={view().k >= 0.6 || ((hover() || sel()) && touches(r))}><div class="flab" classList={{ t: r.thread }} style={{ left: `${r.label.x}px`, top: `${r.label.y}px`, opacity: touches(r) ? 1 : 0.25 }}>{r.label.text}</div></Show>}</For>
            <Show when={placed().some((p) => p.box.dead)}>
              <div class="sub" style={{ position: 'absolute', 'white-space': 'nowrap', left: `${Math.min(...placed().filter((p) => p.box.dead).map((p) => p.x))}px`, top: `${Math.min(...placed().filter((p) => p.box.dead).map((p) => p.y)) - 30}px` }}>{t('not reached from any entry point')}</div>
            </Show>
            <For each={placed()}>{(p, i) => (
              <div class="fbox" classList={{ dead: p.box.dead, on: sel() === p.box.file, pinned: p.pinned }}
                style={{ left: `${p.x}px`, top: `${p.y}px`, width: `${BW}px`, height: `${BH}px`, animation: enter(p, i()) }}
                onMouseEnter={() => setHover(p.box.file)} onMouseLeave={() => setHover(null)}
                onPointerDown={(e) => onBoxDown(e, p)} tabindex="0" role="button" aria-label={`${shortName(root(), p.box.file)}, ${p.box.fns.length} functions`}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(sel() === p.box.file ? null : p.box.file); } }}
                onClick={() => { if (!justDragged) setSel(sel() === p.box.file ? null : p.box.file); }}>
                <Show when={p.pinned}><button class="pin" title={t('unpin: let the layout place this box')} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); unpin(p.box.file); }}>{t('pinned ×')}</button></Show>
                <Show when={p.box.entries.length}><span class="start">{p.box.entries.length > 1 ? `start ▸ ${p.box.entries.length}` : 'start ▸'}</span></Show>
                <Show when={p.box.thread}><span class="tag">{t('thread')}</span></Show>
                <div class="t" title={shortName(root(), p.box.file)}>{basename(p.box.file)}</div>
                <div class="s">{p.box.fns.length} functions · {p.box.dead ? t('none run') : `${run(p.box)} run`}<Show when={folderOf(p.box.file)}><span class="dir"> · {folderOf(p.box.file)}</span></Show></div>
                <Show when={p.box.loops.length && hover() !== p.box.file}><div class="loop" title={p.box.loops.join('\n')}>{p.box.loops[0]}{p.box.loops.length > 1 ? ` · +${p.box.loops.length - 1}` : ''}</div></Show>
                <Show when={hover() === p.box.file}>
                  <div class="hpop" style={{ left: '-1px', top: `${BH + 6}px` }}>
                    <For each={p.box.fns}>{(f) => <div><span class="n">{f.num}</span><span classList={{ no: !f.num }}>{f.name}</span></div>}</For>
                    <For each={p.box.loops}>{(l) => <div style={{ color: '#5f8a8a', font: '300 12px var(--ui)', 'padding-top': '4px' }}>{l}</div>}</For>
                  </div>
                </Show>
              </div>
            )}</For>
          </div>
          <Show when={!placed().length}><div class="empty" style={{ position: 'absolute', inset: 0 }}>{lspState() === 'ready' ? status() || t('building…') : t('open a folder to see how it runs')}</div></Show>
        </div>
      </div>
      <div class="pane prev" style={{ width: '440px', flex: 'none' }}>
        <Show when={sel()} fallback={<div class="empty">{t('click a box to see what’s inside')}</div>}>
          <div style={{ padding: '14px 20px 0' }}>
            <div style={{ font: '300 28px var(--ui)', color: 'var(--bright)' }}>{shortName(root(), sel()!)}</div>
            <div class="sub" style={{ margin: '2px 0 12px' }}>{placed().find((p) => p.box.file === sel())?.box.dead ? `not reached from any entry point · ${selCards().length} functions, in file order` : `${selCards().length} of ${placed().find((p) => p.box.file === sel())?.box.fns.length ?? 0} functions run in this flow · in execution order`}</div>
          </div>
          <div class="pcol" style={{ position: 'relative', top: 0, flex: 1 }}>
            <div class="pcol-in">
              <For each={selCards()}>{(c, k) => <Card card={c} id={`flow:${k()}`} color={PAL[k() % PAL.length]} focus={false} num={(c as any).num || undefined} onFocus={() => {}} />}</For>
              <For each={placed().find((p) => p.box.file === sel() && !p.box.dead)?.box.fns.filter((f) => !f.num) ?? []}>{(f) => <div class="pnote">{f.name} — not run in this flow</div>}</For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
