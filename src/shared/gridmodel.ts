// The grid view's data: called functions as rows, calling functions as columns, both grouped by file; each square
// holds the steps (items) where that call happens. Built from the same run as the metro, so the numbers always agree.
import type { Seq, StepNumber } from './flowseq';

export interface GridFn { key: string; name: string; file: string; fn: number; first: number; count: number }
export interface GridModel {
  rows: GridFn[];                      // called
  cols: GridFn[];                      // calling
  cells: Map<string, number[]>;        // `${colKey}>${rowKey}` → items, in run order
  cellOf: string[];                      // item → its cell key ('' for the entry, which nothing calls)
  files: string[];                     // in order of first appearance
}
export type GridOrder = 'file' | 'run' | 'count';

const short = (n: string) => n.replace(/^.*::(?=[^:]+$)/, '');

export function buildGrid(s: Seq, nums: StepNumber[], order: GridOrder = 'file'): GridModel {
  const R = s.run.rows, rows = new Map<string, GridFn>(), cols = new Map<string, GridFn>(), cells = new Map<string, number[]>(), files: string[] = [];
  const cellOf: string[] = [];
  const fnOf = (row: number): { key: string; name: string; file: string } => {
    const r = R[row];
    if (r.kind === 'ref' && r.ref != null) return { key: R[r.ref].key, name: short(R[r.ref].name), file: R[r.ref].file };
    if (r.kind === 'step') return { key: r.key, name: short(r.name), file: r.file };
    // a call through a pointer, or a value: kept in its caller's file, under the text it is written as
    const at = r.caller != null ? R[r.caller].file : r.file;
    return { key: `${r.kind}:${r.text ?? r.name}@${at}`, name: r.kind === 'indirect' ? (r.text ?? r.name) : short(r.name), file: at };
  };
  const add = (m: Map<string, GridFn>, f: { key: string; name: string; file: string }, it: number) => {
    let g = m.get(f.key);
    if (!g) { g = { ...f, fn: nums[it]?.fn ?? 0, first: it, count: 0 }; m.set(f.key, g); }
    g.count++;
    if (!files.includes(f.file)) files.push(f.file);
  };
  s.items.forEach((row, it) => {
    const r = R[row];
    if (r.caller == null) { cellOf.push(''); if (!files.includes(r.file)) files.push(r.file); return; }
    const callee = fnOf(row), caller = fnOf(r.caller);
    add(rows, callee, it);
    if (!cols.has(caller.key)) add(cols, caller, s.itemOf[r.caller] ?? it); else cols.get(caller.key)!.count++;
    const k = `${caller.key}>${callee.key}`;
    (cells.get(k) ?? cells.set(k, []).get(k)!).push(it);
    cellOf.push(k);
  });
  // a column's count is how many calls it makes; its ƒ number is its own (from its first step)
  for (const c of cols.values()) { c.count = 0; const st = s.items.findIndex((row) => fnOf(row).key === c.key); if (st >= 0) { c.fn = nums[st]?.fn ?? c.fn; c.first = st; } }
  for (const [k, v] of cells) cols.get(k.slice(0, k.indexOf('>')))!.count += v.length;
  const sort = (a: GridFn, b: GridFn) => order === 'count' ? b.count - a.count || a.first - b.first
    : order === 'file' ? files.indexOf(a.file) - files.indexOf(b.file) || a.first - b.first : a.first - b.first;
  return { rows: [...rows.values()].sort(sort), cols: [...cols.values()].sort(sort), cells, cellOf, files };
}
