// Builds the flow view: every function reachable from each entry point, numbered in execution order, grouped by file.
//
// Fast and complete:
//  1. the call graph is crawled from clangd's index (callHierarchy/outgoingCalls needs no file open or parsed),
//     many requests in flight at once, until no new function turns up;
//  2. a call to a virtual method also reaches every override (classes and their bases come from a quick text pass,
//     the overriding methods from the index), so a chain doesn't stop at an interface;
//  3. execution order is numbered afterwards, in memory, once per entry point.
import { api, CallItem, DocSymbol, OutgoingCall, Pos, uriToFile, fileToUri, basename } from './api';
import { workspaceSymbols, callItemAt, outgoing, inProject, resolveDefinition, withBody, symbols, ensureOpen } from './lsp';
import { states } from './store';
import { parseCpp, loopsAt, functionDefs, offsetOf, THREAD_RE, FnDef } from '../../shared/flowcore';
import { analyseFunction, walkRun, fnExtent, AstNode, FnInfo, Run, Target } from '../../shared/flowrun';
import type { Tree } from '@lezer/common';

export interface FlowFn { key: string; item: CallItem; file: string; nums: string[]; line: number }
export interface FlowEdge { from: string; to: string; nums: string[]; thread: boolean; virtual: boolean; lanes: string[] }
export interface BoxFn { name: string; num: string; line: number; endLine: number }
export interface FlowBox { file: string; fns: BoxFn[]; loops: string[]; entries: string[]; thread: boolean; dead: boolean }
/** One entry point and everything it reaches: a program (one main), or a library's public API. */
export interface FlowLane { id: string; label: string; file: string; fns: number; files: string[]; start: string }
/** Between programs: one starts another, or they share code. */
export interface LaneLink { from: string; to: string; kind: 'starts' | 'shares'; text: string }
export interface FlowGraph {
  boxes: FlowBox[]; edges: FlowEdge[]; fns: FlowFn[]; entries: { file: string; label: string }[];
  lanes: FlowLane[]; links: LaneLink[]; shared: string[];
  note: string; truncated: boolean; limit: number; unresolved: number; library: number; ms: number;
}

const texts = new Map<string, { text: string; tree: Tree | null }>();
async function readText(file: string) {
  const live = states.get(file)?.doc.toString();
  const c = texts.get(file);
  if (c && (live === undefined || c.text === live)) return c;
  const v = { text: live ?? ((await api.fs.read(file).catch(() => '')) as string), tree: null as Tree | null };
  texts.set(file, v);
  return v;
}
/** Text and parse tree; the tree is made only when something needs it. */
async function src(file: string) {
  const v = await readText(file);
  if (!v.tree) v.tree = parseCpp(v.text);
  return v as { text: string; tree: Tree };
}

const keyOf = (it: CallItem) => `${it.uri}#${it.selectionRange.start.line}`;
const MAIN_NAMES = new Set(['main', 'wmain', 'WinMain', 'wWinMain']);
const SOURCE = /\.(c|cc|cpp|cxx|c\+\+|m|mm)$/i, HEADER = /\.(h|hh|hpp|hxx|h\+\+|inl|ipp|tcc)$/i;
const CONCURRENCY = 24, LIMIT = 20000;

/** Runs fn over items with at most n in flight. */
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<unknown>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}

