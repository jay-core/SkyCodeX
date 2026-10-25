// Geometry for the flow view: arrows between boxes, and where each arrow's label goes so it never sits on a box.
export interface Rect { x: number; y: number; w: number; h: number }
export interface BoxAt { id: string; x: number; y: number; w: number; h: number; extra?: { left?: number; top?: number; bottom?: number } }
export interface EdgeIn { from: string; to: string; text: string; thread: boolean }
export interface Route { d: string; from: string; to: string; thread: boolean; label: { x: number; y: number; text: string; thread: boolean }; head: { x: number; y: number; ang: number } }

type P = [number, number];
const bez = (p0: P, p1: P, p2: P, p3: P, t: number): P => {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
};
const tangent = (p0: P, p1: P, p2: P, p3: P, t: number): P => {
  const u = 1 - t;
  const x = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
  const y = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
};
export const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** The area a box really covers on screen, with its notes around it (start marker, thread tag, loop note). */
export const footprint = (b: BoxAt, pad = 4): Rect => {
  const l = b.extra?.left ?? 0, t = b.extra?.top ?? 0, bo = b.extra?.bottom ?? 0;
  return { x: b.x - l - pad, y: b.y - t - pad, w: b.w + l + 2 * pad, h: b.h + t + bo + 2 * pad };
};
export const labelSize = (text: string, thread: boolean) => ({ w: text.length * (thread ? 6.4 : 7.6) + 16, h: 19 });

/** Arrow paths between placed boxes; labels slide along their arrow, then sideways, until they are clear of boxes and other labels. */
export function routeEdges(boxes: BoxAt[], edges: EdgeIn[]): Route[] {
  const at = new Map(boxes.map((b) => [b.id, b]));
  const blocked = boxes.map((b) => footprint(b));
  const taken: Rect[] = [];
  const out: Route[] = [];
  for (const e of edges) {
    const a = at.get(e.from), b = at.get(e.to);
    if (!a || !b) continue;
    let x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2, ang = 0;
    if (b.x <= a.x + a.w / 2) {   // same column or backwards: leave from the bottom (or top)
      x1 = a.x + a.w / 2; y1 = a.y + a.h; x2 = b.x + b.w / 2; y2 = b.y - 2; ang = 90;
      if (b.y < a.y) { y1 = a.y; y2 = b.y + b.h + 2; ang = -90; }
    }
    const p0: P = [x1, y1], p3: P = [ang === 0 ? x2 - 2 : x2, y2];
    const dx = Math.max(40, (x2 - x1) / 2), dy = ang > 0 ? 60 : -60;
    const p1: P = ang === 0 ? [x1 + dx, y1] : [x1, y1 + dy], p2: P = ang === 0 ? [x2 - dx, y2] : [x2, y2 - dy];
    const d = `M${p0[0]} ${p0[1]} C${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]}`;

    const { w, h } = labelSize(e.text, e.thread);
    let best: { x: number; y: number; cost: number } | null = null;
    search: for (const t of [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82]) {
      const [cx, cy] = bez(p0, p1, p2, p3, t), [tx, ty] = tangent(p0, p1, p2, p3, t);
      for (const s of [0, 1, -1, 2, -2, 3, -3]) {
        const x = cx - ty * s * 13, y = cy + tx * s * 13;
        const r = { x: x - w / 2, y: y - h / 2, w, h };
        let cost = 0;
        for (const o of blocked) cost += overlap(r, o) * 4;
        for (const o of taken) cost += overlap(r, o);
        cost += Math.abs(s) * 0.5 + Math.abs(t - 0.5);   // prefer the middle of the arrow when everything is clear
        if (!best || cost < best.cost) best = { x, y, cost };
        if (cost < 5) break search;
      }
    }
    taken.push({ x: best!.x - w / 2, y: best!.y - h / 2, w, h });
    out.push({ d, from: e.from, to: e.to, thread: e.thread, label: { x: best!.x, y: best!.y, text: e.text, thread: e.thread }, head: { x: p3[0], y: p3[1], ang } });
  }
  return out;
}

/** Frames drawn around each folder's boxes when the view is grouped by folder. */
export function folderFrames(boxes: (BoxAt & { folder: string })[], pad = 22): (Rect & { folder: string })[] {
  const by = new Map<string, Rect>();
  for (const b of boxes) {
    const f = footprint(b, 0), r = by.get(b.folder);
    if (!r) { by.set(b.folder, { ...f }); continue; }
    const x = Math.min(r.x, f.x), y = Math.min(r.y, f.y);
    by.set(b.folder, { x, y, w: Math.max(r.x + r.w, f.x + f.w) - x, h: Math.max(r.y + r.h, f.y + f.h) - y });
  }
  return [...by].map(([folder, r]) => ({ folder, x: r.x - pad, y: r.y - pad - 14, w: r.w + 2 * pad, h: r.h + 2 * pad + 14 }));
}
