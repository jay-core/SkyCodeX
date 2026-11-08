import type { Seq, StepNumber } from './flowseq';
import { leadingComment, findings } from './flowseq';
import type { RunFrame } from './flowrun';

export type Tone = '' | 'ok' | 'warn' | 'thread' | 'link' | 'comment';
export interface Note { text: string; tone: Tone }
export interface MetroRow {
  item: number; step: number; fn: number; call: number; again: boolean;
  kind: 'step' | 'ref' | 'indirect' | 'value';
  name: string; file: string;
  who: string | null;
  callText: string;
  inside: string;
  result: string; resultTone: Tone;
  notes: Note[];
}

const short = (n: string) => n.replace(/^.*::(?=[^:]+$)/, '');

export function callAt(line: string, at: number, name: string): string | null {
  let i = line.indexOf(name, Math.max(0, at - name.length));
  if (i < 0 || i > at + 2) i = at;
  let j = i;
  while (j < line.length && /[\w:~.>-]/.test(line[j]) && line[j] !== '(') j++;
  while (j < line.length && line[j] === ' ') j++;
  if (line[j] !== '(') return null;
  let depth = 0, k = j;
  for (; k < line.length; k++) { if (line[k] === '(') depth++; else if (line[k] === ')' && --depth === 0) break; }
  return depth === 0 && k < line.length ? line.slice(i, k + 1) : line.slice(i).trimEnd();
}

export function resultOf(before: string, after: string): { text: string; tone: Tone } | null {
  const b = before.replace(/\s+$/, '');
  if (/\breturn$/.test(b)) return { text: '→ returned', tone: '' };
  const asg = /([A-Za-z_]\w*(?:\.[A-Za-z_]\w*|->[A-Za-z_]\w*|\[[^\]]*\])*)\s*[+\-*/%|&^]?=$/.exec(b);
  if (asg && !/[=!<>]=$/.test(b)) return { text: `→ ${asg[1]}`, tone: '' };
  if (/\bfor\s*\(.*:\s*$/.test(before)) return { text: '→ each item', tone: '' };
  let depth = 0, start = 0;
  for (let i = b.length - 1; i >= 0; i--) {
    if (b[i] === ')') depth++;
    else if (depth === 0 && (b[i] === '{' || b[i] === ';')) { start = i + 1; break; }
    else if (b[i] === '(' && depth-- === 0) {
      const head = b.slice(0, i).trimEnd(), word = /([A-Za-z_][\w:]*)$/.exec(head)?.[1] ?? '';
      if (/^(if|while|switch)$/.test(word)) return { text: '→ the condition', tone: '' };
      if (word && word !== 'for') return { text: `→ argument of ${word}`, tone: '' };
      return null;
    }
  }
  if (/^\s*(?:[A-Za-z_][\w]*\s*(?:\.|->)\s*)*$/.test(b.slice(start)) && /^\s*[;}]/.test(after)) return { text: '', tone: '' };
  return null;
}

