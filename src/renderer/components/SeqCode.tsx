// The selected step's code in the flow page's preview pane: read-only, with the line that leads to the next step
// marked, and ctrl/cmd-click going to a definition as in the editor's previews.
import { onMount, onCleanup } from 'solid-js';
import { EditorView, Decoration } from '@codemirror/view';
import { EditorState, StateField } from '@codemirror/state';
import { cardExtensions } from '../lib/cm';
import { gotoDefinition } from '../lib/goto';

/** file: absolute path; text: the function's lines; start: its first line in the file (0-based); hl: a file line to mark, or -1. */
export default function SeqCode(props: { file: string; text: string; start: number; hl: number }) {
  let host!: HTMLDivElement, view: EditorView | undefined;
  onMount(() => {
    const local = props.hl - props.start;
    const mark = StateField.define({
      create: (st) => (local >= 0 && local < st.doc.lines ? Decoration.set([Decoration.line({ class: 'snext' }).range(st.doc.line(local + 1).from)]) : Decoration.none),
      update: (v) => v,
      provide: (f) => EditorView.decorations.from(f),
    });
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: props.text,
        extensions: [
          cardExtensions(props.start + 1), mark, gotoDefinition({ file: () => props.file, base: () => props.start }),
        ],
      }),
    });
    if (local >= 0) requestAnimationFrame(() => view?.dispatch({ effects: EditorView.scrollIntoView(view.state.doc.line(Math.min(local + 1, view.state.doc.lines)).from, { y: 'center' }) }));
  });
  onCleanup(() => view?.destroy());
  return <div class="scode" ref={host} />;
}
