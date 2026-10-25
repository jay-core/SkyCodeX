import { describe, it, expect } from 'vitest';
import { routeEdges, footprint, overlap, labelSize, folderFrames } from '../renderer/lib/flowlayout';

describe('flow labels', () => {
  it('moves a label off a box that sits on the middle of its arrow', () => {
    const boxes = [
      { id: 'a', x: 0, y: 0, w: 190, h: 66 },
      { id: 'b', x: 600, y: 0, w: 190, h: 66 },
      { id: 'mid', x: 320, y: 10, w: 190, h: 66 },   // right where the label would go
    ];
    const [r] = routeEdges(boxes, [{ from: 'a', to: 'b', text: '3 · 7 · 12', thread: false }]);
    const { w, h } = labelSize('3 · 7 · 12', false);
    const lab = { x: r.label.x - w / 2, y: r.label.y - h / 2, w, h };
    for (const b of boxes) expect(overlap(lab, footprint(b))).toBe(0);
  });
  it('keeps two labels apart', () => {
    const boxes = [{ id: 'a', x: 0, y: 0, w: 190, h: 66 }, { id: 'b', x: 500, y: 0, w: 190, h: 66 }, { id: 'c', x: 500, y: 10, w: 190, h: 66 }];
    const rs = routeEdges(boxes, [{ from: 'a', to: 'b', text: '1 · 2', thread: false }, { from: 'a', to: 'c', text: '3 · 4', thread: false }]);
    const rect = (r: typeof rs[0]) => { const s = labelSize(r.label.text, false); return { x: r.label.x - s.w / 2, y: r.label.y - s.h / 2, w: s.w, h: s.h }; };
    expect(overlap(rect(rs[0]), rect(rs[1]))).toBe(0);
  });
  it('frames each folder around its boxes', () => {
    const f = folderFrames([{ id: 'x', x: 0, y: 0, w: 100, h: 50, folder: 'src' }, { id: 'y', x: 200, y: 100, w: 100, h: 50, folder: 'src' }, { id: 'z', x: 0, y: 400, w: 100, h: 50, folder: 'lib' }]);
    const src = f.find((r) => r.folder === 'src')!;
    expect(src.x).toBeLessThan(0);
    expect(src.x + src.w).toBeGreaterThan(300);
    expect(src.y + src.h).toBeGreaterThan(150);
    expect(f).toHaveLength(2);
  });
});