export function metroRow(s: Seq, it: number, nums: StepNumber[], lines: (file: string) => string[] | null): MetroRow {
  const R = s.run.rows, row = s.items[it], r = R[row], n = nums[it];
  const fnRow = r.kind === 'ref' && r.ref != null ? R[r.ref] : r;
  const caller = r.caller != null ? R[r.caller] : null;
  const notes: Note[] = [];
  let callText = '', inside = '', result = '', resultTone: Tone = '';
  if (caller && r.at) {
    const L = lines(caller.file), line = L?.[r.at.line];
    const name = short(r.kind === 'indirect' || r.kind === 'value' ? (r.via ?? r.name) : fnRow.name);
    const c = line != null ? callAt(line, r.at.character, name) : null;
    callText = c ?? (line?.includes(name) ? name : `${name}(${(r.args ?? []).join(', ')})`);
    if (line != null && c) {
      const at = line.indexOf(c);
      const res = resultOf(line.slice(0, at), line.slice(at + c.length));
      if (res) { result = res.text; resultTone = res.tone; }
    }
  } else callText = `${short(fnRow.name)}()`;
  const own = r.frames.map((f) => s.run.frames[f]).filter((f) => f.owner === r.caller && f.kind === 'loop');
  const fr: RunFrame | undefined = own[own.length - 1];
  if (fr) inside = fr.text;
  if (r.kind === 'indirect') notes.push({ text: r.could?.length ? `through ${r.via ?? 'a pointer'} · could be ${r.could.slice(0, 2).join(', ')}` : `through ${r.via ?? 'a pointer'}`, tone: 'link' });
  if (r.kind === 'value') notes.push({ text: 'named, not called', tone: '' });
  const fx = r.kind === 'step' || r.kind === 'ref' ? s.run.effects?.[fnRow.key] : undefined;
  const callerFx = caller ? s.run.effects?.[caller.key] : undefined;
  if (r.at && fx?.returnsValue && callerFx?.dropped?.some((d) => d.start.line === r.at!.line && Math.abs(d.start.character - r.at!.character) <= short(fnRow.name).length + 2)) {
    notes.push({ text: 'result thrown away', tone: 'warn' }); if (!result) { result = '→ unused'; resultTone = 'warn'; }
  }
  if (fx) {
    for (const g of fx.globalWrites.slice(0, 2)) notes.push({ text: `writes ${g}`, tone: 'warn' });
    if (fx.locks.length) notes.push({ text: `locks ${fx.locks[0]}`, tone: '' });
    if (fx.throws.length) notes.push({ text: `may throw ${fx.throws[0]}`, tone: 'warn' });
    if (pureFrom(s, fnRow === r ? row : r.ref!, lines)) notes.push({ text: 'pure', tone: 'ok' });
  }
  if ((r.kind === 'step') && n.call === 1) { const L = lines(fnRow.file); const c = L ? leadingComment(L, fnRow.start) : ''; if (c) notes.push({ text: `“${c}”`, tone: 'comment' }); }
  return {
    item: it, step: n.step, fn: n.fn, call: n.call, again: n.again, kind: r.kind, name: short(fnRow.name), file: fnRow.file,
    who: caller ? short(caller.name) : null, callText, inside, result, resultTone, notes,
  };
}

const NOT_CALLS = new Set(['if', 'while', 'for', 'switch', 'return', 'sizeof', 'alignof', 'decltype', 'static_cast', 'const_cast', 'reinterpret_cast', 'dynamic_cast', 'catch', 'noexcept', 'static_assert', 'throw']);
function pureFrom(s: Seq, row: number, lines: (file: string) => string[] | null): boolean {
  const R = s.run.rows, fx = s.run.effects;
  if (!fx) return false;
  for (let i = row; i <= R[row].last; i++) {
    const r = R[i];
    if (r.kind === 'indirect') return false;
    if (r.kind === 'value') continue;
    const fn = r.kind === 'ref' && r.ref != null ? R[r.ref] : r, e = fx[fn.key];
    if (!e || e.writes.length || e.globalWrites.length || e.globalReads.length || e.locks.length || e.allocates.length || e.throws.length) return false;
    const L = lines(fn.file);
    if (!L || !fn.lines) return false;
    const whole = L.slice(fn.line, fn.start + fn.lines).join('\n'), body = whole.slice(whole.indexOf('{') + 1).replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*$/gm, '');
    const at = r.kind === 'ref' && r.ref != null ? r.ref : i, known = new Set<string>();
    for (let j = at + 1; j <= R[at].last; j++) known.add(short(R[j].kind === 'ref' && R[j].ref != null ? R[R[j].ref!].name : R[j].name));
    for (const m of body.matchAll(/([A-Za-z_]\w*)\s*\(/g)) if (!NOT_CALLS.has(m[1]) && !known.has(m[1])) return false;
  }
  return true;
}

