// Helpers that keep animations smooth: heavy work lands before the first animated frame, never inside it.

/** Resolves once the pending DOM work has been laid out and painted (two frames later). */
export const afterPaint = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/** Elements of a scrolling column that are on screen; only those are worth animating. */
export function onScreen(col: HTMLElement, selector: string): HTMLElement[] {
  const c = col.getBoundingClientRect();
  return ([...col.querySelectorAll(selector)] as HTMLElement[]).filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > c.top && r.top < c.bottom; });
}

/** Loads the bundled faces ahead of use, so a first glimpse of a weight never stalls a frame. */
export function preloadFonts() {
  const go = () => {
    for (const w of [100, 200, 300, 400, 500, 600, 700]) document.fonts.load(`${w} 13px "ArX F1"`).catch(() => {});
    for (const w of [300, 350, 400, 600, 700]) document.fonts.load(`${w} 13px "Selawik"`).catch(() => {});
  };
  'requestIdleCallback' in window ? (window as any).requestIdleCallback(go, { timeout: 2000 }) : setTimeout(go, 300);
}
