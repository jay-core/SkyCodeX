// Editor actions that span files: rename, quick fixes and refactorings, quick open, the command palette.
import { createSignal } from 'solid-js';
import { api, fileToUri, uriToFile, relPath, Range } from './api';
import { lspState, diagnosticsFor, ensureOpen } from './lsp';
import { files, states, openFile, onDocChanged, getMainView, root, flash, save, saveAll, setPage, setSettingsOpen, setTerminalOpen, terminalOpen, openFolder } from './store';
import { posToOffset, offsetToPos } from './cm';

export interface PaletteItem { label: string; detail?: string; run: () => void }
export interface PaletteState { placeholder: string; items?: PaletteItem[]; prompt?: { value: string; accept: (v: string) => void } }
export const [palette, setPalette] = createSignal<PaletteState | null>(null);

const req = (method: string, params: unknown) => api.lsp.request(method, params) as Promise<any>;

/** Applies an LSP WorkspaceEdit. Affected files are opened and left unsaved so the change can be reviewed. */
export async function applyWorkspaceEdit(edit: any): Promise<number> {
  const byFile = new Map<string, { range: Range; newText: string }[]>();
  for (const [uri, edits] of Object.entries(edit?.changes ?? {})) byFile.set(uriToFile(uri), edits as any);
  for (const dc of edit?.documentChanges ?? []) if (dc.textDocument && dc.edits) byFile.set(uriToFile(dc.textDocument.uri), [...(byFile.get(uriToFile(dc.textDocument.uri)) ?? []), ...dc.edits]);
  const back = files.active;
  for (const [file, edits] of byFile) {
    if (!states.has(file)) await openFile(file);
    const st = states.get(file)!;
    const changes = edits
      .map((e) => ({ from: posToOffset(st.doc, e.range.start.line, e.range.start.character), to: posToOffset(st.doc, e.range.end.line, e.range.end.character), insert: e.newText }))
      .sort((a, b) => a.from - b.from);
    const view = getMainView();
    if (file === files.active && view) view.dispatch({ changes });
    else onDocChanged(file, st.update({ changes }).state);
  }
  if (back && states.has(back)) await openFile(back);
  if (byFile.size) flash(`changed ${byFile.size} file${byFile.size > 1 ? 's' : ''} — review, then save (⌘/Ctrl ⌥ S saves all)`, 5000);
  return byFile.size;
}
api.lsp.onNotify((method, params) => { if (method === '$/applyEdit') applyWorkspaceEdit(params); });

function cursor() {
  const v = getMainView();
  if (!v || !files.active) return null;
  const sel = v.state.selection.main;
  return { file: files.active, view: v, pos: offsetToPos(v.state.doc, sel.head), from: offsetToPos(v.state.doc, sel.from), to: offsetToPos(v.state.doc, sel.to) };
}

export async function rename() {
  const c = cursor();
  if (!c || lspState() !== 'ready') return;
  const word = c.view.state.wordAt(c.view.state.selection.main.head);
  if (!word) return;
  const old = c.view.state.sliceDoc(word.from, word.to);
  setPalette({
    placeholder: `rename ${old} to…`,
    prompt: {
      value: old,
      accept: async (name) => {
        if (!name || name === old) return;
        try {
          const edit = await req('textDocument/rename', { textDocument: { uri: fileToUri(c.file) }, position: c.pos, newName: name });
          const n = await applyWorkspaceEdit(edit);
          if (!n) flash(`nothing to rename for ${old}`);
        } catch (e) { flash(String(e).replace(/^Error: [\w/]+: /, '')); }
      },
    },
  });
}

export async function quickFix() {
  const c = cursor();
  if (!c || lspState() !== 'ready') return;
  const line = c.pos.line;
  const diagnostics = diagnosticsFor(c.file).filter((d) => d.range.start.line <= line && d.range.end.line >= line);
  let actions: any[] = [];
  try { actions = (await req('textDocument/codeAction', { textDocument: { uri: fileToUri(c.file) }, range: { start: c.from, end: c.to }, context: { diagnostics } })) ?? []; } catch { /* none */ }
  if (!actions.length) { flash('no fixes or refactorings here'); return; }
  setPalette({
    placeholder: 'fixes and refactorings',
    items: actions.map((a) => ({
      label: a.title, detail: a.kind ?? (a.command ? 'refactoring' : ''),
      run: async () => {
        if (a.edit) await applyWorkspaceEdit(a.edit);
        const cmd = a.command && typeof a.command === 'object' ? a.command : a.command ? a : null;
        if (cmd?.command) { try { await req('workspace/executeCommand', { command: cmd.command, arguments: cmd.arguments }); } catch (e) { flash(String(e)); } }
      },
    })),
  });
}

