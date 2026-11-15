import { api, CallItem, DocSymbol, OutgoingCall, Pos, uriToFile, fileToUri, basename, normPath } from './api';
import { inBuild, stablePick } from '../../shared/defpick';
import { workspaceSymbols, callItemAt, outgoing, inProject, resolveDefinition, withBody, symbols, ensureOpen } from './lsp';
import { states } from './store';
import { parseCpp, loopsAt, functionDefs, definedNames, addressCandidates, offsetOf, THREAD_RE, FnDef } from '../../shared/flowcore';
import { analyseFunction, walkRun, fnExtent, functionNode, AstNode, FnInfo, Run, Target } from '../../shared/flowrun';
import { effects } from '../../shared/flowfacts';
import type { Tree } from '@lezer/common';

export interface FlowFn { key: string; item: CallItem; file: string; nums: string[]; line: number }
export interface FlowEdge { from: string; to: string; nums: string[]; thread: boolean; virtual: boolean; lanes: string[] }
export interface BoxFn { name: string; num: string; line: number; endLine: number }
export interface FlowBox { file: string; fns: BoxFn[]; loops: string[]; entries: string[]; thread: boolean; dead: boolean }
export interface FlowLane { id: string; label: string; file: string; fns: number; files: string[]; start: string }
export interface LaneLink { from: string; to: string; kind: 'starts' | 'shares'; text: string }
export interface FlowGraph {
  boxes: FlowBox[]; edges: FlowEdge[]; fns: FlowFn[]; entries: { file: string; label: string }[];
  lanes: FlowLane[]; links: LaneLink[]; shared: string[];
  note: string; truncated: boolean; limit: number; unresolved: number; library: number; apiLeft?: number; ms: number;
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
export const invalidateFlowText = (file: string) => { texts.delete(file); };
export const builtText = (file: string): string | undefined => texts.get(file)?.text;
async function src(file: string) {
  const v = await readText(file);
  if (!v.tree) v.tree = parseCpp(v.text);
  return v as { text: string; tree: Tree };
}

const keyOf = (it: CallItem) => `${it.uri}#${it.selectionRange.start.line}`;
const MAIN_NAMES = new Set(['main', 'wmain', 'WinMain', 'wWinMain']);
const SOURCE = /\.(c|cc|cpp|cxx|c\+\+|m|mm)$/i, HEADER = /\.(h|hh|hpp|hxx|h\+\+|inl|ipp|tcc)$/i;
const CONCURRENCY = 24, LIMIT = 20000;

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<unknown>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}

export interface Entry { file: string; line: number; ch: number; name: string; rel: string; label: string; kind?: 'main' | 'interrupt' }

