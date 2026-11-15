import { createSignal } from 'solid-js';
import { api, CallItem, Range, Pos, uriToFile, fileToUri, basename, relPath } from './api';
import { symbols, enclosingFunction, callItemAt, outgoing, inProject, projectRoot, resolveDefinition, withBody, definitionAt } from './lsp';
import { parseCpp, offsetOf, lineOf } from '../../shared/flowcore';
import { states, settings } from './store';
import { mergeLevel, keepsDeeper } from '../../shared/levelmerge';

export type CardKind = 'call' | 'macro' | 'assert' | 'lambda' | 'indirect';
export interface Card {
  key: string;
  item: CallItem;
  file: string;
  name: string;
  startLine: number;
  text: string;
  fromRanges: Range[];
  std: boolean;
  declOnly?: boolean;
  unread?: boolean;
  kind: CardKind;
}
export interface Level {
  caller: CallItem;
  callerFile: string;
  callerStartLine: number;
  cards: Card[];
  hidden: number;
  more: string[];
  focus: number;
}

export const [levels, setLevels] = createSignal<Level[]>([]);
export const [win, setWin] = createSignal(0);
export const [mainFn, setMainFn] = createSignal<{ name: string; file: string; range: Range } | null>(null);
export const [busy, setBusy] = createSignal(false);

const textCache = new Map<string, string[]>();
async function fileLines(file: string): Promise<string[]> {
  const live = states.get(file);
  if (live) return live.doc.toString().split('\n');
  if (!textCache.has(file)) { try { textCache.set(file, (await api.fs.read(file)).split('\n')); } catch { textCache.set(file, []); } }
  return textCache.get(file)!;
}
export const invalidateText = (file: string) => textCache.delete(file);
export const clearTextCache = () => { textCache.clear(); trees.clear(); };

const before = (a: Pos, b: Pos) => a.line < b.line || (a.line === b.line && a.character < b.character);

async function buildLevel(caller: CallItem, callerStartLine: number): Promise<Level> {
  const s = settings();
  const calls = (await outgoing(caller)).filter((c) => c.fromRanges?.length);
  calls.sort((a, b) => {
    const fa = a.fromRanges.reduce((m, r) => (before(r.start, m) ? r.start : m), a.fromRanges[0].start);
    const fb = b.fromRanges.reduce((m, r) => (before(r.start, m) ? r.start : m), b.fromRanges[0].start);
    return before(fa, fb) ? -1 : 1;
  });
  const cards: Card[] = [];
  let hidden = 0;
  const more: string[] = [];
  for (const c of calls) {
    const file = uriToFile(c.to.uri);
    const std = !inProject(file);
    if (std && !s['preview.include_std']) { hidden++; continue; }
    if (cards.length >= s['preview.max_cards']) { more.push(c.to.name); continue; }
    const def = std ? await withBody(c.to) : await resolveDefinition(c.to);
    const dfile = uriToFile(def.uri);
    const lines = await fileLines(dfile);
    const bodiless = std && (def === c.to || def.range.start.line < c.to.selectionRange.start.line - 6
      || /^\s*(template\s*<.*>\s*)?(class|struct|union)\b/.test(lines[def.range.start.line] ?? ''));
    const a = bodiless ? def.selectionRange.start.line : def.range.start.line, b = bodiless ? a : Math.min(def.range.end.line, a + 400);
    cards.push({
      key: `${def.uri}#${a}:${c.to.name}`, item: def, file: dfile, name: c.to.name,
      startLine: a, text: lines.slice(a, b + 1).join('\n') || c.to.detail || c.to.name,
      fromRanges: c.fromRanges, std, declOnly: bodiless, kind: 'call', unread: !lines.length,
    });
  }
  if (s['preview.include_other'] !== false) {
    const others = await otherCards(caller, cards, !!s['preview.include_std']), max = s['preview.max_cards'];
    cards.push(...others.slice(0, max));
    more.push(...others.slice(max).map((o) => o.name));
  }
  return { caller, callerFile: uriToFile(caller.uri), callerStartLine, cards, hidden, more, focus: -1 };
}

const trees = new Map<string, { text: string; tree: ReturnType<typeof parseCpp> }>();
function parsed(file: string, text: string) {
  const hit = trees.get(file);
  if (hit && hit.text === text) return hit.tree;
  if (trees.size > 24) trees.clear();
  const tree = parseCpp(text);
  trees.set(file, { text, tree });
  return tree;
}
const posAt = (text: string, off: number): Pos => { const line = lineOf(text, off); return { line, character: off - offsetOf(text, line, 0) }; };
const NOT_CALLS = new Set(['sizeof', 'alignof', 'decltype', 'typeid', 'noexcept', 'static_cast', 'dynamic_cast', 'const_cast', 'reinterpret_cast', 'return', 'if', 'while', 'for', 'switch']);

