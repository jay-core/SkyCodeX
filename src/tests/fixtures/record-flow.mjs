// Records what the flow analyser reads from clangd for a sample project — every function's call-hierarchy item,
// syntax tree and outgoing calls — so src/tests/flowrun.test.ts checks the analyser on real compiler output
// without starting clangd. Paths are stored relative to the project.
// usage: node src/tests/fixtures/record-flow.mjs samples/tinyhttp src/tests/fixtures/tinyhttp-flow.json
// Flags after the output (-DDEBUG -DBOARD=2) record the project under another build setting: its compile_flags.txt
// with them added, in a compile database written to a temporary folder (removed afterwards, its index with it).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startClangd, uri, file as fileOf } from '../../concepts/flow/lsp.mjs';

const [rootArg, outArg, ...extra] = process.argv.slice(2);
const root = path.resolve(rootArg);
const REPO = fileURLToPath(new URL('../../..', import.meta.url));
let ccDir = root, tmp = '';
if (extra.length) {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skycodex-record-'));
  const flags = fs.readFileSync(path.join(root, 'compile_flags.txt'), 'utf8').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const srcs = fs.readdirSync(root).filter((n) => /\.(c|cc|cpp|cxx)$/i.test(n)).map((n) => path.join(root, n));
  fs.writeFileSync(path.join(tmp, 'compile_commands.json'), JSON.stringify(srcs.map((f) => ({ directory: root, file: f, arguments: ['clang++', ...flags, ...extra, '-c', f] }))));
  ccDir = tmp;
}
process.on('exit', () => { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); });
const c = startClangd(path.join(REPO, 'tools/clangd/bin/clangd'), root, ccDir);
let indexing = 0, indexed = false;
c.on('window/workDoneProgress/create', () => {});
c.on('$/progress', (p) => { if (p.value?.kind === 'begin') indexing++; if (p.value?.kind === 'end' && --indexing <= 0) indexed = true; });
await c.init();
const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name.startsWith('.') || e.name === 'build') continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(c|cc|cpp|h|hpp)$/.test(e.name)) files.push(p); } };
walk(root);
files.sort();
for (const f of files) c.open(f);
for (let i = 0; i < 600 && !indexed; i++) await new Promise((r) => setTimeout(r, 100));
const rel = (u) => { const f = fileOf(u); return f.startsWith(root + path.sep) ? path.relative(root, f).split(path.sep).join('/') : null; };
const keyOf = (it) => { const r = rel(it.uri); return r ? `${r}#${it.selectionRange.start.line}` : `lib:${it.name}`; };
const item = (it) => ({ key: keyOf(it), name: it.name, kind: it.kind, detail: it.detail ?? '', file: rel(it.uri), lib: rel(it.uri) ? '' : path.basename(fileOf(it.uri)), range: it.range, selectionRange: it.selectionRange });
const fns = [];
for (const f of files) {
  const syms = await c.req('textDocument/documentSymbol', { textDocument: { uri: uri(f) } });
  const flat = []; const w = (l) => l.forEach((x) => { flat.push(x); w(x.children ?? []); }); w(syms ?? []);
  for (const s of flat.filter((x) => [6, 9, 12].includes(x.kind))) {
    const it = (await c.req('textDocument/prepareCallHierarchy', { textDocument: { uri: uri(f) }, position: s.selectionRange.start }))?.[0];
    if (!it || it.range.end.line === it.range.start.line && /\.(h|hpp)$/.test(f)) continue;   // declarations only
    const ast = await c.req('textDocument/ast', { textDocument: { uri: it.uri }, range: it.range });
    const calls = await c.req('callHierarchy/outgoingCalls', { item: it });
    fns.push({ ...item(it), ast, calls: (calls ?? []).map((x) => ({ to: item(x.to), fromRanges: x.fromRanges })) });
  }
}
fs.writeFileSync(outArg, JSON.stringify({ note: 'recorded from clangd by record-flow.mjs', fns }));
console.log(fns.length, 'functions');
c.stop();
process.exit(0);
