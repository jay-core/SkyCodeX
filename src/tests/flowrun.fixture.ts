// Loads a recorded clangd fixture (src/tests/fixtures/record-flow.mjs) into what walkRun needs.
import fs from 'node:fs';
import path from 'node:path';
import { analyseFunction, walkRun, fnExtent, FnInfo, Target, Run } from '../shared/flowrun';
import { effects } from '../shared/flowfacts';

interface Item { key: string; name: string; kind: number; detail: string; file: string | null; lib: string; range: any; selectionRange: any }
interface Fn extends Item { ast: any; calls: { to: Item; fromRanges: any[] }[] }

export function loadFixture(fixture: string, root: string) {
  const { fns } = JSON.parse(fs.readFileSync(fixture, 'utf8')) as { fns: Fn[] };
  const byKey = new Map(fns.map((f) => [f.key, f]));
  const target = (it: Item): Target => ({ key: it.key, name: it.name, project: byKey.has(it.key), ctor: it.kind === 9, container: `${it.detail} ${it.lib}` });
  const infos = new Map<string, FnInfo>();
  for (const f of fns) {
    const text = fs.readFileSync(path.join(root, f.file!), 'utf8');
    const flow = analyseFunction(f.ast, text, f.calls.map((c) => ({ to: target(c.to), fromRanges: c.fromRanges })));
    infos.set(f.key, { name: f.name.replace(/^.*::/, ''), file: f.file!, line: f.selectionRange.start.line, ...fnExtent(f.ast, f.range), flow, effects: { ...effects(f.ast, text), owner: f.kind === 6 || f.kind === 9 ? f.detail || f.name.replace(/::[^:]*$/, '') : undefined } });
  }
  return { infos, run: (start: string): Run => walkRun(start, (k) => infos.get(k)) };
}

/** The run as text, one row per line: number or kind, name, the frames around it. Handy in failing tests. */
export function describeRun(run: Run): string[] {
  return run.rows.map((r) => {
    const fr = r.frames.map((i) => { const f = run.frames[i]; return f.kind === 'loop' ? `↻${f.count != null ? '×' + f.count : ''} ${f.text}` : f.kind === 'arm' ? `[${f.label}] ${f.text}` : f.kind === 'guard' ? `past ${f.text} → ${f.label}` : `${f.kind}`; }).join(' / ');
    const head = r.kind === 'step' ? String(r.n) : r.kind === 'ref' ? `→${run.rows[r.ref!].n}` : r.kind === 'indirect' ? `⇢ ${r.via}` : 'value';
    return `${'  '.repeat(r.depth)}${head} ${r.name}${r.thread ? ' (thread)' : ''}${r.unsequenced ? ' (unsequenced)' : ''}${fr ? '   { ' + fr + ' }' : ''}`;
  });
}
