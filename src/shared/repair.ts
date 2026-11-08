export interface RPos { line: number; character: number }
export interface RRange { start: RPos; end: RPos }
interface RTextEdit { range: RRange; newText: string }
interface RAction { title: string; kind?: string; edit?: { changes?: Record<string, RTextEdit[]>; documentChanges?: { textDocument: { uri: string }; edits: RTextEdit[] }[] } }
export interface RDiag { range: RRange; severity?: number; message: string; code?: string | number; relatedInformation?: { location: { uri: string; range: RRange }; message: string }[]; codeActions?: RAction[] }
export interface Edit { from: number; to: number; insert: string }
export interface Candidate { edit: Edit; src: string; why: string; clang?: boolean }
export type Lang = 'c' | 'cpp';

export function lineStarts(text: string): number[] {
  const out = [0];
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) out.push(i + 1);
  return out;
}
export const offsetAt = (starts: number[], text: string, p: RPos) => Math.min(text.length, (starts[Math.min(p.line, starts.length - 1)] ?? 0) + p.character);
export function posAt(starts: number[], off: number): RPos {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= off) lo = m; else hi = m - 1; }
  return { line: lo, character: off - starts[lo] };
}
export const applyEdit = (text: string, e: Edit) => text.slice(0, e.from) + e.insert + text.slice(e.to);

export const isCast = (insert: string) => /\b(static|reinterpret|const|dynamic|bit)_cast\s*</.test(insert) || /^\s*\(\s*(const\s+|unsigned\s+|signed\s+|struct\s+|enum\s+)*[A-Za-z_][\w:<>,\s]*[\s*&]*\)\s*$/.test(insert);

const CPP_STD: Record<string, string> = {};
const C_STD: Record<string, string> = {};
const GLOBAL = new Set<string>();
const put = (to: Record<string, string>, header: string, names: string, global = false) => { for (const n of names.split(' ')) { to[n] = header; if (global) GLOBAL.add(n); } };
put(CPP_STD, 'string', 'string wstring to_string stoi stol stoll stoul stod stof getline');
put(CPP_STD, 'string_view', 'string_view');
put(CPP_STD, 'vector', 'vector');
put(CPP_STD, 'map', 'map multimap');
put(CPP_STD, 'set', 'set multiset');
put(CPP_STD, 'unordered_map', 'unordered_map unordered_multimap');
put(CPP_STD, 'unordered_set', 'unordered_set unordered_multiset');
put(CPP_STD, 'deque', 'deque');
put(CPP_STD, 'list', 'list');
put(CPP_STD, 'forward_list', 'forward_list');
put(CPP_STD, 'array', 'array');
put(CPP_STD, 'stack', 'stack');
put(CPP_STD, 'queue', 'queue priority_queue');
put(CPP_STD, 'bitset', 'bitset');
put(CPP_STD, 'tuple', 'tuple make_tuple tie');
put(CPP_STD, 'utility', 'pair make_pair move swap forward exchange');
put(CPP_STD, 'optional', 'optional nullopt make_optional');
put(CPP_STD, 'variant', 'variant visit holds_alternative monostate');
put(CPP_STD, 'any', 'any any_cast');
put(CPP_STD, 'functional', 'function bind ref cref hash');
put(CPP_STD, 'memory', 'unique_ptr shared_ptr weak_ptr make_unique make_shared');
put(CPP_STD, 'iostream', 'cout cin cerr clog endl');
put(CPP_STD, 'fstream', 'ifstream ofstream fstream');
put(CPP_STD, 'sstream', 'stringstream ostringstream istringstream');
put(CPP_STD, 'algorithm', 'sort stable_sort find find_if count count_if min max minmax min_element max_element reverse fill copy copy_if transform any_of all_of none_of remove remove_if unique lower_bound upper_bound binary_search for_each clamp');
put(CPP_STD, 'numeric', 'accumulate iota gcd lcm reduce partial_sum');
put(CPP_STD, 'thread', 'thread');
put(CPP_STD, 'mutex', 'mutex lock_guard unique_lock scoped_lock');
put(CPP_STD, 'condition_variable', 'condition_variable');
put(CPP_STD, 'atomic', 'atomic');
put(CPP_STD, 'chrono', 'chrono');
put(CPP_STD, 'stdexcept', 'runtime_error logic_error invalid_argument out_of_range overflow_error');
put(CPP_STD, 'exception', 'exception');
put(CPP_STD, 'initializer_list', 'initializer_list');
put(CPP_STD, 'limits', 'numeric_limits');
put(CPP_STD, 'cstddef', 'size_t ptrdiff_t nullptr_t', true);
put(CPP_STD, 'cstdint', 'int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t intptr_t uintptr_t', true);
put(CPP_STD, 'cmath', 'sqrt pow floor ceil fabs sin cos tan exp log round', true);
put(CPP_STD, 'cstring', 'memcpy memset memmove memcmp strlen strcmp strncmp strcpy strncpy strcat', true);
put(CPP_STD, 'cstdio', 'printf fprintf sprintf snprintf puts fopen fclose FILE', true);
put(CPP_STD, 'cstdlib', 'malloc calloc realloc free exit atoi abort', true);
put(CPP_STD, 'cassert', 'assert', true);
put(C_STD, 'stdio.h', 'printf fprintf sprintf snprintf puts scanf fopen fclose FILE');
put(C_STD, 'stdlib.h', 'malloc calloc realloc free exit atoi abort abs');
put(C_STD, 'string.h', 'memcpy memset memmove memcmp strlen strcmp strncmp strcpy strncpy strcat');
put(C_STD, 'stdint.h', 'int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t intptr_t uintptr_t');
put(C_STD, 'stddef.h', 'size_t ptrdiff_t NULL offsetof');
put(C_STD, 'stdbool.h', 'bool true false');
put(C_STD, 'assert.h', 'assert');
put(C_STD, 'math.h', 'sqrt pow floor ceil fabs sin cos tan exp log round');
export const headerFor = (name: string, lang: Lang) => (lang === 'c' ? C_STD[name] : CPP_STD[name]);