async function otherCards(caller: CallItem, calls: Card[], includeStd: boolean): Promise<Card[]> {
  const file = uriToFile(caller.uri);
  const body = await withBody(caller);
  const text = (await fileLines(file)).join('\n');
  const tree = parsed(file, text);
  const from = offsetOf(text, body.range.start.line, 0), to = offsetOf(text, body.range.end.line + 1, 0);
  const known = new Set(calls.map((c) => c.name.replace(/^.*::/, '')));
  const asserts: { from: number; to: number }[] = [];
  const sites: { name: string; at: number; end: number }[] = [];
  tree.iterate({ from, to, enter: (n) => {
    if (n.from < from || n.to > to + 1) return;
    if (n.name === 'StaticAssertDeclaration') asserts.push({ from: n.from, to: n.to });
    else if (n.name === 'CallExpression') {
      let c = n.node.firstChild;
      if (c && /FieldExpression|ScopedIdentifier/.test(c.name)) c = c.lastChild;
      if (!c || !/Identifier/.test(c.name)) return;
      const name = text.slice(c.from, c.to);
      if (!known.has(name) && !NOT_CALLS.has(name)) sites.push({ name, at: c.from, end: c.to });
    }
  } });
  const out: Card[] = [];
  for (const a of asserts) {
    const l0 = lineOf(text, a.from), l1 = lineOf(text, a.to);
    out.push(await mk('assert', 'static_assert', file, l0, Math.min(l1, l0 + 8), { start: posAt(text, a.from), end: posAt(text, a.from + 13) }, posAt(text, a.from)));
  }
  const byDef = new Map<string, Card>();
  for (const st of sites) {
    const range = { start: posAt(text, st.at), end: posAt(text, st.end) };
    const def = await definitionAt(file, range.start);
    if (!def || (!includeStd && !inProject(def.file))) continue;
    const key = `${def.file}:${def.line}`;
    const seen = byDef.get(key);
    if (seen) { seen.fromRanges.push(range); continue; }
    const card = await classify(st.name, def, range);
    if (card) { byDef.set(key, card); out.push(card); }
  }
  const first = (c: Card) => c.fromRanges[0].start.line * 1e5 + c.fromRanges[0].start.character;
  return out.sort((a, b) => first(a) - first(b));
}

