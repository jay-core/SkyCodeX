// The preview engine: calls made by the function under the cursor, level by level.
import { createSignal } from 'solid-js';
import { api, CallItem, Range, Pos, uriToFile, fileToUri, basename, relPath } from './api';
import { symbols, enclosingFunction, callItemAt, outgoing, inProject, projectRoot, resolveDefinition, withBody, definitionAt } from './lsp';
import { parseCpp, offsetOf, lineOf } from '../../shared/flowcore';
import { states, settings } from './store';

/** call: a real function call (clangd). The rest look like calls but are not functions. */
export type CardKind = 'call' | 'macro' | 'assert' | 'lambda' | 'indirect';
export interface Card {
  key: string;
  item: CallItem;
  file: string;
  name: string;
  startLine: number;        // 0-based first line of the card text in its file
  text: string;
  fromRanges: Range[];      // call sites, in the caller's file coordinates
  std: boolean;
  declOnly?: boolean;       // std: only a declaration exists, the body is compiled into the library
  kind: CardKind;
}
export interface Level {
  caller: CallItem;
  callerFile: string;
  callerStartLine: number;  // where the caller's text starts (0 for the main editor)
  cards: Card[];
  hidden: number;           // standard-library calls left out
  more: string[];           // names beyond preview.max_cards
  focus: number;            // card holding the preview cursor, -1 for none
}

export const [levels, setLevels] = createSignal<Level[]>([]);
export const [win, setWin] = createSignal(0);                // first visible level
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
    const def = std ? await withBody(c.to) : await resolveDefinition(c.to);  // definition with its whole body
    const dfile = uriToFile(def.uri);
    const lines = await fileLines(dfile);
    // a library function with no body in its header (or an implicit member) shows just its declaration line
    // library headers are macro-heavy: trust a parsed body only when it starts just above the name and isn't a class
    const bodiless = std && (def === c.to || def.range.start.line < c.to.selectionRange.start.line - 6
      || /^\s*(template\s*<.*>\s*)?(class|struct|union)\b/.test(lines[def.range.start.line] ?? ''));
    const a = bodiless ? def.selectionRange.start.line : def.range.start.line, b = bodiless ? a : Math.min(def.range.end.line, a + 400);
    cards.push({
      key: `${def.uri}#${a}:${c.to.name}`, item: def, file: dfile, name: c.to.name,
      startLine: a, text: lines.slice(a, b + 1).join('\n') || c.to.detail || c.to.name,
      fromRanges: c.fromRanges, std, declOnly: bodiless, kind: 'call',
    });
  }
  // after the functions: the things that look like calls (macros, static_assert, lambdas, calls through pointers)
  if (s['preview.include_other'] !== false) cards.push(...(await otherCards(caller, cards, !!s['preview.include_std'], s['preview.max_cards'])));
  return { caller, callerFile: uriToFile(caller.uri), callerStartLine, cards, hidden, more, focus: -1 };
}

// ---------- call-like things clangd does not report ----------
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

async function otherCards(caller: CallItem, calls: Card[], includeStd: boolean, max: number): Promise<Card[]> {
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
      if (c && /FieldExpression|ScopedIdentifier/.test(c.name)) c = c.lastChild;   // obj.member(…), ns::name(…)
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
  return out.sort((a, b) => first(a) - first(b)).slice(0, max);
}

