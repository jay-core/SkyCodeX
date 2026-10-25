// Spelling in comments and strings (and prose in Markdown), checked by the system's own spelling checker.
// Only the lines on screen are checked, and each word is asked about once.
import { ViewPlugin, Decoration, DecorationSet, EditorView, ViewUpdate } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import { api } from './api';
import { setPalette } from './actions';
import { t } from './i18n';
import { proseWords } from './tools';

const mark = Decoration.mark({ class: 'cm-misspelt' });
const known = new Map<string, boolean>();   // word → misspelt
const IGNORE_KEY = 'spell.ignore';
const ignored = new Set<string>((() => { try { return JSON.parse(localStorage.getItem(IGNORE_KEY) || '[]'); } catch { return []; } })());

const PROSE = /Comment|String|Docstring|Paragraph|ATXHeading|SetextHeading/;
const CODE = /Code|URL|Link|Escape|Interpolation|Format|Character|Template|Preproc|Import/;   // #include "x.h" is a path, not prose


function misspelt(words: string[]): Set<string> {
  const ask = [...new Set(words.filter((w) => !known.has(w) && !ignored.has(w.toLowerCase())))];
  if (ask.length) {
    let bad: string[] = [];
    try { bad = (api as any).spell?.misspelt(ask) ?? []; } catch { /* no checker on this system */ }
    const b = new Set(bad);
    for (const w of ask) known.set(w, b.has(w));
  }
  return new Set(words.filter((w) => known.get(w) && !ignored.has(w.toLowerCase())));
}

export function spellcheck(enabled: () => boolean) {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet = Decoration.none;
    timer = 0;
    constructor(readonly view: EditorView) { this.schedule(); }
    update(u: ViewUpdate) { if (u.docChanged || u.viewportChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) this.schedule(); }
    destroy() { clearTimeout(this.timer); }
    schedule() { clearTimeout(this.timer); this.timer = window.setTimeout(() => { this.decorations = this.build(); this.view.dispatch({}); }, document.documentElement.classList.contains('saver') ? 1500 : 400); }
    build(): DecorationSet {
      if (!enabled()) return Decoration.none;
      const v = this.view, found: { from: number; to: number; word: string }[] = [];
      for (const { from, to } of v.visibleRanges) {
        syntaxTree(v.state).iterate({
          from, to,
          enter: (n) => {
            if (CODE.test(n.name)) return false;
            if (!PROSE.test(n.name)) return;
            // code inside prose (`x` in Markdown, {x} in a Python f-string) is blanked out first
            let text = v.state.sliceDoc(n.from, n.to);
            const c = n.node.cursor();
            if (c.firstChild()) do { if (CODE.test(c.name)) text = text.slice(0, c.from - n.from) + ' '.repeat(c.to - c.from) + text.slice(c.to - n.from); } while (c.nextSibling());
            found.push(...proseWords(text, n.from));
            return false;
          },
        });
      }
      const bad = misspelt(found.map((f) => f.word));
      const b = new RangeSetBuilder<Decoration>();
      for (const f of found.sort((a, c) => a.from - c.from)) if (bad.has(f.word)) b.add(f.from, f.to, mark);
      return b.finish();
    }
  }, {
    decorations: (p) => p.decorations,
    eventHandlers: {
      // right-click on an underlined word: suggestions, or ignore it from now on
      contextmenu(e, view) {
        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
        if (pos == null) return false;
        let hit: { from: number; to: number } | null = null;
        this.decorations.between(pos, pos, (from, to) => { hit = { from, to }; });
        if (!hit) return false;
        e.preventDefault();
        const { from, to } = hit as { from: number; to: number };
        const word = view.state.sliceDoc(from, to);
        let sugg: string[] = [];
        try { sugg = (api as any).spell?.suggest(word) ?? []; } catch { /* none */ }
        setPalette({
          placeholder: t('spelling of “{w}”', { w: word }),
          items: [
            ...sugg.slice(0, 8).map((s) => ({ label: s, detail: t('replace'), run: () => view.dispatch({ changes: { from, to, insert: s } }) })),
            { label: t('ignore “{w}” from now on', { w: word }), detail: '', run: () => { ignored.add(word.toLowerCase()); try { localStorage.setItem(IGNORE_KEY, JSON.stringify([...ignored])); } catch { /* this run only */ } this.schedule(); } },
          ],
        });
        return true;
      },
    },
  });
}
