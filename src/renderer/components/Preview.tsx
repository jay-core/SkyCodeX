import { For, Index, Show, createEffect, createMemo, on, onMount, onCleanup, createSignal } from 'solid-js';
import { levels, setLevels, win, setWin, setMainFn, focusCard, prepareShiftRight, shiftHome, canShift, busy, mainFn, Level, cardLoc } from '../lib/preview';
import { afterPaint, onScreen } from '../lib/motion';
import Card, { cardViews, cardCursor } from './Card';
import { PAL, Link, linkSvg, curveSvg, edgeStub } from '../lib/lines';
import { getMainView, settings, cursorPos, root, files } from '../lib/store';
import { api } from '../lib/api';
import { posToOffset } from '../lib/cm';
import { lspState, lspMessage, indexing } from '../lib/lsp';

const EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)', IN = 'cubic-bezier(0.55, 0, 1, 0.45)';
const stored = (k: string, d: number) => { try { const v = Number(localStorage.getItem(k)); return v > 0 ? v : d; } catch { return d; } };
const store = (k: string, v: number) => { try { localStorage.setItem(k, String(v)); } catch { /* not kept */ } };
const MIN_COL = 170;
const IDX_W = 34;   // the call index: a thin column of colour squares
const STUBS = 4;   // labelled stubs per column edge for cards scrolled out of view

/** A drag handle inside the preview; reports horizontal movement. */
function Handle(props: { left: number; onDrag: (dx: number) => void; onEnd: () => void }) {
  const down = (e: MouseEvent) => {
    e.preventDefault();
    let last = e.clientX;
    const el = e.currentTarget as HTMLElement;
    el.classList.add('drag');
    const move = (m: MouseEvent) => { props.onDrag(m.clientX - last); last = m.clientX; };
    const up = () => { el.classList.remove('drag'); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); props.onEnd(); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };
  return <div class="psplit" style={{ left: `${props.left - 3}px` }} onMouseDown={down} />;
}

