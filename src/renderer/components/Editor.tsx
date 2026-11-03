import { onMount, onCleanup, createEffect, on } from 'solid-js';
import { EditorView, Decoration, DecorationSet, keymap, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { EditorState, StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';
import { editorExtensions, offsetToPos } from '../lib/cm';
import { completionFor, hoverFor, lintSupport, attachView, definitionAt, indexEpoch } from '../lib/lsp';
import { langOf, syntaxFor, serverLang } from '../lib/langs';
import { sender, flush as flushOther } from '../lib/langlsp';
import { saver } from '../lib/power';
import { files, states, settings, setStateFactory, setMainView, onDocChanged, openFile, save, setCrumb, setCursorPos } from '../lib/store';
import { refreshForCursor, mainFn, levels, win } from '../lib/preview';
import { repairFor } from '../lib/repair';

/** C and C++ sources and headers the repair engine checks (not fragments such as .inc tables). */
const REPAIRABLE = /\.(c|cc|cpp|cxx|c\+\+|h|hh|hpp|hxx|h\+\+|ipp|inl|tpp|tcc)$/i;

// ---- decorations: focus dimming, ⌘/Ctrl-hover link (call outlines come from the preview: lib/callmarks.ts) ----
interface Marks { dim: [number, number] | null; link: [number, number] | null }
export const setMarks = StateEffect.define<Partial<Marks>>();
const marksField = StateField.define<{ m: Marks; deco: DecorationSet }>({
  create: () => ({ m: { dim: null, link: null }, deco: Decoration.none }),
  update(v, tr) {
    let m = v.m;
    for (const e of tr.effects) if (e.is(setMarks)) m = { ...m, ...e.value };
    if (m === v.m && !tr.docChanged) return v;
    if (m === v.m) return { m, deco: v.deco.map(tr.changes) };
    const doc = tr.state.doc;
    const ranges: { from: number; to: number; d: Decoration }[] = [];
    if (m.link && m.link[1] <= doc.length) ranges.push({ from: m.link[0], to: m.link[1], d: Decoration.mark({ class: 'cmd-link' }) });
    ranges.sort((x, y) => x.from - y.from);
    const b = new RangeSetBuilder<Decoration>();
    for (const r of ranges) b.add(r.from, r.to, r.d);
    return { m, deco: b.finish() };
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
});

/** Toolchain and SDK locations: files there are shown read-only. */
export const SYSTEM_PATH = /^(\/usr\/|\/Library\/Developer\/|\/Applications\/Xcode|\/opt\/homebrew\/|[A-Za-z]:[\\/]Program Files)|[\\/](c\+\+|include)[\\/]v\d[\\/]/;

/** Focus dimming: only the lines on screen are decorated, so a huge file costs the same as a small one. */
const dimLine = Decoration.line({ class: 'cm-dimmed' });
const dimPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) { this.decorations = this.build(view); }
  update(u: ViewUpdate) {
    if (u.docChanged || u.viewportChanged || u.startState.field(marksField).m.dim !== u.state.field(marksField).m.dim) this.decorations = this.build(u.view);
  }
  build(view: EditorView) {
    const dim = view.state.field(marksField).m.dim;
    if (!dim) return Decoration.none;
    const b = new RangeSetBuilder<Decoration>(), doc = view.state.doc;
    for (const { from, to } of view.visibleRanges) {
      for (let n = doc.lineAt(from).number; n <= doc.lineAt(to).number; n++) if (n < dim[0] || n > dim[1]) b.add(doc.line(n).from, doc.line(n).from, dimLine);
    }
    return b.finish();
  }
}, { decorations: (p) => p.decorations });

export function wordAt(view: EditorView, pos: number): [number, number] | null {
  const w = view.state.wordAt(pos);
  return w ? [w.from, w.to] : null;
}