export function includeSpot(text: string): number {
  const lines = text.split('\n');
  let off = 0, last = -1, lead = 0, block = false;
  for (let i = 0; i < lines.length && i < 400; off += lines[i].length + 1, i++) {
    const l = lines[i], end = off + l.length + 1;
    const comment = block || /^\s*(\/\/.*|\/\*.*)?$/.test(l);
    if (block || /^\s*\/\*/.test(l)) block = !/\*\//.test(l.slice(block ? 0 : l.indexOf('/*') + 2));
    if (/^\s*#\s*include\b/.test(l)) last = end;
    else if (comment) { if (last < 0) lead = end; }
    else if (last < 0 && /^\s*#\s*(pragma\s+once|ifndef|define)\b/.test(l)) lead = end;
    else if (last < 0 || !/^\s*#/.test(l)) break;
  }
  return Math.min(text.length, last >= 0 ? last : lead);
}
const includes = (text: string, header: string) => new RegExp(`^\\s*#\\s*include\\s*[<"]${header.replace(/[.]/g, '\\.')}[>"]`, 'm').test(text);

const CLOSER: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
const norm = (t: string) => t.replace(/\s*\(aka '[^']*'\)/g, '').replace(/\bconst\b/g, '').replace(/\s+/g, '');

function clangEdit(a: RAction, starts: number[], text: string): Edit | null {
  const files = a.edit?.changes ? Object.values(a.edit.changes) : (a.edit?.documentChanges ?? []).map((d) => d.edits);
  if (files.length !== 1) return null;
  const edits = files[0];
  if (!edits?.length) return null;
  const es = edits.map((e) => ({ from: offsetAt(starts, text, e.range.start), to: offsetAt(starts, text, e.range.end), insert: e.newText })).sort((x, y) => x.from - y.from);
  if (es.length === 1) {
    const e = es[0], old = text.slice(e.from, e.to);
    return old && e.insert.length > old.length && e.insert.endsWith(old) ? { from: e.from, to: e.from, insert: e.insert.slice(0, -old.length) } : e;
  }
  if (es.length === 2 && es[0].from === es[0].to && es[1].from === es[1].to && CLOSER[es[1].insert] === es[0].insert)
    return { from: es[0].from, to: es[1].to, insert: es[0].insert + text.slice(es[0].to, es[1].from) + es[1].insert };
  return null;
}

function openerBefore(text: string, off: number, open: string, close: string): number {
  const from = Math.max(0, off - 4000), stack: number[] = [];
  for (let i = from; i < off; i++) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '/') { const n = text.indexOf('\n', i); i = n < 0 ? off : n; continue; }
    if (c === '/' && text[i + 1] === '*') { const n = text.indexOf('*/', i + 2); i = n < 0 ? off : n + 1; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < off && text[j] !== c && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1; i = j; continue; }
    if (c === open) stack.push(i);
    else if (c === close) stack.pop();
  }
  return stack.length ? stack[stack.length - 1] : -1;
}

function prevEnd(text: string, off: number): number {
  let i = off;
  while (i > 0 && /\s/.test(text[i - 1])) i--;
  return i;
}

export function candidatesFor(text: string, d: RDiag, lang: Lang, starts = lineStarts(text)): Candidate[] {
  const out: Candidate[] = [];
  const p = offsetAt(starts, text, d.range.start);
  const m = d.message.replace(/^[A-Z](?=[a-z ])/, (c) => c.toLowerCase());
  const seen = new Set<string>();
  const add = (c: Candidate) => {
    if (isCast(c.edit.insert)) return;
    const k = /^\s*#\s*include\b/.test(c.edit.insert) ? c.edit.insert.trim() : applyEdit(text, c.edit).replace(/\s+/g, '');
    if (!seen.has(k)) { seen.add(k); out.push(c); }
  };
  const col = (pos: RPos) => (pos.line === d.range.start.line ? `column ${pos.character + 1}` : `line ${pos.line + 1}`);

  for (const a of d.codeActions ?? []) {
    const e = clangEdit(a, starts, text);
    if (!e) continue;
    const mean = /did you mean (?:to use )?'([^']+)'/.exec(m)?.[1];
    add({ edit: e, clang: true, src: mean ? `clang · did you mean ${mean}` : `clang · ${a.title}`, why: `clang's own fix for this error: ${a.title.replace(/^./, (c) => c.toLowerCase())}.` });
  }

  const exp = /^expected '([^']{1,3})'/.exec(m);
  if (exp) {
    const tok = exp[1], at = prevEnd(text, p);
    const note = d.relatedInformation?.find((r) => /^to match this '/i.test(r.message))?.location.range.start;
    const back = !note && CLOSER[tok] ? openerBefore(text, at, CLOSER[tok], tok) : -1;
    const open = note ?? (back >= 0 ? posAt(starts, back) : null);
    const src = open && CLOSER[tok] ? `closes the ${CLOSER[tok]} opened at ${col(open)}` : `adds the missing ${tok}`;
    const why = open && CLOSER[tok]
      ? `The ${CLOSER[tok]} opened at ${col(open)} is never closed. A ${tok} here closes it.`
      : `clang expects a ${tok} here, and none is written.`;
    add({ edit: { from: at, to: at, insert: tok }, src, why });
  }

  const stray = text[p];
  if (stray && ((/[)\]}]/.test(stray) && /^(expected|extraneous)\b/.test(m)) || (/[;,]/.test(stray) && (/^extraneous/.test(m) || /^expected (expression|unqualified-id|external declaration|member name|a type)/.test(m)))))
    add({ edit: { from: p, to: p + 1, insert: '' }, src: `removes a stray ${stray}`, why: `This ${stray} ${CLOSER[stray] ? `closes no ${CLOSER[stray]}` : 'belongs to nothing'}; without it the code reads as intended.` });

  if (!exp && /^expected /.test(m)) {
    const at = prevEnd(text, p);
    for (const tok of [';', ')', '}']) add({ edit: { from: at, to: at, insert: tok }, src: `adds a ${tok}`, why: `clang expects more here; a ${tok} ends what came before.` });
  }

  const undeclared = /^(?:use of undeclared identifier|unknown type name|no template named|no (?:type|member|template) named) '(\w+)'/.exec(m)
    ?? /(?:call to undeclared (?:library )?function|implicit declaration of function|implicitly declaring library function) '(\w+)'/.exec(m);
  if (undeclared) {
    const name = undeclared[1], header = headerFor(name, lang);
    const inStd = /in namespace 'std'/.test(m);
    if (header) {
      const at = text.indexOf(name, p) === p ? p : -1;
      if (lang === 'cpp' && !inStd && !GLOBAL.has(name) && at >= 0 && !/::\s*$/.test(text.slice(Math.max(0, at - 3), at)))
        add({ edit: { from: at, to: at, insert: 'std::' }, src: `std::${name}`, why: `${name} is in the standard library${includes(text, header) ? `, and <${header}> is already included` : ''}; it is only missing its std::.` });
      if (!includes(text, header)) {
        const at2 = includeSpot(text);
        add({ edit: { from: at2, to: at2, insert: `#include <${header}>\n` }, src: `#include <${header}>`, why: `${inStd || lang === 'c' || GLOBAL.has(name) ? name : `std::${name}`} is declared by <${header}>, which this file doesn't include.` });
      }
    }
  }

  const conv = /no viable conversion from '([^']+)' to '([^']+)'/.exec(m);
  const conv2 = /(?:cannot initialize|cannot convert|assigning to|initializing|passing|returning)[^']*'([^']+)'[^']*(?:with an? (?:l|r)value of type|from incompatible type|from|with an expression of type) '([^']+)'/.exec(m);
  const [from, to] = conv ? [conv[1], conv[2]] : conv2 ? [conv2[2], conv2[1]] : ['', ''];
  if (from && to) {
    const f = norm(from), t = norm(to);
    const eq = /^[^;=]*?[^=!<>]=(?!=)\s*/.exec(text.slice(p, p + 300));
    for (const at of eq ? [p, p + eq[0].length] : [p]) {
      if (f === `${t}*`) add({ edit: { from: at, to: at, insert: '*' }, src: 'reads the value it points to', why: `This is a ${from}, and a ${to} is wanted here: * reads the value the pointer points to.` });
      if (t === `${f}*`) add({ edit: { from: at, to: at, insert: '&' }, src: 'passes its address', why: `A ${to} is wanted here, and this is a ${from}: & gives its address.` });
    }
  }

  return out.slice(0, 8);
}

const serious = (d: RDiag) => (d.severity ?? 1) <= 2;
const errorCount = (l: RDiag[]) => l.filter((d) => (d.severity ?? 1) === 1).length;
const syntaxError = (m: string) => /^(expected|extraneous|missing|unterminated)\b/i.test(m);
export const cleanMessage = (m: string) => m.replace(/ \(fix available\)$/, '');

export interface Verdict { cleared: number; revealed: RDiag[] }
export function verdict(before: RDiag[], after: RDiag[], target: RDiag, edit: Edit, text: string, starts = lineStarts(text)): Verdict {
  const no: Verdict = { cleared: 0, revealed: [] };
  const nextStarts = lineStarts(applyEdit(text, edit)), grow = edit.insert.length - (edit.to - edit.from);
  const moved = (d: RDiag) => {
    const o = offsetAt(starts, text, d.range.start);
    return `${d.message}@${posAt(nextStarts, o < edit.from ? o : o >= edit.to ? o + grow : edit.from).line}`;
  };
  const now = (d: RDiag) => `${d.message}@${d.range.start.line}`;
  const had = new Map<string, number>(), revealed: RDiag[] = [];
  const fixLine = posAt(nextStarts, edit.from).line;
  for (const d of before.filter(serious)) { const k = moved(d); had.set(k, (had.get(k) ?? 0) + 1); }
  for (const d of after.filter(serious)) {
    const k = now(d), n = had.get(k) ?? 0;
    if (n) { had.set(k, n - 1); continue; }
    if (syntaxError(target.message) && !syntaxError(d.message) && d.range.start.line > fixLine) { revealed.push(d); continue; }
    return no;
  }
  const t = moved(target);
  if (after.filter((d) => now(d) === t).length >= before.filter((d) => moved(d) === t).length) return no;
  const cleared = errorCount(before) - (errorCount(after) - errorCount(revealed));
  return cleared > 0 ? { cleared, revealed } : no;
}

const brief = (m: string) => cleanMessage(m).replace(/;.*$/, '').replace(/^[A-Z](?=[a-z ])/, (c) => c.toLowerCase());
export function reason(c: Candidate, v: Verdict): string {
  const gone = v.cleared > 1 ? `this error and ${v.cleared - 1} more are gone` : 'this error is gone';
  if (!v.revealed.length) return `${c.why} With it, ${gone} and clangd finds no new one in the file.`;
  const what = v.revealed.map((d) => `${brief(d.message)} (line ${d.range.start.line + 1})`).join('; ');
  return `${c.why} With it, ${gone}. clangd then reads the code it had skipped, and finds ${v.revealed.length} more ${v.revealed.length === 1 ? 'problem' : 'problems'} there, not made by this fix: ${what}.`;
}
