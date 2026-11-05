import { For, Show, createSignal, createEffect, createResource, on, onMount, onCleanup } from 'solid-js';
import { SETTINGS, SECTIONS, SettingDef } from '../../shared/settings-schema';
import { hexToHsla, hslaToHex, isColor } from '../../shared/color';
import { api } from '../lib/api';
import { settings, problems, setSettingsOpen, openFile, info, flash, applySettings } from '../lib/store';
import { installedFonts, weightsOf, WEIGHT_NAMES, FontFamily } from '../lib/fonts';
import { afterPaint } from '../lib/motion';
import { t } from '../lib/i18n';

const PAGES: { name: string; sections: string[] }[] = [
  { name: 'appearance', sections: ['font', 'font.ui', 'font.preview', 'theme', 'motion', 'colors.editor', 'colors.code', 'colors.diagnostics', 'colors.cards', 'colors.flow'] },
  { name: 'interface', sections: ['ui', 'power'] },
  { name: 'editor', sections: ['editor', 'window'] },
  { name: 'preview', sections: ['preview'] },
  { name: 'clangd', sections: ['clangd'] },
];
const sectionOf = (k: string) => k.slice(0, k.lastIndexOf('.'));
const NAMES: Record<string, string> = {
  'font.family': 'code font', 'font.ui.family': 'interface font', 'font.preview.scale': 'preview text scale', 'font.weight': 'code weight',
};
const label = (d: SettingDef) => {
  if (NAMES[d.key]) return NAMES[d.key];
  if (d.label) return d.label;
  if (d.type === 'color') return d.key.slice(d.key.lastIndexOf('.') + 1).replace(/_/g, ' ');
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
        onFocus={show} onMouseDown={() => { if (!open()) void show(); }}
        onInput={(e) => { const v = e.currentTarget.value; if (!open()) void show().then(() => setQ(v)); setQ(v); setHi(0); }} onKeyDown={key} />
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
  const g = (f: FontFamily) => (f.bundled ? 'bundled with skycodex' : !monoFirst ? 'installed' : f.mono ? 'monospace' : 'other installed fonts');
  const order = (f: FontFamily) => (f.bundled ? 0 : !monoFirst || f.mono ? 1 : 2);
  return [...all].sort((a, b) => order(a) - order(b)).map((f) => ({ value: f.name, label: f.name, group: g(f), font: true }));
};

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
            onClick={() => set(props.d.key, w)}>{WEIGHT_NAMES[w] ?? w}<span class="w">{w}</span></button>
        )}</For>
      </div>
      <div class="doc">{ws.loading ? 'reading the font…' : ws()?.length ? `${props.family()} has ${ws()!.length} weight${ws()!.length > 1 ? 's' : ''} · ${props.d.doc}` : `${props.d.doc} · this font's weights couldn't be read, the nearest is drawn`}</div>
    </>
  );
}

/** A colour: swatch and hex, and hue / saturation / lightness (and transparency) sliders whose tracks show what they do. */
function ColorCtl(props: { d: SettingDef }) {
  const d = props.d;
  const [live, setLive] = createSignal<string | null>(null);
  createEffect(on(() => settings()[d.key], () => setLive(null), { defer: true }));
  const cur = () => live() ?? String(settings()[d.key] ?? d.default);
  const hsla = () => hexToHsla(cur());
  const alpha = () => cur().length === 9;
  // dragging recolours the window at once (nothing is written); letting go saves
  const preview = (hex: string) => { setLive(hex); applySettings({ ...settings(), [d.key]: hex }, problems()); };
  const commit = (hex: string) => { setLive(hex); set(d.key, hex); };
  const withPart = (k: 'h' | 's' | 'l' | 'a', v: number) => hslaToHex({ ...hsla(), [k]: v }, alpha());
  const track = (k: 'h' | 's' | 'l' | 'a') => {
    const c = hsla(), at = (v: number) => hslaToHex({ ...c, [k]: v, a: k === 'a' ? v : 1 }, k === 'a');
    const stops = k === 'h' ? [0, 60, 120, 180, 240, 300, 360] : k === 'a' ? [0, 1] : [0, 50, 100];
    return `linear-gradient(90deg, ${stops.map(at).join(', ')})`;
  };
  const slider = (k: 'h' | 's' | 'l' | 'a', name: string, max: number, step: number) => (
    <div class="cslide">
      <span>{name}</span>
      <input type="range" min={0} max={max} step={step} value={k === 'a' ? hsla().a : Math.round(hsla()[k])} style={{ background: track(k) }}
        onInput={(e) => preview(withPart(k, Number(e.currentTarget.value)))} onChange={(e) => commit(withPart(k, Number(e.currentTarget.value)))} />
    </div>
  );
  return (
    <div class="colorctl">
      <div class="crow">
        <span class="swatch" style={{ background: cur() }} />
        <input class="hex" type="text" spellcheck={false} value={cur()} onChange={(e) => { const v = e.currentTarget.value.trim().toLowerCase(); if (isColor(v)) commit(v); else { flash(`${label(d)}: a colour like #ad9b6f`); e.currentTarget.value = cur(); } }} />
      </div>
      {slider('h', 'hue', 359, 1)}{slider('s', 'saturation', 100, 1)}{slider('l', 'lightness', 100, 1)}
      <Show when={alpha()}>{slider('a', 'opacity', 1, 0.01)}</Show>
    </div>
  );
}

