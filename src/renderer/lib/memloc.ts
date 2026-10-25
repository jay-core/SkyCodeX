// Finds where a symbol from the built program is defined in the source, through clangd's index.
import { workspaceSymbols, inProject, ensureOpen, projectRoot } from './lsp';
import { api, uriToFile } from './api';
import { symbolQuery } from '../../shared/symname';

export interface SymbolLoc { file: string; line: number; character: number; inProject: boolean; snippet: string }

const FN = [6, 9, 12], VAR = [13, 8, 14], TYPE = [5, 23, 10];
const cache = new Map<string, Promise<SymbolLoc | null>>();

/** Best definition for a symbol of the given memory kind (code / data / bss / rodata). */
export function locateSymbol(name: string, kind: string): Promise<SymbolLoc | null> {
  const key = `${kind}|${name}`;
  if (!cache.has(key)) cache.set(key, find(name, kind).then(withSnippet).then((l) => { if (!l) cache.delete(key); return l; }));   // a miss may just be the index still loading
  return cache.get(key)!;
}

const texts = new Map<string, Promise<string[]>>();
const linesOf = (file: string) => {
  if (!texts.has(file)) texts.set(file, (api.fs.read(file) as Promise<string>).then((t) => t.split('\n')).catch(() => []));
  return texts.get(file)!;
};
/** The declaration's own line(s), for the hover: up to the end of the statement, at most three lines. */
async function withSnippet(loc: SymbolLoc | null): Promise<SymbolLoc | null> {
  if (!loc) return null;
  const lines = await linesOf(loc.file);
  const out: string[] = [];
  for (let i = loc.line; i < lines.length && out.length < 3; i++) {
    out.push(lines[i].trim());
    if (/[;{]\s*(\/\/.*)?$/.test(lines[i])) break;
  }
  return { ...loc, snippet: out.join(' ').replace(/\s*\{\s*$/, ' { … }').slice(0, 160) };
}
export const clearSymbolLocations = () => { cache.clear(); texts.clear(); known.clear(); sources = null; };

// functions with a stack frame already carry their exact file:line (from -fstack-usage)
const known = new Map<string, { file: string; line: number }>();
export function setKnownLocations(stack: { fn: string; file: string; line: number }[]) { for (const s of stack) known.set(s.fn, s); }

let sources: Promise<string[]> | null = null;
const projectSources = () => (sources ??= (api.fs.sources(projectRoot()) as Promise<string[]>).then((l) => l.filter((f) => !/\.(rs|py|pyi|go)$/i.test(f))).catch(() => []));
/** clangd indexes a project only once a file of it is open: open a couple in the background. */
export async function warmIndex() {
  for (const f of (await projectSources()).slice(0, 2)) ensureOpen(f).catch(() => {});
}
/** A known file and line (stack rows), with its source line for the hover. */
export const locAt = (file: string, line: number, inProject = true) => withSnippet({ file, line, character: 0, inProject, snippet: '' }) as Promise<SymbolLoc>;

async function find(name: string, kind: string): Promise<SymbolLoc | null> {
  // a static local, "fn(args)::var": clangd doesn't index locals, so find the function and read its body
  const local = name.match(/^(.+\)(?:\s*const)?)::([A-Za-z_]\w*)$/);
  if (local) {
    const fn = await find(local[1], 'code');
    if (!fn) return null;
    const lines = await linesOf(fn.file), re = new RegExp(`\\bstatic\\b[^;]*\\b${local[2]}\\b`);
    for (let i = fn.line; i < Math.min(lines.length, fn.line + 400); i++) {
      if (re.test(lines[i])) return { ...fn, line: i, character: lines[i].search(new RegExp(`\\b${local[2]}\\b`)) };
    }
    return fn;
  }
  const k = known.get(name);
  if (k) { const lines = await linesOf(k.file); const leaf = symbolQuery(name)?.leaf ?? ''; return { file: k.file, line: k.line, character: Math.max(0, (lines[k.line] ?? '').indexOf(leaf)), inProject: inProject(k.file), snippet: '' }; }
  const q = symbolQuery(name);
  if (!q) return null;
  return (await fromIndex(name, kind, q)) ?? (await fromSource(q, kind));
}

/** clangd's index: exact, once the project has been indexed. */
async function fromIndex(name: string, kind: string, q: { leaf: string; scope: string }): Promise<SymbolLoc | null> {
  const typeOnly = /^(construction vtable|vtable|VTT|typeinfo)/.test(name);
  const want = typeOnly ? TYPE : kind === 'code' ? FN : VAR;
  // a C symbol on Mach-O keeps its leading underscore
  for (const leaf of q.leaf.startsWith('_') ? [q.leaf, q.leaf.slice(1)] : [q.leaf]) {
    const hits = (await workspaceSymbols(leaf)).filter((s) => s.name === leaf || s.name.endsWith(`::${leaf}`));
    if (!hits.length) continue;
    const score = (s: (typeof hits)[number]) => {
      const c = s.containerName ?? '';
      return (q.scope ? (c === q.scope ? 8 : c.endsWith(q.scope) || q.scope.endsWith(c) && c ? 4 : 0) : c ? 0 : 3)
        + (inProject(uriToFile(s.location.uri)) ? 2 : 0) + (want.includes(s.kind) ? 2 : 0);
    };
    const best = hits.reduce((a, b) => (score(b) > score(a) ? b : a));
    const file = uriToFile(best.location.uri);
    return { file, line: best.location.range.start.line, character: best.location.range.start.character, inProject: inProject(file), snippet: '' };
  }
  return null;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The project's own text, when the index has nothing: the definition ("Scope::name …") first, else a declaration. */
async function fromSource(q: { leaf: string; scope: string }, kind: string): Promise<SymbolLoc | null> {
  const names = q.leaf.startsWith('_') ? [q.leaf, q.leaf.slice(1)] : [q.leaf];   // as is, then without a Mach-O underscore
  const scope = q.scope.split('::').pop() ?? '';
  let best: { file: string; line: number; character: number; score: number } | null = null;
  for (const file of await projectSources()) {
    const lines = await linesOf(file);
    for (const n of names) {
      const qualified = scope ? new RegExp(`\\b${esc(scope)}::${esc(n)}\\s*(\\[|=|;|\\{|\\()`) : null;
      const decl = new RegExp(`[\\w>*&\\]]\\s+[*&]?\\s*${esc(n)}\\s*(\\[|=|;|\\{|\\(${kind === 'code' ? '' : '|,'})`);
      lines.forEach((l, i) => {
        const t = l.trim();
        if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('#') || /^\s*(return|extern)\b/.test(t)) return;
        const score = qualified?.test(l) ? 10 : decl.test(l) ? (scope ? 4 : 6) + (/[;{]\s*(\/\/.*)?$/.test(l) ? 1 : 0) : 0;
        if (score && (!best || score > best.score)) best = { file, line: i, character: Math.max(0, l.search(new RegExp(`\\b${esc(n)}\\b`))), score };
      });
    }
    if (best && (best as { score: number }).score >= 10) break;
  }
  if (!best) return null;
  const b = best as { file: string; line: number; character: number };
  return { file: b.file, line: b.line, character: b.character, inProject: inProject(b.file), snippet: '' };
}
