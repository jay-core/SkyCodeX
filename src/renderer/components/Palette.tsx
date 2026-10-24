import { For, Show, createSignal, createMemo, onMount, createEffect, on } from 'solid-js';
import { palette, setPalette, fuzzy, PaletteItem, symbolQuery, clearSymbolQuery } from '../lib/actions';

export default function Palette() {
  const [q, setQ] = createSignal(palette()?.prompt?.value ?? '');
  const [sel, setSel] = createSignal(0);
  const [remote, setRemote] = createSignal<PaletteItem[]>([]);
  let input!: HTMLInputElement;
  onMount(() => { input.focus(); input.select(); });
  const close = () => { clearSymbolQuery(); setPalette(null); };
  createEffect(on(q, async (v) => { if (symbolQuery) setRemote(await symbolQuery(v)); setSel(0); }));
  const items = createMemo(() => {
    const p = palette();
    if (!p || p.prompt) return [];
    if (symbolQuery) return remote();
    return (p.items ?? []).map((it) => ({ it, s: fuzzy(q(), it.label + ' ' + (it.detail ?? '')) }))
      .filter((x) => x.s !== null).sort((a, b) => b.s! - a.s!).slice(0, 80).map((x) => x.it);
  });
  const accept = (i = sel()) => {
    const p = palette();
    if (p?.prompt) { const v = q(); close(); p.prompt.accept(v); return; }
    const it = items()[i];
    if (it) { close(); it.run(); }
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Enter') { e.preventDefault(); accept(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(Math.min(items().length - 1, sel() + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(Math.max(0, sel() - 1)); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, 'z-index': 30 }} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div class="pal">
        <input ref={input} value={q()} placeholder={palette()?.placeholder} onInput={(e) => setQ(e.currentTarget.value)} onKeyDown={key} spellcheck={false} />
        <Show when={!palette()?.prompt}>
          <div class="pal-list">
            <For each={items()}>{(it, i) => (
              <div class="pal-it" classList={{ on: i() === sel() }} onMouseEnter={() => setSel(i())} onMouseDown={(e) => { e.preventDefault(); accept(i()); }}>
                <span class="l">{it.label}</span><span class="d">{it.detail}</span>
              </div>
            )}</For>
            <Show when={!items().length}><div class="pal-it"><span class="d">{symbolQuery && !q() ? 'type a name' : 'nothing matches'}</span></div></Show>
          </div>
        </Show>
        <Show when={palette()?.prompt}><div class="pal-it"><span class="d">⏎ apply · esc cancel</span></div></Show>
      </div>
    </div>
  );
}
