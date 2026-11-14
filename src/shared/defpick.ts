export function inBuild<T extends { file: string }>(hits: T[], built: Set<string> | null, norm: (f: string) => string): T[] {
  if (!built) return hits;
  const b = hits.filter((h) => built.has(norm(h.file)));
  return b.length ? b : hits;
}

const dirsOf = (f: string) => f.split(/[\\/]/).slice(0, -1);

export function stablePick<T extends { file: string }>(hits: T[], own: T | null, caller: string, clangd: string, built: Set<string> | null, norm: (f: string) => string): T | null {
  const pool = inBuild(hits, built, norm);
  if (!own && built?.has(norm(clangd)) && (pool.length < 2 || !pool.some((h) => norm(h.file) === norm(clangd)))) return null;
  const c = dirsOf(caller);
  const shared = (f: string) => { const a = dirsOf(f); let i = 0; while (i < a.length && i < c.length && a[i] === c[i]) i++; return i; };
  const best = own ?? pool.sort((a, b) => shared(b.file) - shared(a.file) || a.file.localeCompare(b.file))[0];
  return best.file === clangd ? null : best;
}
