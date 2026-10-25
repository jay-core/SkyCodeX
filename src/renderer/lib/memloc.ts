// Finds where a symbol from the built program is defined in the source, through clangd's index.
import { workspaceSymbols, inProject } from './lsp';
import { uriToFile } from './api';
import { symbolQuery } from '../../shared/symname';

export interface SymbolLoc { file: string; line: number; character: number; inProject: boolean }

const FN = [6, 9, 12], VAR = [13, 8, 14], TYPE = [5, 23, 10];
const cache = new Map<string, Promise<SymbolLoc | null>>();

/** Best definition for a symbol of the given memory kind (code / data / bss / rodata). */
export function locateSymbol(name: string, kind: string): Promise<SymbolLoc | null> {
  const key = `${kind}|${name}`;
  if (!cache.has(key)) cache.set(key, find(name, kind));
  return cache.get(key)!;
}
export const clearSymbolLocations = () => cache.clear();

async function find(name: string, kind: string): Promise<SymbolLoc | null> {
  const q = symbolQuery(name);
  if (!q) return null;
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
    return { file, line: best.location.range.start.line, character: best.location.range.start.character, inProject: inProject(file) };
  }
  return null;
}
