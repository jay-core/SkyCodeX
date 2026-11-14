import type { Run, RunRow } from './flowrun';

const targetOf = (R: RunRow[], i: number): number | null => (R[i].kind === 'step' ? i : R[i].kind === 'ref' ? R[i].ref! : null);

export interface RouteInfo { rows: number[]; at: number[] }
export function routesBetween(run: Run, a: number, b: string): RouteInfo[] {
  const R = run.rows, out: RouteInfo[] = [];
  for (let i = 0; i < R.length; i++) {
    if ((R[i].kind !== 'step' && R[i].kind !== 'ref') || (R[i].key !== b && R[i].name !== b)) continue;
    const chain = [targetOf(R, i)!];
    for (let c = R[i].caller; c != null; c = R[c].caller) chain.unshift(c);
    const k = chain.indexOf(a);
    if (k < 0 || k === chain.length - 1) continue;
    const rows = chain.slice(k), key = rows.join('>'), e = out.find((x) => x.rows.join('>') === key);
    if (e) e.at.push(i); else out.push({ rows, at: [i] });
  }
  return out;
}
export const frameWords = (run: Run, row: number) => run.rows[row].frames.map((k) => run.frames[k]).filter((f) => f.kind === 'loop' || f.kind === 'guard').map((f) => (f.kind === 'loop' ? `in ${f.text}` : `past ${f.text} → ${f.label}`));
