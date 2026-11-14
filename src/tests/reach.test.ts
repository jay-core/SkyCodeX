import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '../..');
const SRC = path.join(ROOT, 'src');
const OUT = [path.join(SRC, 'tests'), path.join(SRC, 'concepts')];
const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!OUT.includes(p)) out.push(...walk(p)); } else if (/\.(ts|tsx)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

const product = walk(SRC).sort();
const text = new Map(product.map((f) => [f, fs.readFileSync(f, 'utf8')]));
const resolve = (from: string, spec: string) => {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(from), spec.replace(/\?.*$/, ''));
  return [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')].find((p) => text.has(p)) ?? null;
};
const specsOf = (t: string) => [
  ...[...t.matchAll(/^\s*import\s+(?!type\s)[^'"]*?from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]),
  ...[...t.matchAll(/^\s*export\s+(?!type\s)[^'"]*?from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]),
  ...[...t.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]),
  ...[...t.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
  ...[...t.matchAll(/new URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g)].map((m) => m[1]),
];

const buildEntries = [...fs.readFileSync(path.join(SRC, 'build/build-main.mjs'), 'utf8').matchAll(/entryPoints:\s*\[\s*'([^']+)'/g)].map((m) => path.join(ROOT, m[1]));
const html = path.join(SRC, 'renderer/index.html');
const pageEntries = [...fs.readFileSync(html, 'utf8').matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => resolve(html, m[1].startsWith('/') ? `.${m[1]}` : m[1])).filter((p): p is string => !!p);
const entries = [...buildEntries, ...pageEntries];

const reached = new Set<string>();
const todo = entries.filter((e) => text.has(e));
while (todo.length) {
  const f = todo.pop()!;
  if (reached.has(f)) continue;
  reached.add(f);
  for (const s of specsOf(text.get(f)!)) { const t = resolve(f, s); if (t && !reached.has(t)) todo.push(t); }
}

const BOXES = path.join(SRC, 'shared/flowboxes.ts');
const exportsOf = (t: string) => [...t.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|interface|type|class|enum)\s+([A-Za-z_]\w*)/gm)].map((m) => m[1]);
const importedNames = (target: string) => {
  const names = new Set<string>();
  for (const [f, t] of text) {
    if (f === target) continue;
    for (const m of t.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) if (resolve(f, m[2]) === target) for (const n of m[1].split(',')) { const k = n.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]; if (k) names.add(k); }
  }
  return names;
};

describe('P5.S.6 the boxes view is gone, and what remains is reached', () => {
  it('starts from the entries the build names', () => {
    expect(entries.map(rel).sort()).toEqual(['src/main/fetch-clangd.ts', 'src/main/main.ts', 'src/preload/preload.ts', 'src/renderer/main.tsx']);
  });

  it('reaches every product file from an entry, apart from the unreached files kept as findings (P1.D4.4.a)', () => {
    expect(product.filter((f) => !reached.has(f)).map(rel)).toEqual(['src/shared/symname.ts']);
  });

  it('has every export left in shared/flowboxes.ts imported by product code (P1.D4.1.a)', () => {
    const used = importedNames(BOXES);
    expect(exportsOf(text.get(BOXES)!).filter((n) => !used.has(n))).toEqual([]);
  });

  it('keeps the units of P2.S16.T02 and P2.S16.T05', () => {
    const t = fs.readFileSync(path.join(SRC, 'tests/flowboxes.test.ts'), 'utf8');
    expect(t).toMatch(/routesBetween\(run, step\('main'\), 'split'\)/);
    expect(t).toMatch(/frameWords\(run, /);
  });
});
