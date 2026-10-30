// The flow page: the sequence (the default) or the boxes view of the same run, with the entry point chosen above.
// Tab switches between the two and keeps the selected step.
import { For, Show, createEffect, on, onMount } from 'solid-js';
import { flowView, setFlowView, graph, lane, setLane, rebuild, ensureBuilt, seq, refreshChanged, magnify, toggleMagnify, stepMagnify, setMagnify } from '../lib/flowstore';
import { root, files } from '../lib/store';
import { indexEpoch, lspState } from '../lib/lsp';
import Sequence from './Sequence';
import FlowBoxes from './FlowBoxes';

export default function Flow() {
  onMount(ensureBuilt);
  createEffect(on([indexEpoch, lspState, root], () => rebuild(), { defer: true }));
  // the change ripple: which functions of the run have unsaved edits
  createEffect(on([seq, () => files.list.map((f) => `${f.path}:${f.dirty}`).join('|')], () => refreshChanged()));
  const switcher = () => (
    <>
      <Show when={(graph()?.lanes.length ?? 0) > 1}>
        <span class="lanes"><For each={graph()!.lanes}>{(l, i) => <button class="chip" classList={{ on: lane() === i() }} aria-pressed={lane() === i()} title={l.file} onClick={() => setLane(i())}>{l.label}</button>}</For></span>
      </Show>
      <button class="chip" classList={{ on: flowView() === 'sequence' }} aria-pressed={flowView() === 'sequence'} onClick={() => setFlowView('sequence')}>sequence</button>
      <button class="chip" classList={{ on: flowView() === 'boxes' }} aria-pressed={flowView() === 'boxes'} onClick={() => setFlowView('boxes')}>boxes</button>
      <button class="chip" onClick={() => rebuild()}>refresh</button>
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
