// The selected step's code in the flow page's preview pane: read-only, with the line that leads to the next step
// marked, the calls this function makes outlined (a click goes to that step), and ctrl/cmd-click going to a
// definition as in the editor's previews. While the run plays, the body is walked line by line at the play speed.
import { onMount, onCleanup } from 'solid-js';
import { EditorView, Decoration } from '@codemirror/view';
import { EditorState, StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';
import { cardExtensions } from '../lib/cm';
import { gotoDefinition } from '../lib/goto';
import { walkSpeed } from '../lib/flowstore';

export interface CodeCall { line: number; ch: number; len: number; item: number; now: boolean }
const setWalk = StateEffect.define<number>();

/** file: absolute path; text: the function's lines; start: its first line in the file (0-based); hl: a file line to
 *  mark, or -1; calls: the calls it makes in this run (file lines), each a step to go to. */
export default function SeqCode(props: { file: string; text: string; start: number; hl: number; calls?: CodeCall[]; onJump?: (item: number) => void }) {
  let host!: HTMLDivElement, view: EditorView | undefined, timer = 0;
  onMount(() => {
    const local = props.hl - props.start;
    const deco = StateField.define<{ walk: number; d: ReturnType<typeof Decoration.set> }>({
      create: (st) => ({ walk: -1, d: build(st, -1) }),
      update: (v, tr) => { for (const e of tr.effects) if (e.is(setWalk)) return { walk: e.value, d: build(tr.state, e.value) }; return v; },
      provide: (f) => EditorView.decorations.from(f, (v) => v.d),
    });
    // the marked line, the outlined calls, and (while walking) the lines run so far and the one running now
    function build(st: EditorState, walk: number) {
      const b = new RangeSetBuilder<Decoration>(), doc = st.doc, out: { from: number; to: number; d: Decoration }[] = [];
      for (let n = 1; n <= doc.lines; n++) {
        const cls = walk >= 0 ? (n - 1 < walk ? 'swalked' : n - 1 === walk ? 'snext' : 'snot') : n - 1 === local ? 'snext' : '';
        if (cls) out.push({ from: doc.line(n).from, to: doc.line(n).from, d: Decoration.line({ class: cls }) });
      }
      for (const c of props.calls ?? []) {
        const n = c.line - props.start + 1;
        if (n < 1 || n > doc.lines) continue;
        const l = doc.line(n), from = Math.min(l.to, l.from + c.ch), to = Math.min(l.to, from + c.len);
        if (to > from) out.push({ from, to, d: Decoration.mark({ class: c.now ? 'cbx on' : 'cbx', attributes: { 'data-step': String(c.item), title: `step ${c.item + 1} · click to go there` } }) });
      }
      out.sort((a, b2) => a.from - b2.from || (a.from === a.to ? -1 : 1));
      for (const o of out) b.add(o.from, o.to, o.d);
      return b.finish();
    }
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: props.text,
        extensions: [
          cardExtensions(props.start + 1), deco, gotoDefinition({ file: () => props.file, base: () => props.start }),
          EditorView.domEventHandlers({
            mousedown(e) {
              if (e.metaKey || e.ctrlKey || e.altKey || e.button !== 0) return false;
              const el = (e.target as HTMLElement).closest?.('.cbx') as HTMLElement | null;
              if (!el || !props.onJump) return false;
              e.preventDefault(); props.onJump(Number(el.dataset.step)); return true;
            },
          }),
        ],
      }),
    });
    if (local >= 0) requestAnimationFrame(() => view?.dispatch({ effects: EditorView.scrollIntoView(view.state.doc.line(Math.min(local + 1, view.state.doc.lines)).from, { y: 'center' }) }));
    // while the run plays: walk from the first line to the line that leads on, at the play speed
    const k = walkSpeed();
    if (k > 0 && local >= 0 && !document.documentElement.classList.contains('calm')) {
      let n = 0;
      const tick = () => {
        if (!view) return;
        view.dispatch({ effects: setWalk.of(n) });
        if (n >= local) { timer = window.setTimeout(() => view?.dispatch({ effects: setWalk.of(-1) }), 260 / k); return; }
        n++; timer = window.setTimeout(tick, 110 / k);
      };
      tick();
    }
  });
  onCleanup(() => { clearTimeout(timer); view?.destroy(); });
  return <div class="scode" ref={host} />;
}
