// Feasibility check: a function's flow (calls in order, nested in their loops and branches) from clangd's syntax
// tree and its index, expanded into callees and numbered in execution order.
// usage: node flowtree.mjs <root> <compile-commands dir> <file> <function> [depth]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startClangd, uri, file as fileOf } from './lsp.mjs';

const [root, ccDir, startFile, startName, depthArg] = process.argv.slice(2);
const MAX_DEPTH = Number(depthArg ?? 5);
const REPO = fileURLToPath(new URL('../../..', import.meta.url));   // the repository, from this script's place
const c = startClangd(path.join(REPO, 'tools/clangd/bin/clangd'), root, ccDir);
const timing = { ast: [], calls: [], syms: [] };
const time = async (k, p) => { const t = performance.now(); const r = await p; timing[k].push(performance.now() - t); return r; };

// ---- wait for clangd's background index (index-based outgoing calls need it) ----
let indexing = 0, indexed = false;
c.on('window/workDoneProgress/create', () => {});
c.on('$/progress', (p) => { if (p.value?.kind === 'begin') indexing++; if (p.value?.kind === 'end' && --indexing <= 0) indexed = true; });
const t0 = performance.now();
await c.init();
c.open(startFile);
for (let i = 0; i < 600 && !indexed; i++) await new Promise((r) => setTimeout(r, 100));
const indexMs = Math.round(performance.now() - t0);

const texts = new Map();
const text = (f) => { if (!texts.has(f)) texts.set(f, fs.readFileSync(f, 'utf8').split('\n')); return texts.get(f); };
const before = (a, b) => a.line < b.line || (a.line === b.line && a.character <= b.character);
const inside = (p, r) => before(r.start, p) && before(p, r.end);
const inProject = (f) => f.startsWith(root) && !/[\\/](build|third_party|external)[\\/]/.test(f.slice(root.length));

// ---- symbols: a function's full range, from its file's outline ----
const symCache = new Map();
async function fnAt(f, pos) {
  if (!symCache.has(f)) {
    c.open(f);
    const s = await time('syms', c.req('textDocument/documentSymbol', { textDocument: { uri: uri(f) } }));
    const flat = []; const walk = (l) => l.forEach((x) => { flat.push(x); walk(x.children ?? []); }); walk(s ?? []);
    symCache.set(f, flat.filter((x) => [6, 9, 12].includes(x.kind)));
  }
  return symCache.get(f).filter((x) => inside(pos, x.range)).sort((a, b) => (a.range.end.line - a.range.start.line) - (b.range.end.line - b.range.start.line))[0] ?? null;
}

// ---- structure: loops and branches, from the syntax tree ----
const LOOPS = { While: 'while', For: 'for', CXXForRange: 'for each', Do: 'do … while' };
const BRANCHES = { If: 'if', Switch: 'switch', ConditionalOperator: '?:' };
function structure(ast, f) {
  const out = [];
  const lines = text(f);
  const header = (r) => {   // the loop or branch header as written, up to the body
    let s = lines.slice(r.start.line, Math.min(r.end.line, r.start.line + 2) + 1).join(' ').slice(r.start.character);
    let depth = 0, end = s.length;
    for (let i = s.indexOf('('); i >= 0 && i < s.length; i++) { if (s[i] === '(') depth++; else if (s[i] === ')' && --depth === 0) { end = i + 1; break; } }
    return s.slice(0, end).replace(/\s+/g, ' ').trim();
  };
  const visit = (n, under) => {
    const k = n.kind;
    if (n.role === 'statement' && (LOOPS[k] || BRANCHES[k])) {
      const h = header(n.range);
      // a range-for's range is read once, before the loop; an if's condition always runs: only the body repeats or depends
      const kids = n.children ?? [];
      let range = n.range;
      if ((k === 'CXXForRange' || k === 'If') && kids.length > 1) range = { start: kids[k === 'If' ? 1 : kids.length - 1].range.start, end: n.range.end };
      const node = { type: LOOPS[k] ? 'loop' : 'branch', kind: LOOPS[k] ?? BRANCHES[k], range, text: h, count: LOOPS[k] ? tripCount(h) : null };
      out.push(node);
      (n.children ?? []).forEach((ch) => visit(ch, node));
      return;
    }
    if (k === 'Lambda') out.push({ type: 'lambda', range: n.range });
    (n.children ?? []).forEach((ch) => visit(ch, under));
  };
  visit(ast, null);
  return out;
}
/** for (int i = 0; i < 4; ++i): a fixed number of passes. */
function tripCount(h) {
  const m = /^for\s*\(\s*(?:[\w:]+\s+)?(\w+)\s*=\s*(\d+)\s*;\s*\1\s*(<=?)\s*(\d+)\s*;\s*(?:\+\+\1|\1\+\+|\1\s*\+=\s*1)\s*\)/.exec(h);
  return m ? Number(m[4]) - Number(m[2]) + (m[3] === '<=' ? 1 : 0) : null;
}

