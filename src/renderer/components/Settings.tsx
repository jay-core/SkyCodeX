import { For, Show, createSignal, onMount, onCleanup } from 'solid-js';
import { SETTINGS, SettingDef } from '../../shared/settings-schema';
import { api } from '../lib/api';
import { settings, problems, setSettingsOpen, openFile, info, flash } from '../lib/store';

const PAGES: { name: string; sections: string[] }[] = [
  { name: 'appearance', sections: ['font', 'font.ui', 'font.preview', 'theme', 'motion'] },
  { name: 'editor', sections: ['editor', 'window'] },
  { name: 'preview', sections: ['preview'] },
  { name: 'clangd', sections: ['clangd'] },
  { name: 'terminal', sections: ['terminal'] },
  { name: 'memory', sections: ['memory'] },
];
const sectionOf = (k: string) => k.slice(0, k.lastIndexOf('.'));
const label = (d: SettingDef) => {
  const sec = sectionOf(d.key).replace(/^font\.?/, (m) => (m ? 'font ' : '')).replace('.', ' ');
  const name = d.key.slice(d.key.lastIndexOf('.') + 1).replace(/_/g, ' ');
  return sectionOf(d.key) === 'font' ? `code ${name}` : `${sec} ${name}`.trim().replace(/^ui family$/, 'interface font');
};

async function set(key: string, value: unknown) {
  try { await api.settings.set(key, value); } catch (e) { flash(String(e).replace(/^Error: /, '')); }
}

function Control(props: { d: SettingDef }) {
  const v = () => settings()[props.d.key];
  const d = props.d;
  if (d.type === 'boolean') return (
    <div class="ctl" style={{ display: 'flex', 'align-items': 'center' }}>
      <div><div class="lab">{label(d)}</div><div class="doc">{d.doc}</div></div>
      <button class="tog" onClick={() => set(d.key, !v())}><b style={{ width: v() ? '44px' : '0' }} /><i style={{ left: v() ? '38px' : '-2px' }} /></button>
    </div>
  );
  if (d.type === 'enum') return (
    <div class="ctl"><div class="lab">{label(d)}</div><div class="choices"><For each={d.values}>{(x) => <button classList={{ on: v() === x }} onClick={() => set(d.key, x)}>{x}</button>}</For></div><div class="doc">{d.doc}</div></div>
  );
  if (d.type === 'number' && d.max !== undefined && d.max - (d.min ?? 0) <= 200) {
    const step = d.max - (d.min ?? 0) <= 10 ? 0.1 : d.max - (d.min ?? 0) <= 80 ? 0.5 : 1;
    return (
      <div class="ctl"><div class="lab">{label(d)}<span class="v">{v()}</span></div>
        <input type="range" min={d.min} max={d.max} step={step} value={v()} onChange={(e) => set(d.key, Number(e.currentTarget.value))} />
        <div class="doc">{d.doc}</div></div>
    );
  }
  const text = () => (d.type === 'string[]' ? JSON.stringify(v() ?? []) : String(v() ?? ''));
  return (
    <div class="ctl"><div class="lab">{label(d)}</div>
      <input type="text" value={text()} onChange={(e) => {
        const raw = e.currentTarget.value;
        if (d.type === 'number') set(d.key, Number(raw));
        else if (d.type === 'string[]') { try { set(d.key, JSON.parse(raw)); } catch { flash('write a list like ["--clang-tidy"]'); } }
        else set(d.key, raw);
      }} />
      <div class="doc">{d.doc}</div></div>
  );
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