/** Every main in the project, found in the parse tree, so a "void main()" inside a string (a GLSL shader, say) or a comment is not one. */
async function findMains(root: string): Promise<CallItem[]> {
  const out = new Map<string, CallItem>();
  const found: { file: string; line: number; ch: number; name: string }[] = [];
  const files = ((await api.fs.sources(root)) as string[]).filter((f) => SOURCE.test(f));
  await pool(files, 16, async (f) => {
    const v = await readText(f);
    if (!/\b(w?main|w?WinMain)\s*\(/.test(v.text)) return;
    const { text, tree } = await src(f);
    for (const d of functionDefs(tree, text)) {
      if (!MAIN_NAMES.has(d.name)) continue;
      const lineText = text.split('\n')[d.line] ?? '';
      found.push({ file: f, line: d.line, ch: Math.max(0, lineText.search(new RegExp(`\\b${d.name}\\s*\\(`))), name: d.name });
    }
  });
  await pool(found, 8, async ({ file, line, ch, name }) => {
    const it = await callItemAt(file, { line, character: ch });
    // a main inside a disabled #if block has no symbol; it still appears, without calls
    const pos = { line, character: ch };
    out.set(`${file}#${line}`, it ?? { name, kind: 12, uri: fileToUri(file), range: { start: pos, end: pos }, selectionRange: { start: pos, end: { line, character: ch + name.length } } });
  });
  return [...out.values()].sort((a, b) => a.uri.localeCompare(b.uri) || a.selectionRange.start.line - b.selectionRange.start.line);
}

/** Folders whose headers are a library's public interface: inc/, include/, … at most two levels down. */
const PUBLIC_DIR = /^(inc|include|includes|public|api)$/i;
const MAX_API = 2000;

/**
 * A library without main starts from its public API: every function and method declared in its public headers,
 * in the order the headers declare them, followed to its definition.
 */
async function findApi(root: string): Promise<CallItem[]> {
  const headers = ((await api.fs.sources(root)) as string[]).filter((f) => {
    if (!HEADER.test(f) || !f.startsWith(root)) return false;
    const dirs = f.slice(root.length + 1).split(/[\\/]/).slice(0, -1);
    return dirs.slice(0, 2).some((d) => PUBLIC_DIR.test(d)) && !dirs.some((d) => /^(tests?|examples?|samples?|third[_-]?party|external|vendor)$/i.test(d));
  });
  const decls: { file: string; pos: Pos }[] = [];
  const walk = (file: string, list: DocSymbol[]) => {
    for (const s of list) {
      if ((s.kind === 6 || s.kind === 12) && !/^(~|operator\b)/.test(s.name) && decls.length < MAX_API) decls.push({ file, pos: s.selectionRange.start });
      if (s.children?.length) walk(file, s.children);
    }
  };
  for (const h of headers) walk(h, await symbols(h));
  const items: (CallItem | null)[] = new Array(decls.length).fill(null);
  await pool(decls.map((d, i) => ({ ...d, i })), CONCURRENCY, async ({ file, pos, i }) => {
    const it = await callItemAt(file, pos);
    if (it) items[i] = await resolveDefinition(it);
  });
  const out = new Map<string, CallItem>();
  for (const it of items) if (it && !out.has(keyOf(it))) out.set(keyOf(it), it);
  return [...out.values()];
}

// ---------- the crawl ----------

interface Call { to: string; at: Pos; virtual: boolean }
interface Node { item: CallItem; calls: Call[]; raw: OutgoingCall[] }

const firstRange = (rs: { start: Pos }[]) => rs.reduce((m, r) => (r.start.line < m.line || (r.start.line === m.line && r.start.character < m.character) ? r.start : m), rs[0].start);

/** Classes and their direct bases, from a text pass over the project (no compiler needed). */
async function classBases(root: string): Promise<Map<string, Set<string>>> {
  const bases = new Map<string, Set<string>>();
  const files = (await api.fs.sources(root)) as string[];
  await pool(files, 16, async (f) => {
    const { text } = await readText(f);
    if (!/\b(class|struct)\b[^;{]*:/.test(text)) return;
    const clean = text.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
    for (const m of clean.matchAll(/\b(?:class|struct)\s+(?:\w+\s+)*?(\w+)\s*(?:final\s*)?:\s*([^{;]+)\{/g)) {
      const list = m[2].replace(/<[^<>]*>/g, '').split(',')
        .map((b) => b.replace(/\b(public|protected|private|virtual)\b/g, '').trim().split('::').pop()!.trim())
        .filter((b) => /^\w+$/.test(b));
      if (!list.length) continue;
      const s = bases.get(m[1]) ?? new Set<string>();
      for (const b of list) s.add(b);
      bases.set(m[1], s);
    }
  });
  return bases;
}

/** Every class that derives from cls, directly or not. */
function derivedOf(bases: Map<string, Set<string>>, cls: string): Set<string> {
  const out = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const [c, bs] of bases) if (!out.has(c) && (bs.has(cls) || [...bs].some((b) => out.has(b)))) { out.add(c); grew = true; }
  }
  return out;
}

/**
 * Everything reachable from the starts, from clangd's index, with many requests in flight.
 * Calls to methods that derived classes override also lead to each override.
 */
async function crawl(root: string, starts: CallItem[], onProgress?: (n: number) => void) {
  const nodes = new Map<string, Node>();
  let truncated = false;
  const bases = await classBases(root);
  const overridden = new Map<string, Promise<CallItem[]>>();   // method key → its overrides

  /** Overrides of a method, if its class has derived classes that define a method of that name. */
  const overridesOf = (it: CallItem): Promise<CallItem[]> => {
    const k = keyOf(it);
    let p = overridden.get(k);
    if (p) return p;
    p = (async () => {
      const parts = (it.detail ?? '').split('::');
      const cls = parts.length > 1 ? parts[parts.length - 2] : '';
      if (it.kind !== 6 || !cls) return [];
      const derived = derivedOf(bases, cls);
      if (!derived.size) return [];
      const hits = (await workspaceSymbols(it.name)).filter((s) => s.name === it.name && (s.kind === 6 || s.kind === 12)
        && derived.has((s.containerName ?? '').split('::').pop() ?? '') && inProject(uriToFile(s.location.uri)));
      const items = await Promise.all(hits.map((s) => callItemAt(uriToFile(s.location.uri), s.location.range.start)));
      return items.filter((x): x is CallItem => !!x && keyOf(x) !== k);
    })();
    overridden.set(k, p);
    return p;
  };

  let frontier = starts;
  while (frontier.length && !truncated) {
    const next: CallItem[] = [];
    const fresh = frontier.filter((it) => { const k = keyOf(it); if (nodes.has(k)) return false; if (nodes.size >= LIMIT) { truncated = true; return false; } nodes.set(k, { item: it, calls: [], raw: [] }); return true; });
    await pool(fresh, CONCURRENCY, async (it) => {
      const node = nodes.get(keyOf(it))!;
      const [raw, subs] = await Promise.all([outgoing(it), overridesOf(it)]);
      node.raw = raw;   // every call with every call site, library ones too: the analyser places each one
      for (const c of raw) {
        if (!c.fromRanges?.length || !inProject(uriToFile(c.to.uri))) continue;
        node.calls.push({ to: keyOf(c.to), at: firstRange(c.fromRanges), virtual: false });
        if (!nodes.has(keyOf(c.to))) next.push(c.to);
      }
      // an override runs where the method it overrides is called: drawn from that method, after its own calls
      for (const o of subs) {
        node.calls.push({ to: keyOf(o), at: { line: 1e9, character: 0 }, virtual: true });
        if (!nodes.has(keyOf(o))) next.push(o);
      }
      onProgress?.(nodes.size);
    });
    frontier = next;
  }
  return { nodes, truncated };
}

// ---------- programs: names, and which one starts which ----------

const SPAWN_RE = /\b(?:std::)?(?:system|_?popen|_?exec(?:l|lp|le|v|vp|vpe|ve)|posix_spawnp?|CreateProcess[AW]?|ShellExecute(?:Ex)?[AW]?|_?spawn(?:l|lp|v|vp)e?|QProcess::(?:start|execute|startDetached)|\.start|boost::process::\w+)\s*\(/g;

/** The name a main is known by: its build target, else its folder (for main.cpp), else its file name. */
function programName(file: string, targets: { name: string; sources: string[] }[]) {
  const t = targets.find((x) => x.sources.includes(file));
  if (t) return t.name;
  const stem = basename(file).replace(/\.[^.]+$/, '');
  return /^(main|app|program)$/i.test(stem) ? basename(file.replace(/[\\/][^\\/]+$/, '')) : stem;
}

export async function buildFlow(root: string, onProgress?: (n: number) => void): Promise<FlowGraph> {
  const t0 = performance.now();
  const mains = await findMains(root);
  const apiItems = mains.length ? [] : await findApi(root);
  const targets = mains.length > 1 ? ((await api.fs.targets(root).catch(() => [])) as { name: string; sources: string[] }[]) : [];
  // one lane per main; a library's whole API is one lane, numbered in the order its headers declare it
  const laneStarts: CallItem[][] = mains.length ? mains.map((m) => [m]) : apiItems.length ? [apiItems] : [];
  const starts = await Promise.all(laneStarts.flat().map((s) => withBody(s)));
  const { nodes, truncated } = await crawl(root, starts, onProgress);
  lastCrawl = { root, nodes };

  // every file a function was reached in, read (in parallel) before the numbering walks them
  await pool([...new Set([...nodes.values()].map((n) => uriToFile(n.item.uri)))], 16, (f) => readText(f));

  const fns = new Map<string, FlowFn>();
  const edgeMap = new Map<string, FlowEdge>();
  const loopRanges = new Map<string, { file: string; label: string; prefix: string; lo: number; hi: number }>();
  const multi = laneStarts.length > 1;
  const laneId = (e: number) => (e < 26 ? String.fromCharCode(65 + e) : String.fromCharCode(64 + Math.floor(e / 26)) + String.fromCharCode(65 + (e % 26)));
  let si = 0;

  for (let e = 0; e < laneStarts.length; e++) {
    const P = multi ? laneId(e) : '';
    const seen = new Set<string>();
    let n = 0, t = 0;
    const visit = async (key: string, thread: boolean, depth: number): Promise<string | null> => {
      const node = nodes.get(key);
      if (!node || depth > 400) return null;
      if (seen.has(key)) return fns.get(key)!.nums.find((x) => x.startsWith(P) && /\d/.test(x[P.length] ?? '') || x.startsWith(`${P}t`)) ?? null;
      seen.add(key);
      const file = uriToFile(node.item.uri);
      const num = thread ? `${P}t${++t}` : `${P}${++n}`;
      const f = fns.get(key) ?? { key, item: node.item, file, nums: [], line: node.item.selectionRange.start.line };
      f.nums.push(num);
      fns.set(key, f);
      const calls = [...node.calls].sort((a, b) => a.at.line - b.at.line || a.at.character - b.at.character);
      const { text, tree } = calls.some((c) => !c.virtual) ? await src(file) : { text: '', tree: null as unknown as Tree };
      for (const c of calls) {
        const off = c.virtual ? -1 : offsetOf(text, c.at.line, c.at.character);
        const spawns = off >= 0 && THREAD_RE.test(text.slice(Math.max(text.lastIndexOf(';', off) + 1, text.lastIndexOf('{', off) + 1), off));
        const sub = thread || spawns;
        const before = sub ? t : n;
        const calleeNum = await visit(c.to, sub, depth + 1);
        const callee = fns.get(c.to);
        if (!callee || !calleeNum) continue;
        if (callee.file !== file) {
          const ek = `${file}→${callee.file}`;
          const edge = edgeMap.get(ek) ?? { from: file, to: callee.file, nums: [], thread: false, virtual: true, lanes: [] };
          if (!edge.nums.includes(calleeNum)) edge.nums.push(calleeNum);
          edge.thread = edge.thread || spawns;
          edge.virtual = edge.virtual && c.virtual;   // dashed only when every call it carries is through an override
          if (!edge.lanes.includes(P)) edge.lanes.push(P);
          edgeMap.set(ek, edge);
        }
        // numbers assigned while visiting this call repeat with every loop around the call site
        const after = sub ? t : n;
        if (after <= before || off < 0) continue;
        for (const lp of loopsAt(tree, text, off, file)) {
          const lk = `${P}|${sub ? 't' : ''}|${lp.key}`;
          const r = loopRanges.get(lk);
          if (r) { r.lo = Math.min(r.lo, before + 1); r.hi = Math.max(r.hi, after); }
          else loopRanges.set(lk, { file, label: lp.label, prefix: `${P}${sub ? 't' : ''}`, lo: before + 1, hi: after });
        }
      }
      return num;
    };
    for (let k = 0; k < laneStarts[e].length; k++) await visit(keyOf(starts[si++]), false, 0);
  }

  // boxes: every file reached, with every function defined in it (numbered when it runs)
  const byFile = new Map<string, FlowFn[]>();
  for (const f of fns.values()) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);
  const order = (s: string) => { const m = s.match(/^([A-Z]*)(t?)(\d+)/); return m ? (m[1] ? [...m[1]].reduce((a, ch) => a * 27 + ch.charCodeAt(0) - 64, 0) * 1e6 : 0) + (m[2] ? 5e5 : 0) + Number(m[3]) : 9e9; };
  const rowsFor = (defs: FnDef[], list: FlowFn[]): BoxFn[] => {
    const byLine = new Map(list.map((f) => [f.line, f]));
    const rows = defs.map((d) => ({ name: d.name, num: byLine.get(d.line)?.nums.join(' · ') ?? '', line: d.line, endLine: d.endLine }));
    for (const f of list) if (!defs.some((d) => d.line === f.line)) rows.push({ name: f.item.name, num: f.nums.join(' · '), line: f.line, endLine: f.item.range.end.line });
    return rows.sort((a, b) => order(a.num) - order(b.num) || a.line - b.line);
  };
  const names = mains.map((m) => programName(uriToFile(m.uri), targets));
  const entryLabels = mains.length
    ? mains.map((m, i) => ({ file: uriToFile(m.uri), label: multi ? `${names[i]} ${laneId(i)}` : m.name }))
    : [...new Set(apiItems.map((a) => uriToFile(a.uri)))].map((file) => ({ file, label: 'API' }));
  const boxes: FlowBox[] = [];
  for (const [file, list] of byFile) {
    const { text, tree } = await src(file);
    const loops = [...loopRanges.values()].filter((l) => l.file === file)
      .map((l) => `↻ ${l.prefix}${l.lo}${l.hi > l.lo ? `–${l.prefix}${l.hi}` : ''} repeat · ${l.label}`);
    boxes.push({
      file, fns: rowsFor(functionDefs(tree, text), list), loops,
      entries: entryLabels.filter((x) => x.file === file).map((x) => x.label),
      thread: list.every((f) => f.nums.every((x) => /^[A-Z]*t/.test(x))), dead: false,
    });
  }
  // files no entry point reaches (parsed only to list their functions)
  const reached = new Set(byFile.keys());
  for (const f of (await api.fs.sources(root)) as string[]) {
    if (reached.has(f) || !/\.(c|cc|cpp|cxx)$/i.test(f)) continue;
    const { text, tree } = await src(f);
    boxes.push({ file: f, fns: rowsFor(functionDefs(tree, text), []), loops: [], entries: [], thread: false, dead: true });
  }

  // programs: what each reaches, the code they share, and which starts which
  const lanes: FlowLane[] = laneStarts.map((_, e) => {
    const P = multi ? laneId(e) : '';
    const mine = [...fns.values()].filter((f) => f.nums.some((x) => (P ? x.startsWith(P) && !/[A-Z]/.test(x[P.length] ?? '') : true)));
    const first = laneStarts.slice(0, e).reduce((a, l) => a + l.length, 0);
    return { id: P, label: mains.length ? names[e] : 'public API', file: mains.length ? uriToFile(mains[e].uri) : '', fns: mine.length, files: [...new Set(mine.map((f) => f.file))], start: keyOf(starts[first]) };
  });
  const count = new Map<string, number>();
  for (const l of lanes) for (const f of l.files) count.set(f, (count.get(f) ?? 0) + 1);
  const shared = [...count].filter(([, c]) => c > 1).map(([f]) => f);
  const links: LaneLink[] = [];
  if (lanes.length > 1) {
    for (const l of lanes) {
      const k = l.files.filter((f) => shared.includes(f)).length;
      if (k) links.push({ from: l.id, to: 'shared', kind: 'shares', text: `${k} file${k > 1 ? 's' : ''}` });
    }
    // a program that runs another by name: system("./server"), execl(".../worker", …), CreateProcess(L"tool.exe", …)
    const defsByFile = new Map<string, FnDef[]>();
    for (const l of lanes) {
      const own = [...fns.values()].filter((f) => f.nums.some((x) => x.startsWith(l.id) && !/[A-Z]/.test(x[l.id.length] ?? '')));
      const hit = new Set<string>();
      for (const f of own) {
        const { text, tree } = await src(f.file);
        if (!SPAWN_RE.test(text)) continue;
        SPAWN_RE.lastIndex = 0;
        if (!defsByFile.has(f.file)) defsByFile.set(f.file, functionDefs(tree, text));
        const d = defsByFile.get(f.file)!.find((x) => x.line === f.line);
        if (!d) continue;
        const body = text.slice(d.from, d.to);
        for (const m of body.matchAll(SPAWN_RE)) {
          const stmt = body.slice(m.index!, body.indexOf(';', m.index!) + 1 || undefined);
          const strings = [...stmt.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((s) => s[1]).join(' ');
          for (const o of lanes) {
            if (o.id === l.id || hit.has(o.id)) continue;
            if (new RegExp(`(^|[\\s/\\\\"'])${o.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\.exe)?($|[\\s"'])`).test(strings)) {
              hit.add(o.id);
              links.push({ from: l.id, to: o.id, kind: 'starts', text: `starts ${o.label}` });
            }
          }
        }
      }
    }
  }

  const note = mains.length || apiItems.length ? '' : 'No main function or public headers found — showing files only.';
  const unresolved = [...fns.values()].filter((f) => HEADER.test(f.file) && f.item.range.end.line === f.item.range.start.line && !nodes.get(f.key)?.calls.length).length;
  return {
    boxes, edges: [...edgeMap.values()], fns: [...fns.values()], entries: entryLabels, lanes, links, shared,
    note, truncated, limit: LIMIT, unresolved, library: apiItems.length, ms: Math.round(performance.now() - t0),
  };
}

// ---------- the run: one entry point's steps in execution order (src/shared/flowrun.ts) ----------

let lastCrawl: { root: string; nodes: Map<string, Node> } | null = null;
const flowCache = new Map<string, { text: string; info: FnInfo }>();
/** Forgets every file text, parse tree and analysed function, so the next build reads everything again. */
export function clearFlowCaches() { texts.clear(); flowCache.clear(); }

/**
 * Every step from one entry point (a lane's start key), numbered in execution order, with loops, conditions,
 * early exits, threads and indirect calls placed exactly. Uses the graph of the last buildFlow and asks clangd for
 * the syntax tree of each function it reaches (cached by the file's text).
 */
export async function buildRun(start: string, onProgress?: (done: number, total: number) => void): Promise<Run> {
  if (!lastCrawl) throw new Error('build the flow first');
  const { nodes } = lastCrawl;
  const target = (it: CallItem): Target => ({ key: keyOf(it), name: it.name, project: nodes.has(keyOf(it)), ctor: it.kind === 9, container: `${it.detail ?? ''} ${it.uri}` });
  // what the start reaches, overrides included
  const reach = new Set<string>([start]);
  for (const k of reach) for (const c of nodes.get(k)?.calls ?? []) reach.add(c.to);
  const byFile = new Map<string, string[]>();
  for (const k of reach) { const n = nodes.get(k); if (n) { const f = uriToFile(n.item.uri); byFile.set(f, [...(byFile.get(f) ?? []), k]); } }
  const flows = new Map<string, FnInfo>();
  let done = 0;
  // file by file, so each file is opened once and stays open while its functions are read
  await pool([...byFile.keys()], 12, async (file) => {
    const { text } = await readText(file);
    await ensureOpen(file);
    await Promise.all(byFile.get(file)!.map(async (k) => {
      const node = nodes.get(k)!, it = node.item;
      const ck = `${k}@${it.range.start.line}-${it.range.end.line}`;
      const hit = flowCache.get(ck);
      if (hit && hit.text === text) { flows.set(k, hit.info); return; }
      const ast = (await api.lsp.request('textDocument/ast', { textDocument: { uri: it.uri }, range: it.range }).catch(() => null)) as AstNode | null;
      const flow = ast ? analyseFunction(ast, text, node.raw.filter((c) => c.fromRanges?.length).map((c) => ({ to: target(c.to), fromRanges: c.fromRanges }))) : { body: [], dropped: [] };
      const overrides = node.calls.filter((c) => c.virtual).map((c) => nodes.get(c.to)).filter((x): x is Node => !!x).map((x) => target(x.item));
      const info: FnInfo = { name: it.name, file, line: it.selectionRange.start.line, ...fnExtent(ast, it.range), flow, overrides };
      if (ast) flowCache.set(ck, { text, info });
      flows.set(k, info);
    }));
    done += byFile.get(file)!.length;
    onProgress?.(done, reach.size);
  });
  return walkRun(start, (k) => flows.get(k));
}

export const shortName = (root: string, file: string) => (file.startsWith(root) ? file.slice(root.length + 1) : basename(file));
export { fileToUri };
