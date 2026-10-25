// Language engines for Rust, Python and Go files (rust-analyzer, Pyright, gopls from language packs).
// Each starts when the first file of its language opens; documents sync, diagnostics, completion, hover and go-to-definition.
import { createSignal } from 'solid-js';
import type { EditorView } from '@codemirror/view';
import { setDiagnostics, Diagnostic as CmDiagnostic } from '@codemirror/lint';
import { api, fileToUri, uriToFile, Diagnostic, Pos } from './api';
import { posToOffset } from './cm';
import { serverLang } from './langs';

type Lang = 'rust' | 'python' | 'go';
const LANG_ID: Record<Lang, string> = { rust: 'rust', python: 'python', go: 'go' };
export const [langStatus, setLangStatus] = createSignal<Partial<Record<Lang, string>>>({});

let root = '';
const started = new Map<Lang, Promise<boolean>>();
const versions = new Map<string, number>();
const diags = new Map<string, Diagnostic[]>();
const views = new Map<string, EditorView>();
const waiting = new Map<string, string>();   // documents opened before their server was ready

export function resetLanguages(folder: string) { root = folder; started.clear(); versions.clear(); diags.clear(); setLangStatus({}); }

function ensure(lang: Lang): Promise<boolean> {
  if (!root) return Promise.resolve(false);
  let p = started.get(lang);
  if (!p) {
    setLangStatus({ ...langStatus(), [lang]: 'starting' });
    p = (api.lang.start(lang, root) as Promise<{ ok: boolean; message?: string; name?: string }>).then((r) => {
      setLangStatus({ ...langStatus(), [lang]: r.ok ? `${r.name} ready` : r.message ?? 'unavailable' });
      return r.ok;
    });
    started.set(lang, p);
  }
  return p;
}
export const req = (lang: Lang, method: string, params: unknown) => api.lang.request(lang, method, params) as Promise<any>;
export const sender = (file: string) => (method: string, params: unknown) => { const l = serverLang(file); return l ? req(l, method, params) : Promise.reject(new Error('no engine')); };

export function openDoc(file: string, text: string) {
  const lang = serverLang(file)!;
  if (versions.has(file)) return changeDoc(file, () => text);
  waiting.set(file, text);
  ensure(lang).then((ok) => {
    const t = waiting.get(file);
    waiting.delete(file);
    if (!ok || t === undefined || versions.has(file)) return;
    versions.set(file, 1);
    api.lang.notify(lang, 'textDocument/didOpen', { textDocument: { uri: fileToUri(file), languageId: LANG_ID[lang], version: 1, text: t } });
  });
}
const timers = new Map<string, number>();
export function changeDoc(file: string, get: () => string) {
  if (!versions.has(file)) { if (waiting.has(file)) waiting.set(file, get()); else openDoc(file, get()); return; }
  clearTimeout(timers.get(file));
  timers.set(file, window.setTimeout(() => send(file, get()), 150));
}
function send(file: string, text: string) {
  timers.delete(file);
  const v = versions.get(file)! + 1;
  versions.set(file, v);
  api.lang.notify(serverLang(file)!, 'textDocument/didChange', { textDocument: { uri: fileToUri(file), version: v }, contentChanges: [{ text }] });
}
export function flush(file: string, text: string) { if (timers.has(file)) { clearTimeout(timers.get(file)); send(file, text); } }
export function savedDoc(file: string) { if (versions.has(file)) api.lang.notify(serverLang(file)!, 'textDocument/didSave', { textDocument: { uri: fileToUri(file) } }); }
export function attachView(file: string, view: EditorView | null) { if (view) { views.set(file, view); push(file); } else views.delete(file); }

api.lang.onNotify((_lang, method, params) => {
  if (method !== 'textDocument/publishDiagnostics') return;
  const file = uriToFile(params.uri);
  diags.set(file, params.diagnostics);
  push(file);
});
function push(file: string) {
  const v = views.get(file);
  if (!v) return;
  const doc = v.state.doc;
  const out: CmDiagnostic[] = (diags.get(file) ?? []).map((d) => {
    const from = posToOffset(doc, d.range.start.line, d.range.start.character);
    let to = posToOffset(doc, d.range.end.line, d.range.end.character);
    if (to <= from) to = Math.min(from + 1, doc.length);
    return { from, to, severity: d.severity === 1 ? 'error' : d.severity === 2 ? 'warning' : 'info', message: d.message, source: d.source };
  });
  v.dispatch(setDiagnostics(v.state, out));
}

export async function definitionAt(file: string, pos: Pos) {
  const lang = serverLang(file);
  if (!lang || !(await ensure(lang))) return null;
  let res: any;
  try { res = await req(lang, 'textDocument/definition', { textDocument: { uri: fileToUri(file) }, position: pos }); } catch { return null; }
  const l = Array.isArray(res) ? res[0] : res;
  if (!l) return null;
  const uri = l.targetUri ?? l.uri, range = l.targetSelectionRange ?? l.range;
  return { file: uriToFile(uri), line: range.start.line, character: range.start.character };
}
