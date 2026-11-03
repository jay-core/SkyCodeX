// The build setting chip (configurations): "as built", or another setting — one of the project's other build folders,
// or macros defined or undefined — whose run is shown lined up with as built (src/renderer/lib/flowstore.ts).
import { For, Show, createSignal } from 'solid-js';
import { seq, setting, chooseSetting } from '../lib/flowstore';
import { root } from '../lib/store';
import { api, basename } from '../lib/api';
import { macrosTested } from '../../shared/flowalign';

/** A macro's change: defined, undefined, or set to a value. */
type Change = { kind: 'def' } | { kind: 'undef' } | { kind: 'value'; v: string };
const flagOf = (k: string, c: Change) => (c.kind === 'def' ? `-D${k}` : c.kind === 'undef' ? `-U${k}` : `-D${k}=${c.v}`);
const wordOf = (k: string, c: Change) => (c.kind === 'def' ? k : c.kind === 'undef' ? `no ${k}` : `${k}=${c.v}`);

export default function SettingChip() {
  const [open, setOpen] = createSignal(false);
  const [opts, setOpts] = createSignal<{ folders: string[]; macros: [string, string[]][]; commands: boolean } | null>(null);
  const [pending, setPending] = createSignal<Map<string, Change>>(new Map());
  const [typed, setTyped] = createSignal('');
  async function load() {
    const s = seq();
    if (!s) return;
    const o = await api.setting.options(root());
    // the macros the conditions in the run's own files test (any other can be typed)
    const all = new Map<string, Set<string>>();
    for (const f of [...new Set(s.run.rows.filter((r) => r.kind === 'step').map((r) => r.file))]) {
      const t = (await api.fs.read(f).catch(() => '')) as string;
      for (const [k, v] of macrosTested(t)) { const m = all.get(k) ?? new Set<string>(); for (const x of v) m.add(x); all.set(k, m); }
    }
    setOpts({ folders: o.folders, commands: o.commands, macros: [...all].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, [...v].sort((a, b) => Number(a) - Number(b))]) });
  }
  const toggle = (k: string, c: Change) => {
    const m = new Map(pending()), had = m.get(k);
    if (had && JSON.stringify(had) === JSON.stringify(c)) m.delete(k); else m.set(k, c);
    setPending(m);
  };
  const isOn = (k: string, c: Change) => JSON.stringify(pending().get(k)) === JSON.stringify(c);
  /** The flags typed by hand: -DNAME, -DNAME=value, -UNAME. */
  const typedFlags = () => typed().split(/\s+/).filter((x) => /^-[DU][A-Za-z_]\w*(=\S*)?$/.test(x));
  function apply() {
    const flags = [...[...pending()].map(([k, c]) => flagOf(k, c)), ...typedFlags()];
    if (!flags.length) return;
    const label = [...[...pending()].map(([k, c]) => wordOf(k, c)), ...typedFlags().map((f) => (f.startsWith('-U') ? `no ${f.slice(2)}` : f.slice(2)))].join(' · ');
    setOpen(false);
    void chooseSetting({ label, flags });
  }
  const chipText = () => { const s = setting(); return s ? `${s.label}${s.state === 'reading' ? ' …' : s.state === 'failed' ? ' ✕' : ''} ▾` : 'as built ▾'; };
  return (
    <span class="setc">
      <button class="chip" classList={{ on: !!setting() }} title={setting()?.note || 'build settings: as built, or another — the code is read again by clang with it, and what differs shows in place'}
        onClick={() => { const o = !open(); setOpen(o); if (o) void load(); }}>{chipText()}</button>
      <Show when={open()}>
        <div class="setm" ref={(el) => requestAnimationFrame(() => { const r = el.getBoundingClientRect(); if (r.left < 8) el.style.transform = `translateX(${Math.ceil(8 - r.left)}px)`; })}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
          <div class="mh">build settings</div>
          <button class="mi" classList={{ on: !setting() }} onClick={() => { setOpen(false); void chooseSetting(null); }}>as built</button>
          <For each={opts()?.folders ?? []}>{(f) => (
            <button class="mi" classList={{ on: setting()?.folder === f }} onClick={() => { setOpen(false); void chooseSetting({ label: `${basename(f)}/`, flags: [], folder: f }); }}>{basename(f)}/ <span class="w">its own compile_commands.json</span></button>
          )}</For>
          <Show when={opts()?.commands}>
            <div class="mh">change a setting · tested by the code on this run</div>
            <For each={opts()?.macros ?? []}>{([k, vals]) => (
              <div class="mr">
                <span class="k">{k}</span>
                <span class="vs">
                  <button classList={{ on: isOn(k, { kind: 'def' }) }} onClick={() => toggle(k, { kind: 'def' })}>define</button>
                  <button classList={{ on: isOn(k, { kind: 'undef' }) }} onClick={() => toggle(k, { kind: 'undef' })}>undefine</button>
                  <For each={vals}>{(v) => <button classList={{ on: isOn(k, { kind: 'value', v }) }} onClick={() => toggle(k, { kind: 'value', v })}>{v}</button>}</For>
                </span>
              </div>
            )}</For>
            <input class="mt" placeholder="others: -DNAME=1 -UNAME" value={typed()} onInput={(e) => setTyped(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') apply(); }} />
            <button class="go" disabled={!pending().size && !typedFlags().length} onClick={apply}>read the code with this</button>
          </Show>
          <Show when={setting()?.note}><div class="nt">{setting()!.note}</div></Show>
          <div class="mh">clang reads the code again with each setting; what differs shows in place</div>
        </div>
      </Show>
    </span>
  );
}
