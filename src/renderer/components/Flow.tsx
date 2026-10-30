// The flow page: the sequence (the default) or the boxes view of the same run, with the entry point chosen above.
// Tab switches between the two and keeps the selected step.
import { For, Show, createEffect, on, onMount } from 'solid-js';
import { flowView, setFlowView, entries, lane, setLane, rebuild, ensureBuilt, seq, refreshChanged, magnify, toggleMagnify, stepMagnify, setMagnify, programs, setPrograms } from '../lib/flowstore';
import Programs from './Programs';
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
  // a build may have written (or rewritten) the project's compile_commands.json: clangd reads it from the start
  const refresh = async () => {
    refreshTree();
    if (await api.lsp.stale()) { flash('compile_commands.json changed: clangd reads the project again', 5000); await restartLsp(); }
    rebuild();
  };
  // switching views: the current step glides from its row in one view to its place in the other, as the new view
  // fades in (no motion when animations are calmed: reduced motion or battery saver)
  async function switchView(v: 'sequence' | 'boxes') {
    if (v === flowView()) return;
    const sel = (w: string) => document.querySelector(w === 'sequence' ? '.seqv .srow.sel' : '.bxv .fr.sel') as HTMLElement | null;
    const from = sel(flowView()), calm = document.documentElement.classList.contains('calm');
    const a = from?.getBoundingClientRect(), label = from?.textContent?.trim() ?? '';
    setFlowView(v);
    if (calm || !a) return;
    const host = document.querySelector(v === 'sequence' ? '.seqv' : '.bxv') as HTMLElement | null;
    host?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
    let to: HTMLElement | null = null;
    for (let i = 0; i < 40 && !(to = sel(v)); i++) await new Promise((r) => requestAnimationFrame(r));
    const b = to?.getBoundingClientRect();
    if (!b || !b.width) return;
    const ghost = document.createElement('div');
    ghost.className = 'glide';
    ghost.textContent = label;
    Object.assign(ghost.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
    document.body.appendChild(ghost);
    to!.style.visibility = 'hidden';
    const anim = ghost.animate([{ transform: 'translate(0, 0)', width: `${a.width}px`, height: `${a.height}px` }, { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px)`, width: `${b.width}px`, height: `${b.height}px` }],
      { duration: 420, easing: 'cubic-bezier(.16, 1, .3, 1)' });
    const done = () => { ghost.remove(); if (to) to.style.visibility = ''; };
    anim.onfinish = done; anim.oncancel = done;
  }
  // several programs: the page opens on the list of them; a program's flow has a link back to it
  const listing = () => programs() && entries().length > 1;
  const switcher = () => (
    <>
      <Show when={entries().length > 1 && !listing()}>
        <button class="backp" title="every program in this folder (Backspace)" onClick={() => setPrograms(true)}>← all programs</button>
      </Show>
      <Show when={entries().length > 1 && entries().length <= 6 && !listing()}>
        <span class="lanes"><For each={entries()}>{(e, i) => <button class="chip" classList={{ on: lane() === i() }} aria-pressed={lane() === i()} title={e.rel} onClick={() => setLane(i())}>{e.label}</button>}</For></span>
      </Show>
      <button class="chip" classList={{ on: flowView() === 'sequence' }} aria-pressed={flowView() === 'sequence'} onClick={() => switchView('sequence')}>sequence</button>
      <button class="chip" classList={{ on: flowView() === 'boxes' }} aria-pressed={flowView() === 'boxes'} onClick={() => switchView('boxes')}>boxes</button>
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
      if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !(e.target as HTMLElement).closest('input, textarea, .cm-editor')) { e.preventDefault(); switchView(flowView() === 'boxes' ? 'sequence' : 'boxes'); }
      // Backspace: back to the list of programs
      if (e.key === 'Backspace' && entries().length > 1 && !listing() && !(e.target as HTMLElement).closest('input, textarea, .cm-editor')) { e.preventDefault(); setPrograms(true); }
      // M: the magnifier, in either view
      if ((e.key === 'm' || e.key === 'M') && !e.metaKey && !e.ctrlKey && !e.altKey && !(e.target as HTMLElement).closest('input, textarea, .cm-editor')) { e.preventDefault(); toggleMagnify(); }
    }}>
      <Show when={!listing()} fallback={<Programs switcher={switcher()} />}>
        <Show when={flowView() === 'boxes'} fallback={<Sequence switcher={switcher()} />}><FlowBoxes switcher={switcher()} /></Show>
      </Show>
    </div>
  );
}
