import type { Seq } from './flowseq';
import type { RunRow } from './flowrun';
import { argName } from './flowwatch';
import { callResult } from './metrofacts';

export type LinkKind = 'in' | 'out' | 'call';
export interface StepLink { kind: LinkKind; from: number; to: number; label: string }
export interface StepDecision { text: string; file: string; line: number }
export interface Take { arg: string; param: string; how: string; from: string }
export interface StepLinks { links: StepLink[]; decisions: StepDecision[]; takes: Take[]; gives: { what: string; to: string[] }; calls: string }
export interface Source { kind: 'result' | 'write' | 'param'; row: number; text: string }

type Lines = (file: string) => string[] | null;
const short = (n: string) => n.replace(/^.*::(?=[^:]+$)/, '');
const CHAIN = /^[A-Za-z_]\w*(?:(?:\.|->)[A-Za-z_]\w*)*$/;
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function passMode(type: string): string {
  const t = type.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (/&\s*$/.test(t)) return 'by reference';
  if (/\*\s*(?:const\s*)?$/.test(t)) return 'by pointer';
  if (/\b(?:basic_)?string_view\b|\bspan\s*</.test(t)) return 'a view';
  return 'a copy';
}

const fnOf = (s: Seq, row: number): RunRow => { const r = s.run.rows[row]; return r.kind === 'ref' && r.ref != null ? s.run.rows[r.ref] : r; };
const fxOf = (s: Seq, row: number) => { const r = s.run.rows[row]; return r.kind === 'step' || r.kind === 'ref' ? s.run.effects?.[fnOf(s, row).key] ?? null : null; };
const nameOf = (s: Seq, row: number) => { const r = s.run.rows[row]; return short(r.kind === 'indirect' ? (r.text ?? r.name) : fnOf(s, row).name); };
const rootOf = (arg: string) => /^[A-Za-z_]\w*/.exec(argName(arg))?.[0] ?? '';
const reads = (arg: string, v: string) => { const n = argName(arg); return n === v || n.startsWith(`${v}.`) || n.startsWith(`${v}->`) || n.startsWith(`${v}[`); };
const itemOfRow = (s: Seq, row: number) => { const k = s.itemOf[row]; return k != null && k >= 0 && s.items[k] === row ? k : -1; };

export function resultName(s: Seq, row: number, lines: Lines): { text: string; name: string } {
  const res = callResult(s, row, lines).result;
  return { text: res?.text ?? '', name: res?.name ?? '' };
}

function argsAt(s: Seq, row: number, lines: Lines): string {
  const r = s.run.rows[row], file = r.caller != null ? s.run.rows[r.caller].file : '', t = r.at ? lines(file)?.[r.at.line] ?? '' : '';
  const open = r.at ? t.indexOf('(', r.at.character) : -1;
  if (open < 0) return '…';
  for (let k = open, d = 0; k < t.length; k++) { if (t[k] === '(') d++; else if (t[k] === ')' && --d === 0) return t.slice(open + 1, k).trim(); }
  return `${t.slice(open + 1).trim()} …`;
}

export function sourceOf(s: Seq, caller: number, before: number, v: string, lines: Lines): Source | null {
  const R = s.run.rows;
  for (let j = before - 1; j > caller; j--) {
    const r = R[j];
    if (r.caller !== caller) continue;
    if (resultName(s, j, lines).name === v) return { kind: 'result', row: j, text: `${v} = ${nameOf(s, j)}(${r.args ? r.args.join(', ') : argsAt(s, j, lines)})` };
    const fx = fxOf(s, j);
    if (fx?.params && r.args) for (let i = 0; i < r.args.length; i++) {
      const p = fx.params[i];
      if (p && argName(r.args[i]) === v && fx.paramWrites?.includes(p.name)) return { kind: 'write', row: j, text: `${nameOf(s, j)} writes ${v}` };
    }
  }
  const cfx = fxOf(s, caller);
  if (cfx?.params?.some((p) => p.name === v)) return { kind: 'param', row: caller, text: `${v}: parameter of ${nameOf(s, caller)}` };
  return null;
}

const condText = (t: string) => {
  const s0 = t.trim().replace(/^\}\s*/, ''), i = s0.indexOf('(');
  if (i < 0) return s0;
  let d = 0;
  for (let k = i; k < s0.length; k++) { if (s0[k] === '(') d++; else if (s0[k] === ')' && --d === 0) return s0.slice(0, k + 1); }
  return `${s0} …`;
};

