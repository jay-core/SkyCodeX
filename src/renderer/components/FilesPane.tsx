import { For, Show, createSignal, createResource } from 'solid-js';
import { api, DirEntry, basename } from '../lib/api';
import { root, files, openFile, openFolder } from '../lib/store';
import { t } from '../lib/i18n';

const [expanded, setExpanded] = createSignal<Set<string>>(new Set());
const [listVersion, setListVersion] = createSignal(0);
let treeTimer: number | undefined;
export const refreshTree = () => { clearTimeout(treeTimer); treeTimer = window.setTimeout(() => setListVersion((n) => n + 1), 250); };

function Dir(props: { path: string; depth: number }) {
  const [entries] = createResource(() => [props.path, listVersion()] as const, async ([p]) => (await api.fs.list(p)) as DirEntry[]);
  return (
    <For each={entries() ?? []}>{(e) => {
      const open = () => expanded().has(e.path);
      return (
        <>
          <div class="ti" classList={{ on: files.active === e.path }} style={{ 'padding-left': `${12 + props.depth * 13}px` }}
            onClick={() => {
              if (e.dir) { const s = new Set(expanded()); s.has(e.path) ? s.delete(e.path) : s.add(e.path); setExpanded(s); }
              else openFile(e.path);
            }}>
            <span class="ic">{e.dir ? (open() ? '▾' : '▸') : ''}</span>
            <span>{e.name}</span>
            <Show when={!e.dir && files.list.some((f) => f.path === e.path && f.dirty)}><span class="dot" style={{ background: 'var(--ty)' }} /></Show>
          </div>
          <Show when={e.dir && open()}><Dir path={e.path} depth={props.depth + 1} /></Show>
        </>
      );
    }}</For>
  );
}

export default function FilesPane() {
  const pick = async () => { const p = await api.fs.pickFolder(); if (p) openFolder(p as string); };
  return (
    <div class="pane files" style={{ height: '100%' }}>
      <div class="ph"><span style={{ color: 'var(--dim)' }}>{root() ? basename(root()) : 'files'}</span><span class="grow" /><button class="chip" onClick={pick}>{t('open…')}</button></div>
      <Show when={root()} fallback={<div class="empty"><button style={{ color: 'var(--bright)', 'font-size': '15px' }} onClick={pick}>{t('open a folder')}</button></div>}>
        <div class="tree"><Dir path={root()} depth={0} /></div>
      </Show>
    </div>
  );
}
