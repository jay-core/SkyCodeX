// Builds the flow view: every function reachable from each main, numbered in execution order, grouped by file.
import { api, CallItem, uriToFile, fileToUri, basename } from './api';
import { workspaceSymbols, callItemAt, outgoing, inProject, resolveDefinition, withBody } from './lsp';
import { states } from './store';
import { parseCpp, loopsAt, functionDefs, offsetOf, THREAD_RE, FnDef } from '../../shared/flowcore';
import type { Tree } from '@lezer/common';

export interface FlowFn { key: string; item: CallItem; file: string; nums: string[]; line: number }
export interface FlowEdge { from: string; to: string; nums: string[]; thread: boolean }
export interface BoxFn { name: string; num: string; line: number; endLine: number }
export interface FlowBox { file: string; fns: BoxFn[]; loops: string[]; entries: string[]; thread: boolean; dead: boolean }
export interface FlowGraph { boxes: FlowBox[]; edges: FlowEdge[]; fns: FlowFn[]; entries: { file: string; label: string }[]; note: string; truncated: boolean; unresolved: number }

const texts = new Map<string, { text: string; tree: Tree }>();
async function src(file: string) {
  const live = states.get(file)?.doc.toString();
  const c = texts.get(file);
  if (c && (live === undefined || c.text === live)) return c;
  const text = live ?? ((await api.fs.read(file).catch(() => '')) as string);
  const v = { text, tree: parseCpp(text) };
  texts.set(file, v);
  return v;
}