export default function Preview(props: { overlay: () => SVGSVGElement | undefined; bodyEl: () => HTMLElement | undefined; codeEl: () => HTMLElement | undefined; registerRedraw: (f: () => void) => void }) {
  let area!: HTMLDivElement;
  const cols: HTMLDivElement[] = [];
  const ix: HTMLDivElement[] = [];
  const [tip, setTip] = createSignal<{ k: number; y: number } | null>(null);
  // widths: the call index, then two card columns split by a ratio; both handles are draggable
  const [areaW, setAreaW] = createSignal(800);
  const [frac, setFrac] = createSignal(stored('litho.preview.split', 0.5));
  const IDX = () => IDX_W;
  const cardsW = () => Math.max(2 * MIN_COL, areaW() - IDX());
  const w1 = () => Math.round(Math.min(cardsW() - MIN_COL, Math.max(MIN_COL, cardsW() * frac())));
  const w2 = () => cardsW() - w1();
  const slotX = (s: number) => (s <= 0 ? s * w1() : w1() + (s - 1) * w2());
  const slotW = (s: number) => (s <= 0 ? w1() : w2());
  const ro = new ResizeObserver(() => { setAreaW(area.clientWidth); redraw(); });
  onMount(() => { ro.observe(area); props.registerRedraw(redraw); });
  onCleanup(() => { ro.disconnect(); cancelAnimationFrame(raf); });

  let raf = 0;
  function redraw() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  }

  function draw() {
    const svg = props.overlay(), body = props.bodyEl();
    if (!svg || !body || !area.isConnected) return;   // hidden preview: the editor may still ask for a redraw
    const br = body.getBoundingClientRect();
    const links: Link[] = [];
    let curves = '';
    const stack = new Map<string, number>();
    const ls = levels(), w = win();
    const ar = area.getBoundingClientRect();
    const colRect = (i: number) => cols[i]?.getBoundingClientRect();
    for (let c = 0; c < 2; c++) {
      const li = w + c, lv = ls[li];
      if (!lv) continue;
      const cr = colRect(li);
      if (!cr || cr.left >= ar.right - 2 || cr.right <= ar.left + 2) continue;
      if (c === 0) {
        // left column: call site → its name in the index → the card's colour dot
        const v = li === 0 ? getMainView() : null, code = props.codeEl();
        const scroller = v?.scrollDOM.getBoundingClientRect();
        lv.cards.forEach((card, k) => {
          const entry = ix[k];
          if (!entry) return;
          const sq = entry.querySelector('.sq')!.getBoundingClientRect();
          const ey = (sq.top + sq.bottom) / 2 - br.top;
          const head = cols[li]?.querySelector(`[data-card="${li}:${k}"] .card-h`) as HTMLElement | null;
          const hr = head?.getBoundingClientRect();
          const off: 0 | -1 | 1 = !hr ? 1 : hr.bottom < cr.top + 4 ? -1 : hr.top > cr.bottom - 44 ? 1 : 0;
          entry.classList.toggle('off', off !== 0);
          if (!off && head) {
            const sw = head.querySelector('.sw')!.getBoundingClientRect();
            curves += curveSvg(sq.right - br.left + 3, ey, sw.left - br.left - 1, (sw.top + sw.bottom) / 2 - br.top, PAL[k % PAL.length], lit()[0] === k, lit()[0] >= 0 && lit()[0] !== k);
          } else if (off && lit()[0] === k) {
            // the lit card is scrolled out of its column: stay connected, to the edge it went past
            const ex = cr.left - br.left + 22, eyy = off < 0 ? cr.top - br.top + 10 : cr.bottom - br.top - 50;
            curves += curveSvg(sq.right - br.left + 3, ey, ex, eyy, PAL[k % PAL.length], true) + edgeStub(ex, eyy, off, PAL[k % PAL.length], card.name);
          }
          if (!v || !code || !scroller) return;
          for (const r of card.fromRanges) {
            const doc = v.state.doc;
            if (r.end.line >= doc.lines) continue;
            const p = v.coordsAtPos(posToOffset(doc, r.end.line, r.end.character));
            if (!p || p.top < scroller.top || p.bottom > scroller.bottom) continue;
            const endP = v.coordsAtPos(doc.line(r.end.line + 1).to);
            links.push({
              from: { x: p.right - br.left, y: (p.top + p.bottom) / 2 - br.top }, textEnd: (endP?.right ?? p.right) - br.left,
              lead: code.getBoundingClientRect().right - br.left - 6, to: { x: sq.left - br.left - 4, y: ey },
              color: PAL[k % PAL.length], edge: 0, name: card.name, hot: lit()[0] === k, dim: lit()[0] >= 0 && lit()[0] !== k,
            });
          }
        });
        continue;
      }
      // right column: the focused card on the left → the cards it calls
      const prev = ls[li - 1];
      if (prev.focus < 0) continue;
      const srcView: any = cardViews.get(`${li - 1}:${prev.focus}`);
      const pr = colRect(li - 1);
      if (!srcView || !pr) continue;
      const srcLead = pr.right - br.left - 14, lineBase = prev.cards[prev.focus].startLine;
      const scrollerRect = srcView.scrollDOM.getBoundingClientRect();
      const overflow = new Map<number, { x: number; y: number; n: number; name: string; color: string }>();
      lv.cards.forEach((card, k) => {
        const head = cols[li]?.querySelector(`[data-card="${li}:${k}"] .card-h`) as HTMLElement | null;
        if (!head) return;
        const hr = head.getBoundingClientRect();
        const sw = head.querySelector('.sw')!.getBoundingClientRect();
        let y2 = (sw.top + sw.bottom) / 2 - br.top, edge: 0 | -1 | 1 = 0;
        const top = cr.top - br.top + 10, bottom = cr.bottom - br.top - 50;
        // off-screen cards point at the column edge; several of them stack instead of overlapping
        let label = card.name;
        if (y2 < top || y2 > bottom) {
          edge = y2 < top ? -1 : 1;
          const n = stack.get(`${li}:${edge}`) ?? 0;
          stack.set(`${li}:${edge}`, n + 1);
          y2 = edge < 0 ? top + 15 * Math.min(n, STUBS - 1) : bottom - 15 * Math.min(n, STUBS - 1);
          if (n >= STUBS - 1) label = '';
          if (n >= STUBS - 1) overflow.set(edge, { x: hr.left - br.left, y: y2, n: n - STUBS + 2, name: overflow.get(edge)?.name ?? card.name, color: overflow.get(edge)?.color ?? PAL[k % PAL.length] });
        }
        for (const r of card.fromRanges) {
          const doc = srcView.state.doc;
          const line = r.end.line - lineBase;
          if (line < 0 || line >= doc.lines) continue;
          const p = srcView.coordsAtPos(posToOffset(doc, line, r.end.character));
          if (!p || p.top < scrollerRect.top || p.bottom > scrollerRect.bottom || p.right < scrollerRect.left + 30) continue;
          const endP = srcView.coordsAtPos(doc.line(line + 1).to);
          const vis = Math.min(scrollerRect.right, pr.right) - br.left;
          links.push({
            from: { x: Math.min(p.right - br.left, vis), y: (p.top + p.bottom) / 2 - br.top },
            textEnd: Math.min((endP?.right ?? p.right) - br.left, vis), lead: srcLead,
            to: { x: (edge ? hr.left : sw.left - 1) - br.left, y: y2 }, color: PAL[k % PAL.length], edge, name: label, onDot: !edge, hot: lit()[1] === k, dim: lit()[1] >= 0 && lit()[1] !== k,
          });
        }
      });
      for (const [e, o] of overflow) {
        const one = o.n === 1;   // a single extra stub keeps its own name
        curves += edgeStub(o.x, o.y, e, one ? o.color : '#7b8279', one ? o.name : `${o.n} more`);
      }
    }
    svg.setAttribute('width', String(br.width)); svg.setAttribute('height', String(br.height));
    const clipW = ar.right - br.left, clipH = ar.bottom - br.top - 40;
    svg.innerHTML = `<defs><clipPath id="pclip"><rect x="0" y="0" width="${clipW}" height="${clipH}"/></clipPath></defs><g clip-path="url(#pclip)">${linkSvg(links) + curves}</g>`;
  }

  // a new folder starts with empty previews
  createEffect(on(root, () => { setLevels([]); setMainFn(null); setWin(0); }, { defer: true }));

  // ---- shift with the Windows Phone motion: turnstile out, slide over, slide in ----
  let animating = false;
  const reduce = () => !!settings()['motion.reduce'];
  // column widths are held during a shift: a width change re-measures every card editor, which would stall a frame
  const [frozen, setFrozen] = createSignal<Map<number, number> | null>(null);
  const freeze = () => setFrozen(new Map(cols.map((c, li) => [li, c?.offsetWidth ?? 0] as [number, number]).filter(([, w]) => w > 0)));
  const colWidth = (li: number) => frozen()?.get(li) ?? slotW(li - win());
  const turnstile = (els: HTMLElement[], frames: Keyframe[], o: (i: number) => KeyframeAnimationOptions) => els.map((el, i) => el.animate(frames, o(i)));
  async function doShift(dir: 1 | 0) {
    if (animating) return;
    const w = win();
    if (dir === 0 && w === 0) return;
    animating = true;
    const svg = props.overlay(); if (svg) svg.style.opacity = '0';
    try {
      if (dir === 1 && !(await prepareShiftRight())) return;
      freeze();
      await afterPaint();   // the incoming column's editors are mounted and measured before anything moves
      if (reduce()) { setWin(dir === 1 ? w + 1 : 0); return; }
      const anims: Animation[] = [];
      if (dir === 1) {
        const out = cols[w] ? onScreen(cols[w], '.card, .pnote, .more') : [], mid = cols[w + 1], inc = cols[w + 2] ? onScreen(cols[w + 2], '.card, .pnote, .more') : [];
        anims.push(...turnstile(out, [{ transform: 'none', opacity: 1 }, { transform: 'translate3d(-30px,0,0) perspective(900px) rotateY(-80deg)', opacity: 0 }], (i) => ({ duration: 240, delay: i * 30, easing: IN, fill: 'both' })));
        // the outgoing column stays in place while its cards turn away
        if (cols[w]) anims.push(cols[w].animate([{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(0,0,0)' }], { duration: 240 + out.length * 30 }));
        setWin(w + 1);
        if (mid) anims.push(mid.animate([{ transform: `translate3d(${(frozen()?.get(w) ?? w1())}px,0,0)` }, { transform: 'translate3d(0,0,0)' }], { duration: 600, delay: 160, easing: EXPO, fill: 'backwards' }));
        anims.push(...turnstile(inc, [{ transform: 'translate3d(170px,0,0)', opacity: 0 }, { transform: 'none', opacity: 1 }], (i) => ({ duration: 600, delay: 260 + i * 50, easing: EXPO, fill: 'backwards' })));
      } else {
        shiftHome();
        for (const c of [0, 1]) if (cols[c]) anims.push(...turnstile(onScreen(cols[c], '.card, .pnote, .more'), [{ transform: 'translate3d(-170px,0,0)', opacity: 0 }, { transform: 'none', opacity: 1 }],
          (i) => ({ duration: 620, delay: 100 + c * 70 + i * 45, easing: EXPO, fill: 'backwards' })));
      }
      await Promise.allSettled(anims.map((a) => a.finished));
      anims.forEach((a) => a.cancel());   // the turned-out cards sit off screen now; drop their end state
    } finally {
      setFrozen(null);
      animating = false;
      await afterPaint();
      if (svg) { redraw(); svg.style.opacity = '1'; }
    }
  }
  const onKey = (e: KeyboardEvent) => {
    if (!e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === 'ArrowRight' || e.key === ']') { e.preventDefault(); doShift(1); }
    else if (e.key === 'ArrowLeft' || e.key === '[') { e.preventDefault(); doShift(0); }
  };
  onMount(() => window.addEventListener('keydown', onKey));
  onCleanup(() => window.removeEventListener('keydown', onKey));

  // ---- a cursor on a call lights its card in the next column (and its index entry) ----
  // pane 1 follows the main editor's cursor, pane 2 the cursor inside pane 1's focused card;
  // both are derived from the cursors, so scrolling or clicking elsewhere never clears them
  function hitIn(li: number): number {
    const lv = levels()[li];
    if (!lv) return -1;
    let view: any, base = 0;
    if (li === 0) {
      cursorPos();
      view = getMainView();
      if (!view || lv.callerFile !== files.active) return -1;
    } else {
      const prev = levels()[li - 1];
      if (!prev || prev.focus < 0) return -1;
      const cc = cardCursor(), id = `${li - 1}:${prev.focus}`;
      if (cc?.id !== id) return -1;   // no cursor placed in that card yet
      view = cardViews.get(id);
      base = prev.cards[prev.focus].startLine;
      if (!view) return -1;
    }
    const doc = view.state.doc, head = view.state.selection.main.head;
    let hit = -1;
    lv.cards.forEach((c, k) => {
      for (const r of c.fromRanges) {
        const a0 = r.start.line - base, b0 = r.end.line - base;
        if (a0 < 0 || b0 >= doc.lines) continue;
        if (head >= posToOffset(doc, a0, r.start.character) && head <= posToOffset(doc, b0, r.end.character) + 1) hit = k;
      }
    });
    return hit;
  }
  // a clicked square holds its card lit until the next click anywhere else
  const [pinned, setPinned] = createSignal(-1);
  const unpin = (e: MouseEvent) => { if (!(e.target as Element)?.closest?.('.cindex .ix')) setPinned(-1); };
  onMount(() => window.addEventListener('mousedown', unpin, true));
  onCleanup(() => window.removeEventListener('mousedown', unpin, true));
  createEffect(on([win, () => levels()[win()]?.caller], () => setPinned(-1), { defer: true }));
  const lit = createMemo(() => [pinned() >= 0 ? pinned() : hitIn(win()), hitIn(win() + 1)] as const, undefined, { equals: (a, b) => a[0] === b[0] && a[1] === b[1] });
  const isLit = (li: number, k: number) => (li === win() ? lit()[0] === k : li === win() + 1 ? lit()[1] === k : false);
  createEffect(on([levels, win, w1, IDX, lit], () => queueMicrotask(redraw)));
  // a newly lit card glides into view when it is outside its column
  createEffect(on(lit, (now, before) => [0, 1].forEach((c) => {
    const k = now[c];
    if (k < 0 || (before && before[c] === k)) return;
    const col = cols[win() + c], el = col?.querySelector(`[data-card="${win() + c}:${k}"]`) as HTMLElement | null;
    if (!el) return;
    const top = el.offsetTop - 8;
    if (top < col.scrollTop || top + Math.min(el.offsetHeight, 120) > col.scrollTop + col.clientHeight - 40) col.scrollTo({ top, behavior: reduce() ? 'auto' : 'smooth' });
  })));

  function reveal(k: number) {
    const col = cols[win()], el = col?.querySelector(`[data-card="${win()}:${k}"]`) as HTMLElement | null;
    if (!el) return;
    col.scrollTo({ top: el.offsetTop - 8, behavior: reduce() ? 'auto' : 'smooth' });
    el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 900);
  }
  const title = (lv: Level | undefined, i: number) => (lv ? (i === 0 ? lv.caller.name : lv.caller.name) : '');
  const levelCount = () => levels().length;

  return (
    <div class="pane prev" style={{ flex: 1 }} ref={area}>
      <div class="ph" style={{ position: 'absolute', left: 0, right: 0, top: 0, 'z-index': 2, padding: 0 }}>
        <span title="calls in this function" style={{ width: `${IDX()}px`, 'text-align': 'center', 'font-size': '12px', color: '#4f564f', flex: 'none' }}>{levels()[win()]?.cards.length || ''}</span>
        <For each={[0, 1]}>{(c) => (
          <span style={{ width: `${c === 0 ? w1() : w2()}px`, flex: 'none', 'padding-left': '22px', overflow: 'hidden', 'text-overflow': 'ellipsis', color: levels()[win() + c] ? 'var(--bright)' : '#3a3f3a', 'font-size': '18px' }}>
            {title(levels()[win() + c], win() + c) || (c === 0 ? 'preview' : '')}
          </span>
        )}</For>
      </div>
      <Index each={levels()}>{(lv, li) => (
        <div class="pcol" classList={{ haslit: (li === win() && lit()[0] >= 0) || (li === win() + 1 && lit()[1] >= 0) }} ref={(el) => (cols[li] = el)} onScroll={redraw}
          style={{ left: `${IDX()}px`, width: `${colWidth(li)}px`, transform: `translateX(${slotX(li - win())}px)`, visibility: Math.abs(li - win() - 0.5) < 2 ? 'visible' : 'hidden' }}>
          <div class="pcol-in">
            <For each={lv().cards}>{(card, k) => (
              <Card card={card} id={`${li}:${k()}`} color={PAL[k() % PAL.length]} focus={lv().focus === k()} lit={isLit(li, k())} onFocus={() => focusCard(li, k())} onScroll={redraw} />
            )}</For>
            <Show when={lv().more.length}><div class="more">+{lv().more.length} more · {lv().more.slice(0, 4).join(', ')}{lv().more.length > 4 ? '…' : ''}</div></Show>
            <Show when={lv().hidden}><div class="pnote">{lv().hidden} standard-library call{lv().hidden > 1 ? 's' : ''} hidden · <button class="lnk" onClick={() => api.settings.set('preview.include_std', true)}>show</button></div></Show>
            <Show when={!lv().cards.length && !lv().hidden}><div class="pnote">no calls</div></Show>
          </div>
        </div>
      )}</Index>
      <Show when={levelCount() === 1 || (levelCount() > 0 && !levels()[win() + 1])}>
        <div class="empty" style={{ position: 'absolute', left: `${IDX() + w1()}px`, right: 0, top: '36px', bottom: '40px' }}>click into a card<br />to go one level deeper</div>
      </Show>
      <Show when={!levelCount()}>
        <div class="empty" style={{ position: 'absolute', inset: '36px 0 40px 0' }}>
          {lspState() === 'failed' ? lspMessage() : lspState() !== 'ready' ? 'open a folder to start' : busy() ? '…' : mainFn() ? 'no calls in this function' : 'cursor is outside any function\n— nothing to preview'}
          <Show when={indexing()}><div class="sub" style={{ 'margin-top': '10px' }}>{indexing()}</div></Show>
        </div>
      </Show>
      <div class="cindex" style={{ width: `${IDX()}px` }} classList={{ haslit: lit()[0] >= 0 }}>
        <For each={levels()[win()]?.cards ?? []}>{(card, k) => (
          <div class="ix" classList={{ lit: lit()[0] === k() }} style={{ '--c': PAL[k() % PAL.length] }} ref={(el) => (ix[k()] = el)} onClick={() => { setPinned(k()); reveal(k()); }}
            onMouseEnter={(e) => setTip({ k: k(), y: e.currentTarget.getBoundingClientRect().top - area.getBoundingClientRect().top + 11 })} onMouseLeave={() => setTip(null)}>
            <i class="sq" />
          </div>
        )}</For>
      </div>
      <Show when={tip() && levels()[win()]?.cards[tip()!.k]}>{(c) => (
        <div class="ixtip" style={{ left: `${IDX() + 6}px`, top: `${tip()!.y}px`, '--c': PAL[tip()!.k % PAL.length] }}>
          <i class="sq" /><span class="nm">{c().name}</span><span class="loc">{c().std ? 'standard library' : cardLoc(c())}</span>
        </div>
      )}</Show>
      <Show when={levelCount()}>
        <Handle left={IDX() + w1()} onDrag={(dx) => setFrac(Math.max(0.15, Math.min(0.85, (w1() + dx) / cardsW())))} onEnd={() => store('litho.preview.split', frac())} />
      </Show>
      <div class="shiftbar">
        <button disabled={win() === 0} onClick={() => doShift(0)}>‹ source</button>
        <span style={{ 'font-size': '12.5px', color: '#3a3f3a' }}>{levelCount() ? `levels ${win() + 1}–${win() + 2}` : ''}</span>
        <span style={{ flex: 1 }} />
        <button onClick={() => api.settings.set('preview.include_std', !settings()['preview.include_std'])}>{settings()['preview.include_std'] ? 'hide std calls' : 'show std calls'}</button>
        <button disabled={!canShift()} onClick={() => doShift(1)}>shift preview ›</button>
      </div>
    </div>
  );
}