const ISR_NAME = /^(?:\w+_IRQHandler|SysTick_Handler|PendSV_Handler|SVC_Handler|NMI_Handler|HardFault_Handler|MemManage_Handler|BusFault_Handler|UsageFault_Handler|DebugMon_Handler|\w+_ISR|ISR)$/;
const ISR_MARK = /__attribute__\s*\(\(\s*(?:interrupt|isr|signal)\b|\b__interrupt\b|\b__irq\b/;
export const entryKey = (e: Entry) => `${fileToUri(e.file)}#${e.line}`;

export async function findEntries(root: string): Promise<Entry[]> {
  const found: Entry[] = [];
  const files = ((await api.fs.sources(root)) as string[]).filter((f) => SOURCE.test(f));
  await pool(files, 16, async (f) => {
    const v = await readText(f);
    if (!/\b(w?main|w?WinMain)\s*\(|_IRQHandler\b|_Handler\b|_ISR\b|\bISR\s*\(|__interrupt\b|__irq\b|\(\(\s*(?:interrupt|isr|signal)\b/.test(v.text)) return;
    const { text, tree } = await src(f);
    for (const d of functionDefs(tree, text)) {
      const isr = !MAIN_NAMES.has(d.name) && (ISR_NAME.test(d.name) || ISR_MARK.test(text.slice(d.from, offsetOf(text, d.line, 0) + (text.split('\n')[d.line] ?? '').indexOf(d.name))));
      if (!MAIN_NAMES.has(d.name) && !isr) continue;
      const lineText = text.split('\n')[d.line] ?? '';
      const rel = f.startsWith(root) ? f.slice(root.length).replace(/^[\\/]/, '') : f;
      const label = !isr ? programName(f, []) : d.name === 'ISR' ? (lineText.match(/ISR\s*\(\s*(\w+)/)?.[1] ?? 'ISR') : d.name;
      found.push({ file: f, line: d.line, ch: Math.max(0, lineText.search(new RegExp(`\\b${d.name}\\s*\\(`))), name: d.name, rel, label, kind: isr ? 'interrupt' : 'main' });
    }
  });
  return found.sort((a, b) => a.rel.localeCompare(b.rel) || a.line - b.line);
}
export async function resolveEntry(e: Entry): Promise<CallItem> {
  const it = await callItemAt(e.file, { line: e.line, character: e.ch });
  const pos = { line: e.line, character: e.ch };
  return it ?? { name: e.name, kind: 12, uri: fileToUri(e.file), range: { start: pos, end: pos }, selectionRange: { start: pos, end: { line: e.line, character: e.ch + e.name.length } } };
}

const PUBLIC_DIR = /^(inc|include|includes|public|api)$/i;
const MAX_API = 2000;
let apiLeft = 0;

async function findApi(root: string): Promise<CallItem[]> {
  const headers = ((await api.fs.sources(root)) as string[]).filter((f) => {
    if (!HEADER.test(f) || !f.startsWith(root)) return false;
    const dirs = f.slice(root.length + 1).split(/[\\/]/).slice(0, -1);
    return dirs.slice(0, 2).some((d) => PUBLIC_DIR.test(d)) && !dirs.some((d) => /^(tests?|examples?|samples?|third[_-]?party|external|vendor)$/i.test(d));
  });
  const decls: { file: string; pos: Pos }[] = [];
  apiLeft = 0;
  const walk = (file: string, list: DocSymbol[]) => {
    for (const s of list) {
      if ((s.kind === 6 || s.kind === 12) && !/^(~|operator\b)/.test(s.name)) { if (decls.length < MAX_API) decls.push({ file, pos: s.selectionRange.start }); else apiLeft++; }
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

interface Call { to: string; at: Pos; virtual: boolean }
interface Node { item: CallItem; calls: Call[]; raw: OutgoingCall[] }

const firstRange = (rs: { start: Pos }[]) => rs.reduce((m, r) => (r.start.line < m.line || (r.start.line === m.line && r.start.character < m.character) ? r.start : m), rs[0].start);

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

function derivedOf(bases: Map<string, Set<string>>, cls: string): Set<string> {
  const out = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const [c, bs] of bases) if (!out.has(c) && (bs.has(cls) || [...bs].some((b) => out.has(b)))) { out.add(c); grew = true; }
  }
  return out;
}

let nameIdx: { root: string; p: Promise<Map<string, string[]>> } | null = null;
function nameIndex(root: string): Promise<Map<string, string[]>> {
  if (nameIdx?.root === root) return nameIdx.p;
  const p = (async () => {
    const m = new Map<string, string[]>();
    for (const f of ((await api.fs.sources(root)) as string[]).filter((x) => SOURCE.test(x))) {
      for (const n of definedNames((await readText(f)).text)) { const l = m.get(n); if (l) l.push(f); else m.set(n, [f]); }
    }
    return m;
  })();
  nameIdx = { root, p };
  return p;
}

export async function definitionFiles(root: string, name: string): Promise<string[]> {
  return (await nameIndex(root)).get(name) ?? [];
}
async function builtSet(): Promise<Set<string> | null> {
  const list = await api.lsp.built().catch(() => null);
  return list?.length ? new Set(list.map(normPath)) : null;
}

function textDefinitions(root: string, entry: string, built: Set<string> | null) {
  const names = () => nameIndex(root);
  const found = new Map<string, Promise<CallItem | null>>();
  return (it: CallItem): Promise<CallItem | null> => {
    let p = found.get(it.name);
    if (!p) found.set(it.name, p = (async () => {
      const hits: { file: string; d: FnDef; text: string }[] = [];
      for (const file of (await names()).get(it.name) ?? []) {
        const { text, tree } = await src(file);
        for (const d of functionDefs(tree, text)) if (d.name === it.name || d.name.endsWith(`::${it.name}`)) hits.push({ file, d, text });
      }
      const best = ownDefinition(hits, it.name, entry) ?? nearest(inBuild(hits, built, normPath), uriToFile(it.uri));
      if (!best) return null;
      const { file, d, text } = best, ch = Math.max(0, (text.split('\n')[d.line] ?? '').search(new RegExp(`\\b${it.name}\\s*\\(`)));
      return callItemAt(file, { line: d.line, character: ch });
    })());
    return p;
  };
}
function ownDefinition<T extends { file: string; d: FnDef; text: string }>(hits: T[], name: string, entry: string): T | null {
  return (entry && hits.find((h) => h.file === entry && h.d.name === name && !isStatic(h))) || null;
}
const isStatic = (h: { d: FnDef; text: string }) => /\bstatic\b/.test(h.text.slice(h.d.from, offsetOf(h.text, h.d.line, 0)) + (h.text.split('\n')[h.d.line] ?? ''));
function nearest<T extends { file: string }>(hits: T[], decl: string): T | null {
  if (hits.length <= 1) return hits[0] ?? null;
  const dirs = (f: string) => f.split(/[\\/]/).slice(0, -1);
  const d = dirs(decl), shared = (f: string) => { const a = dirs(f); let i = 0; while (i < a.length && i < d.length && a[i] === d[i]) i++; return i; };
  const ranked = hits.map((h) => ({ h, s: shared(h.file) })).sort((a, b) => b.s - a.s);
  return ranked[0].s > ranked[1].s ? ranked[0].h : null;
}
function stableDefinitions(root: string, entry: string, built: Set<string> | null) {
  const picked = new Map<string, Promise<CallItem | null>>();
  return (it: CallItem, caller: string): Promise<CallItem | null> => {
    const k = `${it.name}@${caller.replace(/[\\/][^\\/]*$/, '')}`;
    let p = picked.get(k);
    if (!p) picked.set(k, p = (async () => {
      const files = (await nameIndex(root)).get(it.name) ?? [];
      if (files.length < 2) return null;
      const hits: { file: string; d: FnDef; text: string }[] = [];
      for (const file of files) {
        const { text, tree } = await src(file);
        for (const d of functionDefs(tree, text)) if (d.name === it.name && !isStatic({ d, text })) hits.push({ file, d, text });
      }
      if (hits.length < 2) return null;
      const best = stablePick(hits, ownDefinition(hits, it.name, entry), caller, uriToFile(it.uri), built, normPath);
      if (!best) return null;
      const ch = Math.max(0, (best.text.split('\n')[best.d.line] ?? '').search(new RegExp(`\\b${it.name}\\s*\\(`)));
      return callItemAt(best.file, { line: best.d.line, character: ch });
    })());
    return p;
  };
}
const declOnly = (it: CallItem) => HEADER.test(it.uri) && it.range.end.line === it.range.start.line;

async function crawl(root: string, starts: CallItem[], onProgress?: (n: number) => void) {
  const nodes = new Map<string, Node>();
  let truncated = false;
  const bases = await classBases(root);
  const overridden = new Map<string, Promise<CallItem[]>>();
  nameIdx = null; taken = null;
  const entry = starts.length === 1 ? uriToFile(starts[0].uri) : '';
  const built = await builtSet();
  const fromText = textDefinitions(root, entry, built), stable = stableDefinitions(root, entry, built);

  const overridesOf = (it: CallItem): Promise<CallItem[]> => {
    const k = keyOf(it);
    let p = overridden.get(k);
    if (p) return p;
    p = (async () => {
      const parts = (it.detail ?? '').split('::').filter(Boolean);
      const cls = parts[parts.length - 1] === it.name ? parts[parts.length - 2] ?? '' : parts[parts.length - 1] ?? '';
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
      await Promise.all(raw.map(async (c) => {
        if (!c.to || !c.fromRanges?.length || !inProject(uriToFile(c.to.uri))) return;
        if (declOnly(c.to)) { const d = await fromText(c.to); if (d) c.to = d; }
        else if (c.to.kind === 12 && /^\w+$/.test(c.to.name) && /\.c$/i.test(uriToFile(c.to.uri))) { const d = await stable(c.to, uriToFile(it.uri)); if (d) c.to = d; }
      }));
      node.raw = raw;
      for (const c of raw) {
        if (!c.fromRanges?.length || !inProject(uriToFile(c.to.uri))) continue;
        node.calls.push({ to: keyOf(c.to), at: firstRange(c.fromRanges), virtual: false });
        if (!nodes.has(keyOf(c.to))) next.push(c.to);
      }
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

const SPAWN_RE = /\b(?:std::)?(?:system|_?popen|_?exec(?:l|lp|le|v|vp|vpe|ve)|posix_spawnp?|CreateProcess[AW]?|ShellExecute(?:Ex)?[AW]?|_?spawn(?:l|lp|v|vp)e?|QProcess::(?:start|execute|startDetached)|\.start|boost::process::\w+)\s*\(/g;

function programName(file: string, targets: { name: string; sources: string[] }[]) {
  const t = targets.find((x) => x.sources.includes(file));
  if (t) return t.name;
  const stem = basename(file).replace(/\.[^.]+$/, '');
  return /^(main|app|program)$/i.test(stem) ? basename(file.replace(/[\\/][^\\/]+$/, '')) : stem;
}

export async function buildFlow(root: string, onProgress?: (n: number) => void, starts0: CallItem[] = []): Promise<FlowGraph> {
  const t0 = performance.now();
  const mains = starts0;
  const apiItems = mains.length ? [] : await findApi(root);
  const targets = mains.length > 1 ? ((await api.fs.targets(root).catch(() => [])) as { name: string; sources: string[] }[]) : [];
  const laneStarts: CallItem[][] = mains.length ? mains.map((m) => [m]) : apiItems.length ? [apiItems] : [];
  const starts = await Promise.all(laneStarts.flat().map((s) => withBody(s)));
  const { nodes, truncated } = await crawl(root, starts, onProgress);
  lastCrawl = { root, nodes };

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
          edge.virtual = edge.virtual && c.virtual;
          if (!edge.lanes.includes(P)) edge.lanes.push(P);
          edgeMap.set(ek, edge);
        }
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
  const reached = new Set(byFile.keys());
  for (const f of (await api.fs.sources(root)) as string[]) {
    if (reached.has(f) || !/\.(c|cc|cpp|cxx)$/i.test(f)) continue;
    boxes.push({ file: f, fns: [], loops: [], entries: [], thread: false, dead: true });
  }

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
    note, truncated, limit: LIMIT, unresolved, library: apiItems.length, apiLeft: mains.length ? 0 : apiLeft, ms: Math.round(performance.now() - t0),
  };
}

export async function connectPrograms(root: string, starts: CallItem[], onProgress?: (n: number) => void): Promise<Pick<FlowGraph, 'lanes' | 'links' | 'shared'>> {
  const keep = lastCrawl;
  try { const g = await buildFlow(root, onProgress, starts); return { lanes: g.lanes, links: g.links, shared: g.shared }; }
  finally { lastCrawl = keep; }
}

let lastCrawl: { root: string; nodes: Map<string, Node> } | null = null;
const flowCache = new Map<string, { text: string; calls: string; info: FnInfo }>();
export function clearFlowCaches() { texts.clear(); flowCache.clear(); candidates.clear(); }

export async function buildRun(start: string, onProgress?: (done: number, total: number) => void): Promise<Run> {
  if (!lastCrawl) throw new Error('build the flow first');
  const { nodes } = lastCrawl;
  const target = (it: CallItem): Target => ({ key: keyOf(it), name: it.name, project: nodes.has(keyOf(it)), ctor: it.kind === 9, container: `${it.detail ?? ''} ${it.uri}` });
  const reach = new Set<string>([start]);
  for (const k of reach) for (const c of nodes.get(k)?.calls ?? []) reach.add(c.to);
  const byFile = new Map<string, string[]>();
  for (const k of reach) { const n = nodes.get(k); if (n) { const f = uriToFile(n.item.uri); byFile.set(f, [...(byFile.get(f) ?? []), k]); } }
  const flows = new Map<string, FnInfo>();
  let done = 0;
  await pool([...byFile.keys()], 12, async (file) => {
    const { text } = await readText(file);
    await ensureOpen(file);
    await Promise.all(byFile.get(file)!.map(async (k) => {
      const node = nodes.get(k)!, it = node.item;
      const ck = `${k}@${it.range.start.line}-${it.range.end.line}`;
      const calls = node.raw.map((c) => `${keyOf(c.to)}:${+nodes.has(keyOf(c.to))}:${(c.fromRanges ?? []).map((r) => `${r.start.line}.${r.start.character}`).join(',')}`).join('|');
      const hit = flowCache.get(ck);
      if (hit && hit.text === text && hit.calls === calls) { flows.set(k, hit.info); return; }
      const ast = functionNode((await api.lsp.request('textDocument/ast', { textDocument: { uri: it.uri }, range: it.range }).catch(() => null)) as AstNode | null);
      const flow = ast ? analyseFunction(ast, text, node.raw.filter((c) => c.fromRanges?.length).map((c) => ({ to: target(c.to), fromRanges: c.fromRanges }))) : { body: [], dropped: [], failed: 'clangd gave no syntax tree for it, so its calls are not shown' };
      const overrides = node.calls.filter((c) => c.virtual).map((c) => nodes.get(c.to)).filter((x): x is Node => !!x).map((x) => target(x.item));
      let fx: FnInfo['effects'];
      if (ast) { try { fx = { ...effects(ast, text), owner: it.kind === 6 || it.kind === 9 ? it.detail : undefined }; } catch { fx = undefined; } }
      const info: FnInfo = { name: it.name, file, line: it.selectionRange.start.line, ...fnExtent(ast, it.range), flow, overrides, effects: fx };
      if (ast) flowCache.set(ck, { text, calls, info });
      flows.set(k, info);
    }));
    done += byFile.get(file)!.length;
    onProgress?.(done, reach.size);
  });
  const run = walkRun(start, (k) => flows.get(k));
  const defined = await nameIndex(lastCrawl.root), built = await builtSet(), unlisted = new Set<string>();
  const inProject = (n: string) => (defined.get(n) ?? []).some((f) => !built || built.has(normPath(f)));
  for (const f of flows.values()) for (const n of f.flow.unlisted ?? []) if (inProject(n)) unlisted.add(n);
  run.unlisted = [...unlisted];
  const ind = run.rows.filter((r) => r.kind === 'indirect');
  if (ind.length) {
    const t = await addressTakenIn(lastCrawl.root);
    for (const r of ind) {
      const from = r.caller != null ? run.rows[r.caller].file : '', dir = from.replace(/[\\/][^\\/]*$/, '');
      r.could = t.map(([n, files]) => ({ n, far: +!files.some((f) => f.startsWith(dir)) })).sort((a, b) => a.far - b.far || byName.compare(a.n, b.n)).map((x) => x.n).slice(0, 12);
    }
  }
  return run;
}

const byName = new Intl.Collator();
let taken: { root: string; p: Promise<[string, string[]][]> } | null = null;
const candidates = new Map<string, { text: string; names: string[] }>();
function addressTakenIn(root: string): Promise<[string, string[]][]> {
  if (taken?.root === root) return taken.p;
  const p = (async () => {
    const idx = await nameIndex(root), names = new Set(idx.keys()), out = new Set<string>();
    for (const f of ((await api.fs.sources(root)) as string[]).filter((x) => SOURCE.test(x) || HEADER.test(x))) {
      const { text } = await readText(f);
      let c = candidates.get(f);
      if (c?.text !== text) candidates.set(f, c = { text, names: addressCandidates(text) });
      for (const n of c.names) if (names.has(n)) out.add(n);
    }
    return [...out].map((n): [string, string[]] => [n, idx.get(n) ?? []]);
  })();
  taken = { root, p };
  return p;
}

export const shortName = (root: string, file: string) => (file.startsWith(root) ? file.slice(root.length + 1) : basename(file));
export { fileToUri };
