// Smaller tools: new project from a template, the to-do list, format document, and the offline C++ reference.
import { createSignal } from 'solid-js';
import { api, relPath, fileToUri } from './api';
import { setPalette } from './actions';
import { root, openFolder, openFile, settings, flash, getMainView, files, states } from './store';
import { serverLang } from './langs';
import { sender, flush as flushOther } from './langlsp';
import { flushDoc } from './lsp';
import { posToOffset } from './cm';
import { t } from './i18n';
import { findTodos, applyEdits, refMatches, TextEdit } from './tools';
export { applyEdits };

// ---------- new project ----------
export async function newProject() {
  const list = (await api.templates.list()) as { id: string; title: string; note: string }[];
  setPalette({
    placeholder: t('new project from a template…'),
    items: list.map((tp) => ({ label: tp.title, detail: tp.note, run: () => placeProject(tp) })),
  });
}
async function placeProject(tp: { id: string; title: string }) {
  flash(t('choose the folder the new project goes in'), 3000);
  const parent = (await api.fs.pickFolder()) as string | null;
  if (!parent) return;
  setPalette({
    placeholder: t('name of the new folder, inside {where}', { where: parent }),
    prompt: {
      value: '',
      accept: async (name) => {
        const r = (await api.templates.create(parent, name, tp.id)) as { ok: boolean; message?: string; dir?: string; open?: string };
        if (!r.ok) { flash(r.message ?? t('the project was not created'), 6000); return; }
        await openFolder(r.dir!);
        await openFile(r.open!);
        flash(t('created {name} from {what}', { name, what: tp.title }), 4000);
      },
    },
  });
}

// ---------- to-do list ----------
export async function todoList() {
  if (!root()) { flash(t('open a folder first')); return; }
  const words = (settings()['editor.todo_words'] as string[] | undefined) ?? ['TODO', 'FIXME'];
  const items: { label: string; detail: string; run: () => void }[] = [];
  for (const f of (await api.fs.sources(root())) as string[]) {
    const text = states.get(f)?.doc.toString() ?? ((await api.fs.read(f).catch(() => '')) as string);
    for (const n of findTodos(text, words)) items.push({ label: `${n.word}  ${n.note || '—'}`, detail: `${relPath(root(), f)}:${n.line + 1}`, run: () => openFile(f, { line: n.line, character: n.col }) });
    if (items.length > 3000) break;
  }
  setPalette({ placeholder: items.length ? t('{n} notes · type to filter', { n: items.length }) : t('no {words} notes in this folder', { words: words.join(', ') }), items });
}

// ---------- formatting ----------
export async function formatDocument() {
  const v = getMainView(), file = files.active;
  if (!v || !file) return;
  const lang = serverLang(file);
  const text = v.state.doc.toString();
  if (lang) flushOther(file, text); else flushDoc(file, text);
  const send = lang ? sender(file) : (m: string, p: unknown) => api.lsp.request(m, p) as Promise<any>;
  let edits: TextEdit[] | null;
  try { edits = await send('textDocument/formatting', { textDocument: { uri: fileToUri(file) }, options: { tabSize: settings()['editor.tab_size'] ?? 4, insertSpaces: true } }); }
  catch (e) { flash(t('could not format: {why}', { why: String((e as Error).message ?? e).replace(/^.*formatting: /, '') }), 5000); return; }
  if (!edits?.length) { flash(t('already formatted')); return; }
  const doc = v.state.doc;
  v.dispatch({ changes: edits.map((e) => ({ from: posToOffset(doc, e.range.start.line, e.range.start.character), to: posToOffset(doc, e.range.end.line, e.range.end.character), insert: e.newText })) });
}

// ---------- the offline C++ reference ----------
export const [refPage, setRefPage] = createSignal<{ name: string; path: string } | null>(null);
let index: Record<string, string> | null | undefined;
export async function loadRefIndex(force = false) { if (index === undefined || index === null || force) index = await api.ref.index(); return index; }

export async function openReference(query?: string) {
  const idx = await loadRefIndex();
  if (!idx) { flash(t('the C++ reference is not installed — add it from the compiler window'), 5000); return; }
  const names = Object.keys(idx);
  const show = (n: string) => setRefPage({ name: n, path: idx[n] });
  const hits = query ? refMatches(names, query) : [];
  // an exact name (or std:: plus it) opens straight away; anything less certain is offered as a list
  if (hits.length === 1 || (hits.length && (hits[0] === query || hits[0] === `std::${query}`))) { show(hits[0]); return; }
  setPalette({
    placeholder: query ? t('reference pages for {q}', { q: query }) : t('search the C++ reference'),
    items: (hits.length ? hits : names.sort()).slice(0, 4000).map((n) => ({ label: n, detail: idx[n].replace(/^en\//, '').replace(/\.html$/, ''), run: () => show(n) })),
  });
}
/** The name under the cursor with its qualifiers, e.g. std::chrono::steady_clock. */
export function nameAtCursor(): string {
  const v = getMainView();
  if (!v) return '';
  const pos = v.state.selection.main.head, line = v.state.doc.lineAt(pos), col = pos - line.from;
  const before = line.text.slice(0, col).match(/[\w:~]*$/)![0], after = line.text.slice(col).match(/^\w*/)![0];
  return (before + after).replace(/^:+|:+$/g, '');
}
