// The flow page: the sequence (the default) or the boxes view of the same run, with the entry point chosen above.
// Tab switches between the two and keeps the selected step.
import { For, Show, createEffect, createMemo, createSignal, on, onMount } from 'solid-js';
import { flowView, setFlowView, entries, lane, setLane, rebuild, ensureBuilt, seq, refreshChanged, magnify, toggleMagnify, stepMagnify, setMagnify } from '../lib/flowstore';
import { root, files, flash, restartLsp } from '../lib/store';
import { api } from '../lib/api';
import { refreshTree } from './FilesPane';
import { indexEpoch, lspState } from '../lib/lsp';
import Sequence from './Sequence';
import FlowBoxes from './FlowBoxes';

export default function Flow() {
  onMount(ensureBuilt);
  createEffect(on([indexEpoch, lspState, root], () => rebuild(), { defer: true }));
  // the change ripple: which functions of the run have unsaved edits
  createEffect(on([seq, () => files.list.map((f) => `${f.path}:${f.dirty}`).join('|')], () => refreshChanged()));
  // many programs: one chip that opens a list to search, best ranked first
  // a build may have written (or rewritten) the project's compile_commands.json: clangd reads it from the start
  const refresh = async () => {
    refreshTree();
    if (await api.lsp.stale()) { flash('compile_commands.json changed: clangd reads the project again', 5000); await restartLsp(); }
    rebuild();
  };
  const [pick, setPick] = createSignal(false), [pickQ, setPickQ] = createSignal('');
  const picked = createMemo(() => { const q = pickQ().trim().toLowerCase(); return entries().map((e, i) => ({ e, i })).filter(({ e }) => !q || e.rel.toLowerCase().includes(q) || e.label.toLowerCase().includes(q)); });
  const switcher = () => (
    <>
      <Show when={entries().length > 1 && entries().length <= 6}>
        <span class="lanes"><For each={entries()}>{(e, i) => <button class="chip" classList={{ on: lane() === i() }} aria-pressed={lane() === i()} title={e.rel} onClick={() => setLane(i())}>{e.label}</button>}</For></span>
      </Show>
      <Show when={entries().length > 6}>
        <span class="epick">
          <button class="chip on" title={`${entries().length} programs in this folder: choose which one to follow`} onClick={() => { setPickQ(''); setPick(!pick()); }}>{entries()[lane()]?.label ?? 'program'} ▾</button>
          <Show when={pick()}>
            <div class="eplist" onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setPick(false); }}>
              <input type="text" placeholder={`${entries().length} programs · type to find one`} value={pickQ()} ref={(el) => setTimeout(() => el.focus())} onInput={(e) => setPickQ(e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { const m = picked()[0]; if (m) { setPick(false); setLane(m.i); } } }} />
              <div class="eprows">
                <For each={picked().slice(0, 200)}>{(m) => (
                  <button classList={{ on: m.i === lane() }} onClick={() => { setPick(false); setLane(m.i); }}><span class="nm">{m.e.label}</span><span class="w">{m.e.rel}</span></button>
                )}</For>
              </div>
            </div>
          </Show>
        </span>
      </Show>
      <button class="chip" classList={{ on: flowView() === 'sequence' }} aria-pressed={flowView() === 'sequence'} onClick={() => setFlowView('sequence')}>sequence</button>
      <button class="chip" classList={{ on: flowView() === 'boxes' }} aria-pressed={flowView() === 'boxes'} onClick={() => setFlowView('boxes')}>boxes</button>
      <button class="chip" title="read the folder again: new files, functions and entry points, and a compile_commands.json a build has written" onClick={refresh}>refresh</button>
      <span class="mgchips">
        <button class="chip" classList={{ on: !!magnify() }} aria-pressed={!!magnify()} title="a magnifier that follows the pointer, at any zoom (M)" onClick={toggleMagnify}>magnifier</button>
        <Show when={magnify()}><button class="chip mgz" title="the magnifier's strength: 1.5×, 2×, 3×, 4×" onClick={() => (magnify() >= 4 ? setMagnify(1.5) : stepMagnify(1))}>{magnify()}×</button></Show>
      </span>
    </>
  );
  return (
    <div style={{ height: '100%' }} onKeyDown={(e) => {
      // Tab switches between the two views, keeping the selected step
      if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !(e.target as HTMLElement).closest('input, textarea, .cm-editor')) { e.preventDefault(); setFlowView(flowView() === 'boxes' ? 'sequence' : 'boxes'); }
      // M: the magnifier, in either view
      if ((e.key === 'm' || e.key === 'M') && !e.metaKey && !e.ctrlKey && !e.altKey && !(e.target as HTMLElement).closest('input, textarea, .cm-editor')) { e.preventDefault(); toggleMagnify(); }
    }}>
      <Show when={flowView() === 'boxes'} fallback={<Sequence switcher={switcher()} />}><FlowBoxes switcher={switcher()} /></Show>
    </div>
  );
}
