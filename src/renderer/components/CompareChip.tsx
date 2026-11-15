import { For, Show, createSignal } from 'solid-js';
import { comparing, chooseCompare } from '../lib/flowstore';
import { root } from '../lib/store';
import { api } from '../lib/api';
import { fitInWindow } from '../lib/measure';

type Commit = { sha: string; short: string; subject: string; when: string };

export default function CompareChip() {
  const [open, setOpen] = createSignal(false);
  const [list, setList] = createSignal<{ commits: Commit[]; message?: string } | null>(null);
  const [newer, setNewer] = createSignal<Commit | null>(null);
  const [shown, setShown] = createSignal(40);
  async function load() {
    const r = await api.change.history(root());
    setList(r.ok ? { commits: r.commits ?? [] } : { commits: [], message: r.message });
  }
  function pick(c: Commit) {
    setOpen(false);
    const n = newer();
    void chooseCompare({ older: c.sha, olderLabel: c === list()?.commits[0] && !n ? 'the last commit' : c.short, newer: n ? n.sha : 'work', newerLabel: n ? n.short : 'the files on disk' });
  }
  const chipText = () => { const c = comparing(); return c ? `compared with ${c.olderLabel}${c.state === 'reading' ? ' …' : c.state === 'failed' ? ' ✕' : ''} ▾` : 'compare ▾'; };
  return (
    <span class="setc">
      <button class="chip" classList={{ on: !!comparing() }} title={comparing()?.note || comparing()?.summary || 'what a change does: the run compared with an older version from git — added steps in green, removed ones as faded red ghosts'}
        onClick={() => { const o = !open(); setOpen(o); if (o) void load(); }}>{chipText()}</button>
      <Show when={comparing()?.state === 'ready' && comparing()?.summary}><span class="csum" title={comparing()!.summary}>{comparing()!.summary}</span></Show>
      <Show when={open()}>
        <div class="setm" ref={(el) => fitInWindow(el)}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
          <button class="mi" classList={{ on: !comparing() }} onClick={() => { setOpen(false); void chooseCompare(null); }}>no comparison</button>
          <div class="mh">newer: {newer() ? `${newer()!.short} · ${newer()!.subject}` : 'the files on disk'}<Show when={newer()}> · <button class="lnk" onClick={() => setNewer(null)}>the files on disk</button></Show></div>
          <div class="mh">compare with an older commit</div>
          <Show when={list()?.message}><div class="nt">{list()!.message}</div></Show>
          <For each={(list()?.commits ?? []).slice(0, shown())}>{(c) => (
            <div class="mr">
              <button class="mi" title={`${c.short} ${c.subject} · ${c.when}`} onClick={() => pick(c)}><span class="k">{c.short}</span> {c.subject} <span class="w">{c.when}</span></button>
              <span class="vs"><button classList={{ on: newer()?.sha === c.sha }} title="compare an older commit with this one instead of the files on disk" onClick={() => setNewer(newer()?.sha === c.sha ? null : c)}>as newer</button></span>
            </div>
          )}</For>
          <Show when={(list()?.commits.length ?? 0) > shown()}><button class="mi lnk" onClick={() => setShown(shown() + 40)}>show older commits ({(list()?.commits.length ?? 0) - shown()} more of the last {list()!.commits.length})</button></Show>
          <Show when={comparing()?.note}><div class="nt">{comparing()!.note}</div></Show>
          <div class="mh">git only reads: nothing in the repository is written or checked out</div>
        </div>
      </Show>
    </span>
  );
}
