// The start window: shown in the middle of the app when no folder is open, so the first step is never a guess.
// Recent folders on the left (at most 5, newest first), the ways to start on the right.
import { For, Show, createSignal, onCleanup, onMount } from 'solid-js';
import { api, basename } from '../lib/api';
import { openFolder } from '../lib/store';
import { openFileDialog } from '../lib/actions';
import { t } from '../lib/i18n';

export const [startOpen, setStartOpen] = createSignal(false);
type Recent = { path: string; at: number; found: boolean };

const MAC = /Mac/.test(navigator.platform);
const key = (k: string, shift = false) => (MAC ? `${shift ? '⇧' : ''}⌘ ${k}` : `Ctrl ${shift ? '⇧ ' : ''}${k}`);
const home = (p: string) => p.replace(/^\/(Users|home)\/[^/]+/, '~');
function when(at: number): string {
  const min = Math.round((Date.now() - at) / 60000), day = Math.floor((Date.now() - at) / 86400000);
  if (min < 1) return t('just now');
  if (min < 60) return t('{n} min ago', { n: min });
  if (min < 24 * 60 && new Date(at).getDate() === new Date().getDate()) return t('today');
  if (day <= 1) return t('yesterday');
  if (day < 7) return t('{n} days ago', { n: day });
  return new Date(at).toLocaleDateString();
}

export default function StartWindow() {
  const [recent, setRecent] = createSignal<Recent[]>([]);
  let first!: HTMLButtonElement;
  const load = async () => setRecent(((await api.recent.get()) as Recent[]) ?? []);
  const close = () => setStartOpen(false);
  const open = async (p: string) => { close(); await openFolder(p); };
  const pick = async () => { const p = (await api.fs.pickFolder()) as string | null; if (p) await open(p); };
  const file = () => { close(); void openFileDialog(); };
  const remove = async (e: MouseEvent, p: string) => { e.stopPropagation(); await api.recent.remove(p); await load(); };
  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    const n = Number(e.key);
    const r = n >= 1 && n <= 5 ? recent()[n - 1] : e.key === 'Enter' && document.activeElement === document.body ? recent().find((x) => x.found) : undefined;
    if (r?.found) { e.preventDefault(); void open(r.path); }
  };
  onMount(() => { void load(); window.addEventListener('keydown', onKey); first?.focus(); });
  onCleanup(() => window.removeEventListener('keydown', onKey));
  return (
    <div class="startv" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div class="startw" role="dialog" aria-modal="true" aria-label={t('Start')}>
        <div class="st-top"><div class="t">SkyCodeX</div><div class="s">{t('See how your C and C++ program actually runs')}</div></div>
        <div class="st-cols">
          <div>
            <h3>{t('Open recent')}</h3>
            <Show when={recent().length} fallback={<div class="st-none">{t('Folders you open appear here.')}</div>}>
              <For each={recent()}>{(r, i) => (
                <div class="st-rc" classList={{ gone: !r.found }} role="button" tabindex={r.found ? 0 : -1} aria-disabled={!r.found}
                  title={r.found ? r.path : t('this folder no longer exists')} onClick={() => r.found && open(r.path)} onKeyDown={(e) => { if (e.key === 'Enter' && r.found) { e.stopPropagation(); void open(r.path); } }}>
                  <span class="k">{i() + 1}</span>
                  <div class="nmp"><div class="nm">{basename(r.path)}</div><div class="p">{home(r.path)}</div></div>
                  <span class="w">{r.found ? when(r.at) : t('not found')}</span>
                  <button class="x" title={t('remove from the list')} aria-label={t('remove {name} from the list', { name: basename(r.path) })} onClick={(e) => remove(e, r.path)}>✕</button>
                </div>
              )}</For>
            </Show>
          </div>
          <div>
            <h3>{t('Start')}</h3>
            <div class="st-act">
              <button class="st-big go" ref={first} onClick={pick}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2.5 6.5h6l2 2h9v9h-17z" /></svg>
                <span>{t('Open a folder')}<span class="sub">{t('a project, built or not')}</span></span><span class="kb">{key('O')}</span>
              </button>
              <button class="st-big" onClick={file}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M5.5 2.5h7l4 4v13h-11z" /><path d="M12.5 2.5v4h4" /></svg>
                <span>{t('Open a file')}<span class="sub">{t('one file, no project')}</span></span><span class="kb">{key('O', true)}</span>
              </button>
              <button class="st-cont" onClick={close}>{t('Continue without a folder →')}</button>
            </div>
          </div>
        </div>
        <div class="st-foot"><span><b>1–5</b> {t('open a recent folder')}</span><span><b>Esc</b> {t('close')}</span><span class="r">{t('recent folders are kept in data/state, beside the app')}</span></div>
      </div>
    </div>
  );
}
