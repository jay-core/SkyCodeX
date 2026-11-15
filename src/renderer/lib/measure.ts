let ctx: CanvasRenderingContext2D | null = null;
const probes = new Map<string, HTMLElement>();

function probeOf(cls: string, tag: string): HTMLElement {
  const key = `${cls}|${tag}`, kept = probes.get(key);
  if (kept?.isConnected) return kept;
  const host = document.createElement('div');
  host.className = cls;
  host.style.visibility = 'hidden';
  host.style.position = 'absolute';
  host.style.left = '-100000px';
  host.style.top = '0px';
  let probe: HTMLElement = host;
  if (tag) {
    const [t, ...c] = tag.split('.');
    probe = host.appendChild(document.createElement(t));
    if (c.length) probe.className = c.join(' ');
  }
  document.body.appendChild(host);
  probes.set(key, probe);
  return probe;
}

export function textBox(cls: string, tag = ''): (text: string) => number {
  const probe = probeOf(cls, tag), cs = getComputedStyle(probe);
  const font = cs.font, pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
  const plain = cs.textTransform === 'none' && (cs.letterSpacing === 'normal' || parseFloat(cs.letterSpacing) === 0);
  ctx ??= document.createElement('canvas').getContext('2d');
  const g = ctx;
  if (g && plain) return (text) => { g.font = font; return Math.ceil(g.measureText(text).width + pad); };
  return (text) => { probe.style.whiteSpace = 'nowrap'; probe.style.display = 'inline-block'; probe.style.width = ''; probe.textContent = text; return Math.ceil(probe.getBoundingClientRect().width); };
}

export function scrollbarWidth(cls: string): number {
  const probe = probeOf(cls, 'div.sbw');
  probe.style.cssText = 'position:absolute;width:100px;height:40px;overflow-y:scroll';
  return probe.offsetWidth - probe.clientWidth;
}

export function styleOf(cls: string, tag = ''): CSSStyleDeclaration {
  return getComputedStyle(probeOf(cls, tag));
}

export function textHeight(cls: string, tag = ''): (text: string, width: number) => number {
  const probe = probeOf(cls, tag);
  return (text, width) => {
    probe.style.display = 'block';
    probe.style.whiteSpace = '';
    probe.style.overflow = 'visible';
    probe.style.webkitLineClamp = 'none';
    probe.style.height = 'auto';
    probe.style.width = `${Math.max(1, width)}px`;
    probe.textContent = text;
    return Math.ceil(probe.getBoundingClientRect().height);
  };
}

export function textWidthIn(el: Element): (text: string) => number {
  const font = getComputedStyle(el).font;
  ctx ??= document.createElement('canvas').getContext('2d');
  const g = ctx;
  return (text) => { if (!g) return 0; g.font = font; return Math.ceil(g.measureText(text).width); };
}