/** What a callee that isn't a function turned out to be, from where clangd says it is defined. */
async function classify(name: string, def: { file: string; line: number; character: number }, range: Range): Promise<Card | null> {
  const lines = await fileLines(def.file);
  if (/^\s*#\s*define\b/.test(lines[def.line] ?? '')) {
    let b = def.line;
    while (/\\\s*$/.test(lines[b] ?? '') && b - def.line < 30) b++;   // continued with backslashes
    return mk('macro', name, def.file, def.line, b, range, { line: def.line, character: def.character });
  }
  const dtext = lines.join('\n'), tree = parsed(def.file, dtext);
  let decl: any = null;
  for (let n: any = tree.resolveInner(offsetOf(dtext, def.line, def.character), 1); n; n = n.parent) {
    if (n.name === 'FunctionDefinition') return null;   // a real function clangd missed: not ours to guess
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
  // a plain prototype is a function, not something called through a pointer
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

let generation = 0;
/** Called when the main cursor settles. Rebuilds level 1 only when the enclosing function changes. */
export async function refreshForCursor(file: string, pos: Pos, force = false) {
  const gen = ++generation;
  const fn = enclosingFunction(await symbols(file), pos);
  if (gen !== generation) return;
  if (!fn) { setMainFn(null); setLevels([]); setWin(0); return; }
  if (!settings()['preview.enabled']) {
    const cur = mainFn();
    if (!cur || cur.file !== file || cur.range.start.line !== fn.range.start.line) setMainFn({ name: fn.name, file, range: fn.range });
    if (levels().length) setLevels([]);
    return;
  }
  const cur = mainFn();
  if (!force && cur && cur.file === file && cur.name === fn.name && cur.range.start.line === fn.range.start.line && levels().length) return;
  setMainFn({ name: fn.name, file, range: fn.range });
  setBusy(true);
  // while clangd is still building the file or loading its index, it may answer with no calls, or resolve
  // some callees only to their header declaration: keep one retry pending, for up to 30 s after the first attempt for this function
  const key = `${file}#${fn.range.start.line}`;
  const retry = () => scheduleRetry(key, () => refreshForCursor(file, pos, true));
  const item = await callItemAt(file, fn.selectionRange.start);
  if (gen !== generation) return;
  if (!item) { setLevels([]); setBusy(false); retry(); return; }
  const l1 = await buildLevel(item, 0);
  if (gen !== generation) return;
  setLevels([l1]); setWin(0); setBusy(false);
  if (!l1.cards.length || l1.cards.some(unresolvedCard)) retry();
  else retryStart.delete(key);
}

/** Rebuilds the levels in place (after a preview setting changed), keeping pane 1's focused card. */
export async function rebuildLevels(file: string, pos: Pos) {
  const l0 = levels()[0], keep = l0 && l0.focus >= 0 ? l0.cards[l0.focus]?.key : undefined;
  await refreshForCursor(file, pos, true);
  const k = keep ? levels()[0]?.cards.findIndex((c) => c.key === keep) ?? -1 : -1;
  if (k >= 0) await focusCard(0, k);
}

export const unresolvedCard = (c: Card) => c.kind === 'call' && !c.std && /\.(h|hh|hpp|hxx)$/i.test(c.file) && !c.text.includes('{');
const retryStart = new Map<string, number>();
let retryTimer: number | undefined;
function scheduleRetry(key: string, run: () => void) {
  const first = retryStart.get(key) ?? Date.now();
  retryStart.set(key, first);
  if (Date.now() - first > 30000) return;
  clearTimeout(retryTimer);
  retryTimer = window.setTimeout(run, 1500);
}

/** Puts the preview cursor in a card: the next level shows that card's calls. */
export async function focusCard(levelIdx: number, cardIdx: number) {
  const ls = levels().slice(0, levelIdx + 1);
  if (!ls[levelIdx] || ls[levelIdx].focus === cardIdx && levels().length > levelIdx + 1) return;
  const lv = { ...ls[levelIdx], focus: cardIdx };
  ls[levelIdx] = lv;
  setLevels(ls);
  const card = lv.cards[cardIdx];
  if (!card || card.std || card.kind !== 'call') return;   // library code and call-like things have no next level
  const gen = ++generation;
  const next = await buildLevel(card.item, card.startLine);
  if (gen !== generation) return;
  setLevels([...levels().slice(0, levelIdx + 1), next]);
  if (next.cards.some(unresolvedCard)) scheduleRetry(`${card.key}@${levelIdx}`, () => { const lv = levels()[levelIdx]; if (lv?.focus === cardIdx) { setLevels(levels().slice(0, levelIdx + 1).map((l, i) => (i === levelIdx ? { ...l, focus: -1 } : l))); focusCard(levelIdx, cardIdx); } });
}

/** True when shifting right would land on a pair of levels that has content. */
const drillable = (c: Card) => c.kind === 'call' && !c.std;
export const canShift = () => levels().length > win() + 2 || (levels()[win() + 1]?.cards.some(drillable) ?? false);

/** Builds the level a right shift would bring in, without moving; false when there is none. */
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

// ---------- how deep a call goes ----------

/** depth: levels of calls below the function (0: it calls nothing in the project); fns: the functions below it. */
export interface Depth { depth: number; fns: number; capped: boolean }
export const [depths, setDepths] = createSignal<Record<string, Depth | 'busy'>>({});
const DEPTH_CAP = 4000;
const depthCache = new Map<string, Depth>();

/**
 * How deep a card's function goes: the deepest chain of project calls below it, each function opened once, in call
 * order — the depth the flow view shows. The graph comes from clangd's index, many requests in flight at once.
 */
export async function measureDepth(card: Card): Promise<void> {
  if (card.std || card.kind !== 'call') return;
  const k = card.key, have = depths()[k];
  if (have && have !== 'busy') return;
  const hit = depthCache.get(k);
  if (hit) { setDepths({ ...depths(), [k]: hit }); return; }
  setDepths({ ...depths(), [k]: 'busy' });
  const keyOf = (it: CallItem) => `${it.uri}#${it.selectionRange.start.line}`;
  const edges = new Map<string, string[]>();
  let capped = false;
  let frontier: CallItem[] = [card.item];
  const seen = new Set<string>([keyOf(card.item)]);
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
  // depth first, in call order, each function opened once (an explicit stack: chains can be thousands long)
  const opened = new Set<string>([keyOf(card.item)]);
  const stack: [string, number, number][] = [[keyOf(card.item), 0, 0]];
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
  const d: Depth = { depth, fns: opened.size - 1, capped };
  depthCache.set(k, d);
  setDepths({ ...depths(), [k]: d });
}
export const clearDepths = () => { depthCache.clear(); setDepths({}); };

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<unknown>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}
