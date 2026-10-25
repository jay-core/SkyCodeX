// Renderer side of clangd: document sync, diagnostics, completion, hover, definitions, call hierarchy.
import { createSignal } from 'solid-js';
import { EditorView, hoverTooltip, Tooltip } from '@codemirror/view';
import { CompletionContext, CompletionResult, autocompletion } from '@codemirror/autocomplete';
import { setDiagnostics, Diagnostic as CmDiagnostic, linter } from '@codemirror/lint';
import { api, fileToUri, uriToFile, CallItem, OutgoingCall, DocSymbol, Diagnostic, Pos, FN_KINDS } from './api';
import { posToOffset, offsetToPos } from './cm';
import { parseCpp, offsetOf, lineOf } from '../../shared/flowcore';
import { serverLang, langOf } from './langs';
import * as other from './langlsp';

export const [lspState, setLspState] = createSignal<'off' | 'starting' | 'ready' | 'failed'>('off');
export const [lspMessage, setLspMessage] = createSignal('');
export const [indexing, setIndexing] = createSignal<string | null>(null);
/** Bumps whenever clangd's index finishes, so previews and flow can refresh. */
export const [indexEpoch, setIndexEpoch] = createSignal(0);

const versions = new Map<string, number>();
const diags = new Map<string, Diagnostic[]>();
const views = new Map<string, EditorView>();   // file → the editor showing it (for diagnostics)
let root = '';

export async function startLsp(folder: string) {
  root = folder;
  other.resetLanguages(folder);
  versions.clear(); diags.clear();
  setLspState('starting');
  const r = (await api.lsp.start(folder)) as { ok: boolean; message?: string; clangd?: string };
  setLspState(r.ok ? 'ready' : 'failed');
  setLspMessage(r.ok ? '' : r.message ?? 'clangd failed to start');
}

api.lsp.onNotify((method, params) => {
  if (method === 'textDocument/publishDiagnostics') {
    const file = uriToFile(params.uri);
    diags.set(file, params.diagnostics);
    const v = views.get(file);
    if (v) pushDiagnostics(v, file);
  } else if (method === '$/progress') {
    const v = params.value ?? {};
    if (v.kind === 'begin') setIndexing(v.title ?? 'indexing');
    else if (v.kind === 'report') setIndexing(`${v.title ?? 'indexing'}${v.percentage != null ? ` ${v.percentage}%` : ''}${v.message ? ` · ${v.message}` : ''}`);
    else if (v.kind === 'end') { setIndexing(null); defCache.clear(); setIndexEpoch((n) => n + 1); }
  } else if (method === '$/exit') {
    setLspState('failed'); setLspMessage('clangd stopped');
  }
});

// C and C++ files, including standard headers that have no extension (<ostream>, <ios>, <thread> …)
const isCpp = (f: string) => langOf(f) === 'cpp';

