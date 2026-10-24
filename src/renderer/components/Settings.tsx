import { For, Show, createSignal, createEffect, createResource, on, onMount, onCleanup } from 'solid-js';
import { SETTINGS, SettingDef } from '../../shared/settings-schema';
import { api } from '../lib/api';
import { settings, problems, setSettingsOpen, openFile, info, flash, applySettings } from '../lib/store';
import { installedFonts, weightsOf, WEIGHT_NAMES, FontFamily } from '../lib/fonts';

const PAGES: { name: string; sections: string[] }[] = [
  { name: 'appearance', sections: ['font', 'font.ui', 'font.preview', 'theme', 'motion'] },
  { name: 'editor', sections: ['editor', 'window'] },
  { name: 'preview', sections: ['preview'] },
  { name: 'clangd', sections: ['clangd'] },
  { name: 'terminal', sections: ['terminal'] },
  { name: 'memory', sections: ['memory'] },
];
const sectionOf = (k: string) => k.slice(0, k.lastIndexOf('.'));
const NAMES: Record<string, string> = {
  'font.family': 'code font', 'font.ui.family': 'interface font', 'font.preview.scale': 'preview text scale', 'font.weight': 'code weight',
  'terminal.font_weight': 'terminal weight', 'terminal.font_weight_bold': 'terminal bold weight',
};
const label = (d: SettingDef) => {
  if (NAMES[d.key]) return NAMES[d.key];
  const sec = sectionOf(d.key).replace(/^font\.?/, (m) => (m ? 'font ' : '')).replace('.', ' ');
  const name = d.key.slice(d.key.lastIndexOf('.') + 1).replace(/_/g, ' ');
  return sectionOf(d.key) === 'font' ? `code ${name}` : `${sec} ${name}`.trim().replace(/^ui family$/, 'interface font');
};

async function set(key: string, value: unknown) {
  try { await api.settings.set(key, value); } catch (e) { flash(String(e).replace(/^Error: /, '')); }
}

interface Opt { value: string; label: string; group?: string; font?: boolean }

/** A text box with a filtered list under it: pick from the list or type any value and press enter. */
function Combo(props: { value: string; load: () => Promise<Opt[]>; onPick: (v: string) => void; font?: boolean; hint?: string }) {
  const [open, setOpen] = createSignal(false);
  const [q, setQ] = createSignal('');
  const [opts, setOpts] = createSignal<Opt[]>([]);
  const [hi, setHi] = createSignal(0);
  let box!: HTMLDivElement, input!: HTMLInputElement, list: HTMLDivElement | undefined;
  const shown = () => { const t = q().trim().toLowerCase(); return opts().filter((o) => !t || o.label.toLowerCase().includes(t)); };
  const show = async () => { setQ(''); setHi(0); setOpen(true); setOpts(await props.load()); };
  const pick = (v: string | undefined) => { setOpen(false); input.blur(); if (v && v !== props.value) props.onPick(v); };
  const outside = (e: MouseEvent) => { if (open() && !box.contains(e.target as Node)) setOpen(false); };
  onMount(() => window.addEventListener('mousedown', outside));
  onCleanup(() => window.removeEventListener('mousedown', outside));
  const move = (d: number) => {
    setHi((h) => Math.max(0, Math.min(shown().length - 1, h + d)));
    queueMicrotask(() => list?.querySelector('.hi')?.scrollIntoView({ block: 'nearest' }));
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open()) show(); else move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(shown()[hi()]?.value ?? (q().trim() || undefined)); }
    else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); input.blur(); }
  };
  const fontOf = (name: string) => `"${name.replace(/"/g, '')}", var(--ui)`;
  return (
    <div class="combo" ref={box}>
      <input type="text" ref={input} value={open() ? q() : props.value} placeholder={open() ? props.value : ''} spellcheck={false}
        style={{ 'font-family': props.font && !open() ? fontOf(props.value) : undefined }}
        onFocus={show} onInput={(e) => { setQ(e.currentTarget.value); setHi(0); }} onKeyDown={key} />
      <span class="caret" onMouseDown={(e) => { e.preventDefault(); open() ? setOpen(false) : input.focus(); }}>⌄</span>
      <Show when={open()}>
        <div class="combo-list" ref={list}>
          <For each={shown()}>{(o, i) => (
            <>
              <Show when={o.group && (i() === 0 || shown()[i() - 1].group !== o.group)}><div class="combo-g">{o.group}</div></Show>
              <button classList={{ hi: i() === hi(), on: o.value === props.value }} style={{ 'font-family': o.font ? fontOf(o.value) : undefined }}
                onMouseDown={(e) => { e.preventDefault(); pick(o.value); }} onMouseEnter={() => setHi(i())}>{o.label}</button>
            </>
          )}</For>
          <Show when={!shown().length}><div class="combo-g">{q().trim() ? `press enter to use “${q().trim()}”` : props.hint ?? 'nothing to list'}</div></Show>
        </div>
      </Show>
    </div>
  );
}

