import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const RENDERER = path.join(__dirname, '../renderer');
const CSS_FILE = path.join(RENDERER, 'styles.css');
const CSS = fs.readFileSync(CSS_FILE, 'utf8');
const LEFT_OUT = new Set(['smoke.ts', 'probe.ts']);

type Use = { file: string; line: number; value: string };

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...sources(p));
    else if (/\.(ts|tsx)$/.test(e.name) && !(dir === RENDERER && LEFT_OUT.has(e.name))) out.push(p);
  }
  return out.sort();
}

function uses(text: string, file: string, re: RegExp): Use[] {
  const out: Use[] = [];
  text.split('\n').forEach((l, i) => { for (const m of l.matchAll(re)) out.push({ file: path.relative(RENDERER, file), line: i + 1, value: m[1].trim() }); });
  return out;
}

const cssUses = uses(CSS, CSS_FILE, /z-index\s*:\s*([^;}]+)/g);
const inlineUses = sources(RENDERER).flatMap((f) => uses(fs.readFileSync(f, 'utf8'), f, /(?:'z-index'|zIndex)\s*:\s*([^,}]+)/g));
const all = [...cssUses, ...inlineUses];
const named = (v: string) => /^(?:'|"|`)?var\(--z-[\w-]+\)(?:'|"|`)?$/.test(v);
const nameOf = (v: string) => /--z-[\w-]+/.exec(v)?.[0] ?? '';
const rootBlocks = [...CSS.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => m[1]);
const definedIn = (text: string, name: string) => [...text.matchAll(new RegExp(`(?:^|[;{\\s])${name.replace(/[-]/g, '\\-')}\\s*:`, 'g'))].length;

describe('P5.S.1 every layer is named', () => {
  it('finds the layers it judges', () => {
    expect(cssUses.length).toBeGreaterThan(0);
    expect(inlineUses.length).toBeGreaterThan(0);
  });

  it('gives every z-index a named layer', () => {
    expect(all.filter((u) => !named(u.value)).map((u) => `${u.file}:${u.line} ${u.value}`)).toEqual([]);
  });

  it('defines every named layer exactly once, in :root', () => {
    const names = [...new Set(all.filter((u) => named(u.value)).map((u) => nameOf(u.value)))].sort();
    expect(names.length).toBeGreaterThan(0);
    const bad = names.filter((n) => definedIn(CSS, n) !== 1 || rootBlocks.reduce((k, b) => k + definedIn(b, n), 0) !== 1);
    expect(bad).toEqual([]);
  });
});
