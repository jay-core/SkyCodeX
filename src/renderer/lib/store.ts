// App state: settings, the open folder, open files and their editor states, the active page.
import { createSignal, createRoot } from 'solid-js';
import { createStore } from 'solid-js/store';
import { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { api, basename } from './api';
import { openDoc, changeDoc, savedDoc, startLsp, promote } from './lsp';

export type Settings = Record<string, any>;
export interface Problem { key: string; line: number; message: string }

export const [settings, setSettingsSig] = createSignal<Settings>({});
export const [problems, setProblems] = createSignal<Problem[]>([]);
export const [info, setInfo] = createSignal<{ dataDir: string; fallbackReason: string | null; platform: string; version: string; smoke: string | null; settingsFile: string } | null>(null);
export const [root, setRoot] = createSignal<string>('');
export const [page, setPage] = createSignal<'editor' | 'flow' | 'memory'>('editor');
export const [settingsOpen, setSettingsOpen] = createSignal(false);
export const [crumb, setCrumb] = createSignal('');
export const [cursorPos, setCursorPos] = createSignal({ line: 1, col: 1 });
export const [terminalOpen, setTerminalOpen] = createSignal(true);
export const [toast, setToast] = createSignal<string | null>(null);

export interface OpenFile { path: string; dirty: boolean; diskChanged: boolean }
export const [files, setFiles] = createStore<{ list: OpenFile[]; active: string }>({ list: [], active: '' });

/** Editor states live outside the reactive store: they are large and change on every keystroke. */
export const states = new Map<string, EditorState>();
const saved = new Map<string, string>();
let mainView: EditorView | null = null;
export const setMainView = (v: EditorView | null) => { mainView = v; };
export const getMainView = () => mainView;
let makeState: (file: string, text: string) => EditorState = (_f, text) => EditorState.create({ doc: text });
export const setStateFactory = (f: typeof makeState) => { makeState = f; };

export function applySettings(s: Settings, p: Problem[]) {
  setSettingsSig(s); setProblems(p);
  const r = document.documentElement.style;
  r.setProperty('--code-size', `${s['font.size']}px`);
  r.setProperty('--code-lh', String(s['font.line_height']));
  r.setProperty('--code-ls', `${s['font.letter_spacing']}px`);
  r.setProperty('--preview-scale', String(s['font.preview.scale']));
  r.setProperty('--mono', `'${s['font.family']}', 'ARX F1', ui-monospace, Menlo, Consolas, monospace`);
  r.setProperty('--ui', `'${s['font.ui.family']}', 'Selawik', -apple-system, 'Segoe UI', system-ui, sans-serif`);
  document.body.style.fontVariantLigatures = s['font.ligatures'] ? 'normal' : 'none';
}

export function flash(msg: string, ms = 3200) {
  setToast(msg);
  window.setTimeout(() => { if (toast() === msg) setToast(null); }, ms);
}

export async function openFolder(path: string) {
  for (const f of files.list) if (f.dirty) await api.buffers.save(f.path, states.get(f.path)!.doc.toString());
  setRoot(path); setFiles({ list: [], active: '' }); states.clear(); saved.clear();
  await api.fs.watch(path);
  await startLsp(path);
  persistSession();
}

export async function openFile(path: string, at?: { line: number; character: number }, textOverride?: string) {
  if (!states.has(path)) {
    let text: string;
    try { text = await api.fs.read(path); } catch (e) { flash(`can't open ${basename(path)}: ${e}`); return; }
    saved.set(path, text);
    const body = textOverride ?? text;
    states.set(path, makeState(path, body));
    setFiles('list', (l) => [...l, { path, dirty: body !== text, diskChanged: false }]);
    promote(path);
    openDoc(path, body);
  }
  setFiles('active', path);
  setPage('editor');
  if (at && mainView) {
    queueMicrotask(() => {
      const v = mainView!;
      const line = v.state.doc.line(Math.min(at.line + 1, v.state.doc.lines));
      const pos = Math.min(line.from + at.character, line.to);
      v.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
      v.focus();
    });
  }
  persistSession();
}

const bufferTimers = new Map<string, number>();
export function onDocChanged(path: string, state: EditorState) {
  states.set(path, state);
  // the length check makes the common case free; the full comparison only runs when lengths match
  const base = saved.get(path) ?? '';
  const dirty = state.doc.length !== base.length || state.doc.toString() !== base;
  const i = files.list.findIndex((f) => f.path === path);
  if (i >= 0 && files.list[i].dirty !== dirty) setFiles('list', i, 'dirty', dirty);
  changeDoc(path, () => states.get(path)?.doc.toString() ?? '');
  clearTimeout(bufferTimers.get(path));
  bufferTimers.set(path, window.setTimeout(() => {
    const st = states.get(path);
    if (!st) return;
    const text = st.doc.toString();
    text !== saved.get(path) ? api.buffers.save(path, text) : api.buffers.drop(path);
  }, 1000));
  const s = settings();
  if (dirty && s['editor.autosave'] === 'delay') {
    clearTimeout(autosaveTimers.get(path));
    autosaveTimers.set(path, window.setTimeout(() => save(path), s['editor.autosave_delay_ms']));
  }
}
const autosaveTimers = new Map<string, number>();

export async function save(path = files.active) {
  const st = states.get(path);
  if (!st) return;
  const text = st.doc.toString();
  try { await api.fs.write(path, text); } catch (e) { flash(`couldn't save ${basename(path)}: ${e}`, 6000); return; }
  saved.set(path, text);
  const i = files.list.findIndex((f) => f.path === path);
  if (i >= 0) { setFiles('list', i, 'dirty', false); setFiles('list', i, 'diskChanged', false); }
  savedDoc(path);
}
export async function saveAll() { for (const f of files.list) if (f.dirty) await save(f.path); }

/** Closes without asking (used after Save As, where the text now lives in the new file). */
export function forgetFile(path: string) {
  const i = files.list.findIndex((x) => x.path === path);
  setFiles('list', (l) => l.filter((x) => x.path !== path));
  states.delete(path); saved.delete(path);
  api.buffers.drop(path);
  if (files.active === path) setFiles('active', files.list[Math.min(i, files.list.length - 1)]?.path ?? '');
  persistSession();
}

export function closeFile(path: string) {
  const f = files.list.find((x) => x.path === path);
  if (f?.dirty && !confirm(`${basename(path)} has unsaved changes. Close it anyway? The changes stay recoverable in data/state until you edit it again.`)) return;
  const i = files.list.findIndex((x) => x.path === path);
  setFiles('list', (l) => l.filter((x) => x.path !== path));
  states.delete(path); saved.delete(path);
  if (files.active === path) setFiles('active', files.list[Math.min(i, files.list.length - 1)]?.path ?? '');
  persistSession();
}

/** A file changed on disk: reload it if clean, otherwise mark it so nothing is lost. */
export async function onDiskChange(path: string) {
  const i = files.list.findIndex((f) => f.path === path);
  if (i < 0) return;
  let text: string;
  try { text = await api.fs.read(path); } catch { return; }
  if (text === saved.get(path)) return;
  if (!files.list[i].dirty) {
    saved.set(path, text);
    const st = states.get(path)!;
    if (path === files.active && mainView) mainView.dispatch({ changes: { from: 0, to: mainView.state.doc.length, insert: text } });
    else states.set(path, st.update({ changes: { from: 0, to: st.doc.length, insert: text } }).state);
    changeDoc(path, text);
  } else {
    setFiles('list', i, 'diskChanged', true);
    flash(`${basename(path)} changed on disk while you have unsaved edits. Saving will overwrite the disk version.`, 7000);
  }
}

let sessionTimer: number | undefined;
export function persistSession() {
  clearTimeout(sessionTimer);
  sessionTimer = window.setTimeout(() => api.session.set({ root: root(), open: files.list.map((f) => f.path), active: files.active, page: page() }), 400);
}

export async function restoreSession() {
  const s = (await api.session.get()) as { root?: string; open?: string[]; active?: string } | null;
  const buffers = (await api.buffers.load()) as { file: string; text: string }[];
  if (!s?.root || !(await api.fs.exists(s.root))) return false;
  await openFolder(s.root);
  const pending = new Map(buffers.map((b) => [b.file, b.text]));
  for (const p of s.open ?? []) if (await api.fs.exists(p)) await openFile(p, undefined, pending.get(p));
  for (const [p, text] of pending) if (!states.has(p) && p.startsWith(s.root) && (await api.fs.exists(p))) await openFile(p, undefined, text);
  if (s.active && states.has(s.active)) setFiles('active', s.active);
  if (pending.size) flash(`restored ${pending.size} unsaved file${pending.size > 1 ? 's' : ''} from the last session`);
  return true;
}

export const store = createRoot(() => ({}));
