// Pure helpers behind the smaller tools (to-do list, formatting, reference search, code style, spelling), kept apart so they can be tested.
import type { Range } from './api';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Comment notes such as "// TODO: …". */
export function findTodos(text: string, words: string[]): { line: number; col: number; word: string; note: string }[] {
  if (!words.length) return [];
  const re = new RegExp(`(?:\\/\\/+|\\/\\*+|#|^\\s*\\*)\\s*(${words.map(esc).join('|')})\\b[:(\\s]*(.*)`);
  const out: { line: number; col: number; word: string; note: string }[] = [];
  text.split('\n').forEach((l, i) => {
    const m = l.match(re);
    if (m) out.push({ line: i, col: m.index! + m[0].indexOf(m[1]), word: m[1], note: m[2].replace(/\*+\/\s*$/, '').replace(/^[)\]:\s-]+/, '').trim() });
  });
  return out;
}

export interface TextEdit { range: Range; newText: string }
/** Applies LSP text edits to a string (last first, so earlier positions stay valid). */
export function applyEdits(text: string, edits: TextEdit[]): string {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  const off = (p: { line: number; character: number }) => Math.min(text.length, (starts[Math.min(p.line, starts.length - 1)] ?? text.length) + p.character);
  return [...edits].sort((a, b) => off(b.range.start) - off(a.range.start))
    .reduce((s, e) => s.slice(0, off(e.range.start)) + e.newText + s.slice(off(e.range.end)), text);
}

/** Names that fit what was under the cursor: the exact name, then std::name, then members called name, then the rest containing it. */
export function refMatches(names: string[], query: string): string[] {
  const q = query.replace(/^::/, '').trim();
  if (!q) return [];
  const last = q.split('::').pop()!;
  const rank = (n: string) => n === q ? 0 : n === `std::${q}` ? 1 : n.endsWith(`::${q}`) ? 2 : n.endsWith(`::${last}`) ? 3 : n.toLowerCase().includes(q.toLowerCase()) ? 4 : 9;
  return names.map((n) => [n, rank(n)] as const).filter(([, r]) => r < 9).sort((a, b) => a[1] - b[1] || a[0].length - b[0].length).map(([n]) => n);
}

export type StyleOpt = { key: string; label: string; values?: string[]; min?: number; max?: number; bool?: boolean };
export const STYLE_OPTS: StyleOpt[] = [
  { key: 'BasedOnStyle', label: 'based on', values: ['LLVM', 'Google', 'Chromium', 'Mozilla', 'WebKit', 'Microsoft', 'GNU'] },
  { key: 'IndentWidth', label: 'indent width', min: 1, max: 16 },
  { key: 'UseTab', label: 'tabs', values: ['Never', 'ForIndentation', 'Always'] },
  { key: 'ColumnLimit', label: 'line length (0 = none)', min: 0, max: 240 },
  { key: 'BreakBeforeBraces', label: 'braces', values: ['Attach', 'Linux', 'Stroustrup', 'Allman', 'GNU', 'WebKit', 'Mozilla'] },
  { key: 'PointerAlignment', label: 'pointer *', values: ['Left', 'Right', 'Middle'] },
  { key: 'AllowShortFunctionsOnASingleLine', label: 'short functions on one line', values: ['None', 'Empty', 'Inline', 'All'] },
  { key: 'AllowShortIfStatementsOnASingleLine', label: 'short ifs on one line', values: ['Never', 'WithoutElse', 'AllIfsAndElse'] },
  { key: 'NamespaceIndentation', label: 'indent inside namespaces', values: ['None', 'Inner', 'All'] },
  { key: 'AccessModifierOffset', label: 'public: / private: offset', min: -8, max: 8 },
  { key: 'SpaceBeforeParens', label: 'space before (', values: ['Never', 'ControlStatements', 'Always'] },
  { key: 'IndentCaseLabels', label: 'indent case labels', bool: true },
  { key: 'SortIncludes', label: 'sort #includes', values: ['Never', 'CaseSensitive', 'CaseInsensitive'] },
];

/** Reads top-level "Key: value" lines; every other line is kept as it is. */
export function parseStyle(text: string): { values: Record<string, string>; lines: string[] } {
  const values: Record<string, string> = {}, lines = text.split('\n');
  for (const l of lines) { const m = l.match(/^([A-Za-z]\w*):\s*([^#\n]*?)\s*(#.*)?$/); if (m && m[2] !== '') values[m[1]] = m[2]; }
  return { values, lines };
}
/** The file with the chosen values: changed keys rewritten in place, new ones added, cleared ones removed, the rest untouched. */
export function writeStyle(lines: string[], values: Record<string, string>): string {
  const seen = new Set<string>(), managed = new Set(STYLE_OPTS.map((o) => o.key));
  const out: string[] = [];
  for (const l of lines) {
    const m = l.match(/^([A-Za-z]\w*):/);
    if (m && managed.has(m[1])) {
      seen.add(m[1]);
      if (values[m[1]] !== undefined) out.push(`${m[1]}: ${values[m[1]]}`);
      continue;
    }
    out.push(l);
  }
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  const head = out.length && out[0].startsWith('---') ? 1 : 0;
  const add = STYLE_OPTS.filter((o) => values[o.key] !== undefined && !seen.has(o.key)).map((o) => `${o.key}: ${values[o.key]}`);
  out.splice(head, 0, ...add.filter((l) => l.startsWith('BasedOnStyle')));
  out.push(...add.filter((l) => !l.startsWith('BasedOnStyle')));
  return out.join('\n') + '\n';
}

/** Plain words worth checking: letters only, three or more, no inner capitals (identifiers) and not all capitals (acronyms). */
export function proseWords(text: string, offset = 0): { from: number; to: number; word: string }[] {
  const out: { from: number; to: number; word: string }[] = [];
  const clean = text.replace(/\b(?:https?|file):\/\/\S+|\S+@\S+\.\w+/g, (m) => ' '.repeat(m.length));
  for (const m of clean.matchAll(/[A-Za-z][A-Za-z']*[A-Za-z]|[A-Za-z]/g)) {
    const w = m[0].replace(/'s$/, '');
    if (w.length < 3 || /[A-Z]/.test(w.slice(1)) || /^[A-Z]+$/.test(w)) continue;
    const before = clean[m.index! - 1], after = clean[m.index! + m[0].length];
    if (before === '_' || after === '_' || /\d/.test(before ?? '') || /\d/.test(after ?? '') || before === '.' && /\w/.test(clean[m.index! - 2] ?? '') || after === '.' && /[A-Za-z]/.test(clean[m.index! + m[0].length + 1] ?? '')) continue;   // parts of names, numbers, file.ext
    out.push({ from: offset + m.index!, to: offset + m.index! + w.length, word: w });
  }
  return out;
}
