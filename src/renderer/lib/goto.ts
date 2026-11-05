// Going to a definition, the same in every code view (the editor, preview cards, the flow's code preview):
// hold ⌘/Ctrl and the name under the pointer is underlined with a tag saying where it leads (nothing underlined
// when there is nowhere to go); ⌘/Ctrl-click goes there; ⌥-click shows the definition inline under the line;
// a click that finds nothing always says why.
import { EditorView, Decoration, DecorationSet, WidgetType, keymap } from '@codemirror/view';
import { EditorState, StateField, StateEffect, Extension, Prec } from '@codemirror/state';
import { definitionAt, lspState, indexing, indexEpoch, diagnosticsFor, Loc } from './lsp';
import { openFile, flash, states } from './store';
import { api, basename } from './api';
import { cardExtensions } from './cm';

export interface GotoSource { file: () => string; base: () => number }   // base: the file line of the view's first line

const MOD = (e: MouseEvent | KeyboardEvent) => e.metaKey || e.ctrlKey;
const setLink = StateEffect.define<{ from: number; to: number; tag: string } | null>();
const setPeek = StateEffect.define<{ line: number; loc: Loc; name: string; text: string } | null>();

class TagWidget extends WidgetType {
  constructor(readonly tag: string) { super(); }
  eq(o: TagWidget) { return o.tag === this.tag; }
  toDOM() { const s = document.createElement('span'); s.className = 'gt-tag'; s.textContent = this.tag; return s; }
  ignoreEvent() { return true; }
}
class PeekWidget extends WidgetType {
  private inner: EditorView | null = null;
  constructor(readonly p: { line: number; loc: Loc; name: string; text: string }) { super(); }
  eq(o: PeekWidget) { return o.p === this.p; }
  toDOM(view: EditorView) {
    const box = document.createElement('div'); box.className = 'gt-peek';
    const head = document.createElement('div'); head.className = 'gt-peek-h';
    head.innerHTML = `<span></span><span class="r">⌘/Ctrl-click opens the file · Esc closes</span><button aria-label="close">✕</button>`;
    head.firstElementChild!.textContent = `${this.p.name} · ${basename(this.p.loc.file)}:${this.p.loc.line + 1} · definition`;
    head.querySelector('button')!.addEventListener('mousedown', (e) => { e.preventDefault(); view.dispatch({ effects: setPeek.of(null) }); });
    box.appendChild(head);
    const host = document.createElement('div'); box.appendChild(host);
    this.inner = new EditorView({ parent: host, state: EditorState.create({ doc: this.p.text, extensions: [cardExtensions(this.p.loc.line + 1), gotoDefinition({ file: () => this.p.loc.file, base: () => this.p.loc.line })] }) });
    return box;
  }
  destroy() { this.inner?.destroy(); }
  ignoreEvent() { return true; }
}

const field = StateField.define<{ link: DecorationSet; peek: DecorationSet; peekAt: { line: number } | null }>({
  create: () => ({ link: Decoration.none, peek: Decoration.none, peekAt: null }),
  update(v, tr) {
    let { link, peek, peekAt } = v;
    link = link.map(tr.changes); peek = peek.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setLink)) link = e.value && e.value.to <= tr.state.doc.length
        ? Decoration.set([Decoration.mark({ class: 'gt-link' }).range(e.value.from, e.value.to), Decoration.widget({ widget: new TagWidget(e.value.tag), side: 1 }).range(e.value.to)])
        : Decoration.none;
      if (e.is(setPeek)) {
        peekAt = e.value ? { line: e.value.line } : null;
        peek = e.value ? Decoration.set([Decoration.widget({ widget: new PeekWidget(e.value), block: true, side: 1 }).range(tr.state.doc.line(e.value.line).to)]) : Decoration.none;
      }
    }
    return { link, peek, peekAt };
  },
  provide: (f) => [EditorView.decorations.from(f, (v) => v.link), EditorView.decorations.from(f, (v) => v.peek)],
});

// a lookup per name and clangd index: hovering the same name again costs nothing
const cache = new Map<string, Promise<Loc | null>>();
let cacheEpoch = -1;
function lookup(file: string, line: number, character: number): Promise<Loc | null> {
  if (cacheEpoch !== indexEpoch()) { cache.clear(); cacheEpoch = indexEpoch(); }
  const k = `${file}:${line}:${character}`;
  if (!cache.has(k)) cache.set(k, definitionAt(file, { line, character }).then((l) => { if (!l) cache.delete(k); return l; }).catch(() => { cache.delete(k); return null; }));
  return cache.get(k)!;
}

async function fileText(file: string): Promise<string[]> {
  const live = states.get(file);
  if (live) return live.doc.toString().split('\n');
  try { return (await api.fs.read(file)).split('\n'); } catch { return []; }
}

