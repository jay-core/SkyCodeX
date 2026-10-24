import { For, Show, createSignal, createEffect, on, onMount } from 'solid-js';
import ELK from 'elkjs/lib/elk.bundled.js';
import { buildFlow, FlowGraph, FlowBox, shortName, fileToUri } from '../lib/flow';
import { root, settings } from '../lib/store';
import { indexEpoch, lspState } from '../lib/lsp';
import { api } from '../lib/api';
import Card from './Card';
import { PAL } from '../lib/lines';
import type { Card as CardData } from '../lib/preview';

const BW = 190, BH = 66;
const elk = new ELK();

interface Placed { box: FlowBox; x: number; y: number }
interface Routed { d: string; label: { x: number; y: number; text: string; thread: boolean }; thread: boolean; from: string; to: string; head: { x: number; y: number; ang: number } }

const [graph, setGraph] = createSignal<FlowGraph | null>(null);
const [status, setStatus] = createSignal('');
let builtFor = '';

export default function Flow() {
  const [placed, setPlaced] = createSignal<Placed[]>([]);
  const [routes, setRoutes] = createSignal<Routed[]>([]);
  const [hover, setHover] = createSignal<string | null>(null);
  const [sel, setSel] = createSignal<string | null>(null);
  const [view, setView] = createSignal({ x: 40, y: 50, k: 1 });
  const [selCards, setSelCards] = createSignal<CardData[]>([]);
  let canvas!: HTMLDivElement;

  async function rebuild() {
    if (!root() || lspState() !== 'ready') return;
    if (builtFor !== root()) firstBuild = Date.now();
    builtFor = root();
    setStatus('tracing calls from main…');
    const g = await buildFlow(root(), (n) => setStatus(`tracing calls from main… ${n} functions`));
    setGraph(g);
    await layout(g);
    setStatus(g.note || `${g.entries.length > 1 ? `${g.entries.length} entry points · ` : ''}${g.fns.length} functions · ${g.boxes.filter((b) => !b.dead).length} files${g.truncated ? ' · stopped at 400 functions' : ''}`);
    // clangd may still be loading its index: rebuild until every call resolves to a definition (30 s at most)
    if (g.unresolved && Date.now() - firstBuild < 30000) setTimeout(rebuild, 2000);
  }
  let firstBuild = Date.now();

  async function layout(g: FlowGraph) {
    const live = g.boxes.filter((b) => !b.dead);
    const res = await elk.layout({
      id: 'root',
      layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.layered.spacing.nodeNodeBetweenLayers': '120', 'elk.spacing.nodeNode': '56', 'elk.edgeRouting': 'SPLINES', 'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES' },
      children: live.map((b) => ({ id: b.file, width: BW, height: BH + (b.loops.length ? 44 : 0) })),   // room for a two-line loop note under the box
      edges: g.edges.map((e, i) => ({ id: `e${i}`, sources: [e.from], targets: [e.to] })),
    } as any);
    const pos = new Map((res.children ?? []).map((c: any) => [c.id, c]));
    const out: Placed[] = live.map((b) => ({ box: b, x: (pos.get(b.file) as any)?.x ?? 0, y: (pos.get(b.file) as any)?.y ?? 0 }));
    const maxY = Math.max(0, ...out.map((p) => p.y + BH + 40));
    g.boxes.filter((b) => b.dead).forEach((b, i) => out.push({ box: b, x: (i % 4) * (BW + 30), y: maxY + 60 + Math.floor(i / 4) * (BH + 30) }));
    setPlaced(out);
    // fit the whole diagram in view on first layout
    const w = Math.max(...out.map((p) => p.x + BW)) + 60, h = Math.max(...out.map((p) => p.y + BH)) + 80;
    const cw = canvas?.clientWidth || 900, ch = canvas?.clientHeight || 600;
    const k = Math.min(1, (cw - 80) / w, (ch - 60) / h);
    setView({ k, x: 60, y: 40 });
    const at = new Map(out.map((p) => [p.box.file, p]));
    setRoutes(g.edges.map((e) => {
      const a = at.get(e.from)!, b = at.get(e.to)!;
      let x1 = a.x + BW, y1 = a.y + BH / 2, x2 = b.x, y2 = b.y + BH / 2, ang = 0;
      if (b.x <= a.x + BW / 2) { // same column or backwards: leave from the bottom
        x1 = a.x + BW / 2; y1 = a.y + BH; x2 = b.x + BW / 2; y2 = b.y - 2; ang = 90;
        if (b.y < a.y) { y1 = a.y; y2 = b.y + BH + 2; ang = -90; }
      }
      const d = ang === 0
        ? `M${x1} ${y1} C${x1 + Math.max(40, (x2 - x1) / 2)} ${y1} ${x2 - Math.max(40, (x2 - x1) / 2)} ${y2} ${x2 - 2} ${y2}`
        : `M${x1} ${y1} C${x1} ${y1 + (ang > 0 ? 60 : -60)} ${x2} ${y2 - (ang > 0 ? 60 : -60)} ${x2} ${y2}`;
      const text = e.thread ? 'spawns thread' : e.nums.join(' · ');
      return { d, thread: e.thread, from: e.from, to: e.to, label: { x: (x1 + x2) / 2, y: (y1 + y2) / 2, text, thread: e.thread }, head: { x: ang === 0 ? x2 - 2 : x2, y: y2, ang } };
    }));
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
      return { key: `${file}#${f.line}`, item, file, name: f.name, startLine: f.line, text: text.slice(f.line, f.endLine + 1).join('\n'), fromRanges: [], std: false, num: f.num } as CardData & { num: string };
    }));
  }));

  // ---- pan and zoom ----
  let drag: { x: number; y: number; vx: number; vy: number } | null = null;
  const onDown = (e: MouseEvent) => { if ((e.target as HTMLElement).closest('.fbox')) return; drag = { x: e.clientX, y: e.clientY, vx: view().x, vy: view().y }; canvas.classList.add('drag'); };
  const onMove = (e: MouseEvent) => { if (drag) setView({ ...view(), x: drag.vx + e.clientX - drag.x, y: drag.vy + e.clientY - drag.y }); };
  const onUp = () => { drag = null; canvas.classList.remove('drag'); };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const v = view();
    if (e.ctrlKey || e.metaKey) {
      const r = canvas.getBoundingClientRect(), k = Math.min(2.5, Math.max(0.3, v.k * Math.exp(-e.deltaY / 400)));
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      setView({ k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k });
    } else setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
  };

  const touches = (r: Routed) => { const f = hover() ?? sel(); return !f || r.from === f || r.to === f; };
  const run = (b: FlowBox) => b.fns.filter((f) => f.num).length;
  const reduce = () => !!settings()['motion.reduce'];

  return (
    <div class="body" style={{ height: '100%' }}>
      <div class="pane" style={{ flex: 1 }}>
        <div class="ph" style={{ padding: '0 22px' }}><span>{status()}</span><span class="grow" /><button class="chip" onClick={rebuild}>refresh</button><button class="chip" onClick={() => { const g = graph(); if (g) layout(g); }}>fit</button></div>
        <div class="flow" ref={canvas} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onWheel={onWheel}>
          <div style={{ position: 'absolute', left: 0, top: 0, 'transform-origin': '0 0', transform: `translate(${view().x}px, ${view().y}px) scale(${view().k})` }}>
            <svg width="4000" height="3000" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
              <For each={routes()}>{(r) => (
                <g opacity={touches(r) ? 1 : 0.25}>
                  <path d={r.d} fill="none" stroke={touches(r) && (hover() || sel()) ? 'var(--accent)' : '#5f665f'} stroke-width="1.5" stroke-dasharray={r.thread ? '5 4' : undefined} />
                  <path d="M0 0 L-9 -5 L-9 5 Z" transform={`translate(${r.head.x} ${r.head.y}) rotate(${r.head.ang})`} fill={touches(r) && (hover() || sel()) ? 'var(--accent)' : '#5f665f'} />
                </g>
              )}</For>
            </svg>
            <For each={routes()}>{(r) => <div class="flab" classList={{ t: r.thread }} style={{ left: `${r.label.x}px`, top: `${r.label.y}px`, opacity: touches(r) ? 1 : 0.25 }}>{r.label.text}</div>}</For>
            <Show when={placed().some((p) => p.box.dead)}>
              <div class="sub" style={{ position: 'absolute', 'white-space': 'nowrap', left: `${Math.min(...placed().filter((p) => p.box.dead).map((p) => p.x))}px`, top: `${Math.min(...placed().filter((p) => p.box.dead).map((p) => p.y)) - 30}px` }}>not reached from any entry point</div>
            </Show>
            <For each={placed()}>{(p, i) => (
              <div class="fbox" classList={{ dead: p.box.dead, on: sel() === p.box.file }}
                style={{ left: `${p.x}px`, top: `${p.y}px`, width: `${BW}px`, height: `${BH}px`, animation: reduce() ? 'none' : `fadeUp .45s cubic-bezier(.16,1,.3,1) ${i() * 60}ms backwards` }}
                onMouseEnter={() => setHover(p.box.file)} onMouseLeave={() => setHover(null)}
                onClick={() => setSel(sel() === p.box.file ? null : p.box.file)}>
                <Show when={p.box.entries.length}><span class="start">{p.box.entries.length > 1 ? `start ▸ ${p.box.entries.length}` : 'start ▸'}</span></Show>
                <Show when={p.box.thread}><span class="tag">thread</span></Show>
                <div class="t">{shortName(root(), p.box.file)}</div>
                <div class="s">{p.box.fns.length} functions · {p.box.dead ? 'none run' : `${run(p.box)} run`}</div>
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
          <Show when={!placed().length}><div class="empty" style={{ position: 'absolute', inset: 0 }}>{lspState() === 'ready' ? status() || 'building…' : 'open a folder to see how it runs'}</div></Show>
        </div>
      </div>
      <div class="pane prev" style={{ width: '440px', flex: 'none' }}>
        <Show when={sel()} fallback={<div class="empty">click a box to see what’s inside</div>}>
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