const keyOf = (it: CallItem) => `${it.uri}#${it.selectionRange.start.line}`;
const MAIN_RE = /^[ \t]*(?:(?:static|extern|inline)\s+)*(?:int|auto|void)\s+(main|wmain|WinMain|wWinMain)\s*\(/gm;

/** Every main in the project: from clangd's index and from a scan of the sources (which also finds mains clangd can't see). */
async function findMains(root: string): Promise<CallItem[]> {
  const out = new Map<string, CallItem>();
  const add = async (file: string, line: number, ch: number, name: string) => {
    const k = `${file}#${line}`;
    if (out.has(k)) return;
    const it = await callItemAt(file, { line, character: ch });
    // a main inside a disabled #if block has no symbol; it still appears, without calls
    const pos = { line, character: ch };
    out.set(k, it ?? { name, kind: 12, uri: fileToUri(file), range: { start: pos, end: pos }, selectionRange: { start: pos, end: { line, character: ch + name.length } } });
  };
  for (const s of await workspaceSymbols('main')) {
    const f = uriToFile(s.location.uri);
    if (s.name !== 'main' || s.kind !== 12 || !inProject(f)) continue;
    const { text } = await src(f);
    const line = s.location.range.start.line;
    await add(f, line, Math.max(0, (text.split('\n')[line] ?? '').search(/\bmain\s*\(/)), 'main');
  }
  for (const f of (await api.fs.sources(root)) as string[]) {
    if (!/\.(c|cc|cpp|cxx)$/i.test(f)) continue;
    const { text } = await src(f);
    for (const m of text.matchAll(MAIN_RE)) {
      const off = m.index! + m[0].lastIndexOf(m[1]);
      const line = text.slice(0, off).split('\n').length - 1;
      await add(f, line, off - (text.lastIndexOf('\n', off - 1) + 1), m[1]);
    }
  }
  return [...out.values()].sort((a, b) => a.uri.localeCompare(b.uri) || a.selectionRange.start.line - b.selectionRange.start.line);
}

export async function buildFlow(root: string, onProgress?: (n: number) => void): Promise<FlowGraph> {
  const mains = await findMains(root);
  const fns = new Map<string, FlowFn>();
  const edgeMap = new Map<string, FlowEdge>();
  const loopRanges = new Map<string, { file: string; label: string; prefix: string; lo: number; hi: number }>();
  let truncated = false;
  const MAX = 400, MAX_DEPTH = 14;
  const multi = mains.length > 1;

  for (let e = 0; e < mains.length; e++) {
    const P = multi ? String.fromCharCode(65 + (e % 26)) : '';   // A, B, … when there is more than one main
    const seen = new Set<string>();
    let n = 0, t = 0;
    const visit = async (item: CallItem, depth: number, thread: boolean): Promise<string | null> => {
      const key = keyOf(item);
      if (seen.has(key)) return fns.get(key)!.nums.find((x) => x.startsWith(P)) ?? null;
      if (fns.size >= MAX || depth > MAX_DEPTH) { truncated = true; return null; }
      seen.add(key);
      const file = uriToFile(item.uri);
      const num = thread ? `${P}t${++t}` : `${P}${++n}`;
      const f = fns.get(key) ?? { key, item, file, nums: [], line: item.selectionRange.start.line };
      f.nums.push(num);
      fns.set(key, f);
      onProgress?.(fns.size);
      const raw = (await outgoing(item)).filter((c) => c.fromRanges?.length && inProject(uriToFile(c.to.uri)));
      for (const c of raw) c.to = await resolveDefinition(c.to);
      const calls = raw
        .map((c) => ({ c, at: c.fromRanges.reduce((m, r) => (r.start.line < m.line || (r.start.line === m.line && r.start.character < m.character) ? r.start : m), c.fromRanges[0].start) }))
        .sort((a, b) => a.at.line - b.at.line || a.at.character - b.at.character);
      const { text, tree } = await src(file);
      for (const { c, at } of calls) {
        const off = offsetOf(text, at.line, at.character);
        const lineText = text.slice(Math.max(text.lastIndexOf(';', off) + 1, text.lastIndexOf('{', off) + 1), off);
        const spawns = THREAD_RE.test(lineText);
        const sub = thread || spawns;
        const before = sub ? t : n;
        const calleeNum = await visit(c.to, depth + 1, sub);
        const callee = fns.get(keyOf(c.to));
        if (!callee || !calleeNum) continue;
        if (callee.file !== file) {
          const ek = `${file}→${callee.file}`;
          const edge = edgeMap.get(ek) ?? { from: file, to: callee.file, nums: [], thread: false };
          if (!edge.nums.includes(calleeNum)) edge.nums.push(calleeNum);
          edge.thread = edge.thread || spawns;
          edgeMap.set(ek, edge);
        }
        // numbers assigned while visiting this call repeat with every loop around the call site
        const after = sub ? t : n;
        if (after <= before) continue;
        for (const lp of loopsAt(tree, text, off, file)) {
          const lk = `${P}|${sub ? 't' : ''}|${lp.key}`;
          const r = loopRanges.get(lk);
          if (r) { r.lo = Math.min(r.lo, before + 1); r.hi = Math.max(r.hi, after); }
          else loopRanges.set(lk, { file, label: lp.label, prefix: `${P}${sub ? 't' : ''}`, lo: before + 1, hi: after });
        }
      }
      return num;
    };
    await visit(await withBody(mains[e]), 0, false);
  }

  // boxes: every file reached, with every function defined in it (numbered when it runs)
  const byFile = new Map<string, FlowFn[]>();
  for (const f of fns.values()) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);
  const order = (s: string) => { const m = s.match(/^([A-Z]?)(t?)(\d+)/); return m ? (m[1] ? m[1].charCodeAt(0) * 1e6 : 0) + (m[2] ? 5e5 : 0) + Number(m[3]) : 9e9; };
  const rowsFor = (defs: FnDef[], list: FlowFn[]): BoxFn[] => {
    const byLine = new Map(list.map((f) => [f.line, f]));
    const rows = defs.map((d) => ({ name: d.name, num: byLine.get(d.line)?.nums.join(' · ') ?? '', line: d.line, endLine: d.endLine }));
    for (const f of list) if (!defs.some((d) => d.line === f.line)) rows.push({ name: f.item.name, num: f.nums.join(' · '), line: f.line, endLine: f.item.range.end.line });
    return rows.sort((a, b) => order(a.num) - order(b.num) || a.line - b.line);
  };
  const entryLabels = mains.map((m, i) => ({ file: uriToFile(m.uri), label: multi ? `${m.name} ${String.fromCharCode(65 + (i % 26))}` : m.name }));
  const boxes: FlowBox[] = [];
  for (const [file, list] of byFile) {
    const { text, tree } = await src(file);
    const loops = [...loopRanges.values()].filter((l) => l.file === file)
      .map((l) => `↻ ${l.prefix}${l.lo}${l.hi > l.lo ? `–${l.prefix}${l.hi}` : ''} repeat · ${l.label}`);
    boxes.push({
      file, fns: rowsFor(functionDefs(tree, text), list), loops,
      entries: entryLabels.filter((x) => x.file === file).map((x) => x.label),
      thread: list.every((f) => f.nums.every((x) => /^[A-Z]?t/.test(x))), dead: false,
    });
  }
  // files no entry point reaches
  const reached = new Set(byFile.keys());
  for (const f of (await api.fs.sources(root)) as string[]) {
    if (reached.has(f) || !/\.(c|cc|cpp|cxx)$/i.test(f)) continue;
    const { text, tree } = await src(f);
    boxes.push({ file: f, fns: rowsFor(functionDefs(tree, text), []), loops: [], entries: [], thread: false, dead: true });
  }
  const note = mains.length ? '' : 'No main function found — showing files only.';
  const unresolved = [...fns.values()].filter((f) => /\.(h|hh|hpp|hxx)$/i.test(f.file) && f.item.range.end.line === f.item.range.start.line).length;
  return { boxes, edges: [...edgeMap.values()], fns: [...fns.values()], entries: entryLabels, note, truncated, unresolved };
}

export const shortName = (root: string, file: string) => (file.startsWith(root) ? file.slice(root.length + 1) : basename(file));
export { fileToUri };
