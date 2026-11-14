import type { Seq } from './flowseq';

export interface Junction {
  id: string;
  kind: 'exit' | 'arm';
  owner: number;
  ownerRow: number;
  after: number;
  file: string;
  line: number;
  cond: string;
  then: string;
  thenLine: number;
  ends: boolean;
  span: [number, number] | null;
  steps: number;
  inFn: number;
}

type Lines = (file: string) => string[] | null;
const short = (n: string) => n.replace(/^.*::(?=[^:]+$)/, '');
const EXITS = new Set(['return', 'throw', 'co_return', 'goto', 'noreturn']);
const squash = (t: string) => t.replace(/\s+/g, '');

function condLine(L: string[] | null, from: number, to: number, cond: string, fallback: number): number {
  if (!L) return fallback;
  const head = squash(cond.split(' · ')[0]).slice(0, 48);
  if (!head) return fallback;
  for (let l = Math.min(to, L.length - 1); l >= from; l--) if (squash(L[l] ?? '').includes(head)) return l;
  return fallback;
}

const shown = (when: string) => {
  const i = when.indexOf(' · ');
  if (i < 0) return when;
  const head = when.slice(0, i), label = when.slice(i + 3);
  return label === 'else' ? `else of ${head}` : `${head} · ${label}`;
};

export function junctionsOf(s: Seq, lines: Lines): Junction[] {
  const R = s.run.rows, out: Junction[] = [];
  const before = (oi: number, row: number, line: number) => {
    let after = oi;
    for (let k = oi + 1; k <= s.lastItem[oi]; k++) {
      const x = R[s.items[k]];
      if (x.caller !== row || !x.at) continue;
      if (x.at.line > line) break;
      after = s.lastItem[k];
      k = after;
    }
    return after;
  };
  const arms: Junction[] = [];
  s.run.frames.forEach((f, fi) => {
    if (f.kind !== 'arm' || !(f.label === 'then' || f.label === 'else' || /^(?:case|default)\b/.test(f.label))) return;
    const sp = s.span.get(fi), oi = s.itemOf[f.owner];
    if (!sp || oi == null || oi < 0 || s.items[oi] !== f.owner || sp[0] <= oi) return;
    const r = R[f.owner], L = lines(r.file), first = R[s.items[sp[0]]];
    const line = condLine(L, r.start, f.line, f.text, f.line);
    const exit = (s.run.exits?.[r.key] ?? []).find((x) => x.early && EXITS.has(x.kind) && x.when.length > 0 && x.when[x.when.length - 1].split(' · ')[0] === f.text && x.line >= line);
    const thenText = first.at && L ? (L[first.at.line] ?? '').trim().replace(/;\s*$/, '') : short(first.name);
    arms.push({
      id: `a:${fi}`, kind: 'arm', owner: oi, ownerRow: f.owner, after: sp[0] - 1, file: r.file, line,
      cond: f.label === 'then' ? f.text : f.label === 'else' ? `else of ${f.text}` : `${f.text} · ${f.label}`,
      then: thenText, thenLine: first.at?.line ?? f.line, ends: !!exit, span: [sp[0], sp[1]], steps: sp[1] - sp[0] + 1, inFn: 0,
    });
  });
  s.items.forEach((row, oi) => {
    const r = R[row];
    if (r.kind !== 'step') return;
    const L = lines(r.file);
    for (const x of s.run.exits?.[r.key] ?? []) {
      if (!x.early || !EXITS.has(x.kind) || !x.when.length) continue;
      const when = x.when[x.when.length - 1];
      if (/^(?:for|while|do)\b/.test(when)) continue;
      const line = condLine(L, r.start, x.line, when, x.line);
      if (arms.some((a) => a.ownerRow === row && a.line === line)) continue;
      const after = before(oi, row, line);
      out.push({
        id: `x:${oi}:${x.line}`, kind: 'exit', owner: oi, ownerRow: row, after, file: r.file, line, cond: shown(when),
        then: x.text.replace(/;\s*$/, ''), thenLine: x.line, ends: true, span: null, steps: s.lastItem[oi] - after, inFn: 0,
      });
    }
  });
  const all = [...out, ...arms].sort((a, b) => a.after - b.after || a.line - b.line), per = new Map<number, number>();
  for (const j of all) per.set(j.ownerRow, (per.get(j.ownerRow) ?? 0) + 1);
  for (const j of all) j.inFn = per.get(j.ownerRow) ?? 0;
  return all;
}

export interface JunctionWords { then: string; else: string }
export function junctionWords(s: Seq, j: Junction): JunctionWords {
  const owner = short(s.run.rows[j.ownerRow].name), n = (k: number) => `${k} step${k === 1 ? '' : 's'}`;
  if (j.kind === 'exit') return { then: `⊣ ${j.then} · ${owner} ends`, else: j.steps > 0 ? `↓ ${n(j.steps)}` : `${owner} goes on` };
  return { then: `${j.ends ? '⊣' : '↘'} ${j.then}${j.steps > 1 ? ` · ${n(j.steps)}` : ''}`, else: 'straight on' };
}
