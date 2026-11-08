import { StateEffect, StateField } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet } from '@codemirror/view';

export interface CallMark { from: number; to: number; color: string; id: string }

export const setCallMarks = StateEffect.define<CallMark[]>();

export const callMarks = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, tr) {
    marks = marks.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setCallMarks)) continue;
      const list = e.value.filter((m) => m.to > m.from && m.from >= 0 && m.to <= tr.state.doc.length).sort((a, b) => a.from - b.from || a.to - b.to);
      marks = Decoration.set(list.map((m) => Decoration.mark({ class: 'callbox', attributes: { style: `--c: ${m.color}`, 'data-call': m.id } }).range(m.from, m.to)));
    }
    return marks;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const shown = new WeakMap<EditorView, string>();
export function showCallMarks(view: EditorView, marks: CallMark[]) {
  const sig = marks.map((m) => `${m.from}-${m.to}-${m.color}-${m.id}`).join('|');
  if (shown.get(view) === sig) return;
  shown.set(view, sig);
  view.dispatch({ effects: setCallMarks.of(marks) });
}