/** Why there is nothing to go to: said plainly, from what clangd and the code show. */
const KEYWORDS = new Set('alignas alignof auto bool break case catch char class const constexpr const_cast continue decltype default delete do double dynamic_cast else enum explicit extern false float for friend goto if inline int long mutable namespace new noexcept nullptr operator private protected public register reinterpret_cast return short signed sizeof static static_assert static_cast struct switch template this throw true try typedef typeid typename union unsigned using virtual void volatile while'.split(' '));
export async function whyNoDefinition(file: string, line: number, character: number, name: string): Promise<string> {
  if (KEYWORDS.has(name)) return `“${name}” is part of the language itself: there is no definition to go to.`;
  if (lspState() !== 'ready') return `No definition for ${name}: clangd isn’t running (${lspState()}).`;
  if (indexing()) return `No definition for ${name} yet: clangd is still indexing (${indexing()}). Try again when it finishes.`;
  const d = diagnosticsFor(file).find((x) => x.severity === 1 && x.range.start.line <= line && x.range.end.line >= line && (x.range.start.line < line || x.range.start.character <= character) && (x.range.end.line > line || x.range.end.character >= character));
  if (d) return `No definition for ${name}: the compiler reports “${d.message}”.`;
  // inside #if … #endif: the condition may be off for this build, and then the name isn't compiled at all
  const lines = await fileText(file), open: { text: string; line: number }[] = [];
  for (let i = 0; i < Math.min(line, lines.length); i++) {
    const t = lines[i].trim();
    if (/^#\s*if(n?def)?\b/.test(t)) open.push({ text: t, line: i });
    else if (/^#\s*(elif|else)\b/.test(t) && open.length) open[open.length - 1] = { text: t, line: i };
    else if (/^#\s*endif\b/.test(t)) open.pop();
  }
  if (open.length) { const o = open[open.length - 1]; return `No definition for ${name}: this line is inside “${o.text}” (line ${o.line + 1}). If that is off in this build, the code isn’t compiled, so clangd has nothing to go to.`; }
  return `No definition for ${name}: clangd found none (a macro it can’t follow, or a name declared without a body in this project).`;
}

/** The definition's text for an inline peek: from its line to the end of its body (or 40 lines). */
async function peekText(loc: Loc): Promise<string> {
  const lines = await fileText(loc.file);
  let depth = 0, seen = false, end = loc.line;
  for (let i = loc.line; i < lines.length && i < loc.line + 40; i++) {
    for (const ch of lines[i]) { if (ch === '{') { depth++; seen = true; } else if (ch === '}') depth--; }
    end = i;
    if ((seen && depth <= 0) || (!seen && /;\s*$/.test(lines[i]))) break;
  }
  return lines.slice(loc.line, end + 1).join('\n');
}

export function gotoDefinition(src: GotoSource): Extension {
  let hoverTimer = 0, last = '';
  const at = (v: EditorView, pos: number) => {
    const w = v.state.wordAt(pos);
    if (!w) return null;
    const l = v.state.doc.lineAt(w.from);
    return { from: w.from, to: w.to, name: v.state.sliceDoc(w.from, w.to), line: src.base() + l.number - 1, character: w.from - l.from };
  };
  const clear = (v: EditorView) => { last = ''; clearTimeout(hoverTimer); if (v.state.field(field).link !== Decoration.none) v.dispatch({ effects: setLink.of(null) }); };
  return [
    field,
    Prec.high(EditorView.domEventHandlers({
      mousemove(e, v) {
        if (!MOD(e)) { if (last) clear(v); return false; }
        const pos = v.posAtCoords({ x: e.clientX, y: e.clientY }), w = pos == null ? null : at(v, pos);
        const k = w ? `${w.from}:${w.to}` : '';
        if (k === last) return false;
        last = k; clearTimeout(hoverTimer);
        if (!w) { v.dispatch({ effects: setLink.of(null) }); return false; }
        hoverTimer = window.setTimeout(async () => {
          const loc = await lookup(src.file(), w.line, w.character);
          if (last !== k) return;
          v.dispatch({ effects: setLink.of(loc ? { from: w.from, to: w.to, tag: `↗ ${basename(loc.file)}:${loc.line + 1}` } : null) });
        }, 70);
        return false;
      },
      mouseleave(_e, v) { clear(v); return false; },
      mousedown(e, v) {
        if (e.button !== 0 || !(MOD(e) || (e.altKey && !e.shiftKey))) return false;
        const pos = v.posAtCoords({ x: e.clientX, y: e.clientY }), w = pos == null ? null : at(v, pos);
        if (!w) return false;
        e.preventDefault();
        const peek = !MOD(e);
        void lookup(src.file(), w.line, w.character).then(async (loc) => {
          if (!loc) { flash(await whyNoDefinition(src.file(), w.line, w.character, w.name), 7000); return; }
          if (!peek) { openFile(loc.file, { line: loc.line, character: loc.character }); return; }
          const line = v.state.doc.lineAt(w.from).number, cur = v.state.field(field).peekAt;
          v.dispatch({ effects: setPeek.of(cur && cur.line === line ? null : { line, loc, name: w.name, text: await peekText(loc) }) });
          v.focus();   // so Esc closes it
        });
        return true;
      },
      keyup(e, v) { if (!MOD(e) && last) clear(v); return false; },
    })),
    keymap.of([{ key: 'Escape', run: (v) => { if (!v.state.field(field).peekAt) return false; v.dispatch({ effects: setPeek.of(null) }); return true; } }]),
  ];
}
