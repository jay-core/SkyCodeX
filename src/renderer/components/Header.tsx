import { For, Show } from 'solid-js';
import { api, basename } from '../lib/api';
import { files, page, setPage, crumb, cursorPos, root, closeFile, setFiles } from '../lib/store';
import { lspState, indexing } from '../lib/lsp';
import { serverLang } from '../lib/langs';
import { saver } from '../lib/power';
import { langStatus } from '../lib/langlsp';

// the long "install one from the compiler window" message stays in the tooltip
const shortStatus = (s?: string) => (!s ? '' : s === 'starting' ? t('starting…') : s.endsWith(' ready') ? s : t('no language engine'));
import { t } from '../lib/i18n';

export const GEAR = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
    <circle cx="12" cy="12" r="3.4" />
    <For each={[0, 45, 90, 135, 180, 225, 270, 315]}>{(a) => <line x1="12" y1="2.6" x2="12" y2="6.2" transform={`rotate(${a} 12 12)`} stroke-width="3" />}</For>
    <circle cx="12" cy="12" r="6.6" />
  </svg>
);

export default function Header() {
  return (
    <div class="hdr">
      <div class="pivot nodrag">
        <Show when={root()}>
          <button classList={{ on: page() === 'flow' }} onClick={() => setPage('flow')}>{t('flow')}</button>
          {/* the folder's files, reachable even before any file is open */}
          <button classList={{ on: page() === 'editor' && !files.active }} title={root()} onClick={() => { setPage('editor'); setFiles('active', ''); }}>{t('folder')}</button>
        </Show>
        <For each={files.list}>{(f) => (
          <>
            <span class="tab">
              <button classList={{ on: page() === 'editor' && files.active === f.path, dirty: f.dirty }} title={f.path}
                onClick={() => { setPage('editor'); setFiles('active', f.path); }}
                onAuxClick={(e) => { if (e.button === 1) closeFile(f.path); }}>{basename(f.path)}</button>
              <button class="tabx" title={t('Close (⌘/Ctrl W)')} aria-label={`${t('Close')} ${basename(f.path)}`} onClick={() => closeFile(f.path)}>×</button>
            </span>
            <Show when={page() === 'editor' && files.active === f.path && crumb()}><span class="crumb">{crumb()}</span></Show>
          </>
        )}</For>
      </div>
      <div class="status" role="status" aria-live="polite">
        <Show when={saver()}><span title={t('on battery: animations off, background work spaced out (settings → interface → power)')}>{t('battery saver')}</span></Show>
        <Show when={page() === 'editor' && files.active}><span>{cursorPos().line}:{cursorPos().col}</span></Show>
        <Show when={page() === 'editor' && serverLang(files.active)} fallback={<span>{indexing() ?? (lspState() === 'ready' ? t('clangd ready') : lspState() === 'starting' ? t('clangd starting…') : lspState() === 'failed' ? t('clangd unavailable') : '')}</span>}><span title={langStatus()[serverLang(files.active)!] ?? ''}>{shortStatus(langStatus()[serverLang(files.active)!])}</span></Show>
      </div>
      <div class="wctl">
        <button title={t('Minimise')} aria-label={t('Minimise')} onClick={() => api.win.minimize()}><svg viewBox="0 0 10 10"><path d="M0 5.5h10" /></svg></button>
        <button title={t('Maximise')} aria-label={t('Maximise')} onClick={() => api.win.maximize()}><svg viewBox="0 0 10 10"><rect x=".5" y=".5" width="9" height="9" /></svg></button>
        <button class="x" title={t('Close')} aria-label={t('Close')} onClick={() => api.win.close()}><svg viewBox="0 0 10 10"><path d="M.5 .5l9 9M9.5 .5l-9 9" /></svg></button>
      </div>
    </div>
  );
}
