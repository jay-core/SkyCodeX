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
  hot?: boolean;        // the call under a cursor: drawn thicker, with a soft halo
  dim?: boolean;        // another call is under the cursor: this one steps back
}

/** SVG markup for a set of links, in the coordinate space of the overlay. */
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
      if (!l.name) continue;   // folded into an "N more" note
      out += edgeStub(x2, y2, e, l.color, l.name);
    } else if (!l.onDot) out += `<circle cx="${x2}" cy="${y2}" r="${l.hot ? 2.6 : 1.6}" fill="${l.color}" opacity="${0.8 * fade}"/>`;
  }
  return out;
}

/** Marker for a card scrolled out of its column: a chevron pointing toward it and its name on a plate. */
export function edgeStub(x: number, y: number, e: number, color: string, label: string): string {
  const w = Math.round(label.length * 6.4) + 26;
  return `<rect x="${x}" y="${y - 7}" width="${w}" height="14" fill="#151615" opacity=".92"/>`
    + `<path d="M${x + 4} ${y - e * 3} l4 ${e * 5} l4 ${-e * 5}" stroke="${color}" fill="none" stroke-width="1.3"/>`
    + `<text x="${x + 17}" y="${y + 4}" fill="${color}" font-size="11.5" font-weight="300" font-family="Selawik, sans-serif">${escapeXml(label)}</text>`;
}

/** A plain connector from the call index to a card's colour dot. */
export function curveSvg(a: number, ya: number, b: number, yb: number, color: string, hot = false, dim = false): string {
  const k = Math.max(22, (b - a) * 0.5);
  const d = `M${a} ${ya} C${a + k} ${ya} ${b - k} ${yb} ${b} ${yb}`;
  return (hot ? `<path d="${d}" stroke="${color}" stroke-width="7" opacity=".16" stroke-linecap="round" fill="none"/>` : '')
    + `<path d="${d}" stroke="${color}" stroke-width="${hot ? 2 : 1}" opacity="${hot ? 1 : dim ? 0.2 : 0.75}" fill="none"/>`;
}

const escapeXml = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
