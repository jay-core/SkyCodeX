import { For, Index, Show, createEffect, on, onMount, onCleanup, createSignal } from 'solid-js';
import { levels, setLevels, win, setWin, setMainFn, focusCard, shiftRight, shiftHome, canShift, busy, mainFn, Level } from '../lib/preview';
import Card, { cardViews } from './Card';
import { PAL, Link, linkSvg, curveSvg, edgeStub } from '../lib/lines';
import { getMainView, settings, cursorPos, root } from '../lib/store';
import { api } from '../lib/api';
import { posToOffset } from '../lib/cm';
import { lspState, lspMessage, indexing } from '../lib/lsp';

const EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)', IN = 'cubic-bezier(0.55, 0, 1, 0.45)';
const stored = (k: string, d: number) => { try { const v = Number(localStorage.getItem(k)); return v > 0 ? v : d; } catch { return d; } };
const store = (k: string, v: number) => { try { localStorage.setItem(k, String(v)); } catch { /* not kept */ } };
const MIN_COL = 170;
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
  // widths: the call index, then two card columns split by a ratio; both handles are draggable
  const [areaW, setAreaW] = createSignal(800);
  const [IDXW, setIdx] = createSignal(stored('litho.preview.index', 196));
  const [frac, setFrac] = createSignal(stored('litho.preview.split', 0.5));
  const IDX = () => Math.min(IDXW(), Math.max(110, areaW() - 2 * MIN_COL));
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
          const nm = entry.querySelector('.nm')!.getBoundingClientRect(), dot = entry.querySelector('.dot')!.getBoundingClientRect();
          const ey = (nm.top + nm.bottom) / 2 - br.top;
          const head = cols[li]?.querySelector(`[data-card="${li}:${k}"] .card-h`) as HTMLElement | null;
          const hr = head?.getBoundingClientRect();
          const off: 0 | -1 | 1 = !hr ? 1 : hr.bottom < cr.top + 4 ? -1 : hr.top > cr.bottom - 44 ? 1 : 0;
          entry.querySelector('.ixa')!.textContent = off < 0 ? '↑' : off > 0 ? '↓' : '';
          entry.classList.toggle('off', off !== 0);
          if (!off && head) {
            const sw = head.querySelector('.sw')!.getBoundingClientRect();
            curves += curveSvg(dot.right - br.left + 22, ey, sw.left - br.left - 1, (sw.top + sw.bottom) / 2 - br.top, PAL[k % PAL.length]);
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
              lead: code.getBoundingClientRect().right - br.left - 6, to: { x: nm.left - br.left - 12, y: ey },
              color: PAL[k % PAL.length], edge: 0, name: card.name,
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
            to: { x: (edge ? hr.left : sw.left - 1) - br.left, y: y2 }, color: PAL[k % PAL.length], edge, name: label, onDot: !edge,
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

  createEffect(on([levels, win, w1, IDX], () => queueMicrotask(redraw)));
  // a new folder starts with empty previews
  createEffect(on(root, () => { setLevels([]); setMainFn(null); setWin(0); }, { defer: true }));

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
        if (mid) anims.push(mid.animate([{ transform: `translateX(${w1()}px)` }, { transform: 'translateX(0)' }], { duration: 550, delay: 170, easing: EXPO, fill: 'backwards' }));
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
    ix.forEach((e, k) => e?.classList.toggle('lit', k === hit));
    if (hit < 0) return;
    const el = cols[0]?.querySelector(`[data-card="0:${hit}"]`) as HTMLElement | null;
    if (!el || el.classList.contains('lit')) return;
    el.classList.add('lit');
    const top = el.offsetTop - 8, col = cols[0];
    if (top < col.scrollTop || top + el.offsetHeight > col.scrollTop + col.clientHeight - 40) col.scrollTo({ top, behavior: reduce() ? 'auto' : 'smooth' });
  }

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
        <span style={{ width: `${IDX()}px`, 'padding-left': '14px', 'font-size': '13px', color: '#4f564f', flex: 'none' }}>{levels()[win()] ? `calls · ${levels()[win()].cards.length}` : ''}</span>
        <For each={[0, 1]}>{(c) => (
          <span style={{ width: `${c === 0 ? w1() : w2()}px`, flex: 'none', 'padding-left': '22px', overflow: 'hidden', 'text-overflow': 'ellipsis', color: levels()[win() + c] ? 'var(--bright)' : '#3a3f3a', 'font-size': '18px' }}>
            {title(levels()[win() + c], win() + c) || (c === 0 ? 'preview' : '')}
          </span>
        )}</For>
      </div>
      <Index each={levels()}>{(lv, li) => (
        <div class="pcol" ref={(el) => (cols[li] = el)} onScroll={redraw}
          style={{ left: `${IDX()}px`, width: `${slotW(li - win())}px`, transform: `translateX(${slotX(li - win())}px)`, visibility: Math.abs(li - win() - 0.5) < 2 ? 'visible' : 'hidden' }}>
          <div class="pcol-in">
            <For each={lv().cards}>{(card, k) => (
              <Card card={card} id={`${li}:${k()}`} color={PAL[k() % PAL.length]} focus={lv().focus === k()} onFocus={() => focusCard(li, k())} onScroll={redraw} />
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
      <div class="cindex" style={{ width: `${IDX()}px` }}>
        <For each={levels()[win()]?.cards ?? []}>{(card, k) => (
          <div class="ix" ref={(el) => (ix[k()] = el)} onClick={() => reveal(k())} title={`${card.name} — click to show its card`}>
            <span class="n">{k() + 1}</span>
            <span class="nm">{card.name}</span>
            <i class="dot" style={{ background: PAL[k() % PAL.length] }} />
            <span class="ixa" style={{ color: PAL[k() % PAL.length] }} />
          </div>
        )}</For>
        <Show when={levels()[win()]?.cards.length}><div class="ixhint">click a name to show its card</div></Show>
      </div>
      <Show when={levelCount()}>
        <Handle left={IDX()} onDrag={(dx) => setIdx(Math.max(110, Math.min(360, IDX() + dx)))} onEnd={() => store('litho.preview.index', IDX())} />
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
