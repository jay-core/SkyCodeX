// Every program in the folder (each main), the most likely first, then by folder — a project with several opens on
// this list. Nothing is traced until one is picked (the most likely one is already being traced, so it opens at once).
// Type to find one (any case); ↑ ↓ choose, ↵ or a click shows its flow; "← all programs" (or Backspace) comes back.
import { For, Show, createMemo, createSignal } from 'solid-js';
import { entries, lane, setLane, setPrograms, status, isChosen } from '../lib/flowstore';
import { matchesIn } from '../../shared/search';
import { Marked } from './FilesPane';

const FIRST = 3;

export default function Programs(props: { switcher: unknown }) {
  const [q, setQ] = createSignal(''), [open, setOpen] = createSignal<Set<string>>(new Set()), [sel, setSel] = createSignal(0);
  const top = (rel: string) => (rel.includes('/') ? rel.slice(0, rel.indexOf('/')) : '.');
  const groups = createMemo(() => {
    const qq = q().trim(), g = new Map<string, number[]>();
    entries().forEach((e, i) => {
      if (!qq && i === lane()) return;   // shown on its own, first
      if (qq && !matchesIn(`${e.label} ${e.rel}`, qq, 1).length) return;
      const k = top(e.rel);
      g.set(k, [...(g.get(k) ?? []), i]);
    });
    return [...g].map(([k, list]) => ({ k, list, shown: qq || open().has(k) ? list : list.slice(0, FIRST) }));
  });
  const flat = createMemo(() => [...(q().trim() ? [] : [lane()]), ...groups().flatMap((g) => g.shown)]);
  const pick = (i: number) => { setPrograms(false); setLane(i); };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(Math.min(flat().length - 1, sel() + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(Math.max(0, sel() - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const i = flat()[sel()]; if (i != null) pick(i); }
  };
  const Row = (p: { i: number; big?: boolean }) => {
    const e = () => entries()[p.i];
    return (
      <button class="pr" classList={{ on: flat()[sel()] === p.i, top: p.big }} onMouseEnter={() => setSel(flat().indexOf(p.i))} onClick={() => pick(p.i)}>
        <Marked text={e().name === 'main' ? e().label : `${e().label} · ${e().name}`} q={q().trim()} /><span class="p"><Marked text={e().rel} q={q().trim()} /></span>
        <Show when={isChosen(p.i)}><span class="w">last opened</span></Show>
      </button>
    );
  };
  return (
    <div class="body" style={{ height: '100%' }}>
      <div class="pane" style={{ flex: 1 }}>
        <div class="ph" style={{ padding: '0 22px' }}>
          <span style={{ color: 'var(--bright)' }}>all programs · {entries().length} mains</span>
          <span class="sub" style={{ 'margin-left': '14px' }}>{status()}</span>
          <span class="grow" />
          {props.switcher as any}
        </div>
        <div class="progs" onKeyDown={key}>
          <div class="q"><span style={{ color: 'var(--dim)' }}>⌕</span>
            <input value={q()} placeholder="find a program — name or folder, any case" spellcheck={false} ref={(el) => setTimeout(() => el.focus())}
              onInput={(e) => { setQ(e.currentTarget.value); setSel(0); }} onKeyDown={(e) => { if (e.key === 'Escape' && q()) { e.stopPropagation(); setQ(''); } }} />
          </div>
          <Show when={!q().trim()}>
            <div class="grp"><b>most likely first</b></div>
            <Row i={lane()} big />
          </Show>
          <For each={groups()}>{(g) => (
            <>
              <div class="grp"><b>{g.k}</b>{g.list.length} program{g.list.length === 1 ? '' : 's'}
                <Show when={!q().trim() && g.list.length > FIRST}>
                  <button class="more" onClick={() => { const s = new Set(open()); s.has(g.k) ? s.delete(g.k) : s.add(g.k); setOpen(s); }}>{open().has(g.k) ? 'fewer' : `all ${g.list.length} ›`}</button>
                </Show>
              </div>
              <For each={g.shown}>{(i) => <Row i={i} />}</For>
            </>
          )}</For>
          <Show when={q().trim() && !groups().length}><div class="grp">no program matches</div></Show>
        </div>
      </div>
    </div>
  );
}