export function openDoc(file: string, text: string): void {
  if (serverLang(file)) return other.openDoc(file, text);
  if (!isCpp(file) || lspState() !== 'ready') return;
  if (versions.has(file)) return changeDoc(file, text);
  versions.set(file, 1);
  api.lsp.notify('textDocument/didOpen', { textDocument: { uri: fileToUri(file), languageId: /\.c$/i.test(file) ? 'c' : 'cpp', version: 1, text } });
}
const changeTimers = new Map<string, number>();
/** Text may be passed lazily, so a burst of keystrokes costs one copy of the document, when it is actually sent. */
export function changeDoc(file: string, text: string | (() => string)): void {
  const get = typeof text === 'function' ? text : () => text;
  if (serverLang(file)) return other.changeDoc(file, get);
  if (!versions.has(file)) return openDoc(file, get());
  clearTimeout(changeTimers.get(file));
  changeTimers.set(file, window.setTimeout(() => {
    changeTimers.delete(file);
    const v = versions.get(file)! + 1;
    versions.set(file, v);
    api.lsp.notify('textDocument/didChange', { textDocument: { uri: fileToUri(file), version: v }, contentChanges: [{ text: get() }] });
  }, 150));
}
/** Sends any pending change immediately (before a request that depends on the latest text). */
export function flushDoc(file: string, text: string) {
  if (!changeTimers.has(file) || !versions.has(file)) return;
  clearTimeout(changeTimers.get(file)); changeTimers.delete(file);
  const v = versions.get(file)! + 1; versions.set(file, v);
  api.lsp.notify('textDocument/didChange', { textDocument: { uri: fileToUri(file), version: v }, contentChanges: [{ text }] });
}
export function savedDoc(file: string) { if (serverLang(file)) return other.savedDoc(file); if (versions.has(file)) api.lsp.notify('textDocument/didSave', { textDocument: { uri: fileToUri(file) } }); }
export function attachView(file: string, view: EditorView | null) {
  if (serverLang(file)) return other.attachView(file, view);
  if (view) { views.set(file, view); pushDiagnostics(view, file); } else views.delete(file);
}

function pushDiagnostics(view: EditorView, file: string) {
  const doc = view.state.doc;
  const out: CmDiagnostic[] = (diags.get(file) ?? []).map((d) => {
    const from = posToOffset(doc, d.range.start.line, d.range.start.character);
    let to = posToOffset(doc, d.range.end.line, d.range.end.character);
    if (to <= from) to = Math.min(from + 1, doc.length);
    const severity = d.severity === 1 ? 'error' : d.severity === 2 ? 'warning' : 'info';
    return { from, to, severity, message: d.message, source: d.source === 'clang-tidy' && d.code ? `clang-tidy · ${d.code}` : undefined };
  });
  view.dispatch(setDiagnostics(view.state, out));
}
export const diagnosticsFor = (file: string) => diags.get(file) ?? [];
export const lintSupport = linter(null, { delay: 0 });

// clangd answers call-hierarchy and symbol requests only for open documents; files explored by the
// preview and flow views are opened in the background, at most BG_MAX at a time.
const BG_MAX = 40;
const background: string[] = [];
export async function ensureOpen(file: string): Promise<void> {
  if (versions.has(file)) {
    const i = background.indexOf(file);
    if (i >= 0) { background.splice(i, 1); background.push(file); }
    return;
  }
  if (!isCpp(file) || lspState() !== 'ready') return;
  let text = '';
  try { text = (await api.fs.read(file)) as string; } catch { return; }
  if (versions.has(file)) return;
  openDoc(file, text);
  background.push(file);
  while (background.length > BG_MAX) {
    const old = background.shift()!;
    if (views.has(old)) continue;
    versions.delete(old);
    api.lsp.notify('textDocument/didClose', { textDocument: { uri: fileToUri(old) } });
  }
}
/** A file the user opened in the editor is no longer a background document. */
export function promote(file: string) { const i = background.indexOf(file); if (i >= 0) background.splice(i, 1); }

const req = <T>(method: string, params: unknown) => (lspState() === 'ready' ? (api.lsp.request(method, params) as Promise<T>) : Promise.reject(new Error('clangd not ready')));

