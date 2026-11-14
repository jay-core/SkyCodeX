let ctx: CanvasRenderingContext2D | null = null;

export function textBox(cls: string): (text: string) => number {
  const probe = document.createElement('div');
  probe.className = cls;
  probe.style.visibility = 'hidden';
  probe.style.position = 'absolute';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const font = cs.font, pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
  ctx ??= document.createElement('canvas').getContext('2d');
  const g = ctx;
  if (g) { probe.remove(); return (text) => { g.font = font; return Math.ceil(g.measureText(text).width + pad); }; }
  probe.style.whiteSpace = 'nowrap';
  return (text) => { probe.textContent = text; return Math.ceil(probe.getBoundingClientRect().width); };
}
