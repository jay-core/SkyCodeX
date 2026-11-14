import type { Seq, StepNumber } from './flowseq';

export interface GridFn { key: string; name: string; full: string; file: string; fn: number; first: number; count: number; runs: number; atLeast: boolean }
export interface GridModel {
  rows: GridFn[];
  cols: GridFn[];
  cells: Map<string, number[]>;
  cellOf: string[];
  files: string[];
}
export type GridOrder = 'file' | 'run' | 'count';

const short = (n: string) => n.replace(/^.*::(?=[^:]+$)/, '');

export function passesOf(s: Seq, it: number): { n: number; known: boolean } {
  const F = s.run.frames;
  let n = 1, known = true;
  for (const f of s.run.rows[s.items[it]].frames) {
    if (F[f].kind !== 'loop' || F[f].dead) continue;
    if (F[f].count == null) known = false; else n *= F[f].count!;
  }
  return { n, known };
}

export function buildGrid(s: Seq, nums: StepNumber[], order: GridOrder = 'file'): GridModel {
  const R = s.run.rows, rows = new Map<string, GridFn>(), cols = new Map<string, GridFn>(), cells = new Map<string, number[]>(), files: string[] = [];
  const cellOf: string[] = [];
  const fnOf = (row: number): { key: string; name: string; full: string; file: string } => {
    const r = R[row];
    if (r.kind === 'ref' && r.ref != null) return { key: R[r.ref].key, name: short(R[r.ref].name), full: R[r.ref].name, file: R[r.ref].file };
    if (r.kind === 'step') return { key: r.key, name: short(r.name), full: r.name, file: r.file };
    const at = r.caller != null ? R[r.caller].file : r.file, n = r.kind === 'indirect' ? (r.text ?? r.name) : r.name;
    return { key: `${r.kind}:${r.text ?? r.name}@${at}`, name: r.kind === 'indirect' ? n : short(n), full: n, file: at };
  };
  const add = (m: Map<string, GridFn>, f: { key: string; name: string; full: string; file: string }, it: number) => {
    let g = m.get(f.key);
    if (!g) { g = { ...f, fn: nums[it]?.fn ?? 0, first: it, count: 0, runs: 0, atLeast: false }; m.set(f.key, g); }
    g.count++;
    if (!files.includes(f.file)) files.push(f.file);
    return g;
  };
  s.items.forEach((row, it) => {
    const r = R[row];
    if (r.caller == null) { cellOf.push(''); if (!files.includes(r.file)) files.push(r.file); return; }
    const callee = fnOf(row), caller = fnOf(r.caller);
    const g = add(rows, callee, it), p = passesOf(s, it);
    g.runs += p.n; if (!p.known) g.atLeast = true;
    if (!cols.has(caller.key)) add(cols, caller, s.itemOf[r.caller] ?? it); else cols.get(caller.key)!.count++;
    const k = `${caller.key}>${callee.key}`;
    (cells.get(k) ?? cells.set(k, []).get(k)!).push(it);
    cellOf.push(k);
  });
  for (const c of cols.values()) { c.count = 0; const st = s.items.findIndex((row) => fnOf(row).key === c.key); if (st >= 0) { c.fn = nums[st]?.fn ?? c.fn; c.first = st; } }
  for (const [k, v] of cells) cols.get(k.slice(0, k.indexOf('>')))!.count += v.length;
  const all = new Map<string, GridFn[]>();
  for (const g of [...rows.values(), ...cols.values()]) all.set(g.name, [...(all.get(g.name) ?? []), g]);
  for (const list of all.values()) if (new Set(list.map((g) => g.key)).size > 1) for (const g of list) g.name = g.full;
  const full = new Map<string, GridFn[]>();
  for (const g of [...rows.values(), ...cols.values()]) full.set(g.name, [...(full.get(g.name) ?? []), g]);
  for (const list of full.values()) if (new Set(list.map((g) => g.key)).size > 1) for (const g of list) g.name = `${g.name} · ${g.file.replace(/^.*[\\/]/, '')}`;
  const sort = (a: GridFn, b: GridFn) => order === 'count' ? b.count - a.count || a.first - b.first
    : order === 'file' ? files.indexOf(a.file) - files.indexOf(b.file) || a.first - b.first : a.first - b.first;
  return { rows: [...rows.values()].sort(sort), cols: [...cols.values()].sort(sort), cells, cellOf, files };
}