export async function findReferences() {
  const c = cursor();
  if (!c || lspState() !== 'ready') return;
  let refs: any[] = [];
  try { refs = (await req('textDocument/references', { textDocument: { uri: fileToUri(c.file) }, position: c.pos, context: { includeDeclaration: true } })) ?? []; } catch { /* none */ }
  if (!refs.length) { flash('no references found'); return; }
  const lines = new Map<string, string[]>();
  for (const r of refs) { const f = uriToFile(r.uri); if (!lines.has(f)) lines.set(f, ((await api.fs.read(f).catch(() => '')) as string).split('\n')); }
  setPalette({
    placeholder: `${refs.length} references`,
    items: refs.map((r) => { const f = uriToFile(r.uri); return { label: (lines.get(f)?.[r.range.start.line] ?? '').trim(), detail: `${relPath(root(), f)}:${r.range.start.line + 1}`, run: () => openFile(f, r.range.start) }; }),
  });
}

export async function quickOpen() {
  if (!root()) return;
  const all = (await api.fs.sources(root())) as string[];
  setPalette({ placeholder: 'open file…', items: all.map((f) => ({ label: relPath(root(), f), run: () => openFile(f) })) });
}

export async function goToSymbol() {
  if (lspState() !== 'ready') return;
  setPalette({
    placeholder: 'go to symbol in project… (type to search)',
    items: [],
  });
  symbolQuery = async (q: string) => {
    if (!q) return [];
    for (const f of files.list) await ensureOpen(f.path);
    const res = ((await req('workspace/symbol', { query: q }).catch(() => [])) as any[]).filter((s) => uriToFile(s.location.uri).startsWith(root()));
    return res.slice(0, 60).map((s) => ({ label: `${s.containerName ? s.containerName + '::' : ''}${s.name}`, detail: `${relPath(root(), uriToFile(s.location.uri))}:${s.location.range.start.line + 1}`, run: () => openFile(uriToFile(s.location.uri), s.location.range.start) }));
  };
}
export let symbolQuery: ((q: string) => Promise<PaletteItem[]>) | null = null;
export const clearSymbolQuery = () => { symbolQuery = null; };

export function commandPalette() {
  const cmds: [string, string, () => void][] = [
    ['Open folder…', '⌘/Ctrl O', () => api.fs.pickFolder().then((p) => p && openFolder(p as string))],
    ['Quick open file', '⌘/Ctrl P', quickOpen],
    ['Go to symbol in project', '⌘/Ctrl T', goToSymbol],
    ['Save', '⌘/Ctrl S', () => save()],
    ['Save all', '⌘/Ctrl ⌥ S', saveAll],
    ['Rename symbol', 'F2', rename],
    ['Fixes and refactorings', '⌘/Ctrl .', quickFix],
    ['Find references', '⇧F12', findReferences],
    ['Show flow', '', () => setPage('flow')],
    ['Show memory', '', () => setPage('memory')],
    ['Show editor', '', () => setPage('editor')],
    [terminalOpen() ? 'Hide terminal' : 'Show terminal', '⌃`', () => setTerminalOpen(!terminalOpen())],
    ['Settings', '⌘/Ctrl ,', () => setSettingsOpen(true)],
  ];
  setPalette({ placeholder: 'command…', items: cmds.map(([label, detail, run]) => ({ label, detail, run })) });
}

/** Subsequence match with a bonus for word starts and contiguous runs; null when it doesn't match. */
export function fuzzy(q: string, s: string): number | null {
  if (!q) return 0;
  const a = q.toLowerCase(), b = s.toLowerCase();
  let score = 0, j = 0, run = 0;
  for (let i = 0; i < b.length && j < a.length; i++) {
    if (b[i] === a[j]) { run++; score += 1 + run * 2 + (i === 0 || /[\/_:.\s-]/.test(b[i - 1]) ? 6 : 0); j++; } else run = 0;
  }
  return j === a.length ? score - b.length * 0.01 : null;
}
