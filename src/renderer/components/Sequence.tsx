// The sequence view, the flow page's default: the run of one entry point, time going down, one row per call.
// The selected step opens as a box on rows of its own; back and next are marked on their rows; the last steps keep a
// fading warmth; loops are teal frames with their label in a slot of its own; the spine on the right is the whole run.
// Every position comes from layoutSeq (src/shared/flowseq.ts), which never lets two rows or labels share space.
import { For, Show, createSignal, createMemo, createEffect, on, onMount, onCleanup, JSX } from 'solid-js';
import { seq, trail, setTrail, runStatus, status } from '../lib/flowstore';
import { move, Move, layoutSeq, stepFacts, embers, loopsAt, leadingComment, ownFrames, stepWays, StepState, Fact } from '../../shared/flowseq';
import type { RunFrame } from '../../shared/flowrun';
import { settings } from '../lib/store';
import { basename } from '../lib/api';
import { lines, textTick } from '../lib/seqtext';
import StepPreview, { openStep } from './StepPreview';

const ROW = 23, SLOT = 15, TOP = 30, SPINE = 16;


/** The keys, as the ? overlay lists them. */
const KEYS: [string, string][] = [
  ['→ / ←', 'next step / back along the path walked'], ['⇧ →', 'step over: skip what runs inside'], ['↑', 'step out: finish this function'],
  ['R', 'another pass of the loop'], ['L', 'leave the loop'], ['⇧ ←', 'previous pass'], [']  [', 'next / previous call in the same function'],
  ['Home / End', 'start / end of the run'], ['G', 'go to a step number'], ['Enter', 'open the code at this step'], ['Space', 'play; again to pause'],
  ['+ / −', 'play faster / slower'], ['Tab', 'switch to the boxes view'], ['?', 'this list'],
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
  const reduce = () => !!settings()['motion.reduce'];

  const S = () => seq();
  const cur = (): StepState | undefined => trail()[trail().length - 1];
  const N = () => S()?.items.length ?? 0;
  const R = () => S()!.run.rows;
  const rowOf = (it: number) => R()[S()!.items[it]];
  const atEnd = () => (cur()?.at ?? 0) >= N();

  const geom = createMemo(() => {
    const s = S(), c = cur();
    if (!s || !c) return null;
    return layoutSeq(s, c.at, { width: width() - SPINE, rowH: ROW, slotH: SLOT, top: TOP, boxH: c.at < s.items.length ? boxH() : 0 });
  });
  const scroll = createMemo(() => {
    const g = geom(), c = cur();
    if (!g || !c) return 0;
    const target = g.y[c.at] - height() * 0.36;
    return Math.max(0, Math.min(target + manual(), g.height + 120 - height()));
  });
  // only what is near the viewport is drawn: a run of any size stays fast
  const visible = createMemo(() => {
    const g = geom();
    if (!g) return [] as number[];
    const lo = scroll() - 400, hi = scroll() + height() + 400, out: number[] = [];
    let a = 0, b = N() - 1;
    while (a < b) { const m = (a + b) >> 1; if (g.y[m] + g.h[m] < lo) a = m + 1; else b = m; }
    for (let i = a; i < N() && g.y[i] <= hi; i++) out.push(i);
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
  /** Notes a row carries itself: the conditions that start at it (loops have their own label slot instead). */
  const notes = (it: number) => {
    const s = S()!, r = rowOf(it), out: string[] = [];
    for (const f of ownFrames(s.run, s.items[it])) {
      const sp = s.span.get(f);
      if (!sp || sp[0] !== it) continue;
      const fr = s.run.frames[f];
      if (fr.kind !== 'loop') out.push(rowNote(fr));
    }
    if (r.unsequenced) out.push('order: compiler’s choice');
    if (r.approx) out.push('~ in a macro');
    return out.join('   ');
  };
  const uses = (it: number) => (S()!.uses.get(S()!.items[it]) ?? []).map((i) => { const r = R()[i]; return `${short(r.name)} ${r.kind === 'step' ? r.n : R()[r.ref!].n}`; }).join(' · ');

  // ---- moves ----
  let capTimer: ReturnType<typeof setTimeout> | undefined;
  function say(c: { key: string; what: string; why: string }) {
    setCaption(c);
    clearTimeout(capTimer);
    capTimer = setTimeout(() => setCaption(null), 2600);
  }
  function go(m: Move, quiet = false) {
    const s = S();
    if (!s || !trail().length) return;
    const r = move(s, trail(), m);
    if (r.note) { say({ key: '', what: r.note, why: '' }); return; }
    setTrail(r.trail);
    setManual(0);
    const c = r.trail[r.trail.length - 1];
    if (!quiet && m !== 'back') say({ key: c.key, what: c.what, why: c.why });
    if (m === 'back') say({ key: '←', what: 'back', why: 'along the path you walked' });
  }

  // play: one step at a strict cadence; any other key stops it
  let timer: ReturnType<typeof setInterval> | undefined;
  createEffect(on([playing, speed], ([p, k]) => {
    clearInterval(timer);
    if (!p) return;
    timer = setInterval(() => { if (atEnd()) { setPlaying(false); return; } go('next', true); }, 900 / k);
  }));
  onCleanup(() => { clearInterval(timer); clearTimeout(capTimer); });

  function onKey(e: KeyboardEvent) {
    if (gotoOpen() || e.metaKey || e.ctrlKey) return;
    const k = e.key, sh = e.shiftKey;
    const map: Record<string, Move | (() => void)> = {
      ArrowRight: sh ? 'over' : 'next', ArrowLeft: sh ? 'prevPass' : 'back', ArrowUp: 'out',
      ArrowDown: () => say({ key: '↓', what: 'no indirect call here', why: '' }),
      r: 'again', R: 'again', l: 'leave', L: 'leave', ']': 'nextSibling', '[': 'prevSibling', Home: 'home', End: 'end',
      g: () => setGotoOpen(true), G: () => setGotoOpen(true), Enter: () => openHere(), '?': () => setHelp(!help()),
      ' ': () => setPlaying(!playing()), '+': () => setSpeed(Math.min(4, speed() * 1.5)), '=': () => setSpeed(Math.min(4, speed() * 1.5)), '-': () => setSpeed(Math.max(0.25, speed() / 1.5)),
      Escape: () => { setHelp(false); setPlaying(false); },
    };
    if (k === 'ArrowDown' && cur() && !atEnd() && rowOf(cur()!.at).kind === 'indirect') { say({ key: '↓', what: 'step into', why: 'where it goes is known only at run time' }); e.preventDefault(); return; }
    if (k === 'Tab') return;   // the flow page switches views (components/Flow.tsx)
    const a = map[k];
    if (!a) return;
    e.preventDefault();
    if (k !== ' ' && k !== '+' && k !== '=' && k !== '-') setPlaying(false);
    if (typeof a === 'function') a(); else go(a);
  }
  const openHere = openStep;


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
  createEffect(on([geom, () => cur()?.at, height], () => drawSpine()));

  function drawSpine() {
    const s = S(), c = cur(), el = spineEl;
    if (!el || !s) return;
    const H = Math.max(1, height() - 16), dpr = window.devicePixelRatio || 1;
    el.width = 7 * dpr; el.height = H * dpr;
    const x = el.getContext('2d')!;
    x.scale(dpr, dpr);
    x.clearRect(0, 0, 7, H);
    const n = s.items.length;
    for (let i = 0; i < n; i++) {
      const y = Math.round((i / Math.max(1, n)) * (H - 6)) + 3;
      x.fillStyle = loopsAt(s, i).length ? '#355a5a' : '#3a3f3a';
      x.fillRect(2, y, 3, 1);
    }
    if (c) {
      const y = Math.round((Math.min(c.at, n) / Math.max(1, n)) * (H - 6)) + 3;
      x.fillStyle = '#ad9b6f';
      x.beginPath(); x.arc(3.5, y, 3.5, 0, Math.PI * 2); x.fill();
    }
  }
  const onSpine = (e: MouseEvent) => {
    const r = spineEl.getBoundingClientRect();
    go({ jump: Math.max(0, Math.min(N() - 1, Math.round(((e.clientY - r.top - 3) / Math.max(1, r.height - 6)) * N()))) });
    canvas.focus();
  };

  // ---- the header: where we are ----
  const header = createMemo(() => {
    const s = S(), c = cur();
    if (!s || !c) return null;
    const steps = s.run.rows.filter((r) => r.kind === 'step').length;
    if (c.at >= s.items.length) return { k: `${steps} / ${steps} · end`, loop: '', path: '' };
    const r = s.run.rows[s.items[c.at]];
    const n = r.kind === 'step' ? r.n : r.kind === 'ref' ? s.run.rows[r.ref!].n : r.caller != null ? s.run.rows[r.caller].n : 0;
    const L = loopsAt(s, c.at), inner = L[L.length - 1];
    const f = inner != null ? s.run.frames[inner] : null;
    const loop = f ? `pass ${c.passes[inner] ?? 1}${f.count != null ? ` of ${f.count}` : ''} · ${f.text.length > 34 ? f.text.slice(0, 33) + '…' : f.text}${L.length > 1 ? ` · in ${L.length - 1} more loop${L.length > 2 ? 's' : ''}` : ''}` : '';
    const names: string[] = [];
    for (let i: number | null = s.items[c.at]; i != null && names.length < 3; i = s.run.rows[i].caller) names.unshift(short(s.run.rows[i].name));
    return { k: `${n} / ${steps}`, loop, path: names.join('  ›  ') };
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
  const ways = createMemo(() => (S() ? stepWays(S()!, trail()) : []));

  const frameX = (f: number) => { const g = geom()!, [a, b] = S()!.span.get(f)!; let m = Infinity; for (let i = a; i <= b; i++) m = Math.min(m, g.x[i]); return m - 12; };
  const visFrames = createMemo(() => {
    const s = S(), g = geom();
    if (!s || !g) return [] as number[];
    const lo = scroll() - 400, hi = scroll() + height() + 400;
    return [...s.span.entries()].filter(([f, [a, b]]) => s.run.frames[f].kind === 'loop' && g.y[a] <= hi && g.y[b] + g.h[b] >= lo).map(([f]) => f);
  });
  const visBars = createMemo(() => visible().filter((it) => S()!.lastItem[it] > it));
  const hotFrame = (f: number) => { const c = cur(), sp = S()!.span.get(f)!; return !!c && c.at >= sp[0] && c.at <= sp[1]; };
  const laneOf = (it: number) => { const r = rowOf(it); return r.kind === 'step' || r.kind === 'ref' ? r.file : r.caller != null ? R()[r.caller].file : r.file; };
  const arrows = createMemo(() => {
    const g = geom(), s = S();
    if (!g || !s || g.mode !== 'files') return [] as number[];
    return visible().filter((it) => { const r = rowOf(it); return r.caller != null && laneOf(s.itemOf[r.caller]) !== laneOf(it); });
  });

  return (
    <div class="body" style={{ height: '100%' }}>
      <div class="pane" style={{ flex: 1 }}>
        <div class="ph" style={{ padding: '0 22px' }}>
          <Show when={header()} fallback={<span>{runStatus() || status()}</span>}>
            <span class="seqk">{header()!.k}</span>
            <Show when={header()!.loop}><span class="seqloop">{header()!.loop}</span></Show>
            <span class="seqpath">{header()!.path}</span>
          </Show>
          <span class="grow" />
          <Show when={header() && runStatus()}><span class="sub">{runStatus()}</span></Show>
          <Show when={playing()}><span class="sub">playing · {speed() === 1 ? '1×' : `${Math.round(speed() * 100) / 100}×`}</span></Show>
          {props.switcher}
        </div>
        <div class="seqv" classList={{ still: reduce() }} ref={canvas} tabindex="0" role="application" aria-label="the run, one step per row"
          onKeyDown={onKey} onWheel={(e) => { e.preventDefault(); setManual(manual() + e.deltaY); }}>
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
              <For each={visible()}>{(it) => {
                const r = () => rowOf(it);
                const e = () => ember().indexOf(it);
                const sel = () => cur()?.at === it;
                const tag = () => (sel() ? '' : it === prevAt() ? '← back' : it === nextAt() ? (nextIsReturn() ? `next → · back in ${short(nextIsReturn())}` : 'next →') : '');
                return (
                  <div class={`srow k-${r().kind}`} classList={{ sel: sel(), near: !!tag(), [`e${e() + 1}`]: e() >= 0 && !sel(), far: !sel() && !tag() && e() < 0 && !chain().has(S()!.items[it]), thread: r().thread }}
                    style={{ left: `${geom()!.x[it]}px`, top: `${geom()!.y[it]}px`, width: `${Math.max(60, width() - SPINE - geom()!.x[it] - 10)}px` }}
                    onClick={() => { go({ jump: it }); canvas.focus(); }}>
                    <span class="n">{num(it)}</span>
                    <span class="nm">{r().kind === 'indirect' ? r().text : short(r().name)}</span>
                    <Show when={!sel() && geom()!.mode === 'depth' && (r().kind === 'step' || r().kind === 'ref')}><span class="loc">{basename(r().file)}</span></Show>
                    <Show when={sel() && (r().kind === 'step' || r().kind === 'ref')}><span class="loc">{basename(r().file)}:{r().line + 1}</span></Show>
                    <Show when={r().kind === 'indirect'}><span class="nt">{r().via}</span></Show>
                    <Show when={r().kind === 'value'}><span class="nt">named, not called</span></Show>
                    <Show when={notes(it)}><span class="nt">{notes(it)}</span></Show>
                    <Show when={!sel() && uses(it)}><span class="u">uses {uses(it)}</span></Show>
                    <Show when={tag()}><span class="tag">{tag()}</span></Show>
                  </div>
                );
              }}</For>
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
                    <div class="ways"><For each={ways()}>{([k, w]) => <span><b>{k}</b> {w}</span>}</For></div>
                  </div>
                </div>
              </Show>
            </div>
            <canvas class="sspine" ref={spineEl} style={{ height: `${height() - 16}px` }} onClick={onSpine} />
          </Show>
          <Show when={caption()}><div class="scap"><Show when={caption()!.key}><span class="key">{caption()!.key}</span></Show>{caption()!.what}<Show when={caption()!.why}><span class="why">{caption()!.why}</span></Show></div></Show>
          <Show when={gotoOpen()}>
            <div class="scap"><span class="key">G</span>go to step <input class="sgoto" type="text" inputmode="numeric" ref={(el) => setTimeout(() => el.focus())}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { const n = Number((e.target as HTMLInputElement).value); setGotoOpen(false); if (n) go({ goto: n }); canvas.focus(); } if (e.key === 'Escape') { setGotoOpen(false); canvas.focus(); } }} /></div>
          </Show>
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
