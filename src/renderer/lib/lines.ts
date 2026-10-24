// Connector lines between call sites and the cards they lead to.
export const PAL = ['#ad9b6f', '#7f9e82', '#a8929e', '#739696', '#ab9070', '#b8766b', '#8f9aa8', '#9aa86f'];

export interface LinePoint { x: number; y: number }
export interface Link {
  from: LinePoint;       // the call site (right edge of the name)
  lead: number;          // x where the dashed lead ends: the source pane's right edge
  textEnd: number;       // x of the end of the call site's line text
  to: LinePoint;         // card header, left edge
  color: string;
  edge: 0 | -1 | 1;      // target scrolled above (-1) or below (1) its column
  name: string;
  onDot?: boolean;      // ends on the card's own colour dot, so no end marker is drawn
}

/** SVG markup for a set of links, in the coordinate space of the overlay. */
export function linkSvg(links: Link[]): string {
  let out = '';
  for (const l of links) {
    const x1 = Math.min(Math.max(l.from.x + 2, l.textEnd + 8), l.lead), y1 = l.from.y;
    const { x: x2, y: y2 } = l.to;
    const k = Math.max(26, (x2 - l.lead) * 0.55);
    if (l.lead - x1 > 2) out += `<path d="M${x1} ${y1} L${l.lead} ${y1}" stroke="${l.color}" stroke-width="0.8" stroke-dasharray="1.5 4" opacity=".45" fill="none"/><circle cx="${x1}" cy="${y1}" r="1.8" fill="${l.color}"/>`;
    out += `<path d="M${l.lead} ${y1} C${l.lead + k} ${y1} ${x2 - k} ${y2} ${x2} ${y2}" stroke="${l.color}" stroke-width="${l.edge ? 0.8 : 0.9}" opacity="${l.edge ? 0.5 : 0.75}" fill="none"${l.edge ? ' stroke-dasharray="4 4"' : ''}/>`;
    if (l.edge) {
      const e = l.edge;
      out += `<path d="M${x2 + 4} ${y2 + e * 5} l5 ${-e * 7} l5 ${e * 7}" stroke="${l.color}" fill="none" stroke-width="1.4"/>`;
      out += `<text x="${x2 + 16}" y="${y2 + 4}" fill="${l.color}" font-size="11.5" font-weight="300" font-family="Selawik, sans-serif" stroke="#151615" stroke-width="4" paint-order="stroke">${e < 0 ? '↑' : '↓'} ${escapeXml(l.name)}</text>`;
    } else if (!l.onDot) out += `<circle cx="${x2}" cy="${y2}" r="1.6" fill="${l.color}" opacity=".8"/>`;
  }
  return out;
}

/** A plain connector from the call index to a card's colour dot. */
export function curveSvg(a: number, ya: number, b: number, yb: number, color: string): string {
  const k = Math.max(22, (b - a) * 0.5);
  return `<path d="M${a} ${ya} C${a + k} ${ya} ${b - k} ${yb} ${b} ${yb}" stroke="${color}" stroke-width="1" opacity=".75" fill="none"/>`;
}

const escapeXml = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
