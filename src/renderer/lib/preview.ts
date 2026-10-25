// The preview engine: calls made by the function under the cursor, level by level.
import { createSignal } from 'solid-js';
import { api, CallItem, Range, Pos, uriToFile, basename, relPath } from './api';
import { symbols, enclosingFunction, callItemAt, outgoing, inProject, projectRoot, resolveDefinition, withBody } from './lsp';
import { states, settings } from './store';

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
      fromRanges: c.fromRanges, std, declOnly: bodiless,
    });
  }
  return { caller, callerFile: uriToFile(caller.uri), callerStartLine, cards, hidden, more, focus: -1 };
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
  const item = await callItemAt(file, fn.selectionRange.start);
  if (gen !== generation) return;
  if (!item) { setLevels([]); setBusy(false); return; }
  const l1 = await buildLevel(item, 0);
  if (gen !== generation) return;
  setLevels([l1]); setWin(0); setBusy(false);
  // while clangd is still loading its index some callees resolve only to their header declaration:
  // keep one retry pending, for up to 30 s after the first attempt for this function
  const key = `${file}#${fn.range.start.line}`;
  if (l1.cards.some(unresolvedCard)) scheduleRetry(key, () => refreshForCursor(file, pos, true));
  else retryStart.delete(key);
}

export const unresolvedCard = (c: Card) => !c.std && /\.(h|hh|hpp|hxx)$/i.test(c.file) && !c.text.includes('{');
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
  if (!card || card.std) return;
  const gen = ++generation;
  const next = await buildLevel(card.item, card.startLine);
  if (gen !== generation) return;
  setLevels([...levels().slice(0, levelIdx + 1), next]);
  if (next.cards.some(unresolvedCard)) scheduleRetry(`${card.key}@${levelIdx}`, () => { const lv = levels()[levelIdx]; if (lv?.focus === cardIdx) { setLevels(levels().slice(0, levelIdx + 1).map((l, i) => (i === levelIdx ? { ...l, focus: -1 } : l))); focusCard(levelIdx, cardIdx); } });
}

/** True when shifting right would land on a pair of levels that has content. */
export const canShift = () => levels().length > win() + 2 || (levels()[win() + 1]?.cards.some((c) => !c.std) ?? false);

/** Builds the level a right shift would bring in, without moving; false when there is none. */
export async function prepareShiftRight(): Promise<boolean> {
  const w = win();
  const ls = levels();
  if (!ls[w + 1]) return false;
  if (ls[w + 2]) return true;
  const right = ls[w + 1];
  const idx = right.focus >= 0 ? right.focus : right.cards.findIndex((c) => !c.std);
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
