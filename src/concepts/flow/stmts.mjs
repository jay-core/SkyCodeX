// Every statement of each function in a walk, from clangd's syntax tree: kind (code, if, else, loop, return, break,
// continue), where it sits, how deeply it is nested, and its text. Adds `stmts` to each row of the data.
// usage: node stmts.mjs <data.json> <root> <compile-commands dir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startClangd, uri } from './lsp.mjs';

const [dataPath, root, ccDir] = process.argv.slice(2);
const d = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const REPO = fileURLToPath(new URL('../../..', import.meta.url));   // the repository, from this script's place
const c = startClangd(path.join(REPO, 'tools/clangd/bin/clangd'), root, ccDir);
await c.init();
const src = new Map(), syms = new Map();
const lines = (f) => { if (!src.has(f)) src.set(f, fs.readFileSync(f, 'utf8').split('\n')); return src.get(f); };
const before = (a, b) => a.line < b.line || (a.line === b.line && a.character <= b.character);
const inside = (p, r) => before(r.start, p) && before(p, r.end);
async function fnAt(f, line) {
  if (!syms.has(f)) {
    c.open(f);
    const s = await c.req('textDocument/documentSymbol', { textDocument: { uri: uri(f) } });
    const flat = []; const walk = (l) => l.forEach((x) => { flat.push(x); walk(x.children ?? []); }); walk(s ?? []);
    syms.set(f, flat.filter((x) => [6, 9, 12].includes(x.kind)));
  }
  return syms.get(f).filter((x) => x.range.start.line <= line && x.range.end.line >= line).sort((a, b) => (a.range.end.line - a.range.start.line) - (b.range.end.line - b.range.start.line))[0];
}
const text = (f, r) => {
  const L = lines(f);
  let t = L[r.start.line].slice(r.start.character);
  if (r.end.line === r.start.line) t = t.slice(0, r.end.character - r.start.character + 1);
  return t.replace(/\s+/g, ' ').trim().replace(/\{$/, '').trim();
};
const header = (f, r) => {   // a loop or if header, up to its closing parenthesis
  const s = lines(f).slice(r.start.line, r.start.line + 3).join(' ').slice(r.start.character);
  let depth = 0;
  for (let i = s.indexOf('('); i >= 0 && i < s.length; i++) { if (s[i] === '(') depth++; else if (s[i] === ')' && --depth === 0) return s.slice(0, i + 1).replace(/\s+/g, ' ').trim(); }
  return s.replace(/\s+/g, ' ').trim();
};
const LOOP = new Set(['While', 'For', 'CXXForRange', 'Do']);
for (const r of d.rows) {
  const f = path.join(root, r.file);
  const fn = await fnAt(f, r.line - 1);
  if (!fn) { r.stmts = []; continue; }
  const ast = await c.req('textDocument/ast', { textDocument: { uri: uri(f) }, range: fn.range });
  const body = (ast?.children ?? []).find((k) => k.kind === 'Compound');
  const out = [];
  const emit = (n, depth) => {
    if (!n) return;
    if (n.kind === 'Compound') { (n.children ?? []).forEach((k) => emit(k, depth)); return; }
    if (n.kind === 'If') {
      const kids = n.children ?? [];
      const cond = kids.find((k) => k.role === 'expression') ?? kids[0];
      // the condition is decided after the calls inside it run: the decision sits at its end
      out.push({ kind: 'if', at: cond.range.end, line: n.range.start.line + 1, depth, text: header(f, n.range) });
      const rest = kids.slice(kids.indexOf(cond) + 1);   // then, and else: statements or single expressions
      emit(rest[0], depth + 1);
      if (rest[1]) { out.push({ kind: 'else', at: rest[1].range.start, line: rest[1].range.start.line + 1, depth, text: 'else' }); emit(rest[1], depth + 1); }
      return;
    }
    if (LOOP.has(n.kind)) {
      out.push({ kind: 'loop', at: n.range.start, line: n.range.start.line + 1, depth, text: header(f, n.range) });
      const kids = n.children ?? [];
      emit(kids[kids.length - 1], depth + 1);   // the body is the last child
      return;
    }
    const kind = n.kind === 'Return' ? 'return' : n.kind === 'Break' ? 'break' : n.kind === 'Continue' ? 'continue' : 'code';
    out.push({ kind, at: n.range.start, end: n.range.end, line: n.range.start.line + 1, depth, text: text(f, n.range) });
  };
  emit(body, 0);
  // a statement whose call is a step of the walk is that step; it is not listed twice
  const kids = d.rows.map((k, i) => ({ k, i })).filter(({ k }) => k.caller === d.rows.indexOf(r) && k.at);
  for (const s of out) {
    if (s.kind !== 'code' && s.kind !== 'return') continue;
    const hit = kids.find(({ k }) => s.end && inside(k.at, { start: s.at, end: s.end }));
    if (hit) s.call = hit.i;
  }
  r.stmts = out;
}
fs.writeFileSync(dataPath, JSON.stringify(d, null, 1));
const h = d.rows.find((r) => r.name === 'handle');
console.log(h.stmts.map((s) => `${'  '.repeat(s.depth)}${s.kind.padEnd(8)} ${s.line}  ${s.text}${s.call != null ? `  [step ${d.rows[s.call].n}]` : ''}`).join('\n'));
c.stop();
process.exit(0);