const fontOpts = (monoFirst: boolean) => async (): Promise<Opt[]> => {
  const all = await installedFonts();
  const g = (f: FontFamily) => (f.bundled ? 'bundled with lithograph' : !monoFirst ? 'installed' : f.mono ? 'monospace' : 'other installed fonts');
  const order = (f: FontFamily) => (f.bundled ? 0 : !monoFirst || f.mono ? 1 : 2);
  return [...all].sort((a, b) => order(a) - order(b)).map((f) => ({ value: f.name, label: f.name, group: g(f), font: true }));
};
const shellOpts = async (): Promise<Opt[]> => [
  { value: 'auto', label: 'auto — your login shell' },
  ...((await api.sys.shells()) as string[]).map((p) => ({ value: p, label: p })),
];

const decimals = (step: number) => (step >= 1 ? 0 : step >= 0.1 ? 1 : 2);   // 0.05 steps keep two places

/** Slider with a live value while dragging, plus a box to type the number; large ranges get the box only. */
function NumberCtl(props: { d: SettingDef }) {
  const d = props.d;
  const range = (d.max ?? 0) - (d.min ?? 0);
  const slider = d.max !== undefined && range <= 200;
  const step = range <= 3 ? 0.05 : range <= 10 ? 0.1 : range <= 80 ? 0.5 : 1;
  const [live, setLive] = createSignal<number | null>(null);
  const [drag, setDrag] = createSignal(false);
  const [draft, setDraft] = createSignal<string | null>(null);
  const cur = () => live() ?? Number(settings()[d.key]);
  createEffect(on(() => settings()[d.key], () => setLive(null), { defer: true }));
  const fmt = (n: number) => String(+n.toFixed(decimals(step)));
  const clamp = (n: number) => Math.min(d.max ?? Infinity, Math.max(d.min ?? -Infinity, n));
  // dragging restyles the editor at once (nothing is written); letting go saves
  const preview = (n: number) => { setLive(n); applySettings({ ...settings(), [d.key]: n }, problems()); };
  const commit = (n: number) => { if (!Number.isFinite(n)) { flash(`${label(d)}: type a number`); setDraft(null); return; } n = clamp(+n.toFixed(decimals(step))); setLive(n); setDraft(null); set(d.key, n); };
  const typed = (e: KeyboardEvent & { currentTarget: HTMLInputElement }) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(parseFloat(e.currentTarget.value)); e.currentTarget.blur(); }
    else if (e.key === 'Escape') { e.stopPropagation(); setDraft(null); e.currentTarget.blur(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); commit(cur() + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)); }
  };
  const pct = () => (((cur() - (d.min ?? 0)) / (range || 1)) * 100);
  return (
    <>
      <div class="numrow">
        <input class="num" type="text" inputmode="decimal" value={draft() ?? fmt(cur())} onInput={(e) => setDraft(e.currentTarget.value)} onKeyDown={typed}
          onBlur={(e) => { if (draft() !== null) commit(parseFloat(e.currentTarget.value)); }} />
        <Show when={d.unit}><span class="unit">{d.unit}</span></Show>
      </div>
      <Show when={slider}>
        <div class="slide">
          <input type="range" min={d.min} max={d.max} step={step} value={cur()}
            onPointerDown={() => setDrag(true)} onPointerUp={() => setDrag(false)}
            onInput={(e) => preview(Number(e.currentTarget.value))} onChange={(e) => { setDrag(false); commit(Number(e.currentTarget.value)); }} />
          <Show when={drag()}><span class="bubble" style={{ left: `calc(${pct()}% + ${5 - pct() / 10}px)` }}>{fmt(cur())}</span></Show>
        </div>
      </Show>
    </>
  );
}