// ---------- completion ----------
const KIND: Record<number, string> = { 2: 'method', 3: 'function', 4: 'function', 5: 'property', 6: 'variable', 7: 'class', 8: 'interface', 9: 'namespace', 10: 'property', 13: 'enum', 14: 'keyword', 21: 'constant', 22: 'class', 25: 'type' };
type Send = (method: string, params: unknown) => Promise<any>;
export function completionFor(file: () => string, send: Send = req, flush: (file: string, text: string) => void = flushDoc) {
  return autocompletion({
    activateOnTyping: true,
    override: [async (ctx: CompletionContext): Promise<CompletionResult | null> => {
      const word = ctx.matchBefore(/[A-Za-z_][\w]*/);
      const trigger = ctx.matchBefore(/(\.|->|::)$/);
      if (!word && !trigger && !ctx.explicit) return null;
      flush(file(), ctx.state.doc.toString());
      const pos = offsetToPos(ctx.state.doc, ctx.pos);
      let res: any;
      try { res = await send('textDocument/completion', { textDocument: { uri: fileToUri(file()) }, position: pos }); } catch { return null; }
      const items: any[] = Array.isArray(res) ? res : res?.items ?? [];
      if (!items.length) return null;
      const from = word ? word.from : ctx.pos;
      return {
        from,
        options: items.slice(0, 200).map((it) => {
          const insert: string = it.textEdit?.newText ?? it.insertText ?? it.label;
          return { label: String(it.filterText ?? it.label).trim(), displayLabel: String(it.label).trim(), detail: it.detail ?? '', type: KIND[it.kind] ?? 'text', apply: insert, boost: -(it.sortText ? parseInt(String(it.sortText), 16) || 0 : 0) / 1e9 };
        }),
        validFor: /^[\w]*$/,
      };
    }],
  });
}

