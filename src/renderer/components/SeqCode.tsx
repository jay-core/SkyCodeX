// The selected step's code in the flow page's preview pane: read-only, with the line that leads to the next step
// marked, and ctrl/cmd-click going to a definition as in the editor's previews.
import { onMount, onCleanup } from 'solid-js';
import { EditorView, Decoration } from '@codemirror/view';
import { EditorState, StateField } from '@codemirror/state';
import { cardExtensions } from '../lib/cm';
import { definitionAt } from '../lib/lsp';
import { openFile } from '../lib/store';

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
          cardExtensions(props.start + 1), mark,
          EditorView.domEventHandlers({
            mousedown(e, v) {
              if (!(e.metaKey || e.ctrlKey)) return false;
              const pos = v.posAtCoords({ x: e.clientX, y: e.clientY });
              if (pos == null) return false;
              e.preventDefault();
              const l = v.state.doc.lineAt(pos);
              definitionAt(props.file, { line: props.start + l.number - 1, character: pos - l.from }).then((loc) => { if (loc) openFile(loc.file, { line: loc.line, character: loc.character }); });
              return true;
            },
          }),
        ],
      }),
    });
    if (local >= 0) requestAnimationFrame(() => view?.dispatch({ effects: EditorView.scrollIntoView(view.state.doc.line(Math.min(local + 1, view.state.doc.lines)).from, { y: 'center' }) }));
  });
  onCleanup(() => view?.destroy());
  return <div class="scode" ref={host} />;
}