export interface CardCall { item: number; step: number; nth: number; file: string; line: number; code: string; state: 'done' | 'now' | 'later' }
export interface DetailCard {
  head: string;
  callee: { name: string; fn: number; file: string; from: number; to: number; signature: string };
  timesCalled: number; callers: { name: string; count: number }[];
  calls: CardCall[];
  caller: { name: string; fn: number; file: string; line: number; makes: { name: string; steps: number[] }[]; inside: string } | null;
  passesIn: string; getsBack: string;
  itsCalls: { name: string; steps: number[] }[]; library: string[]; loops: number;
  waysOut: { text: string; line: number; early: boolean }[];
  effects: { changes: string; outside: string; pure: string; thread: string };
  comment: string; findings: string[]; across: string;
}

const libraryCalls = (s: Seq, row: number, lines: (file: string) => string[] | null): string[] => {
  const R = s.run.rows, fn = R[row], L = lines(fn.file);
  if (!L || !fn.lines) return [];
  const whole = L.slice(fn.line, fn.start + fn.lines).join('\n'), body = whole.slice(whole.indexOf('{') + 1).replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*$/gm, '');
  const known = new Set<string>();
  for (let j = row + 1; j <= fn.last; j++) known.add(short(R[j].kind === 'ref' && R[j].ref != null ? R[R[j].ref!].name : R[j].name));
  const out: string[] = [];
  for (const m of body.matchAll(/([A-Za-z_]\w*)\s*\(/g)) if (!NOT_CALLS.has(m[1]) && !known.has(m[1]) && !out.includes(m[1]) && m[1] !== short(fn.name)) out.push(m[1]);
  return out;
};