export function stepLinks(s: Seq, it: number, lines: Lines): StepLinks {
  const R = s.run.rows, row = s.items[it], r = R[row];
  const links: StepLink[] = [], decisions: StepDecision[] = [], takes: Take[] = [];
  const seen = new Set<string>();
  const add = (l: StepLink) => { const k = `${l.kind}:${l.from}>${l.to}`; if (l.from === l.to || seen.has(k)) return; seen.add(k); links.push(l); };

  const inputs = (target: number, only: number, depth: number) => {
    const t = R[target], ti = itemOfRow(s, target);
    if (t.caller == null || !t.args || ti < 0) return;
    const tfx = fxOf(s, target);
    t.args.forEach((arg, i) => {
      if (only >= 0 && i !== only) return;
      const n = argName(arg), p = tfx?.params?.[i], how = p ? passMode(p.canon ?? p.type) : '';
      if (!CHAIN.test(n)) { if (depth === 0) takes.push({ arg, param: p?.name ?? '', how, from: '' }); return; }
      const v = rootOf(arg), src = sourceOf(s, t.caller!, target, v, lines);
      if (depth === 0) takes.push({ arg, param: p?.name ?? '', how, from: src ? (src.kind === 'param' ? src.text : `step ${itemOfRow(s, src.row) + 1} · ${src.text}`) : '' });
      if (!src) return;
      const si = itemOfRow(s, src.row);
      if (si < 0) return;
      if (src.kind === 'param') {
        add({ kind: 'in', from: si, to: ti, label: `${arg}${how ? ` · ${how}` : ''}` });
        const pi = fxOf(s, src.row)?.params?.findIndex((q) => q.name === v) ?? -1;
        if (depth < 1 && pi >= 0) inputs(src.row, pi, depth + 1);
      } else add({ kind: 'in', from: si, to: ti, label: `${si + 1} · ${src.text}${how ? ` · ${how}` : ''}` });
    });
  };
  inputs(row, -1, 0);

  const res = resultName(s, row, lines);
  const gives = { what: res.text.replace(/^→ /, ''), to: [] as string[] };
  if (res.name && r.caller != null && r.at) {
    const c = r.caller, v = res.name, readLines = new Set<number>();
    for (let j = row + 1; j <= R[c].last; j++) {
      const x = R[j];
      if (x.caller !== c) continue;
      const k = (x.args ?? []).findIndex((a) => reads(a, v));
      if (k >= 0) {
        if (x.at) readLines.add(x.at.line);
        const xi = itemOfRow(s, j), p = fxOf(s, j)?.params?.[k], how = p ? passMode(p.canon ?? p.type) : '';
        gives.to.push(`${xi >= 0 ? `step ${xi + 1} ` : ''}${nameOf(s, j)}${how ? ` · ${how}` : ''}`);
        if (xi >= 0) add({ kind: 'out', from: it, to: xi, label: `${xi + 1} · reads ${v}${how ? ` · ${how}` : ''}` });
      }
      if (resultName(s, j, lines).name === v) break;
    }
    const cf = R[c], L = lines(cf.file);
    if (L) {
      const word = new RegExp(`(^|[^\\w.>])${esc(v)}\\b`), set = new RegExp(`(^|[^\\w.>])${esc(v)}\\s*[+\\-*/%|&^]?=(?!=)`);
      const end = Math.min(L.length - 1, cf.start + Math.max(1, cf.lines) - 1);
      for (let l = r.at.line + 1; l <= end; l++) {
        const t = L[l] ?? '';
        if (set.test(t)) break;
        if (readLines.has(l) || !/^\s*(?:\}\s*)?(?:else\s+)?(?:if|while|switch)\s*\(/.test(t) || !word.test(t)) continue;
        decisions.push({ text: condText(t), file: cf.file, line: l });
      }
    }
  } else if (res.text === '→ the condition' && r.caller != null && r.at) {
    const cf = R[r.caller], t = lines(cf.file)?.[r.at.line];
    if (t != null) decisions.push({ text: condText(t), file: cf.file, line: r.at.line });
  }

  const per = new Map<string, number>();
  if (r.kind === 'step') {
    for (let j = row + 1; j <= r.last; j++) {
      const x = R[j];
      if (x.caller !== row) continue;
      const nm = nameOf(s, j);
      per.set(nm, (per.get(nm) ?? 0) + 1);
      const xi = itemOfRow(s, j);
      if (xi >= 0) add({ kind: 'call', from: it, to: xi, label: '' });
    }
  }
  const calls = per.size ? `calls ${[...per].map(([n, k]) => `${n} ×${k}`).join(' · ')}` : '';
  return { links, decisions, takes, gives, calls };
}