async function classify(name: string, def: { file: string; line: number; character: number }, range: Range): Promise<Card | null> {
  const lines = await fileLines(def.file);
  if (/^\s*#\s*define\b/.test(lines[def.line] ?? '')) {
    let b = def.line;
    while (/\\\s*$/.test(lines[b] ?? '') && b - def.line < 30) b++;
    return mk('macro', name, def.file, def.line, b, range, { line: def.line, character: def.character });
  }
  const dtext = lines.join('\n'), tree = parsed(def.file, dtext);
  let decl: any = null;
  for (let n: any = tree.resolveInner(offsetOf(dtext, def.line, def.character), 1); n; n = n.parent) {
    if (n.name === 'FunctionDefinition') return null;
    if (/^(Declaration|FieldDeclaration|ParameterDeclaration|OptionalParameterDeclaration)$/.test(n.name)) { decl = n; break; }
  }
  if (!decl) return null;
  let lam: { from: number; to: number } | null = null, fnDecl = false;
  tree.iterate({ from: decl.from, to: decl.to, enter: (n) => {
    if (!lam && n.name === 'LambdaExpression') lam = { from: n.from, to: n.to };
    if (n.name === 'FunctionDeclarator') fnDecl = true;
  } });
  const at = { line: def.line, character: def.character };
  if (lam) { const l = lam as { from: number; to: number }; const a = lineOf(dtext, l.from); return mk('lambda', name, def.file, a, Math.min(lineOf(dtext, l.to), a + 40), range, at); }
  const dt = dtext.slice(decl.from, decl.to);
  if (fnDecl && !/\(\s*[*&]|function\s*</.test(dt) && !dt.includes('=') && !/Parameter/.test(decl.name)) return null;
  const a = lineOf(dtext, decl.from);
  return mk('indirect', name, def.file, a, Math.min(lineOf(dtext, decl.to), a + 5), range, at);
}

async function mk(kind: CardKind, name: string, file: string, a: number, b: number, range: Range, at: Pos): Promise<Card> {
  const lines = await fileLines(file);
  const r = { start: { line: a, character: 0 }, end: { line: b, character: 0 } };
  return {
    key: `${kind}:${file}#${a}:${name}`, item: { name, kind: 12, uri: fileToUri(file), range: r, selectionRange: { start: at, end: at } },
    file, name, startLine: a, text: lines.slice(a, b + 1).join('\n'), fromRanges: [range], std: !inProject(file), kind,
  };
}

let rootGen = 0;
const levelGen: number[] = [];
const sameCaller = (a: CallItem, b: CallItem) => a.uri === b.uri && a.range.start.line === b.range.start.line && a.name === b.name;
function place(idx: number, fresh: Level): Level {
  const ls = levels(), old = ls[idx], m = mergeLevel(old, fresh, sameCaller);
  setLevels([...ls.slice(0, idx), m, ...(m !== fresh && keepsDeeper(old, m) ? ls.slice(idx + 1) : [])]);
  return m;
}

let rootKey = '';
export async function refreshForCursor(file: string, pos: Pos, force = false) {
  const gen = ++rootGen;
  const syms = await symbols(file), text = await fileLines(file);
  const fn = enclosingFunction(syms, pos, (s) => (text[s.range.start.line] ?? '').slice(s.range.start.character, s.range.end.character).includes('{'));
  if (gen !== rootGen) return;
  const key = fn ? `${file}#${fn.range.start.line}` : '';
  if (key !== rootKey) {
    if (rootKey) { clearTimeout(retryTimers.get(rootKey)); retryTimers.delete(rootKey); retryStart.delete(rootKey); }
    rootKey = key;
  }
  if (!fn) { setMainFn(null); setLevels([]); setWin(0); setBusy(false); return; }
  if (!settings()['preview.enabled']) {
    const cur = mainFn();
    if (!cur || cur.file !== file || cur.range.start.line !== fn.range.start.line) setMainFn({ name: fn.name, file, range: fn.range });
    if (levels().length) setLevels([]);
    setBusy(false);
    return;
  }
  const cur = mainFn();
  const sameFn = !!cur && cur.file === file && cur.name === fn.name && cur.range.start.line === fn.range.start.line;
  if (!force && sameFn && levels().length) { setBusy(false); return; }
  setMainFn({ name: fn.name, file, range: fn.range });
  setBusy(true);
  const retry = () => scheduleRetry(key, () => { if (rootKey === key) void refreshForCursor(file, pos, true); });
  const shown = sameFn ? levels()[0] : undefined;
  const item = await callItemAt(file, fn.selectionRange.start);
  if (gen !== rootGen) return;
  if (!item) { if (!shown) setLevels([]); setBusy(false); retry(); return; }
  const l1 = await buildLevel(item, 0);
  if (gen !== rootGen) return;
  setBusy(false);
  if (shown && !l1.cards.length && shown.cards.length) { retry(); return; }
  if (shown) place(0, l1);
  else { setLevels([l1]); setWin(0); }
  if (win() > Math.max(0, levels().length - 1)) setWin(0);
  if (!l1.cards.length || l1.cards.some(unresolvedCard)) retry();
  else retryStart.delete(key);
}

export async function rebuildLevels(file: string, pos: Pos) {
  await refreshForCursor(file, pos, true);
  for (let i = 0; i < levels().length - 1; i++) {
    const lv = levels()[i], c = lv && lv.focus >= 0 ? lv.cards[lv.focus] : undefined;
    if (c) await refreshNext(i, c.key);
  }
}

export const unresolvedCard = (c: Card) => c.kind === 'call' && !c.std && /\.(h|hh|hpp|hxx)$/i.test(c.file) && !c.text.includes('{');
const retryStart = new Map<string, number>();
const retryTimers = new Map<string, number>();
function scheduleRetry(key: string, run: () => void) {
  const first = retryStart.get(key) ?? Date.now();
  retryStart.set(key, first);
  if (Date.now() - first > 30000) return;
  clearTimeout(retryTimers.get(key));
  retryTimers.set(key, window.setTimeout(() => { retryTimers.delete(key); run(); }, 1500));
}

async function refreshNext(idx: number, key: string) {
  const lv = levels()[idx], card = lv && lv.focus >= 0 ? lv.cards[lv.focus] : undefined;
  if (!card || card.key !== key || card.std || card.kind !== 'call') return;
  const g = (levelGen[idx] = (levelGen[idx] ?? 0) + 1);
  const next = await buildLevel(card.item, card.startLine);
  const now = levels()[idx];
  if (g !== levelGen[idx] || !now || now.cards[now.focus]?.key !== key) return;
  const shown = levels()[idx + 1];
  if (shown && !next.cards.length && shown.cards.length) { scheduleRetry(`${key}@${idx}`, () => refreshNext(idx, key)); return; }
  place(idx + 1, next);
  if (next.cards.some(unresolvedCard)) scheduleRetry(`${key}@${idx}`, () => refreshNext(idx, key));
}

export async function focusCard(levelIdx: number, cardIdx: number) {
  const ls = levels().slice(0, levelIdx + 1);
  if (!ls[levelIdx] || ls[levelIdx].focus === cardIdx && levels().length > levelIdx + 1) return;
  const lv = { ...ls[levelIdx], focus: cardIdx };
  ls[levelIdx] = lv;
  setLevels(ls);
  const card = lv.cards[cardIdx];
  if (!card || card.std || card.kind !== 'call') return;
  const g = (levelGen[levelIdx] = (levelGen[levelIdx] ?? 0) + 1);
  const next = await buildLevel(card.item, card.startLine);
  const now = levels()[levelIdx];
  if (g !== levelGen[levelIdx] || !now || now.cards[now.focus]?.key !== card.key) return;
  place(levelIdx + 1, next);
  if (next.cards.some(unresolvedCard)) scheduleRetry(`${card.key}@${levelIdx}`, () => refreshNext(levelIdx, card.key));
}

const drillable = (c: Card) => c.kind === 'call' && !c.std;
export const canShift = () => levels().length > win() + 2 || (levels()[win() + 1]?.cards.some(drillable) ?? false);

export async function prepareShiftRight(): Promise<boolean> {
  const w = win();
  const ls = levels();
  if (!ls[w + 1]) return false;
  if (ls[w + 2]) return true;
  const right = ls[w + 1];
  const idx = right.focus >= 0 && drillable(right.cards[right.focus]) ? right.focus : right.cards.findIndex(drillable);
  if (idx < 0) return false;
  await focusCard(w + 1, idx);
  return !!levels()[w + 2];
}
export async function shiftRight(): Promise<boolean> {
  if (!(await prepareShiftRight())) return false;
  setWin(win() + 1);
  return true;
}
export function shiftHome() { setWin(0); }

export const describeLevel = (lv: Level) => basename(lv.callerFile) && lv.caller.name;
export const cardLoc = (c: Card) => `${relPath(projectRoot(), c.file)}:${c.startLine + 1}`;

export interface Depth { depth: number; fns: number; capped: boolean }
export const [depths, setDepths] = createSignal<Record<string, Depth | 'busy'>>({});
const DEPTH_CAP = 4000;
const depthCache = new Map<string, Depth>();

export async function measureDepth(card: Card): Promise<void> {
  if (card.std || card.kind !== 'call') return;
  const k = card.key, have = depths()[k];
  if (have && have !== 'busy') return;
  const hit = depthCache.get(k);
  if (hit) { setDepths({ ...depths(), [k]: hit }); return; }
  setDepths({ ...depths(), [k]: 'busy' });
  depthItems.set(k, card.item);
  const d = await depthOf(card.item);
  depthCache.set(k, d);
  setDepths({ ...depths(), [k]: d });
}
const depthItems = new Map<string, CallItem>();
export async function remeasureDepths(): Promise<void> {
  for (const [k, item] of [...depthItems]) {
    const d = await depthOf(item);
    if (!depthItems.has(k)) continue;
    const old = depthCache.get(k);
    depthCache.set(k, d);
    if (!old || old.depth !== d.depth || old.fns !== d.fns || old.capped !== d.capped) setDepths({ ...depths(), [k]: d });
  }
}
async function depthOf(root: CallItem): Promise<Depth> {
  const keyOf = (it: CallItem) => `${it.uri}#${it.selectionRange.start.line}`;
  const edges = new Map<string, string[]>();
  let capped = false;
  let frontier: CallItem[] = [root];
  const seen = new Set<string>([keyOf(root)]);
  while (frontier.length) {
    const next: CallItem[] = [];
    await pool(frontier, 16, async (it) => {
      const out = (await outgoing(it)).filter((c) => c.fromRanges?.length && inProject(uriToFile(c.to.uri)));
      const first = (c: typeof out[number]) => c.fromRanges.reduce((m, r) => (before(r.start, m) ? r.start : m), c.fromRanges[0].start);
      out.sort((a, b) => (before(first(a), first(b)) ? -1 : 1));
      edges.set(keyOf(it), out.map((c) => keyOf(c.to)));
      for (const c of out) {
        const ck = keyOf(c.to);
        if (seen.has(ck)) continue;
        if (seen.size >= DEPTH_CAP) { capped = true; continue; }
        seen.add(ck);
        next.push(c.to);
      }
    });
    frontier = next;
  }
  const opened = new Set<string>([keyOf(root)]);
  const stack: [string, number, number][] = [[keyOf(root), 0, 0]];
  let depth = 0;
  while (stack.length) {
    const top = stack[stack.length - 1], kids = edges.get(top[0]) ?? [];
    if (top[2] >= kids.length) { stack.pop(); continue; }
    const c = kids[top[2]++];
    if (opened.has(c)) continue;
    opened.add(c);
    depth = Math.max(depth, top[1] + 1);
    stack.push([c, top[1] + 1, 0]);
  }
  return { depth, fns: opened.size - 1, capped };
}
export const clearDepths = () => { depthCache.clear(); depthItems.clear(); setDepths({}); };

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<unknown>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}
