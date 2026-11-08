import type { Run } from './flowrun';

export interface Alias { name: string; kind: 'member' | 'global' | 'param' | 'local'; byRef: boolean }
export interface Hit { row: number; how: 'set' | 'read' | 'passed' | 'returns'; as: string; copy: boolean; from?: string }

export function argName(a: string): string {
  let s = a.replace(/\s+/g, '');
  for (let k = 0; k < 6; k++) {
    const t = s.replace(/^\((.*)\)$/, '$1').replace(/^std::(?:ref|cref|move|forward(?:<[^>]*>)?)\((.*)\)$/, '$1').replace(/^[&*]/, '').replace(/^this->/, '').replace(/^\(\*this\)\./, '');
    if (t === s) break;
    s = t;
  }
  return s;
}
const refers = (type: string, arg: string) => /&\s*$/.test(type) || (/\*\s*$/.test(type) && /^\s*&/.test(arg));

export function follow(run: Run, seeds: (row: number) => Alias[], within?: [number, number]): Hit[] {
  const R = run.rows, fx = run.effects ?? {}, hits: Hit[] = [];
  const aliases = new Map<number, Alias[]>();
  const [from, to] = within ?? [0, R.length - 1];
  for (let j = from; j <= to; j++) {
    const r = R[j];
    if (r.kind !== 'step' && r.kind !== 'ref') continue;
    const own: Alias[] = j === from && within ? seeds(j) : within ? [] : seeds(j);
    const e = fx[r.key];
    const c = r.caller;
    if (c != null && c >= from && r.args && e?.params) {
      for (const a of aliases.get(c) ?? []) {
        r.args.forEach((arg, i) => {
          const p = e.params![i], n = argName(arg);
          if (!p || (n !== a.name && !n.startsWith(`${a.name}.`) && !n.startsWith(`${a.name}->`))) return;
          const byRef = a.byRef && refers(p.type, arg);
          if (!own.some((x) => x.name === p.name)) own.push({ name: p.name, kind: 'param', byRef });
          hits.push({ row: j, how: 'passed', as: p.name, copy: !byRef, from: n });
        });
      }
    }
    if (!own.length) continue;
    aliases.set(j, own);
    if (!e) continue;
    for (const a of own) {
      const set = a.kind === 'member' ? e.writes.includes(a.name) : a.kind === 'global' ? e.globalWrites.includes(a.name) : a.kind === 'param' ? !!e.paramWrites?.includes(a.name) : false;
      const read = a.kind === 'member' ? e.reads.includes(a.name) || !!e.readsToo?.includes(a.name) : a.kind === 'global' ? e.globalReads.includes(a.name) || !!e.globalReadsToo?.includes(a.name) : a.kind === 'param' ? !!e.paramReads?.includes(a.name) : false;
      if (set) hits.push({ row: j, how: 'set', as: a.name, copy: !a.byRef });
      if (read) hits.push({ row: j, how: 'read', as: a.name, copy: !a.byRef });
      const word = new RegExp(`(^|[^\\w.>])${a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\w(])`);
      if ((run.exits?.[r.key] ?? []).some((x) => x.kind === 'return' && word.test(x.text.replace(/^return\b/, '')))) hits.push({ row: j, how: 'returns', as: a.name, copy: !a.byRef });
    }
  }
  return hits;
}

export function watch(run: Run, v: { name: string; owner?: string }): Hit[] {
  const fx = run.effects ?? {};
  return follow(run, (j) => {
    const e = fx[run.rows[j].key];
    if (!e) return [];
    if (v.owner != null) return e.owner === v.owner ? [{ name: v.name, kind: 'member', byRef: true }] : [];
    return [{ name: v.name, kind: 'global', byRef: true }];
  });
}

export function journey(run: Run, row: number, name: string): Hit[] {
  const e = run.effects?.[run.rows[row].key];
  const kind: Alias['kind'] = e?.params?.some((p) => p.name === name) ? 'param' : 'local';
  return follow(run, (j) => (j === row ? [{ name, kind, byRef: true }] : []), [row, run.rows[row].last]);
}

export function watchable(run: Run): { name: string; owner?: string; uses: number }[] {
  const out = new Map<string, { name: string; owner?: string; uses: number }>();
  for (const r of run.rows) {
    const e = run.effects?.[r.key];
    if (r.kind !== 'step' || !e) continue;
    const put = (name: string, owner?: string) => { const k = `${owner ?? ''}::${name}`; const o = out.get(k); if (o) o.uses++; else out.set(k, { name, owner, uses: 1 }); };
    for (const m of [...e.writes, ...e.reads]) put(m, e.owner);
    for (const g of [...e.globalWrites, ...e.globalReads]) put(g);
  }
  return [...out.values()].sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));
}
