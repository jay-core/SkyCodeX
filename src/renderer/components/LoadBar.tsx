import { Show, createEffect, createMemo, createSignal, onCleanup, on } from 'solid-js';
import { loadInputs, settlePass, retrying, entries, load } from '../lib/flowstore';
import { indexProgress } from '../lib/lsp';
import { ARROW_PERIOD, PART_MEANINGS, PART_NAMES, ease, grid, dotX, dotY, level, parts, ready, type BarPart, type Grid } from '../lib/loadbar';

const PARTS = 5, GAP = 6, R = 0.55, SPACE = 2.3, DIM = '#2b2f2b', HOVER = '#454b45', LIT = '#e3d6ad';
const WORD = { wait: 'waiting', run: 'running', done: 'done' } as const;

function countLine(k: number, p: BarPart): string {
  const l = load(), ix = indexProgress();
  if (k === 0) return p.state === 'done' ? `${entries().length} entry points found.` : p.state === 'run' ? 'No count is known in advance, so an arrow moves across while it runs.' : 'Starts when clangd is ready.';
  if (k === 1) return p.state === 'run' ? (ix?.of ? `Files ${ix.done ?? 0} of ${ix.of}, as clangd reports them.` : ix?.pct != null ? `${ix.pct} %, as clangd reports it.` : 'clangd gives no count yet.') : p.state === 'done' ? 'clangd has nothing left to index.' : 'Waiting for clangd to start.';
  if (k === 2) return p.state === 'run' ? `${l.trace.done ?? 0} functions so far; the total is known only when this pass ends.` : p.state === 'done' && l.trace.done != null ? `${l.trace.done} functions.` : 'Starts after the entry points are found.';
  if (k === 3) return p.state === 'run' ? (l.read.of ? `${l.read.done ?? 0} of ${l.read.of} read.` : 'Starting.') : p.state === 'done' && l.read.of ? `${l.read.of} read.` : 'Starts after the trace.';
  return p.state === 'run' ? (retrying() ? 'Some calls were not resolved yet; trying again in 2 s.' : `Pass ${settlePass()}; stops after 60 s at most.`) : p.state === 'done' ? 'The trace is stable.' : 'Runs only when a pass finds calls not yet listed.';
}

export default function LoadBar() {
  const target = createMemo(() => parts(loadInputs()));
  const done = createMemo(() => ready(loadInputs()));
  const [shown, setShown] = createSignal(!done());
  const [hover, setHover] = createSignal<number | null>(null);
  const [tipAt, setTipAt] = createSignal<{ left: number; top: number } | null>(null);
  let cv!: HTMLCanvasElement, tip: HTMLDivElement | undefined, frame = 0, last = 0, t0 = performance.now();
  const fills: (number | null)[] = Array(PARTS).fill(null);
  createEffect(on(done, (d) => { if (!d) setShown(true); }));
  const calm = () => document.documentElement.classList.contains('calm');
  const grids = (w: number, h: number): Grid[] => { const pw = (w - GAP * (PARTS - 1)) / PARTS; return Array.from({ length: PARTS }, (_, k) => grid(k * (pw + GAP), k * (pw + GAP) + pw, h, R, SPACE)); };
  const paint = (now: number) => {
    frame = 0;
    if (!cv?.isConnected) return;
    const w = cv.clientWidth, h = cv.clientHeight, dpr = window.devicePixelRatio || 1;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d')!, ms = last ? now - last : 0, still = calm(), ps = target();
    last = now;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    let more = false;
    const phase = still ? 0.6 : (now - t0) / ARROW_PERIOD;
    grids(w, h).forEach((gr, k) => {
      const want = ps[k].fill;
      fills[k] = want == null ? null : fills[k] == null ? want : ease(fills[k]!, want, still ? 1e9 : ms);
      if (want != null && fills[k] !== want) more = true;
      if (ps[k].state === 'run' && want == null && !still) more = true;
      const part: BarPart = { state: ps[k].state, fill: fills[k] };
      for (let c = 0; c <= gr.cols; c++) for (let r = 0; r <= gr.rows; r++) {
        const x = dotX(gr, c), y = dotY(gr, r), a = level(gr, part, x, y, phase);
        g.fillStyle = hover() === k ? HOVER : DIM;
        g.beginPath(); g.arc(x, y, R, 0, 7); g.fill();
        if (a > 0.004) { g.globalAlpha = a; g.fillStyle = LIT; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill(); g.globalAlpha = 1; }
      }
    });
    if (more) frame = requestAnimationFrame(paint); else last = 0;
  };
  const kick = () => { if (!frame) frame = requestAnimationFrame(paint); };
  createEffect(on([target, hover, shown], kick));
  onCleanup(() => { cancelAnimationFrame(frame); frame = 0; });
  const partAt = (x: number) => { const pw = (cv.clientWidth - GAP * (PARTS - 1)) / PARTS, k = Math.floor(x / (pw + GAP)); return k >= 0 && k < PARTS && x - k * (pw + GAP) <= pw ? k : null; };
  const place = (k: number) => {
    const r = cv.getBoundingClientRect(), pw = (r.width - GAP * (PARTS - 1)) / PARTS, bw = tip?.offsetWidth ?? 0, bh = tip?.offsetHeight ?? 0;
    const left = Math.max(8, Math.min(r.left + k * (pw + GAP), window.innerWidth - bw - 8));
    const below = r.bottom + 6, top = below + bh + 8 > window.innerHeight ? Math.max(8, r.top - 6 - bh) : below;
    setTipAt({ left, top });
  };
  createEffect(on([hover, target], () => { const k = hover(); if (k == null) { setTipAt(null); return; } requestAnimationFrame(() => { if (hover() === k) place(k); }); }));
  return (
    <Show when={shown()}>
      <span class="lbar" classList={{ out: done() }} onTransitionEnd={(e) => { if (e.propertyName === 'opacity' && done()) setShown(false); }}>
        <canvas ref={cv} aria-hidden="true" onPointerMove={(e) => setHover(partAt(e.offsetX))} onPointerLeave={() => setHover(null)} />
        <Show when={hover() != null}>
          <div class="lbartip" ref={tip} role="tooltip" style={{ left: `${tipAt()?.left ?? -9999}px`, top: `${tipAt()?.top ?? -9999}px` }}>
            <div class="lbt"><b>{PART_NAMES[hover()!]}</b> · {WORD[target()[hover()!].state]}</div>
            <div>{PART_MEANINGS[hover()!]}</div>
            <div>{countLine(hover()!, target()[hover()!])}</div>
          </div>
        </Show>
      </span>
    </Show>
  );
}
