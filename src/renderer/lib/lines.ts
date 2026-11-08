import { createSignal } from 'solid-js';

export const PAL = ['#86a8e7', '#79c9ae', '#bc9fe6', '#d4c26a', '#6fc0dc', '#a6cf82', '#e2dccb', '#9c96f0'];
const [palette, setPaletteSig] = createSignal<string[]>(PAL);
export const pal = (k: number) => { const p = palette(); return p[k % p.length]; };
export const setPalette = (p: string[]) => setPaletteSig(p.length ? p : PAL);

export interface LinePoint { x: number; y: number }
export interface Link {
  from: LinePoint;
  lead: number;
  textEnd: number;
  to: LinePoint;
  color: string;
  edge: 0 | -1 | 1;
  name: string;
  onDot?: boolean;
  hot?: boolean;
  dim?: boolean;
}

export function linkSvg(links: Link[]): string {
  let out = '';
  for (const l of links) {
    const x1 = Math.min(Math.max(l.from.x + 2, l.textEnd + 8), l.lead), y1 = l.from.y;
    const { x: x2, y: y2 } = l.to;
    const k = Math.max(26, (x2 - l.lead) * 0.55);
    const d = `M${l.lead} ${y1} C${l.lead + k} ${y1} ${x2 - k} ${y2} ${x2} ${y2}`;
    const fade = l.dim ? 0.22 : 1;
    if (l.lead - x1 > 2) out += `<path d="M${x1} ${y1} L${l.lead} ${y1}" stroke="${l.color}" stroke-width="${l.hot ? 1.4 : 0.8}" stroke-dasharray="${l.hot ? '2 3' : '1.5 4'}" opacity="${(l.hot ? 0.95 : 0.45) * fade}" fill="none"/><circle cx="${x1}" cy="${y1}" r="${l.hot ? 3 : 1.8}" fill="${l.color}" opacity="${fade}"/>`;
    if (l.hot) out += `<path d="${d}" stroke="${l.color}" stroke-width="7" opacity=".16" stroke-linecap="round" fill="none"/>`;
    out += `<path d="${d}" stroke="${l.color}" stroke-width="${l.hot ? 2 : l.edge ? 0.8 : 0.9}" opacity="${(l.hot ? 1 : l.edge ? 0.5 : 0.75) * fade}" fill="none"${l.edge ? ' stroke-dasharray="4 4"' : ''}/>`;
    if (l.edge) {
      const e = l.edge;
      if (!l.name) continue;
      out += edgeStub(x2, y2, e, l.color, l.name);
    } else if (!l.onDot) out += `<circle cx="${x2}" cy="${y2}" r="${l.hot ? 2.6 : 1.6}" fill="${l.color}" opacity="${0.8 * fade}"/>`;
  }
  return out;
}

export function edgeStub(x: number, y: number, e: number, color: string, label: string): string {
  const w = Math.round(label.length * 6.4) + 26;
  return `<rect x="${x}" y="${y - 7}" width="${w}" height="14" fill="#151615" opacity=".92"/>`
    + `<path d="M${x + 4} ${y - e * 3} l4 ${e * 5} l4 ${-e * 5}" stroke="${color}" fill="none" stroke-width="1.3"/>`
    + `<text x="${x + 17}" y="${y + 4}" fill="${color}" font-size="11.5" font-weight="300" font-family="Selawik, sans-serif">${escapeXml(label)}</text>`;
}

export function curveSvg(a: number, ya: number, b: number, yb: number, color: string, hot = false, dim = false): string {
  const k = Math.max(22, (b - a) * 0.5);
  const d = `M${a} ${ya} C${a + k} ${ya} ${b - k} ${yb} ${b} ${yb}`;
  return (hot ? `<path d="${d}" stroke="${color}" stroke-width="7" opacity=".16" stroke-linecap="round" fill="none"/>` : '')
    + `<path d="${d}" stroke="${color}" stroke-width="${hot ? 2 : 1}" opacity="${hot ? 1 : dim ? 0.2 : 0.75}" fill="none"/>`;
}

const escapeXml = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
