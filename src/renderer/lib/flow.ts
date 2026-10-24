// Builds the flow view: every function reachable from main, numbered in execution order, grouped by file.
import { api, CallItem, uriToFile, fileToUri, basename } from './api';
import { workspaceSymbols, callItemAt, outgoing, inProject, resolveDefinition, withBody } from './lsp';
import { states } from './store';
import { parseCpp, loopsAt, functionDefs, offsetOf, THREAD_RE, FnDef } from '../../shared/flowcore';
import type { Tree } from '@lezer/common';

export interface FlowFn { key: string; item: CallItem; file: string; num: string; line: number }
export interface FlowEdge { from: string; to: string; nums: string[]; thread: boolean }
export interface FlowBox { file: string; fns: { name: string; num: string; line: number }[]; loops: string[]; entry: boolean; thread: boolean; dead: boolean }
export interface FlowGraph { boxes: FlowBox[]; edges: FlowEdge[]; fns: FlowFn[]; entry: string | null; note: string; truncated: boolean; unresolved: number }

const texts = new Map<string, { text: string; tree: Tree }>();
async function src(file: string) {
  const live = states.get(file)?.doc.toString();
  const c = texts.get(file);
  if (c && (live === undefined || c.text === live)) return c;
  const text = live ?? (await api.fs.read(file).catch(() => ''));
  const v = { text, tree: parseCpp(text) };
  texts.set(file, v);
  return v;
}

const keyOf = (it: CallItem) => `${it.uri}#${it.selectionRange.start.line}`;