export default function Editor(props: { onScroll: () => void; onCursor: () => void }) {
  let host!: HTMLDivElement;
  let view: EditorView;
  let settleTimer: number | undefined;
  let current = '';

  const settle = () => {
    clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      const st = view.state, head = st.selection.main.head;
      const p = offsetToPos(st.doc, head);
      setCursorPos({ line: p.line + 1, col: p.character + 1 });
      refreshForCursor(current, p);
      props.onCursor();
    }, saver() ? 260 : 100);   // calmer on battery
  };

  const makeState = (file: string, text: string) => {
    const s = settings();
    return EditorState.create({
      doc: text,
      extensions: [
        editorExtensions({ tabSize: s['editor.tab_size'] ?? (langOf(file) === 'go' ? 8 : 4), wrap: !!s['editor.word_wrap'] || langOf(file) === 'markdown', language: syntaxFor(file) }),
        // C and C++ talk to clangd; Rust, Python and Go to their pack's engine; other files only get colouring
        langOf(file) === 'cpp' ? [completionFor(() => file), hoverFor(() => file)]
          : serverLang(file) ? [completionFor(() => file, sender(file), flushOther), hoverFor(() => file, sender(file))] : [],
        lintSupport, marksField, dimPlugin,
        keymap.of([{ key: 'Mod-s', run: () => { save(file); return true; } }]),
        // standard-library and SDK headers open read-only; the project's own C and C++ get checked fixes for their errors
        SYSTEM_PATH.test(file) ? [EditorState.readOnly.of(true)] : langOf(file) === 'cpp' && REPAIRABLE.test(file) ? repairFor(file) : [],
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onDocChanged(file, u.state);
          else states.set(file, u.state);
          if (u.docChanged || u.selectionSet) settle();
        }),
        EditorView.domEventHandlers({
          mousedown(e, v) {
            if (!(e.metaKey || e.ctrlKey) || e.button !== 0) return false;
            const pos = v.posAtCoords({ x: e.clientX, y: e.clientY });
            if (pos == null) return false;
            e.preventDefault();
            definitionAt(file, offsetToPos(v.state.doc, pos)).then((loc) => { if (loc) openFile(loc.file, { line: loc.line, character: loc.character }); });
            return true;
          },
          mousemove(e, v) {
            const want = e.metaKey || e.ctrlKey;
            const cur = v.state.field(marksField).m.link;
            if (!want) { if (cur) v.dispatch({ effects: setMarks.of({ link: null }) }); return false; }
            const pos = v.posAtCoords({ x: e.clientX, y: e.clientY });
            const w = pos == null ? null : wordAt(v, pos);
            if (w?.[0] !== cur?.[0] || w?.[1] !== cur?.[1]) v.dispatch({ effects: setMarks.of({ link: w }) });
            return false;
          },
          keyup(e, v) { if ((e.key === 'Meta' || e.key === 'Control') && v.state.field(marksField).m.link) v.dispatch({ effects: setMarks.of({ link: null }) }); return false; },
          scroll() { props.onScroll(); return false; },
        }),
      ],
    });
  };

  onMount(() => {
    setStateFactory(makeState);
    view = new EditorView({ parent: host, state: EditorState.create({ doc: '' }) });
    view.scrollDOM.addEventListener('scroll', () => props.onScroll(), { passive: true });
    setMainView(view);
  });
  onCleanup(() => { setMainView(null); view?.destroy(); });

  // switch documents
  createEffect(on(() => files.active, (active) => {
    if (!view) return;
    if (current) attachView(current, null);
    current = active;
    const st = states.get(active);
    view.setState(st ?? EditorState.create({ doc: '' }));
    if (st) { attachView(active, view); settle(); view.focus(); }
    else setCrumb('');
  }));

  // when clangd finishes indexing, rebuild the previews with the complete call graph
  createEffect(on(indexEpoch, () => {
    if (!view || !current) return;
    refreshForCursor(current, offsetToPos(view.state.doc, view.state.selection.main.head), true);
  }, { defer: true }));

  // crumb and focus dimming follow the preview state
  createEffect(() => {
    const fn = mainFn(), s = settings();
    levels(); win();
    if (!view) return;
    setCrumb(fn && fn.file === current ? fn.name : '');
    const dim: [number, number] | null = fn && fn.file === current && s['theme.focus_dimming'] ? [fn.range.start.line + 1, fn.range.end.line + 1] : null;
    view.dispatch({ effects: setMarks.of({ dim }) });
    props.onScroll();
  });

  return <div class="code" ref={host} />;
}
