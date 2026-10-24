import { For, Index, Show, createEffect, on, onMount, onCleanup, createSignal } from 'solid-js';
import { levels, win, focusCard, shiftRight, shiftHome, canShift, busy, mainFn, Level } from '../lib/preview';
import Card, { cardViews } from './Card';
import { PAL, Link, linkSvg } from '../lib/lines';
import { getMainView, settings, cursorPos } from '../lib/store';
import { posToOffset } from '../lib/cm';
import { lspState, lspMessage, indexing } from '../lib/lsp';

const EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)', IN = 'cubic-bezier(0.55, 0, 1, 0.45)';

export default function Preview(props: { overlay: () => SVGSVGElement | undefined; bodyEl: () => HTMLElement | undefined; codeEl: () => HTMLElement | undefined; registerRedraw: (f: () => void) => void }) {
  let area!: HTMLDivElement;
  const cols: HTMLDivElement[] = [];
  const [colW, setColW] = createSignal(360);
  const ro = new ResizeObserver(() => { setColW(Math.max(220, area.clientWidth / 2)); redraw(); });
  onMount(() => { ro.observe(area); props.registerRedraw(redraw); });
  onCleanup(() => ro.disconnect());

  let raf = 0;
  function redraw() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  }

  function draw() {
    const svg = props.overlay(), body = props.bodyEl();
    if (!svg || !body) return;
    const br = body.getBoundingClientRect();
    const links: Link[] = [];
    const ls = levels(), w = win();
    const ar = area.getBoundingClientRect();
    const colRect = (i: number) => cols[i]?.getBoundingClientRect();
    for (let c = 0; c < 2; c++) {
      const li = w + c, lv = ls[li];
      if (!lv) continue;
      const cr = colRect(li);
      if (!cr || cr.left >= ar.right - 2 || cr.right <= ar.left + 2) continue;
      // where the calls are: the main editor for level 1, the focused card of the previous column otherwise
      let srcView: any = null, srcLead = 0, lineBase = 0;
      if (li === 0) {
        const v = getMainView(); const code = props.codeEl();
        if (!v || !code) continue;
        srcView = v; srcLead = code.getBoundingClientRect().right - br.left; lineBase = 0;
      } else {
        const prev = ls[li - 1];
        if (c === 0 || prev.focus < 0) continue;
        srcView = cardViews.get(`${li - 1}:${prev.focus}`);
        const pr = colRect(li - 1);
        if (!srcView || !pr) continue;
        srcLead = pr.right - br.left - 14; lineBase = prev.cards[prev.focus].startLine;
      }
      const scrollerRect = srcView.scrollDOM.getBoundingClientRect();
      lv.cards.forEach((card, k) => {
        const head = cols[li]?.querySelector(`[data-card="${li}:${k}"] .card-h`) as HTMLElement | null;
        if (!head) return;
        const hr = head.getBoundingClientRect();
        let y2 = hr.top + hr.height / 2 - br.top, edge: 0 | -1 | 1 = 0;
        const top = cr.top - br.top + 10, bottom = cr.bottom - br.top - 50;
        if (y2 < top) { y2 = top; edge = -1; } else if (y2 > bottom) { y2 = bottom; edge = 1; }
        for (const r of card.fromRanges) {
          const doc = srcView.state.doc;
          const line = r.end.line - lineBase;
          if (line < 0 || line >= doc.lines) continue;
          const off = posToOffset(doc, line, r.end.character);
          const p = srcView.coordsAtPos(off);
          if (!p || p.top < scrollerRect.top || p.bottom > scrollerRect.bottom) continue;
          const endP = srcView.coordsAtPos(doc.line(line + 1).to);
          links.push({
            from: { x: p.right - br.left, y: (p.top + p.bottom) / 2 - br.top },
            textEnd: (endP?.right ?? p.right) - br.left, lead: srcLead,
            to: { x: hr.left - br.left, y: y2 }, color: PAL[k % PAL.length], edge, name: card.name,
          });
        }
      });
    }
    svg.setAttribute('width', String(br.width)); svg.setAttribute('height', String(br.height));
    svg.innerHTML = linkSvg(links);
  }

  createEffect(on([levels, win, colW], () => queueMicrotask(redraw)));

  // ---- shift with the Windows Phone motion: turnstile out, slide over, slide in ----
  let animating = false;
  const reduce = () => !!settings()['motion.reduce'];
  async function doShift(dir: 1 | 0) {
    if (animating) return;
    const w = win();
    const svg = props.overlay(); if (svg) svg.style.opacity = '0';
    if (dir === 1) {
      const out = cols[w], mid = cols[w + 1];
      const ok = await shiftRight();
      if (!ok) { if (svg) svg.style.opacity = '1'; return; }
      if (!reduce()) {
        animating = true;
        const anims: Animation[] = [];
        if (out) [...out.querySelectorAll('.card, .pnote, .more')].forEach((el, i) => anims.push((el as HTMLElement).animate(
          [{ transform: 'none', opacity: 1 }, { transform: 'translateX(-30px) perspective(900px) rotateY(-80deg)', opacity: 0 }],
          { duration: 220, delay: i * 30, easing: IN, fill: 'backwards' })));
        if (mid) anims.push(mid.animate([{ transform: `translateX(${colW()}px)` }, { transform: 'translateX(0)' }], { duration: 550, delay: 170, easing: EXPO, fill: 'backwards' }));
        queueMicrotask(() => {
          const inc = cols[w + 2];
          if (inc) [...inc.querySelectorAll('.card, .pnote, .more')].forEach((el, i) => anims.push((el as HTMLElement).animate(
            [{ transform: 'translateX(170px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
            { duration: 550, delay: 270 + i * 50, easing: EXPO, fill: 'backwards' })));
        });
        await Promise.allSettled(anims.map((a) => a.finished));
        animating = false;
      }
    } else {
      if (w === 0) { if (svg) svg.style.opacity = '1'; return; }
      shiftHome();
      if (!reduce()) {
        animating = true;
        const anims: Animation[] = [];
        queueMicrotask(() => [0, 1].forEach((c) => {
          const col = cols[c];
          if (col) [...col.querySelectorAll('.card, .pnote, .more')].forEach((el, i) => anims.push((el as HTMLElement).animate(
            [{ transform: 'translateX(-170px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
            { duration: 600, delay: 120 + c * 70 + i * 45, easing: EXPO, fill: 'backwards' })));
        }));
        await new Promise((r) => setTimeout(r, 30));
        await Promise.allSettled(anims.map((a) => a.finished));
        animating = false;
      }
    }
    if (svg) { svg.style.opacity = '1'; redraw(); }
  }
  const onKey = (e: KeyboardEvent) => {
    if (!e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === 'ArrowRight' || e.key === ']') { e.preventDefault(); doShift(1); }
    else if (e.key === 'ArrowLeft' || e.key === '[') { e.preventDefault(); doShift(0); }
  };
  onMount(() => window.addEventListener('keydown', onKey));
  onCleanup(() => window.removeEventListener('keydown', onKey));

  // ---- the main cursor on a call glides its card into view ----
  createEffect(on([levels, cursorPos], () => queueMicrotask(followCursor)));
  function followCursor() {
    const v = getMainView(), l1 = levels()[0];
    if (!v || !l1 || win() !== 0) return;
    const head = v.state.selection.main.head;
    let hit = -1;
    l1.cards.forEach((c, k) => {
      for (const r of c.fromRanges) {
        const a = posToOffset(v.state.doc, r.start.line, r.start.character), b = posToOffset(v.state.doc, r.end.line, r.end.character);
        if (head >= a && head <= b + 1) hit = k;
      }
    });
    cols[0]?.querySelectorAll('.card.lit').forEach((e) => { if (e.getAttribute('data-card') !== `0:${hit}`) e.classList.remove('lit'); });
    if (hit < 0) return;
    const el = cols[0]?.querySelector(`[data-card="0:${hit}"]`) as HTMLElement | null;
    if (!el || el.classList.contains('lit')) return;
    el.classList.add('lit');
    const top = el.offsetTop - 8, col = cols[0];
    if (top < col.scrollTop || top + el.offsetHeight > col.scrollTop + col.clientHeight - 40) col.scrollTo({ top, behavior: reduce() ? 'auto' : 'smooth' });
  }

  const title = (lv: Level | undefined, i: number) => (lv ? (i === 0 ? lv.caller.name : lv.caller.name) : '');
  const levelCount = () => levels().length;

  return (
    <div class="pane prev" style={{ flex: 1 }} ref={area}>
      <div class="ph" style={{ position: 'absolute', left: 0, right: 0, top: 0, 'z-index': 2, padding: 0 }}>
        <For each={[0, 1]}>{(c) => (
          <span style={{ width: `${colW()}px`, 'padding-left': '22px', overflow: 'hidden', 'text-overflow': 'ellipsis', color: levels()[win() + c] ? 'var(--bright)' : '#3a3f3a', 'font-size': '18px' }}>
            {title(levels()[win() + c], win() + c) || (c === 0 ? 'preview' : '')}
          </span>
        )}</For>
      </div>
      <Index each={levels()}>{(lv, li) => (
        <div class="pcol" ref={(el) => (cols[li] = el)} onScroll={redraw}
          style={{ left: '0px', width: `${colW()}px`, transform: `translateX(${(li - win()) * colW()}px)`, visibility: Math.abs(li - win() - 0.5) < 2 ? 'visible' : 'hidden' }}>
          <div class="pcol-in">
            <For each={lv().cards}>{(card, k) => (
              <Card card={card} id={`${li}:${k()}`} color={PAL[k() % PAL.length]} focus={lv().focus === k()} onFocus={() => focusCard(li, k())} />
            )}</For>
            <Show when={lv().more.length}><div class="more">+{lv().more.length} more · {lv().more.slice(0, 4).join(', ')}{lv().more.length > 4 ? '…' : ''}</div></Show>
            <Show when={lv().hidden}><div class="pnote">{lv().hidden} standard-library call{lv().hidden > 1 ? 's' : ''} hidden</div></Show>
            <Show when={!lv().cards.length && !lv().hidden}><div class="pnote">no calls</div></Show>
          </div>
        </div>
      )}</Index>
      <Show when={levelCount() === 1 || (levelCount() > 0 && !levels()[win() + 1])}>
        <div class="empty" style={{ position: 'absolute', left: `${colW()}px`, right: 0, top: '36px', bottom: '40px' }}>click into a card<br />to go one level deeper</div>
      </Show>
      <Show when={!levelCount()}>
        <div class="empty" style={{ position: 'absolute', inset: '36px 0 40px 0' }}>
          {lspState() === 'failed' ? lspMessage() : lspState() !== 'ready' ? 'open a folder to start' : busy() ? '…' : mainFn() ? 'no calls in this function' : 'cursor is outside any function\n— nothing to preview'}
          <Show when={indexing()}><div class="sub" style={{ 'margin-top': '10px' }}>{indexing()}</div></Show>
        </div>
      </Show>
      <div class="shiftbar">
        <button disabled={win() === 0} onClick={() => doShift(0)}>‹ source</button>
        <span style={{ 'font-size': '12.5px', color: '#3a3f3a' }}>{levelCount() ? `levels ${win() + 1}–${win() + 2}` : ''}</span>
        <span style={{ flex: 1 }} />
        <button disabled={!canShift()} onClick={() => doShift(1)}>shift preview ›</button>
      </div>
    </div>
  );
}