async function findMain(root: string): Promise<CallItem | null> {
  for (const s of await workspaceSymbols('main')) {
    const f = uriToFile(s.location.uri);
    if (s.name === 'main' && (s.kind === 12) && inProject(f)) {
      const { text } = await src(f);
      const line = text.split('\n')[s.location.range.start.line] ?? '';
      const ch = Math.max(0, line.search(/\bmain\s*\(/));
      const it = await callItemAt(f, { line: s.location.range.start.line, character: ch });
      if (it) return it;
    }
  }
  // the index may not have it yet: scan the sources
  for (const f of (await api.fs.sources(root)) as string[]) {
    if (!/\.(c|cc|cpp|cxx)$/i.test(f)) continue;
    const { text } = await src(f);
    const m = /^[ \t]*(?:int|auto|void)\s+(main)\s*\(/m.exec(text);
    if (!m) continue;
    const off = m.index + m[0].indexOf('main');
    const line = text.slice(0, off).split('\n').length - 1;
    const ch = off - (text.lastIndexOf('\n', off - 1) + 1);
    const it = await callItemAt(f, { line, character: ch });
    if (it) return it;
  }
  return null;
}

export async function buildFlow(root: string, onProgress?: (n: number) => void): Promise<FlowGraph> {
  const entry = await findMain(root);
  const fns = new Map<string, FlowFn>();
  const edgeMap = new Map<string, FlowEdge>();
  const loopRanges = new Map<string, { file: string; label: string; lo: number; hi: number; first: string; last: string }>();
  let n = 0, t = 0, truncated = false;
  const MAX = 400, MAX_DEPTH = 14;

  const visit = async (item: CallItem, depth: number, thread: boolean): Promise<void> => {
    const key = keyOf(item);
    if (fns.has(key)) return;
    if (fns.size >= MAX || depth > MAX_DEPTH) { truncated = true; return; }
    const file = uriToFile(item.uri);
    const num = thread ? `t${++t}` : String(++n);
    fns.set(key, { key, item, file, num, line: item.selectionRange.start.line });
    onProgress?.(fns.size);
    const raw = (await outgoing(item)).filter((c) => c.fromRanges?.length && inProject(uriToFile(c.to.uri)));
    for (const c of raw) c.to = await resolveDefinition(c.to);
    const calls = raw
      .map((c) => ({ c, at: c.fromRanges.reduce((m, r) => (r.start.line < m.line || (r.start.line === m.line && r.start.character < m.character) ? r.start : m), c.fromRanges[0].start) }))
      .sort((a, b) => a.at.line - b.at.line || a.at.character - b.at.character);
    const { text, tree } = await src(file);
    for (const { c, at } of calls) {
      const off = offsetOf(text, at.line, at.character);
      const stmtStart = text.lastIndexOf(';', off) + 1, lineText = text.slice(Math.max(stmtStart, text.lastIndexOf('{', off) + 1), off);
      const spawns = THREAD_RE.test(lineText);
      const before = n, beforeT = t;
      await visit(c.to, depth + 1, thread || spawns);
      const callee = fns.get(keyOf(c.to));
      if (!callee) continue;
      const toFile = callee.file;
      if (toFile !== file) {
        const ek = `${file}→${toFile}`;
        const e = edgeMap.get(ek) ?? { from: file, to: toFile, nums: [], thread: false };
        if (!e.nums.includes(callee.num)) e.nums.push(callee.num);
        e.thread = e.thread || spawns;
        edgeMap.set(ek, e);
      }
      // numbers assigned while visiting this call repeat with every loop around the call site
      const assigned = thread || spawns ? t > beforeT : n > before;
      if (!assigned) continue;
      for (const lp of loopsAt(tree, text, off, file)) {
        const lo = thread || spawns ? beforeT + 1 : before + 1, hi = thread || spawns ? t : n;
        const r = loopRanges.get(lp.key);
        if (r) { r.lo = Math.min(r.lo, lo); r.hi = Math.max(r.hi, hi); }
        else loopRanges.set(lp.key, { file, label: lp.label, lo, hi, first: '', last: '' });
      }
    }
  };
  if (entry) await visit(await withBody(entry), 0, false);

  // boxes: files reached, with every function defined in them (numbered when they run)
  const byFile = new Map<string, FlowFn[]>();
  for (const f of fns.values()) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);
  const boxes: FlowBox[] = [];
  for (const [file, list] of byFile) {
    const { text, tree } = await src(file);
    const defs: FnDef[] = functionDefs(tree, text);
    const byLine = new Map(list.map((f) => [f.line, f]));
    const rows = defs.map((d) => ({ name: d.name, num: byLine.get(d.line)?.num ?? '', line: d.line }));
    for (const f of list) if (!defs.some((d) => d.line === f.line)) rows.push({ name: f.item.name, num: f.num, line: f.line });
    const numOrder = (s: string) => (s.startsWith('t') ? 1e6 + Number(s.slice(1)) : Number(s || 2e6));
    rows.sort((a, b) => numOrder(a.num) - numOrder(b.num) || a.line - b.line);
    const pre = (s: number, thr: boolean) => (thr ? `t${s}` : String(s));
    const loops = [...loopRanges.values()].filter((l) => l.file === file)
      .map((l) => { const thr = list.some((f) => f.num.startsWith('t')) && !list.some((f) => !f.num.startsWith('t')); return `↻ ${pre(l.lo, thr)}${l.hi > l.lo ? `–${pre(l.hi, thr)}` : ''} repeat · ${l.label}`; });
    boxes.push({ file, fns: rows, loops, entry: !!entry && uriToFile(entry.uri) === file, thread: list.every((f) => f.num.startsWith('t')), dead: false });
  }
  // files no entry point reaches
  const reached = new Set(byFile.keys());
  for (const f of (await api.fs.sources(root)) as string[]) {
    if (reached.has(f) || !/\.(c|cc|cpp|cxx)$/i.test(f)) continue;
    const { text, tree } = await src(f);
    boxes.push({ file: f, fns: functionDefs(tree, text).map((d) => ({ name: d.name, num: '', line: d.line })), loops: [], entry: false, thread: false, dead: true });
  }
  const note = entry ? '' : 'No main function found — showing files only. Library projects are listed without arrows.';
  const unresolved = [...fns.values()].filter((f) => /\.(h|hh|hpp|hxx)$/i.test(f.file) && f.item.range.end.line === f.item.range.start.line).length;
  return { boxes, edges: [...edgeMap.values()], fns: [...fns.values()], entry: entry ? uriToFile(entry.uri) : null, note, truncated, unresolved };
}

export const shortName = (root: string, file: string) => (file.startsWith(root) ? file.slice(root.length + 1) : basename(file));
export { fileToUri };
