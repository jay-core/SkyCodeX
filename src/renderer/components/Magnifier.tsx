// The magnifier, for either flow view: when it is on (the chip or M), a lens follows the pointer and shows what is
// under it larger, at the strength chosen — at any zoom, so small text reads without zooming the whole view. It is
// a live copy of the view (refreshed as the view changes), so everything it shows is what the view shows.
import { Show, createSignal, createEffect, onCleanup, on } from 'solid-js';
import { magnify } from '../lib/flowstore';

const LW = 420, LH = 260;

/** host: the view the pointer moves over. source: what to copy, and where its own (0, 0) is on screen. */
export default function Magnifier(props: { host: () => HTMLElement | undefined; source: () => { el: HTMLElement; x: number; y: number; w: number; h: number } | null }) {
  const [at, setAt] = createSignal<{ x: number; y: number } | null>(null);
  let inner: HTMLDivElement | undefined, copyOf: HTMLElement | null = null, mo: MutationObserver | null = null, timer = 0;

  /** The copy, made again whenever the view changes (a few times a second at most). */
  const recopy = () => {
    const src = props.source();
    if (!inner || !src) return;
    copyOf = src.el;
    const c = src.el.cloneNode(true) as HTMLElement;
    c.querySelectorAll('canvas').forEach((x) => x.remove());   // canvases copy empty
    inner.replaceChildren(c);
    place();
  };
  /** The lens stays inside the view; the spot under the pointer is shown where the pointer is in the lens. */
  const box = () => {
    const p = at(), h = props.host()?.getBoundingClientRect();
    if (!p || !h) return { left: 0, top: 0 };
    return { left: Math.max(h.left, Math.min(h.right - LW, p.x - LW / 2)), top: Math.max(h.top, Math.min(h.bottom - LH, p.y - LH / 2)) };
  };
  const place = () => {
    const p = at(), src = props.source(), z = magnify();
    if (!inner || !p || !src) return;
    const b = box();
    inner.style.width = `${src.w}px`; inner.style.height = `${src.h}px`;
    inner.style.transform = `translate(${p.x - b.left - (p.x - src.x) * z}px, ${p.y - b.top - (p.y - src.y) * z}px) scale(${z})`;
  };
  const watch = () => {
    const src = props.source();
    if (!src || src.el === copyOf && mo) return;
    mo?.disconnect();
    mo = new MutationObserver(() => { clearTimeout(timer); timer = window.setTimeout(recopy, 90); });
    mo.observe(src.el, { subtree: true, childList: true, attributes: true, characterData: true });
    recopy();
  };
  const move = (e: PointerEvent) => { if (!magnify()) return; setAt({ x: e.clientX, y: e.clientY }); watch(); place(); };
  const leave = () => setAt(null);
  const scrolled = () => { if (magnify() && at()) place(); };
  createEffect(on(props.host, (h) => {
    if (!h) return;
    h.addEventListener('pointermove', move);
    h.addEventListener('pointerleave', leave);
    h.addEventListener('scroll', scrolled, true);
    onCleanup(() => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerleave', leave); h.removeEventListener('scroll', scrolled, true); });
  }));
  createEffect(on(magnify, (z) => { if (!z) { setAt(null); mo?.disconnect(); mo = null; copyOf = null; } else place(); }));
  onCleanup(() => { mo?.disconnect(); clearTimeout(timer); });

  return (
    <Show when={magnify() && at()}>
      <div class="magnifier" ref={() => { requestAnimationFrame(() => { copyOf = null; mo = null; watch(); }); }}
        style={{ left: `${box().left}px`, top: `${box().top}px`, width: `${LW}px`, height: `${LH}px` }}>
        <div class="mg-in" ref={inner} />
        <span class="mg-z">{magnify()}×</span>
      </div>
    </Show>
  );
}
