// Line counts from the last profile run, shown as a faint heat behind the lines of open files.
import { createSignal } from 'solid-js';
import { ViewPlugin, Decoration, DecorationSet, EditorView, ViewUpdate, GutterMarker, gutter } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

export const [heat, setHeat] = createSignal<{ lines: Record<string, [number, number][]>; max: number } | null>(null);
export const [heatEpoch, setHeatEpoch] = createSignal(0);

const counts = (file: string) => { const h = heat(); return h ? new Map(h.lines[file] ?? []) : null; };
const fmt = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}G` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : String(n));

class Count extends GutterMarker {
  constructor(readonly n: number, readonly k: number) { super(); }
  eq(o: Count) { return o.n === this.n && o.k === this.k; }
  toDOM() { const s = document.createElement('span'); s.textContent = this.n ? `${fmt(this.n)}×` : '0'; s.style.opacity = String(0.35 + this.k * 0.65); s.title = `ran ${this.n.toLocaleString()} times`; return s; }
}

/** The heat: line backgrounds scaled by log(count), and a gutter of counts. Only lines on screen are decorated. */
export function profileHeat(file: () => string) {
  const lines = ViewPlugin.fromClass(class {
    decorations: DecorationSet = Decoration.none; epoch = -1;
    constructor(view: EditorView) { this.decorations = this.build(view); }
    update(u: ViewUpdate) { if (u.docChanged || u.viewportChanged || this.epoch !== heatEpoch()) this.decorations = this.build(u.view); }
    build(view: EditorView) {
      this.epoch = heatEpoch();
      const c = counts(file()), max = heat()?.max ?? 1;
      if (!c?.size) return Decoration.none;
      const b = new RangeSetBuilder<Decoration>(), doc = view.state.doc;
      for (const { from, to } of view.visibleRanges) for (let n = doc.lineAt(from).number; n <= doc.lineAt(to).number; n++) {
        const v = c.get(n);
        if (v === undefined) continue;
        const k = v ? Math.log1p(v) / Math.log1p(max) : 0;
        b.add(doc.line(n).from, doc.line(n).from, Decoration.line({ attributes: { style: v ? `background: rgba(173, 155, 111, ${(0.05 + k * 0.2).toFixed(3)})` : 'background: rgba(95, 102, 95, .06)' } }));
      }
      return b.finish();
    }
  }, { decorations: (p) => p.decorations });
  const g = gutter({
    class: 'cm-heat-gutter',
    lineMarker(view, line) { const c = counts(file()); const n = view.state.doc.lineAt(line.from).number; const v = c?.get(n); const max = heat()?.max ?? 1; return v === undefined ? null : new Count(v, v ? Math.log1p(v) / Math.log1p(max) : 0); },
    lineMarkerChange: () => true,
  });
  return [lines, g];
}
