// The error repair engine in the editor: under each C/C++ error, the fixes clangd confirmed (src/main/main.ts
// repair:check, src/shared/repair.ts), each with its own ✓ and ✗. Nothing in the code changes until ✓, and each ✓ is
// one edit that ⌘/Ctrl Z undoes. Hovering a fix shows why it is suggested there.
import { createSignal } from 'solid-js';
import { EditorView, Decoration, DecorationSet, WidgetType, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { StateField, StateEffect, RangeSetBuilder, EditorState } from '@codemirror/state';
import { api, fileToUri } from './api';
import { diagnosticsFor, onDiagnostics } from './lsp';
import { posToOffset } from './cm';
import { t } from './i18n';

export interface Fix { id: number; error: string; at: number; from: number; to: number; insert: string; src: string; why: string; key: string }
interface Repair { fixes: Fix[]; applied: number | null; deco: DecorationSet }

/** The note in the status line for the file shown: checking, or how many errors and checked fixes. */
export const [repairNote, setRepairNote] = createSignal<{ file: string; text: string }>({ file: '', text: '' });

const setFixes = StateEffect.define<Fix[]>();
const dropFix = StateEffect.define<number>();
const applied = StateEffect.define<number>();   // where a fix was applied (offset before it)
/** ✗: per file, the fixes the user turned down, so a later check doesn't show them again. */
const dismissed = new Map<string, Set<string>>();
/** Per file, how many errors the last check found. */
const errorsIn = new Map<string, number>();
function noteFor(file: string, n: number, fixes: number) {
  setRepairNote({ file, text: n ? `${n} ${n === 1 ? t('error') : t('errors')} · ${fixes ? `${fixes} ${fixes === 1 ? t('fix') : t('fixes')} ${t('found, each checked with clangd')}` : t('no fix found')}` : '' });
}
let nextId = 1;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The line as it reads with the fix: what goes in green, what goes out faded red and struck. */
function preview(state: EditorState, f: Fix): string {
  const doc = state.doc, l = doc.lineAt(f.from);
  if (f.insert.includes('\n') || f.to > l.to) return `<span class="add">${esc(f.insert.replace(/\n+$/, ''))}</span>`;
  const before = l.text.slice(0, f.from - l.from), after = l.text.slice(f.to - l.from), gone = doc.sliceString(f.from, f.to);
  const lead = before.length - before.trimStart().length;
  return `${esc(before.slice(lead))}${gone ? `<span class="del">${esc(gone)}</span>` : ''}${f.insert ? `<span class="add">${esc(f.insert)}</span>` : ''}${esc(after)}`;
}

// ---------- the reason, on hover ----------
let tip: HTMLElement | null = null;
const hideTip = () => { tip?.remove(); tip = null; };
function showTip(row: HTMLElement, why: string) {
  hideTip();
  tip = document.createElement('div');
  tip.className = 'cm-tooltip hov rtip';
  tip.textContent = why;
  document.body.appendChild(tip);
  // beside the fix, so it covers no code; under it when the window is too narrow
  const r = (row.querySelector('.src') ?? row).getBoundingClientRect(), w = tip.offsetWidth;
  const beside = r.right + 24 + w <= window.innerWidth - 8;
  tip.style.left = `${beside ? r.right + 24 : Math.max(8, row.getBoundingClientRect().left + 40)}px`;
  tip.style.top = `${beside ? r.top - 8 : row.getBoundingClientRect().bottom + 4}px`;
}

class FixesWidget extends WidgetType {
  constructor(readonly fixes: Fix[], readonly indent: number) { super(); }
  eq(o: FixesWidget) { return o.indent === this.indent && o.fixes.length === this.fixes.length && o.fixes.every((f, i) => f.id === this.fixes[i].id && f.from === this.fixes[i].from); }
  toDOM(view: EditorView) {
    const box = document.createElement('div');
    box.className = 'rp';
    box.style.paddingLeft = `${this.indent}ch`;
    let last = '';
    for (const f of this.fixes) {
      if (f.error !== last) { const w = document.createElement('div'); w.className = 'why0'; w.textContent = f.error; box.appendChild(w); last = f.error; }
      const row = document.createElement('div');
      row.className = 'rs';
      row.dataset.fix = String(f.id);
      row.innerHTML = `<button class="bx ok" aria-label="${esc(t('apply this fix'))}">✓</button><button class="bx no" aria-label="${esc(t('not this fix'))}">✗</button><span class="ed">${preview(view.state, f)}</span><span class="src">${esc(f.src)}</span>`;
      row.addEventListener('mouseenter', () => showTip(row, f.why));
      row.addEventListener('mouseleave', hideTip);
      const act = (ok: boolean) => (e: Event) => {
        e.preventDefault(); e.stopPropagation(); hideTip();
        const now = view.state.field(repairField).fixes.find((x) => x.id === f.id);
        if (!now) return;
        if (ok) view.dispatch({ changes: { from: now.from, to: now.to, insert: now.insert }, effects: applied.of(now.from), userEvent: 'input.repair' });
        else {
          dismissedFor(view).add(now.key);
          view.dispatch({ effects: dropFix.of(now.id) });
          const file = view.state.field(fileOf);
          noteFor(file, errorsIn.get(file) ?? 0, view.state.field(repairField).fixes.length);
        }
        view.focus();
      };
      row.querySelector('.ok')!.addEventListener('mousedown', act(true));
      row.querySelector('.no')!.addEventListener('mousedown', act(false));
      box.appendChild(row);
    }
    return box;
  }
  ignoreEvent() { return true; }
  destroy() { hideTip(); }
}
class AppliedWidget extends WidgetType {
  eq() { return true; }
  toDOM() { const s = document.createElement('span'); s.className = 'applied'; s.textContent = `   ✓ ${t('applied')} · ${/Mac/.test(navigator.platform) ? '⌘' : 'Ctrl '}Z ${t('undoes it')}`; return s; }
}

const fileOf = StateField.define<string>({ create: () => '', update: (v) => v });
const dismissedFor = (view: EditorView) => { const f = view.state.field(fileOf); if (!dismissed.has(f)) dismissed.set(f, new Set()); return dismissed.get(f)!; };

function decorate(state: EditorState, fixes: Fix[], appliedAt: number | null): DecorationSet {
  const doc = state.doc, byLine = new Map<number, Fix[]>();
  for (const f of [...fixes].sort((a, b) => a.at - b.at || a.id - b.id)) { const n = doc.lineAt(f.at).number; byLine.set(n, [...(byLine.get(n) ?? []), f]); }
  const marks: { at: number; d: Decoration }[] = [];
  if (appliedAt != null && appliedAt <= doc.length) marks.push({ at: doc.lineAt(appliedAt).to, d: Decoration.widget({ widget: new AppliedWidget(), side: 2 }) });
  for (const [n, fs] of byLine) {
    const l = doc.line(n), lead = /^[ \t]*/.exec(l.text)![0];
    const indent = [...lead].reduce((c, ch) => c + (ch === '\t' ? state.tabSize : 1), 0);
    marks.push({ at: l.to, d: Decoration.widget({ widget: new FixesWidget(fs, indent), block: true, side: 3 }) });
  }
  marks.sort((a, b) => a.at - b.at);
  const b = new RangeSetBuilder<Decoration>();
  for (const m of marks) b.add(m.at, m.at, m.d);
  return b.finish();
}

const repairField = StateField.define<Repair>({
  create: () => ({ fixes: [], applied: null, deco: Decoration.none }),
  update(v, tr) {
    // nothing shown and nothing asked: typing in a file without errors costs nothing here
    if (!v.fixes.length && v.applied === null && !tr.effects.length) return v;
    let { fixes, applied: at } = v;
    let changed = false;
    if (tr.docChanged) {
      // a fix whose error line or text was edited is no longer known to work: it waits for the next check
      fixes = fixes.flatMap((f) => {
        const l = tr.startState.doc.lineAt(f.at);
        if (tr.changes.touchesRange(Math.min(l.from, f.from), Math.max(l.to, f.to))) return [];
        return [{ ...f, at: tr.changes.mapPos(f.at), from: tr.changes.mapPos(f.from, 1), to: tr.changes.mapPos(f.to, -1) }];
      });
      at = tr.isUserEvent('input.repair') ? at : null;
      changed = true;
    }
    for (const e of tr.effects) {
      if (e.is(setFixes)) { fixes = e.value; changed = true; }
      else if (e.is(dropFix)) { fixes = fixes.filter((f) => f.id !== e.value); changed = true; }
      else if (e.is(applied)) { at = tr.changes.mapPos(e.value, -1); changed = true; }
    }
    if (!changed) return v;
    return { fixes, applied: at, deco: decorate(tr.state, fixes, at) };
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
});

/** Asks for checked fixes once the errors settle: after clangd publishes them, or a pause in typing. */
const checker = (file: string) => ViewPlugin.fromClass(class {
  timer = 0;
  sent = '';
  dead = false;   // the editor moved to another file while a check was under way
  off: () => void;
  constructor(readonly view: EditorView) {
    this.off = onDiagnostics((f) => { if (f === file) this.soon(); });
    this.soon();
  }
  update(u: ViewUpdate) { if (u.docChanged) this.soon(); }
  soon() { clearTimeout(this.timer); this.timer = window.setTimeout(() => void this.run(), 700); }
  async run() {
    const view = this.view, text = view.state.doc.toString();
    if (!diagnosticsFor(file).some((d) => (d.severity ?? 1) === 1)) {
      this.sent = '';
      if (view.state.field(repairField).fixes.length) view.dispatch({ effects: setFixes.of([]) });
      if (repairNote().file === file) setRepairNote({ file, text: '' });
      return;
    }
    if (text === this.sent) return;   // this text is checked, or being checked
    this.sent = text;
    setRepairNote({ file, text: t('checking fixes…') });
    let r: Awaited<ReturnType<typeof api.repair.check>>;
    try { r = await api.repair.check(file, fileToUri(file), text); } catch { r = { ok: false }; }
    if (this.dead || this.sent !== text) return;   // another file is shown, or a newer check is under way
    if (!r.ok || view.state.doc.toString() !== text) { this.sent = ''; if (repairNote().file === file) setRepairNote({ file, text: '' }); return; }
    const doc = view.state.doc, gone = dismissed.get(file) ?? new Set<string>();
    const fixes: Fix[] = (r.suggestions ?? []).map((s) => {
      const at = posToOffset(doc, s.error.range.start.line, s.error.range.start.character);
      return { id: nextId++, error: s.error.message, at, from: s.edit.from, to: s.edit.to, insert: s.edit.insert, src: s.src, why: s.why, key: `${s.error.message}|${s.edit.insert}|${doc.lineAt(at).text.trim()}` };
    }).filter((f) => !gone.has(f.key));
    view.dispatch({ effects: setFixes.of(fixes) });
    errorsIn.set(file, r.errors ?? 0);
    noteFor(file, r.errors ?? 0, fixes.length);
  }
  destroy() { this.dead = true; clearTimeout(this.timer); this.off(); hideTip(); }
});

/** The repair engine for a C/C++ file in the editor. */
export const repairFor = (file: string) => [fileOf.init(() => file), repairField, checker(file)];
/** The fixes shown now (smoke checks). */
export const fixesIn = (state: EditorState) => state.field(repairField, false)?.fixes ?? [];