/** The weights the chosen font really has, each shown in itself; any other saved value is kept as a choice. */
function WeightCtl(props: { d: SettingDef; family: () => string }) {
  const [ws] = createResource(props.family, weightsOf);
  const cur = () => Number(settings()[props.d.key]);
  const list = () => {
    const real = ws() ?? [];
    const all = real.length ? real : [100, 200, 300, 400, 500, 600, 700, 800, 900];
    return all.includes(cur()) ? all : [...all, cur()].sort((a, b) => a - b);
  };
  return (
    <>
      <div class="choices weights">
        <For each={list()}>{(w) => (
          <button classList={{ on: cur() === w, synth: !!ws()?.length && !ws()!.includes(w) }} style={{ 'font-family': `"${props.family().replace(/"/g, '')}", var(--mono)`, 'font-weight': w }}
            title={`${w}`} onClick={() => set(props.d.key, w)}>{WEIGHT_NAMES[w] ?? w}</button>
        )}</For>
      </div>
      <div class="doc">{ws.loading ? 'reading the font…' : ws()?.length ? `${props.family()} has ${ws()!.length} weight${ws()!.length > 1 ? 's' : ''} · ${props.d.doc}` : `${props.d.doc} · this font's weights couldn't be read, the nearest is drawn`}</div>
    </>
  );
}

function Control(props: { d: SettingDef }) {
  const v = () => settings()[props.d.key];
  const d = props.d;
  const changed = () => JSON.stringify(v()) !== JSON.stringify(d.default);
  const reset = () => <Show when={changed()}><button class="rst" title={`back to ${JSON.stringify(d.default)}`} onClick={() => set(d.key, d.default)}>reset</button></Show>;
  // a setting that only matters with another one: dimmed until it applies
  const idle = () => d.key === 'editor.autosave_delay_ms' && settings()['editor.autosave'] !== 'delay';
  const Lab = () => <div class="lab">{label(d)}{reset()}</div>;
  const wrap = (body: any) => <div class="ctl" classList={{ idle: idle() }}>{body}</div>;
  if (d.type === 'boolean') return (
    <div class="ctl" style={{ display: 'flex', 'align-items': 'center' }}>
      <div><Lab /><Show when={d.doc !== 'true | false'}><div class="doc">{d.doc}</div></Show></div>
      <button class="tog" onClick={() => set(d.key, !v())}><b style={{ width: v() ? '44px' : '0' }} /><i style={{ left: v() ? '38px' : '-2px' }} /></button>
    </div>
  );
  if (d.type === 'enum') return wrap(<><Lab /><div class="choices"><For each={d.values}>{(x) => <button classList={{ on: v() === x }} onClick={() => set(d.key, x)}>{x}</button>}</For></div><Show when={d.doc !== d.values!.join(' | ')}><div class="doc">{d.doc}</div></Show></>);
  if (/(^font|_font)\.?weight|font_weight/.test(d.key)) return wrap(<><Lab /><WeightCtl d={d} family={() => String(settings()['font.family'])} /></>);
  if (d.type === 'number') return wrap(<><Lab /><NumberCtl d={d} /><div class="doc">{d.doc}</div></>);
  if (d.key === 'font.family' || d.key === 'font.ui.family') return wrap(<>
    <Lab /><Combo value={String(v())} load={fontOpts(d.key === 'font.family')} onPick={(x) => set(d.key, x)} font hint="installed fonts couldn't be listed — type a font name" />
    <div class="doc">{d.key === 'font.family' ? 'monospace fonts first · type to filter, or any font name' : 'any installed font · type to filter'}</div></>);
  if (d.key === 'terminal.shell') return wrap(<>
    <Lab /><Combo value={String(v())} load={shellOpts} onPick={(x) => set(d.key, x)} hint="type the path to a shell" />
    <div class="doc">{d.doc} · new terminals use it</div></>);
  if (d.key === 'clangd.path') return wrap(<>
    <Lab /><div class="pathrow">
      <input type="text" value={String(v())} spellcheck={false} onChange={(e) => set(d.key, e.currentTarget.value.trim() || 'auto')} />
      <button class="chip" onClick={async () => { const p = (await api.fs.pickFile('')) as string | null; if (p) set(d.key, p); }}>browse</button>
      <Show when={v() !== 'auto'}><button class="chip" onClick={() => set(d.key, 'auto')}>auto</button></Show>
    </div><div class="doc">{d.doc}</div></>);
  // lists: JSON or plain space-separated words
  const text = () => (d.type === 'string[]' ? ((v() as string[]) ?? []).join(' ') : String(v() ?? ''));
  return wrap(<>
    <Lab />
    <input type="text" value={text()} spellcheck={false} onChange={(e) => {
      const raw = e.currentTarget.value.trim();
      if (d.type !== 'string[]') return set(d.key, raw);
      if (raw.startsWith('[')) { try { set(d.key, JSON.parse(raw)); } catch { flash('write a list like --clang-tidy --header-insertion=never'); } }
      else set(d.key, raw ? raw.split(/\s+/) : []);
    }} />
    <div class="doc">{d.type === 'string[]' ? 'separate arguments with spaces, e.g. --clang-tidy' : d.doc}</div></>);
}