// ---- one function's flow: its project calls in source order, placed in their innermost loop or branch ----
const flows = new Map();
async function flowOf(item) {
  const key = `${item.uri}#${item.selectionRange.start.line}`;
  if (flows.has(key)) return flows.get(key);
  const f = fileOf(item.uri);
  const fn = await fnAt(f, item.selectionRange.start);
  const result = { key, name: item.name, file: f, line: (fn?.selectionRange ?? item.selectionRange).start.line, calls: [], structs: [] };
  flows.set(key, result);
  if (!fn) return result;
  c.open(f);
  const [ast, out] = await Promise.all([
    time('ast', c.req('textDocument/ast', { textDocument: { uri: item.uri }, range: fn.range })),
    time('calls', c.req('callHierarchy/outgoingCalls', { item }).catch(() => [])),
  ]);
  result.structs = ast ? structure(ast, f) : [];
  const src = text(f);
  for (const oc of out ?? []) {
    if (!inProject(fileOf(oc.to.uri))) continue;
    for (const r of oc.fromRanges) {
      const after = (src[r.end.line] ?? '').slice(r.end.character).trimStart();
      if (!/^[(<{]/.test(after)) { result.pointers = (result.pointers ?? 0) + 1; continue; }   // e.g. return not_found;
      result.calls.push({ at: r.start, to: oc.to });
    }
  }
  result.calls.sort((a, b) => (before(a.at, b.at) ? -1 : 1));
  return result;
}

// ---- walk from the start: numbered steps, nested loops and branches, callees opened recursively ----
let step = 0, functions = 0, loopsSeen = 0, branchesSeen = 0;
const numbered = new Map();
const lines = [];
const rows = [], frames = [];
const tiny = async (to) => { if (/^operator\W/.test(to.name)) return true; const fn = await fnAt(fileOf(to.uri), to.selectionRange.start); return !!fn && fn.range.end.line - fn.range.start.line <= 2 && FOLD; };
const FOLD = !!process.env.FOLD;
async function walk(item, depth, indent, caller = null, at = null) {
  const fl = await flowOf(item);
  const n = ++step; numbered.set(fl.key, n); functions++;
  const row = { n, name: fl.name.replace(/^.*::/, ''), file: path.relative(root, fl.file), line: fl.line + 1, caller, at, depth: caller == null ? 0 : rows[caller].depth + 1, uses: [], last: 0 };
  rows.push(row);
  const myRow = rows.length - 1;
  lines.push(`${'  '.repeat(indent)}${String(n).padStart(3)} ${fl.name}  ${path.relative(root, fl.file)}:${fl.line + 1}`);
  if (depth >= MAX_DEPTH) { if (fl.calls.length) lines.push(`${'  '.repeat(indent + 1)}    … ${fl.calls.length} calls not opened (depth ${MAX_DEPTH})`); return; }
  // each call goes under the chain of loops and branches that contain it; a header is printed when the chain changes
  let open = [];
  const openFrames = [];
  for (const call of fl.calls) {
    if (FOLD && await tiny(call.to)) { const nm = call.to.name.replace(/^.*::/, ''); if (!row.uses.includes(nm)) row.uses.push(nm); continue; }
    const chain = fl.structs.filter((s) => s.type !== 'lambda' && inside(call.at, s.range)).sort((a, b) => (before(a.range.start, b.range.start) ? -1 : 1));
    let k = 0; while (k < open.length && k < chain.length && open[k] === chain[k]) k++;
    open = open.slice(0, k);
    for (; k < chain.length; k++) {
      const s = chain[k]; open.push(s);
      if (s.type === 'loop') { loopsSeen++; lines.push(`${'  '.repeat(indent + 1 + k)}    ↻ ${s.count != null ? `×${s.count}  ` : ''}${s.text}`); }
      else { branchesSeen++; lines.push(`${'  '.repeat(indent + 1 + k)}    ? ${s.text}`); }
      const fr = { type: s.type, text: s.text, count: s.count, from: rows.length, to: rows.length - 1, owner: myRow };   // empty until a step lands in it
      frames.push(fr); openFrames[k] = fr;
    }
    const inLambda = fl.structs.some((s) => s.type === 'lambda' && inside(call.at, s.range));
    const ind = indent + 1 + open.length;
    const ck = `${call.to.uri}#${call.to.selectionRange.start.line}`;
    if (numbered.has(ck)) { lines.push(`${'  '.repeat(ind)}    → ${call.to.name} (seen at ${numbered.get(ck)})`); const nm = `→ ${call.to.name.replace(/^.*::/, '')} ${numbered.get(ck)}`; if (!row.uses.includes(nm)) row.uses.push(nm); continue; }
    if (inLambda) lines.push(`${'  '.repeat(ind)}    λ in a lambda (may run later, or on another thread):`);
    await walk(call.to, depth + 1, ind, myRow, call.at);
    rows[rows.length - 1].lambda ||= false;
    if (inLambda) rows.find((r) => r.n === numbered.get(ck)).thread = true;
    for (const fr of openFrames.slice(0, open.length)) if (fr) fr.to = rows.length - 1;
  }
  row.last = rows.length - 1;
}

const tFind = performance.now();
const startFn = (await fnAt(startFile, { line: 0, character: 0 }), symCache.get(startFile).find((s) => s.name === startName || s.name.endsWith(`::${startName}`)));
if (!startFn) { console.error('no function', startName); process.exit(1); }
const startItem = (await c.req('textDocument/prepareCallHierarchy', { textDocument: { uri: uri(startFile) }, position: startFn.selectionRange.start }))?.[0];
const tWalk = performance.now();
await walk(startItem, 0, 0);
const walkMs = Math.round(performance.now() - tWalk);

const sum = (a) => Math.round(a.reduce((x, y) => x + y, 0));
const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '-');
console.log(lines.slice(0, Number(process.env.SHOW ?? 120)).join('\n'));
if (lines.length > Number(process.env.SHOW ?? 120)) console.log(`… ${lines.length - Number(process.env.SHOW ?? 120)} more lines`);
console.log(`\nfunctions ${functions} · steps ${step} · loops ${loopsSeen} · branches ${branchesSeen} · distinct functions read ${flows.size}`);
console.log(`index ready after ${indexMs} ms · walk ${walkMs} ms (sequential)`);
console.log(`syntax trees: ${timing.ast.length} × ${avg(timing.ast)} ms · outgoing calls: ${timing.calls.length} × ${avg(timing.calls)} ms · outlines: ${timing.syms.length} × ${avg(timing.syms)} ms`);
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify({ rows, frames: frames.filter((f) => f.to >= f.from && f.from < rows.length) }, null, 1));
c.stop();
process.exit(0);