function Control(props: { d: SettingDef }) {
  const v = () => settings()[props.d.key];
  const d = props.d;
  const changed = () => JSON.stringify(v()) !== JSON.stringify(d.default);
  const reset = () => <Show when={changed()}><button class="rst" title={`back to ${JSON.stringify(d.default)}`} onClick={() => set(d.key, d.default)}>{t('reset')}</button></Show>;
  // a setting that only matters with another one: dimmed until it applies
  const idle = () => d.key === 'editor.autosave_delay_ms' && settings()['editor.autosave'] !== 'delay';
  const Lab = () => <div class="lab">{t(label(d))}{reset()}</div>;
  const wrap = (body: any) => <div class="ctl" classList={{ idle: idle() }}>{body}</div>;
  if (d.type === 'color') return wrap(<><Lab /><ColorCtl d={d} /><div class="doc">{t(d.doc)}</div></>);
  if (d.type === 'boolean') return (
    <div class="ctl" style={{ display: 'flex', 'align-items': 'center' }}>
      <div><Lab /><Show when={d.doc !== 'true | false'}><div class="doc">{t(d.doc)}</div></Show></div>
      <button class="tog" classList={{ on: !!v() }} onClick={() => set(d.key, !v())}><b /><i /></button>
    </div>
  );
  if (d.type === 'enum') return wrap(<><Lab /><div class="choices"><For each={d.values}>{(x) => <button classList={{ on: v() === x }} onClick={() => set(d.key, x)}>{t(x)}</button>}</For></div><Show when={d.doc !== d.values!.join(' | ')}><div class="doc">{t(d.doc)}</div></Show></>);
  if (/(^font|_font)\.?weight|font_weight/.test(d.key)) return wrap(<><Lab /><WeightCtl d={d} family={() => String(settings()['font.family'])} /></>);
  if (d.type === 'number') return wrap(<><Lab /><NumberCtl d={d} /><div class="doc">{t(d.doc)}</div></>);
  if (d.key === 'font.family' || d.key === 'font.ui.family') return wrap(<>
    <Lab /><Combo value={String(v())} load={fontOpts(d.key === 'font.family')} onPick={(x) => set(d.key, x)} font hint="installed fonts couldn't be listed — type a font name" />
    <div class="doc">{d.key === 'font.family' ? 'monospace fonts first · type to filter, or any font name' : 'any installed font · type to filter'}</div></>);
  if (d.key === 'clangd.path') return wrap(<>
    <Lab /><div class="pathrow">
      <input type="text" value={String(v())} spellcheck={false} onChange={(e) => set(d.key, e.currentTarget.value.trim() || 'auto')} />
      <button class="chip" onClick={async () => { const p = (await api.fs.pickFile('')) as string | null; if (p) set(d.key, p); }}>{t('browse')}</button>
      <Show when={v() !== 'auto'}><button class="chip" onClick={() => set(d.key, 'auto')}>{t('auto')}</button></Show>
    </div><div class="doc">{t(d.doc)}</div></>);
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
    <div class="doc">{d.type === 'string[]' ? t('separate items with spaces') : t(d.doc)}</div></>);
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
    // held at the first frame until the page has been laid out, then played: the entrance never starts with a stall
    const anims = [...el.querySelectorAll('.si')].map((k, i) => (k as HTMLElement).animate(
      [{ transform: 'perspective(1400px) rotateY(70deg) translate3d(60px,0,0)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 620, delay: 40 + i * 60, easing: 'cubic-bezier(0.16,1,0.3,1)', fill: 'backwards' }));
    anims.forEach((a) => a.pause());
    afterPaint().then(() => anims.forEach((a) => a.play()));
  });
  onCleanup(() => window.removeEventListener('keydown', onKey));
  const defs = () => SETTINGS.filter((d) => PAGES[pg()].sections.includes(sectionOf(d.key)));
  return (
    <div class="set" ref={el} role="dialog" aria-label="settings">
      <div class="si" style={{ display: 'flex' }}>
        <span class="app-title">SKYCODEX</span><span style={{ flex: 1 }} />
        <button class="chip" style={{ 'font-size': '14px' }} onClick={() => { openFile(info()!.settingsFile); close(); }}>{t('open settings.toml')}</button>
        <button class="chip" style={{ 'font-size': '14px', 'margin-left': '24px' }} onClick={close}>{t('close · esc')}</button>
      </div>
      <div class="pv si"><For each={PAGES}>{(p, i) => <button classList={{ on: pg() === i() }} onClick={() => setPg(i())}>{t(p.name)}</button>}</For></div>
      <Show when={problems().length}>
        <div class="problem si"><For each={problems()}>{(p) => <div>{p.line ? `line ${p.line}: ` : ''}{p.message}</div>}</For></div>
      </Show>
      <div class="grid si"><For each={defs()}>{(d, i) => (
        <>
          {/* each group of colours says what it colours */}
          <Show when={d.type === 'color' && sectionOf(d.key) !== sectionOf(defs()[i() - 1]?.key ?? '')}>
            <div class="sechead">
              <span>{sectionOf(d.key).replace('colors.', '').replace('cards', 'preview cards').replace('editor', 'whole editor')}</span>
              <span class="doc">{SECTIONS.find((x) => x.name === sectionOf(d.key))?.doc}</span>
              <Show when={sectionOf(d.key) === 'colors.editor' && SETTINGS.some((x) => x.type === 'color' && settings()[x.key] !== x.default)}>
                <button class="rst" onClick={async () => { for (const x of SETTINGS) if (x.type === 'color' && settings()[x.key] !== x.default) await set(x.key, x.default); }}>{t('reset all colours')}</button>
              </Show>
            </div>
          </Show>
          <Control d={d} />
        </>
      )}</For></div>
      <div class="sub si" style={{ 'margin-top': '20px' }}>Every change here is written to {info()?.settingsFile} — the page and the file are the same settings.</div>
    </div>
  );
}