export function detailCard(s: Seq, at: number, cell: number[] | null, cur: number, nums: StepNumber[], lines: (file: string) => string[] | null): DetailCard {
  const R = s.run.rows, r = R[s.items[at]];
  const keyOf = (row: number) => (R[row].kind === 'ref' && R[row].ref != null ? R[R[row].ref!].key : R[row].key);
  const fnRowIdx = r.kind === 'ref' && r.ref != null ? r.ref : s.items[at], fnRow = R[fnRowIdx], key = keyOf(s.items[at]);
  const callerRow = r.caller != null ? R[r.caller] : null;
  const all: number[] = [], byCaller = new Map<string, number>();
  s.items.forEach((row, i) => { if (keyOf(row) === key && (R[row].kind === 'step' || R[row].kind === 'ref')) { all.push(i); const c = R[row].caller != null ? short(R[R[row].caller!].name) : '(entry)'; byCaller.set(c, (byCaller.get(c) ?? 0) + 1); } });
  const callOf = (i: number): CardCall => {
    const x = R[s.items[i]], c = x.caller != null ? R[x.caller] : null, L = c ? lines(c.file) : null;
    return { item: i, step: i + 1, nth: all.indexOf(i) + 1 || 1, file: c?.file ?? x.file, line: x.at ? x.at.line + 1 : x.line + 1, code: x.at && L ? (L[x.at.line] ?? '').trim() : '', state: i === cur ? 'now' : i < cur ? 'done' : 'later' };
  };
  const shown = (cell ?? (r.kind === 'step' || r.kind === 'ref' ? all : [at])).map(callOf);
  let caller: DetailCard['caller'] = null;
  if (callerRow && r.caller != null) {
    const makes = new Map<string, number[]>();
    s.items.forEach((row, i) => { const x = R[row]; if (x.caller != null && keyOf(x.caller) === callerRow.key) { const n = short(x.kind === 'ref' && x.ref != null ? R[x.ref].name : x.name); makes.set(n, [...(makes.get(n) ?? []), i + 1]); } });
    const m = metroRow(s, at, nums, lines);
    caller = { name: short(callerRow.name), fn: nums[s.itemOf[r.caller]]?.fn ?? callerRow.n, file: callerRow.file, line: callerRow.line + 1, makes: [...makes].map(([name, steps]) => ({ name, steps })), inside: m.inside };
  }
  const L = lines(fnRow.file), text = L && fnRow.lines ? L.slice(fnRow.start, fnRow.start + fnRow.lines) : [];
  const sigEnd = text.findIndex((l) => l.includes('{')), signature = (sigEnd >= 0 ? text.slice(0, sigEnd + 1).join(' ') : text[0] ?? '').replace(/\s*\{.*$/, '').replace(/\s+/g, ' ').trim();
  const body = text.join('\n');
  const itsCalls = new Map<string, number[]>();
  s.items.forEach((row, i) => { const x = R[row]; if (x.caller != null && keyOf(x.caller) === key && x.caller !== null) { const n = short(x.kind === 'ref' && x.ref != null ? R[x.ref].name : x.name); itsCalls.set(n, [...(itsCalls.get(n) ?? []), i + 1]); } });
  const fx = s.run.effects?.[key];
  const m = metroRow(s, at, nums, lines);
  const pure = m.notes.some((n) => n.text === 'pure') ? 'yes: no outside state, and every call it makes is pure'
    : !fx ? 'not known' : fx.writes.length || fx.globalWrites.length || fx.globalReads.length || fx.locks.length || fx.allocates.length || fx.throws.length ? 'no: it touches outside state (above)'
    : libraryCalls(s, fnRowIdx, lines).length ? 'not marked: its library calls aren’t checked' : 'not marked: a function it calls isn’t pure';
  const threadStart = (() => { let x: number | null = s.items[at]; while (x != null && R[x].thread) { const c: number | null = R[x].caller; if (c == null || !R[c].thread) return x; x = c; } return null; })();
  const fnd = findings(s.run).filter((f) => f.rows.some((row) => keyOf(row) === key)).map((f) => `${f.text} (${f.grade})`);
  const fileOfCaller = callerRow?.file ?? '';
  return {
    head: cell ? `${caller?.name ?? ''} → ${short(fnRow.name)}` : short(fnRow.name),
    callee: { name: short(fnRow.name), fn: nums[s.itemOf[fnRowIdx]]?.fn ?? fnRow.n, file: fnRow.file, from: fnRow.start + 1, to: fnRow.start + Math.max(1, fnRow.lines), signature },
    timesCalled: all.length, callers: [...byCaller].map(([name, count]) => ({ name, count })),
    calls: shown, caller,
    passesIn: r.args?.length ? r.args.join(', ') : '', getsBack: m.result,
    itsCalls: [...itsCalls].map(([name, steps]) => ({ name, steps })), library: libraryCalls(s, fnRowIdx, lines),
    loops: (body.match(/\b(for|while)\s*\(|\bdo\s*\{/g) ?? []).length,
    waysOut: (s.run.exits?.[key] ?? []).map((x) => ({ text: x.text, line: x.line + 1, early: x.early })),
    effects: {
      changes: fx ? [...fx.writes.map((w) => `member ${w}`), ...fx.globalWrites.map((g) => `global ${g}`)].join(', ') || 'only its own locals and parameters' : 'not known',
      outside: fx ? [fx.globalReads.length ? `reads ${fx.globalReads.join(', ')}` : '', fx.locks.length ? `locks ${fx.locks.join(', ')}` : '', fx.allocates.length ? `allocates ${fx.allocates.join(', ')}` : '', fx.throws.length ? `throws ${fx.throws.join(', ')}` : ''].filter(Boolean).join(' · ') || 'no globals, no locks, no allocation, no throw' : 'not known',
      pure, thread: threadStart != null ? `a thread started at step ${s.itemOf[threadStart] + 1}` : 'the main thread',
    },
    comment: L ? leadingComment(L, fnRow.start) : '',
    findings: fnd,
    across: fileOfCaller && fileOfCaller !== fnRow.file ? `${fileOfCaller.split(/[\\/]/).pop()} → ${fnRow.file.split(/[\\/]/).pop()}` : 'within one file',
  };
}
