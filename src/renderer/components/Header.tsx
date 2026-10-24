import { For, Show } from 'solid-js';
import { api, basename } from '../lib/api';
import { files, page, setPage, crumb, cursorPos, root, closeFile, setFiles } from '../lib/store';
import { lspState, indexing } from '../lib/lsp';
import { memoryAlert } from './Memory';

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
          <button classList={{ on: page() === 'flow' }} onClick={() => setPage('flow')}>flow</button>
          <button classList={{ on: page() === 'memory' }} onClick={() => setPage('memory')}>memory</button>
        </Show>
        <For each={files.list}>{(f) => (
          <>
            <button classList={{ on: page() === 'editor' && files.active === f.path, dirty: f.dirty }} title={f.path}
              onClick={() => { setPage('editor'); setFiles('active', f.path); }}
              onAuxClick={(e) => { if (e.button === 1) closeFile(f.path); }}>{basename(f.path)}</button>
            <Show when={page() === 'editor' && files.active === f.path && crumb()}><span class="crumb">{crumb()}</span></Show>
          </>
        )}</For>
      </div>
      <div class="status">
        <Show when={memoryAlert()}><span class="warn">{memoryAlert()}</span></Show>
        <Show when={page() === 'editor' && files.active}><span>{cursorPos().line}:{cursorPos().col}</span></Show>
        <span>{indexing() ?? (lspState() === 'ready' ? 'clangd ready' : lspState() === 'starting' ? 'clangd starting…' : lspState() === 'failed' ? 'clangd unavailable' : '')}</span>
      </div>
      <div class="wctl">
        <button title="Minimise" onClick={() => api.win.minimize()}>—</button>
        <button title="Maximise" onClick={() => api.win.maximize()}>□</button>
        <button class="x" title="Close" onClick={() => api.win.close()}>×</button>
      </div>
    </div>
  );
}
