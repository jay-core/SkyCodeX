import { For, Show, createSignal, createResource, createMemo } from 'solid-js';
import { api, relPath } from '../lib/api';
import { root, settings, openFile } from '../lib/store';

interface Report {
  binary: string; format: string; arch: string; note?: string; storage: number; ram: number;
  byKind: Record<string, number>; largestRam: { name: string; size: number; kind: string }[]; largestStorage: { name: string; size: number; kind: string }[];
  symbolSizesExact: boolean; stack: { fn: string; file: string; bytes: number; qualifier: string }[]; stackNote: string; heap: { file: string; line: number; call: string }[];
}

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1048576).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`);
const [report, setReport] = createSignal<Report | null>(null);

/** Shown in the header when a budget is exceeded. */
export const memoryAlert = createMemo(() => {
  const r = report(), s = settings();
  if (!r) return '';
  const out: string[] = [];
  if (s['memory.ram_budget_kb'] > 0 && r.ram > s['memory.ram_budget_kb'] * 1024) out.push(`RAM ${Math.round((r.ram / (s['memory.ram_budget_kb'] * 1024)) * 100)} %`);
  if (s['memory.storage_budget_kb'] > 0 && r.storage > s['memory.storage_budget_kb'] * 1024) out.push(`storage ${Math.round((r.storage / (s['memory.storage_budget_kb'] * 1024)) * 100)} %`);
  return out.join(' · ');
});

function Region(props: { name: string; used: number; budgetKb: number; parts: [string, number, string][] }) {
  const budget = () => props.budgetKb * 1024;
  const cap = () => Math.max(props.used, budget()) * 1.08 || 1;
  const pct = () => (budget() ? props.used / budget() : 0);
  const warn = () => settings()['memory.warn_percent'] / 100;
  const col = () => (!budget() ? '#7b8279' : pct() > 1 ? 'var(--err)' : pct() > warn() ? 'var(--accent)' : 'var(--ty)');
  const offs = () => { let a = 0; return props.parts.map((p) => { const o = a; a += p[1]; return o; }); };
  return (
    <div style={{ 'margin-bottom': '24px', 'max-width': '900px' }}>
      <div style={{ display: 'flex', 'align-items': 'baseline', gap: '14px' }}>
        <span style={{ font: '300 22px var(--ui)', color: 'var(--bright)' }}>{props.name}</span>
        <span style={{ font: '300 14px var(--ui)', color: col() }}>
          {kb(props.used)}{budget() ? ` of ${kb(budget())} budget · ${Math.round(pct() * 100)} %${pct() > 1 ? ` · over by ${kb(props.used - budget())}` : ''}` : ' · no budget set'}
        </span>
      </div>
      <div class="bar">
        <For each={props.parts}>{([, v, c], i) => <i style={{ left: `${(offs()[i()] / cap()) * 100}%`, width: `calc(${(v / cap()) * 100}% - 1px)`, background: c }} />}</For>
        <Show when={budget()}><div class="budget" style={{ left: `${(budget() / cap()) * 100}%`, background: pct() > 1 ? 'var(--err)' : '#8b9189' }} /></Show>
      </div>
      <div style={{ display: 'flex', gap: '18px', 'margin-top': '6px', font: '300 12px var(--ui)', color: 'var(--dim)' }}>
        <For each={props.parts}>{([n, v, c]) => <span><i style={{ display: 'inline-block', width: '8px', height: '8px', background: c, 'margin-right': '6px' }} />{n} {kb(v)}</span>}</For>
      </div>
    </div>
  );
}

export default function Memory() {
  const [bins] = createResource(() => root(), async (r) => (r ? ((await api.memory.binaries(r)) as string[]) : []));
  const [bin, setBin] = createSignal('');
  const [which, setWhich] = createSignal<'ram' | 'storage'>('ram');
  const [err, setErr] = createSignal('');
  const chosen = () => bin() || bins()?.[0] || '';
  const run = async () => {
    setErr('');
    try { setReport((await api.memory.analyze(chosen(), root())) as Report); } catch (e) { setErr(String(e)); }
  };
  const rows = () => (which() === 'ram' ? report()?.largestRam : report()?.largestStorage) ?? [];
  const maxRow = () => rows()[0]?.size || 1;
  const overMsg = () => {
    const r = report(), s = settings();
    if (!r) return '';
    const b = s['memory.ram_budget_kb'] * 1024;
    if (b > 0 && r.ram > b) return `RAM budget exceeded by ${kb(r.ram - b)}. The largest item is ${r.largestRam[0]?.name ?? '—'} (${kb(r.largestRam[0]?.size ?? 0)}).`;
    const sb = s['memory.storage_budget_kb'] * 1024;
    if (sb > 0 && r.storage > sb) return `Storage budget exceeded by ${kb(r.storage - sb)}. The largest item is ${r.largestStorage[0]?.name ?? '—'} (${kb(r.largestStorage[0]?.size ?? 0)}).`;
    return '';
  };
  return (
    <div class="page" style={{ top: 0, position: 'relative', height: '100%' }}>
      <div class="ph" style={{ padding: '0 30px', gap: '18px' }}>
        <span>program</span>
        <select style={{ background: 'transparent', border: 0, color: 'var(--bright)', 'max-width': '520px', font: '300 14px var(--ui)' }} value={chosen()} onChange={(e) => setBin(e.currentTarget.value)}>
          <For each={bins() ?? []}>{(b) => <option value={b}>{relPath(root(), b)}</option>}</For>
        </select>
        <button class="chip on" onClick={run} disabled={!chosen()}>analyse</button>
        <span class="grow" />
        <Show when={report()}><span class="sub">{report()!.format} · {report()!.arch}{report()!.note ? ` · ${report()!.note}` : ''}</span></Show>
      </div>
      <div class="mem">
        <Show when={!bins()?.length && root()}><div class="empty">No built program found under build/ or out/.<br />Build your project in the terminal, then come back.</div></Show>
        <Show when={err()}><div class="alert">{err()}</div></Show>
        <Show when={bins()?.length && !report()}><div class="empty">Choose a program and press <b style={{ color: 'var(--bright)', 'font-weight': 400 }}>analyse</b>.<br />Budgets are set in settings → memory.</div></Show>
        <Show when={report()}>{(r) => (
          <>
            <Show when={overMsg()}><div class="alert">{overMsg()}</div></Show>
            <Region name="ram" used={r().ram} budgetKb={settings()['memory.ram_budget_kb']} parts={[['data', r().byKind.data, '#5a6f73'], ['zero-initialised', r().byKind.bss, '#4e6a5a']]} />
            <Region name="storage" used={r().storage} budgetKb={settings()['memory.storage_budget_kb']} parts={[['code', r().byKind.code, '#4e6a5a'], ['constants', r().byKind.rodata, '#5a6f73'], ['initial data', r().byKind.data, '#5c5068']]} />
            <div style={{ display: 'grid', 'grid-template-columns': 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '40px', 'max-width': '1300px' }}>
              <div>
                <div style={{ display: 'flex', gap: '18px', font: '300 15px var(--ui)', 'margin-bottom': '8px' }}>
                  <button class="chip" classList={{ on: which() === 'ram' }} style={{ 'font-size': '15px' }} onClick={() => setWhich('ram')}>ram</button>
                  <button class="chip" classList={{ on: which() === 'storage' }} style={{ 'font-size': '15px' }} onClick={() => setWhich('storage')}>storage</button>
                  <span style={{ 'margin-left': 'auto' }} class="sub">largest first{r().symbolSizesExact ? '' : ' · sizes derived from symbol addresses'}</span>
                </div>
                <For each={rows().slice(0, 40)}>{(s) => (
                  <div class="mrow"><span class="n" title={s.name}>{s.name}</span><span><div class="b" style={{ width: `${(s.size / maxRow()) * 100}%` }} /></span><span class="s">{kb(s.size)}</span></div>
                )}</For>
              </div>
              <div>
                <div class="label">stack · per function</div>
                <Show when={r().stack.length} fallback={<div class="sub">{r().stackNote}</div>}>
                  <For each={r().stack.slice(0, 12)}>{(s) => (
                    <div class="mrow" style={{ 'grid-template-columns': '1fr 70px' }}><span class="n" title={`${s.fn} · ${s.file}`}>{s.fn}</span><span class="s">{s.bytes} B</span></div>
                  )}</For>
                </Show>
                <div class="label" style={{ 'margin-top': '22px' }}>heap · allocation sites ({r().heap.length})</div>
                <div class="sub" style={{ 'margin-bottom': '6px' }}>found by scanning source text</div>
                <For each={r().heap.slice(0, 30)}>{(h) => (
                  <div style={{ font: '12.5px var(--mono)', 'line-height': '1.8' }}>
                    <span style={{ color: 'var(--err)', display: 'inline-block', width: '110px' }}>{h.call}</span>
                    <span class="mlink" onClick={() => openFile(`${root()}/${h.file}`, { line: h.line - 1, character: 0 })}>{h.file}:{h.line}</span>
                  </div>
                )}</For>
              </div>
            </div>
          </>
        )}</Show>
      </div>
    </div>
  );
}
