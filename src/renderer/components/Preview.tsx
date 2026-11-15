import { For, Index, Show, createEffect, createMemo, on, onMount, onCleanup, createSignal } from 'solid-js';
import { levels, setLevels, win, setWin, setMainFn, focusCard, prepareShiftRight, shiftHome, canShift, busy, mainFn, Level, rebuildLevels, measureDepth, clearDepths, remeasureDepths, unresolvedCard } from '../lib/preview';
import { afterPaint, onScreen } from '../lib/motion';
import Card, { cardViews, cardCursor } from './Card';
import { pal, Link, linkSvg } from '../lib/lines';
import { showCallMarks, CallMark } from '../lib/callmarks';
import { EditorView } from '@codemirror/view';
import { getMainView, settings, cursorPos, root, files } from '../lib/store';
import { api } from '../lib/api';
import { posToOffset } from '../lib/cm';
import { lspState, lspMessage, indexing, indexEpoch } from '../lib/lsp';
import { t } from '../lib/i18n';

const EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)', IN = 'cubic-bezier(0.55, 0, 1, 0.45)';
const stored = (k: string, d: number) => { try { const v = Number(localStorage.getItem(k)); return v > 0 ? v : d; } catch { return d; } };
const store = (k: string, v: number) => { try { localStorage.setItem(k, String(v)); } catch {  } };
const MIN_COL = 170;
const firstOther = (lv: Level | undefined) => lv?.cards.findIndex((c) => c.kind !== 'call') ?? -1;

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
  const [areaW, setAreaW] = createSignal(800);
  const [frac, setFrac] = createSignal(stored('litho.preview.split', 0.5));
  const cardsW = () => Math.max(2 * MIN_COL, areaW());
  const w1 = () => Math.round(Math.min(cardsW() - MIN_COL, Math.max(MIN_COL, cardsW() * frac())));
  const w2 = () => cardsW() - w1();
  const slotX = (s: number) => (s <= 0 ? s * w1() : w1() + (s - 1) * w2());
  const slotW = (s: number) => (s <= 0 ? w1() : w2());
  const [headH, setHeadH] = createSignal(0), [barH, setBarH] = createSignal(0);
  let headEl!: HTMLDivElement, barEl!: HTMLDivElement;
  const ro = new ResizeObserver(() => { setAreaW(area.clientWidth); setHeadH(headEl.offsetHeight); setBarH(barEl.offsetHeight); redraw(); });
  onMount(() => { ro.observe(area); ro.observe(headEl); ro.observe(barEl); props.registerRedraw(redraw); });
  onCleanup(() => { ro.disconnect(); cancelAnimationFrame(raf); });

  let raf = 0;
  function redraw() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  }

  function sourceOf(li: number): { view: EditorView; base: number } | null {
    const ls = levels(), lv = ls[li];
    if (!lv) return null;
    if (li === 0) { const v = getMainView(); return v && lv.callerFile === files.active ? { view: v, base: 0 } : null; }
    const prev = ls[li - 1];
    if (!prev || prev.focus < 0) return null;
    const v = cardViews.get(`${li - 1}:${prev.focus}`);
    return v ? { view: v, base: prev.cards[prev.focus].startLine } : null;
  }
  let marked = new Set<EditorView>();
  function markCalls() {
    const now = new Set<EditorView>();
    levels().forEach((lv, li) => {
      const src = sourceOf(li);
      if (!src) return;
      const doc = src.view.state.doc, marks: CallMark[] = [];
      lv.cards.forEach((card, k) => {
        for (const r of card.fromRanges) {
          const a0 = r.start.line - src.base, b0 = r.end.line - src.base;
          if (a0 < 0 || b0 >= doc.lines) continue;
          marks.push({ from: posToOffset(doc, a0, r.start.character), to: posToOffset(doc, b0, r.end.character), color: pal(k), id: `${li}:${k}` });
        }
      });
      showCallMarks(src.view, marks);
      now.add(src.view);
    });
    for (const v of marked) if (!now.has(v) && v.dom.isConnected) showCallMarks(v, []);
    marked = now;
    redraw();
  }
  createEffect(on([levels, win, () => files.active, () => pal(0) + pal(1) + pal(2) + pal(3) + pal(4) + pal(5) + pal(6) + pal(7)], () => afterPaint().then(markCalls)));

  type Hit = { li: number; k: number; el: HTMLElement };
  const [hover, setHover] = createSignal<Hit | null>(null);
  const [stuck, setStuck] = createSignal<Hit | null>(null);
  const callAt = (t: EventTarget | null) => {
    const el = (t as Element | null)?.closest?.('.callbox') as HTMLElement | null;
    const id = el?.dataset.call?.split(':').map(Number);
    return el && id && id.length === 2 ? { li: id[0], k: id[1], el } : null;
  };
  const onOver = (e: MouseEvent) => { const c = callAt(e.target); const h = hover(); if (c?.el !== h?.el) { setHover(c); redraw(); } };
  const onClick = async (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey) return;
    const c = callAt(e.target);
    if (!c) return;
    if (c.li === win() + 2) { await doShift(1); await afterPaint(); }
    const col = c.li - win();
    if (col !== 0 && col !== 1) return;
    pin(col, c.k);
    setStuck(c);
    reveal(col, c.k);
    const card = levels()[c.li]?.cards[c.k];
    if (card) measureDepth(card);
  };
  onMount(() => { window.addEventListener('mouseover', onOver); window.addEventListener('click', onClick); });
  onCleanup(() => { window.removeEventListener('mouseover', onOver); window.removeEventListener('click', onClick); });
  createEffect(on(root, () => clearDepths(), { defer: true }));

  function connector(h: Hit, br: DOMRect, ar: DOMRect): string {
    if (!h.el.isConnected || !levels()[h.li]) return '';
    const col = cols[h.li], cr = col?.getBoundingClientRect();
    const view = EditorView.findFromDOM(h.el.closest('.cm-editor') as HTMLElement);
    const r = h.el.getBoundingClientRect();
    const pane = view?.scrollDOM.getBoundingClientRect(), holder = h.el.closest('.pcol')?.getBoundingClientRect();
    const seen = !!pane && r.top >= pane.top - 1 && r.bottom <= pane.bottom + 1 && r.right > pane.left && r.left < pane.right
      && (!holder || (r.top >= holder.top - 1 && r.bottom <= holder.bottom + 1));
    if (!cr || !view || !pane || !seen || cr.right <= ar.left + 2 || cr.left >= ar.right - 2) return '';
    const pos = view.posAtDOM(h.el), end = view.coordsAtPos(view.state.doc.lineAt(pos).to);
    const head = col.querySelector(`[data-card="${h.li}:${h.k}"] .card-h`) as HTMLElement | null, hr = head?.getBoundingClientRect();
    const edge: 0 | -1 | 1 = !hr ? 1 : hr.bottom < cr.top + 4 ? -1 : hr.top > cr.bottom - barH() - 4 ? 1 : 0;
    const sw = head?.querySelector('.sw')?.getBoundingClientRect(), padL = parseFloat(getComputedStyle(col.firstElementChild as Element).paddingLeft) || 0;
    const to = edge || !sw ? { x: cr.left - br.left + padL, y: edge < 0 ? cr.top - br.top + 10 : cr.bottom - br.top - barH() - 10 } : { x: sw.left - br.left - 1, y: (sw.top + sw.bottom) / 2 - br.top };
    const vis = Math.min(pane.right, ar.right) - br.left;
    const link: Link = {
      from: { x: Math.min(r.right - br.left, vis), y: (r.top + r.bottom) / 2 - br.top }, textEnd: Math.min((end?.right ?? r.right) - br.left, vis),
      lead: Math.max(Math.min(pane.right, cr.left) - br.left - 6, r.right - br.left + 4), to, color: pal(h.k), edge, name: levels()[h.li].cards[h.k]?.name ?? '', hot: true, onDot: !edge, maxX: ar.right - br.left,
    };
    return linkSvg([link]);
  }

  function draw() {
    const svg = props.overlay(), body = props.bodyEl();
    if (!svg || !body || !area.isConnected) return;
    const br = body.getBoundingClientRect(), ar = area.getBoundingClientRect();
    svg.setAttribute('width', String(br.width)); svg.setAttribute('height', String(br.height));
    const st = stuck(), h = hover();
    let out = st ? connector(st, br, ar) : '';
    if (h && h.el !== st?.el) out += connector(h, br, ar);
    const clipW = ar.right - br.left, clipH = ar.bottom - br.top - barH();
    svg.innerHTML = `<defs><clipPath id="pclip"><rect x="0" y="0" width="${clipW}" height="${clipH}"/></clipPath></defs><g clip-path="url(#pclip)">${out}</g>`;
  }

  createEffect(on(() => ['preview.include_std', 'preview.include_other', 'preview.max_cards'].map((k) => String(settings()[k])).join('|'), () => {
    const p = cursorPos();
    if (files.active && levels().length) rebuildLevels(files.active, { line: p.line - 1, character: p.col - 1 });
  }, { defer: true }));
  createEffect(on(indexEpoch, () => {
    const p = cursorPos();
    if (files.active && levels().some((l) => l.cards.some(unresolvedCard))) rebuildLevels(files.active, { line: p.line - 1, character: p.col - 1 });
    void remeasureDepths();
  }, { defer: true }));
  createEffect(on(root, () => { setLevels([]); setMainFn(null); setWin(0); }, { defer: true }));

  let animating = false;
  const reduce = () => !!settings()['motion.reduce'];
  const [frozen, setFrozen] = createSignal<Map<number, number> | null>(null);
  const freeze = () => setFrozen(new Map(cols.map((c, li) => [li, c?.offsetWidth ?? 0] as [number, number]).filter(([, w]) => w > 0)));
  const colWidth = (li: number) => frozen()?.get(li) ?? slotW(li - win());
  const turnstile = (els: HTMLElement[], frames: Keyframe[], o: (i: number) => KeyframeAnimationOptions) => els.map((el, i) => el.animate(frames, o(i)));
  async function doShift(dir: 1 | 0 | -1) {
    if (animating) return;
    const w = win();
    if (dir !== 1 && w === 0) return;
    animating = true;
    const svg = props.overlay(); if (svg) svg.style.opacity = '0';
    try {
      if (dir === 1 && !(await prepareShiftRight())) return;
      freeze();
      await afterPaint();
      if (reduce()) { setWin(dir === 1 ? w + 1 : dir === -1 ? w - 1 : 0); return; }
      const anims: Animation[] = [];
      if (dir === 1) {
        const out = cols[w] ? onScreen(cols[w], '.card, .pnote, .more') : [], mid = cols[w + 1], inc = cols[w + 2] ? onScreen(cols[w + 2], '.card, .pnote, .more') : [];
        anims.push(...turnstile(out, [{ transform: 'none', opacity: 1 }, { transform: 'translate3d(-30px,0,0) perspective(900px) rotateY(-80deg)', opacity: 0 }], (i) => ({ duration: 240, delay: i * 30, easing: IN, fill: 'both' })));
        if (cols[w]) anims.push(cols[w].animate([{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(0,0,0)' }], { duration: 240 + out.length * 30 }));
        setWin(w + 1);
        if (mid) anims.push(mid.animate([{ transform: `translate3d(${frozen()?.get(w) ?? w1()}px,0,0)` }, { transform: 'translate3d(0,0,0)' }], { duration: 600, delay: 160, easing: EXPO, fill: 'backwards' }));
        anims.push(...turnstile(inc, [{ transform: 'translate3d(170px,0,0)', opacity: 0 }, { transform: 'none', opacity: 1 }], (i) => ({ duration: 600, delay: 260 + i * 50, easing: EXPO, fill: 'backwards' })));
      } else {
        const to = dir === -1 ? w - 1 : 0;
        if (dir === -1) setWin(to); else shiftHome();
        for (const c of [0, 1]) if (cols[to + c]) anims.push(...turnstile(onScreen(cols[to + c], '.card, .pnote, .more'), [{ transform: 'translate3d(-170px,0,0)', opacity: 0 }, { transform: 'none', opacity: 1 }],
          (i) => ({ duration: 620, delay: 100 + c * 70 + i * 45, easing: EXPO, fill: 'backwards' })));
      }
      await Promise.allSettled(anims.map((a) => a.finished));
      anims.forEach((a) => a.cancel());
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
    else if (e.key === 'ArrowLeft' || e.key === '[') { e.preventDefault(); doShift(-1); }
    else if (e.key === 'Home') { e.preventDefault(); doShift(0); }
  };
  onMount(() => window.addEventListener('keydown', onKey));
  onCleanup(() => window.removeEventListener('keydown', onKey));

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
      if (cc?.id !== id) return -1;
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
  const [pinned, setPinned] = createSignal<[number, number]>([-1, -1]);
  const pin = (c: number, k: number) => setPinned(c === 0 ? [k, -1] : [pinned()[0], k]);
  const unpin = (e: MouseEvent) => { if (!(e.target as Element)?.closest?.('.callbox')) { setPinned([-1, -1]); if (stuck()) { setStuck(null); redraw(); } } };
  onMount(() => window.addEventListener('mousedown', unpin, true));
  onCleanup(() => window.removeEventListener('mousedown', unpin, true));
  createEffect(on([win, () => levels()[win()]?.caller], () => { setPinned([-1, -1]); setStuck(null); }, { defer: true }));
  createEffect(on(() => levels()[win() + 1]?.caller, () => setPinned([pinned()[0], -1]), { defer: true }));
  const lit = createMemo(() => [pinned()[0] >= 0 ? pinned()[0] : hitIn(win()), pinned()[1] >= 0 ? pinned()[1] : hitIn(win() + 1)] as const, undefined, { equals: (a, b) => a[0] === b[0] && a[1] === b[1] });
  const isLit = (li: number, k: number) => (li === win() ? lit()[0] === k : li === win() + 1 ? lit()[1] === k : false);
  createEffect(on([levels, win, w1, lit], () => queueMicrotask(redraw)));
  createEffect(on(lit, (now, before) => [0, 1].forEach((c) => {
    const k = now[c];
    if (k < 0 || (before && before[c] === k)) return;
    const col = cols[win() + c], el = col?.querySelector(`[data-card="${win() + c}:${k}"]`) as HTMLElement | null;
    if (!el) return;
    const top = el.offsetTop - 8;
    if (top < col.scrollTop || top + Math.min(el.offsetHeight, 120) > col.scrollTop + col.clientHeight - barH()) col.scrollTo({ top, behavior: reduce() ? 'auto' : 'smooth' });
  })));

  function reveal(c: number, k: number) {
    const li = win() + c, col = cols[li], el = col?.querySelector(`[data-card="${li}:${k}"]`) as HTMLElement | null;
    if (!el) return;
    col.scrollTo({ top: el.offsetTop - 8, behavior: reduce() ? 'auto' : 'smooth' });
    el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 900);
  }
  const title = (lv: Level | undefined, i: number) => (lv ? (i === 0 ? lv.caller.name : lv.caller.name) : '');
  const levelCount = () => levels().length;

  return (
    <div class="pane prev" style={{ flex: 1, '--prev-head': `${headH()}px`, '--prev-bar': `${barH()}px` }} ref={area}>
      <div class="ph" ref={headEl} style={{ position: 'absolute', left: 0, right: 0, top: 0, 'z-index': 'var(--z-preview-heading)', padding: 0 }}>
        <For each={[0, 1]}>{(c) => (
          <>
            <span title={title(levels()[win() + c], win() + c) || undefined} style={{ width: `${c === 0 ? w1() : w2()}px`, flex: 'none', 'padding-left': '22px', overflow: 'hidden', 'text-overflow': 'ellipsis', color: levels()[win() + c] ? 'var(--bright)' : '#3a3f3a', 'font-size': '18px' }}>
              {title(levels()[win() + c], win() + c) || (c === 0 ? 'preview' : '')}
            </span>
          </>
        )}</For>
      </div>
      <Index each={levels()}>{(lv, li) => (
        <div class="pcol" classList={{ haslit: (li === win() && lit()[0] >= 0) || (li === win() + 1 && lit()[1] >= 0) }} ref={(el) => (cols[li] = el)} onScroll={redraw}
          style={{ left: '0px', width: `${colWidth(li)}px`, transform: `translateX(${slotX(li - win())}px)`, visibility: Math.abs(li - win() - 0.5) < 2 ? 'visible' : 'hidden' }}>
          <div class="pcol-in">
            <For each={lv().cards}>{(card, k) => (
              <>
                <Show when={k() === firstOther(lv())}><div class="pdiv"><span title={t('not functions · macros, static_assert, lambdas, calls through pointers')}>{t('not functions · macros, static_assert, lambdas, calls through pointers')}</span></div></Show>
                <Card card={card} id={`${li}:${k()}`} color={pal(k())} focus={lv().focus === k()} lit={isLit(li, k())} onFocus={() => focusCard(li, k())} onScroll={redraw} />
              </>
            )}</For>
            <Show when={lv().more.length}><div class="more" title={`not shown (preview.max_cards): ${lv().more.join(', ')}`}>+{lv().more.length} more · {lv().more.slice(0, 4).join(', ')}{lv().more.length > 4 ? '…' : ''}</div></Show>
            <Show when={lv().hidden}><div class="pnote">{lv().hidden} standard-library call{lv().hidden > 1 ? 's' : ''} hidden · <button class="lnk" onClick={() => api.settings.set('preview.include_std', true)}>{t('show')}</button></div></Show>
            <Show when={!lv().cards.length && !lv().hidden}><div class="pnote">{indexing() ? `${t('no calls found yet')} · ${indexing()}` : t('no calls')}</div></Show>
          </div>
        </div>
      )}</Index>
      <Show when={levelCount() === 1 || (levelCount() > 0 && !levels()[win() + 1])}>
        <div class="empty" style={{ position: 'absolute', left: `${w1()}px`, right: 0, top: 'var(--prev-head)', bottom: 'var(--prev-bar)' }}>{t('click into a card')}<br />{t('to go one level deeper')}</div>
      </Show>
      <Show when={!levelCount()}>
        <div class="empty" style={{ position: 'absolute', inset: 'var(--prev-head) 0 var(--prev-bar) 0' }}>
          {lspState() === 'failed' ? lspMessage() : lspState() !== 'ready' ? (root() ? t('the language engine (clangd) is starting…') : t('open a folder to start')) : busy() ? '…' : mainFn() ? (indexing() ? `${t('no calls found yet')} · ${indexing()}` : t('no calls in this function')) : 'cursor is outside any function\n— nothing to preview'}
          <Show when={indexing()}><div class="sub" style={{ 'margin-top': '10px' }}>{indexing()}</div></Show>
        </div>
      </Show>
      <Show when={levelCount()}>
        <Handle left={w1()} onDrag={(dx) => setFrac(Math.max(0.15, Math.min(0.85, (w1() + dx) / cardsW())))} onEnd={() => store('litho.preview.split', frac())} />
      </Show>
      <div class="shiftbar" ref={barEl}>
        <button disabled={win() === 0} title={t('back to the source (Alt Home)')} onClick={() => doShift(0)}>{t('« source')}</button>
        <span style={{ 'font-size': '12.5px', color: '#3a3f3a' }}>{levelCount() ? `levels ${win() + 1}–${win() + 2}` : ''}</span>
        <span style={{ flex: 1 }} />
        <button title={t('macros, static_assert, lambdas and calls through pointers, listed after the functions')} onClick={() => api.settings.set('preview.include_other', settings()['preview.include_other'] === false)}>{settings()['preview.include_other'] === false ? t('show non-functions') : t('hide non-functions')}</button>
        <button onClick={() => api.settings.set('preview.include_std', !settings()['preview.include_std'])}>{settings()['preview.include_std'] ? t('hide std calls') : t('show std calls')}</button>
        <span class="pnav" role="group" aria-label={t('preview levels')}>
          <button disabled={win() === 0} title={t('one level back (Alt ←)')} onClick={() => doShift(-1)}>{t('‹ back')}</button>
          <button disabled={!canShift()} title={t('one level deeper (Alt →)')} onClick={() => doShift(1)}>{t('next ›')}</button>
        </span>
      </div>
    </div>
  );
}