export default function Settings() {
  const [pg, setPg] = createSignal(0);
  let el!: HTMLDivElement;
  const close = () => {
    const kids = [...el.querySelectorAll('.si')] as HTMLElement[];
    const reduce = settings()['motion.reduce'];
    if (reduce) return setSettingsOpen(false);
    const anims = kids.map((k, i) => k.animate([{ transform: 'none', opacity: 1 }, { transform: 'perspective(1400px) rotateY(-75deg)', opacity: 0 }], { duration: 260, delay: i * 40, easing: 'cubic-bezier(0.55,0,1,0.45)', fill: 'forwards' }));
    Promise.all(anims.map((a) => a.finished)).then(() => setSettingsOpen(false));
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  onMount(() => {
    window.addEventListener('keydown', onKey);
    if (settings()['motion.reduce']) return;
    [...el.querySelectorAll('.si')].forEach((k, i) => (k as HTMLElement).animate(
      [{ transform: 'perspective(1400px) rotateY(70deg) translateX(60px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 600, delay: 80 + i * 60, easing: 'cubic-bezier(0.16,1,0.3,1)', fill: 'backwards' }));
  });
  onCleanup(() => window.removeEventListener('keydown', onKey));
  const defs = () => SETTINGS.filter((d) => PAGES[pg()].sections.includes(sectionOf(d.key)));
  return (
    <div class="set" ref={el}>
      <div class="si" style={{ display: 'flex' }}>
        <span class="app-title">LITHOGRAPH</span><span style={{ flex: 1 }} />
        <button class="chip" style={{ 'font-size': '14px' }} onClick={() => { openFile(info()!.settingsFile); close(); }}>open settings.toml</button>
        <button class="chip" style={{ 'font-size': '14px', 'margin-left': '24px' }} onClick={close}>close · esc</button>
      </div>
      <div class="pv si"><For each={PAGES}>{(p, i) => <button classList={{ on: pg() === i() }} onClick={() => setPg(i())}>{p.name}</button>}</For></div>
      <Show when={problems().length}>
        <div class="problem si"><For each={problems()}>{(p) => <div>{p.line ? `line ${p.line}: ` : ''}{p.message}</div>}</For></div>
      </Show>
      <div class="grid si"><For each={defs()}>{(d) => <Control d={d} />}</For></div>
      <div class="sub si" style={{ 'margin-top': '20px' }}>Every change here is written to {info()?.settingsFile} — the page and the file are the same settings.</div>
    </div>
  );
}
