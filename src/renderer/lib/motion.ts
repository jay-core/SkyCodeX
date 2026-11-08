export const afterPaint = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

export function onScreen(col: HTMLElement, selector: string): HTMLElement[] {
  const c = col.getBoundingClientRect();
  return ([...col.querySelectorAll(selector)] as HTMLElement[]).filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > c.top && r.top < c.bottom; });
}

export function preloadFonts() {
  const go = () => {
    for (const w of [100, 200, 300, 400, 500, 600, 700]) document.fonts.load(`${w} 13px "ArX F1"`).catch(() => {});
    for (const w of [300, 350, 400, 600, 700]) document.fonts.load(`${w} 13px "Selawik"`).catch(() => {});
  };
  'requestIdleCallback' in window ? (window as any).requestIdleCallback(go, { timeout: 2000 }) : setTimeout(go, 300);
}