// ---------- hover ----------
export function hoverFor(file: () => string, send: Send = req) {
  return hoverTooltip(async (view, pos): Promise<Tooltip | null> => {
    let res: any;
    try { res = await send('textDocument/hover', { textDocument: { uri: fileToUri(file()) }, position: offsetToPos(view.state.doc, pos) }); } catch { return null; }
    const v: string = typeof res?.contents === 'string' ? res.contents : res?.contents?.value ?? '';
    if (!v.trim()) return null;
    return {
      pos, above: false,
      create() {
        const dom = document.createElement('div');
        dom.className = 'hov';
        for (const part of v.split(/```(?:cpp|c\+\+|rust|python|go)?\n?/)) {
          if (!part.trim()) continue;
          const isCode = /^\s*(\/\/|[\w:<>*&\s,()]+\s[\w:~]+\(|[\w:]+\s*$|(class|struct|enum|using|template|namespace)\b)/.test(part) && part.length < 400;
          const el = document.createElement(isCode ? 'pre' : 'div');
          el.textContent = part.replace(/\n{3,}/g, '\n\n').replace(/^---$/gm, '').trim();
          if (!isCode) el.style.margin = '4px 0';
          dom.appendChild(el);
        }
        return { dom };
      },
    };
  }, { hoverTime: 350 });
}

// ---------- navigation ----------
export interface Loc { file: string; line: number; character: number }
export async function definitionAt(file: string, pos: Pos): Promise<Loc | null> {
  if (serverLang(file)) return other.definitionAt(file, pos);
  await ensureOpen(file);
  let res: any;
  try { res = await req('textDocument/definition', { textDocument: { uri: fileToUri(file) }, position: pos }); } catch { return null; }
  const l = Array.isArray(res) ? res[0] : res;
  if (!l) return null;
  const uri = l.targetUri ?? l.uri, range = l.targetSelectionRange ?? l.range;
  return { file: uriToFile(uri), line: range.start.line, character: range.start.character };
}

const symCache = new Map<string, { v: number; syms: DocSymbol[] }>();
export async function symbols(file: string): Promise<DocSymbol[]> {
  await ensureOpen(file);
  const v = versions.get(file) ?? -1, hit = symCache.get(file);
  if (hit && hit.v === v && !changeTimers.has(file)) return hit.syms;
  try {
    const syms = ((await req('textDocument/documentSymbol', { textDocument: { uri: fileToUri(file) } })) as DocSymbol[]) ?? [];
    if (syms.length) symCache.set(file, { v, syms });   // an empty answer may just mean clangd is still parsing
    return syms;
  } catch { return []; }
}

/** The innermost function, method or constructor whose body contains pos. */
export function enclosingFunction(syms: DocSymbol[], pos: Pos): DocSymbol | null {
  const inside = (r: { start: Pos; end: Pos }) =>
    (pos.line > r.start.line || (pos.line === r.start.line && pos.character >= r.start.character)) &&
    (pos.line < r.end.line || (pos.line === r.end.line && pos.character <= r.end.character));
  let best: DocSymbol | null = null;
  const walk = (list: DocSymbol[]) => {
    for (const s of list) {
      if (!inside(s.range)) continue;
      if (FN_KINDS.has(s.kind) && s.range.end.line > s.range.start.line) best = s;
      if (s.children) walk(s.children);
    }
  };
  walk(syms);
  return best;
}

export async function callItemAt(file: string, pos: Pos): Promise<CallItem | null> {
  await ensureOpen(file);
  try { const r = (await req('textDocument/prepareCallHierarchy', { textDocument: { uri: fileToUri(file) }, position: pos })) as CallItem[]; return r?.[0] ?? null; } catch { return null; }
}
export async function outgoing(item: CallItem): Promise<OutgoingCall[]> {
  try { return ((await req('callHierarchy/outgoingCalls', { item })) as OutgoingCall[]) ?? []; } catch { return []; }
}
export async function workspaceSymbols(query: string): Promise<{ name: string; kind: number; location: { uri: string; range: { start: Pos } }; containerName?: string }[]> {
  try { return ((await req('workspace/symbol', { query })) as any[]) ?? []; } catch { return []; }
}
export const projectRoot = () => root;
export const inProject = (file: string) => !!root && file.startsWith(root) && !/[\\/](build|third_party|external)[\\/]/.test(file.slice(root.length));

/** Call-hierarchy items often point at a declaration in a header; follow them to the definition with its body. */
const defCache = new Map<string, CallItem>();
export async function resolveDefinition(item: CallItem): Promise<CallItem> {
  const k = `${item.uri}#${item.selectionRange.start.line}:${item.selectionRange.start.character}`;
  const hit = defCache.get(k);
  if (hit) return hit;
  let out = item;
  // A source-file item already is the definition. Asking clangd for the "definition" of a definition
  // returns its declaration, so only header items are followed.
  if (HEADER.test(item.uri)) {
    const loc = await definitionAt(uriToFile(item.uri), item.selectionRange.start);
    if (loc && !HEADER.test(loc.file)) {
      const d = await callItemAt(loc.file, { line: loc.line, character: loc.character });
      if (d) out = d;
    }
  }
  out = await withBody(out);
  const hasBody = out.range.end.line > out.range.start.line || !HEADER.test(out.uri);
  if (hasBody) defCache.set(k, out);   // never remember a failed lookup: the index may still be loading
  return out;
}
const HEADER = /\.(h|hh|hpp|hxx|inl|ipp)$/i;

/** Widens an item's range to the whole function definition (signature to closing brace) using the parser. */
const parsedLib = new Map<string, { text: string; tree: ReturnType<typeof parseCpp> }>();
export async function withBody(item: CallItem): Promise<CallItem> {
  const file = uriToFile(item.uri);
  let hit = parsedLib.get(file);
  if (!hit) {
    let text = '';
    try { text = (await api.fs.read(file)) as string; } catch { return item; }
    hit = { text, tree: parseCpp(text) };
    if (!inProject(file)) { if (parsedLib.size > 30) parsedLib.clear(); parsedLib.set(file, hit); }
  }
  const { text, tree } = hit;
  const off = offsetOf(text, item.selectionRange.start.line, item.selectionRange.start.character);
  for (let n: any = tree.resolveInner(off, 1); n; n = n.parent) {
    if (n.name === 'FunctionDefinition') {
      const a = lineOf(text, n.from), b = lineOf(text, n.to);
      return { ...item, range: { start: { line: a, character: 0 }, end: { line: b, character: 0 } } };
    }
  }
  return item;
}
export const clearDefinitionCache = () => defCache.clear();
