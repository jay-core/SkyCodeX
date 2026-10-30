import { For, Show, createSignal, createResource } from 'solid-js';
import { api, DirEntry, basename } from '../lib/api';
import { root, files, openFile, openFolder, flash } from '../lib/store';
import { setPalette } from '../lib/actions';
import { t } from '../lib/i18n';

const [expanded, setExpanded] = createSignal<Set<string>>(new Set());
/** The folder being looked at: the last one clicked, else the open file's, else the project's. New files, new folders and the terminal go there. */
const [here, setHere] = createSignal('');
const dirOf = (p: string) => p.replace(/[\\/][^\\/]*$/, '');
const inRoot = (p: string) => !!p && !!root() && (p === root() || p.startsWith(root() + '/') || p.startsWith(root() + '\\'));
const folderNow = () => (inRoot(here()) ? here() : inRoot(files.active) ? dirOf(files.active) : root());
const relTo = (p: string) => (p === root() ? '' : p.slice(root().length + 1).replace(/\\/g, '/'));
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
              if (e.dir) { const s = new Set(expanded()); s.has(e.path) ? s.delete(e.path) : s.add(e.path); setExpanded(s); setHere(e.path); }
              else { setHere(dirOf(e.path)); openFile(e.path); }
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

/** Asks for a name (a path inside the project, from the folder in view) and makes a file or a folder there. */
function create(kind: 'file' | 'folder') {
  const at = relTo(folderNow());
  setPalette({
    placeholder: kind === 'file' ? 'new file — path inside the folder' : 'new folder — path inside the folder',
    prompt: {
      value: `${at ? `${at}/` : ''}${kind === 'file' ? 'untitled.cpp' : 'new_folder'}`,
      accept: async (rel) => {
        rel = rel.trim().replace(/^[\\/]+/, '');
        if (!rel || rel.split(/[\\/]/).includes('..')) { if (rel) flash('stay inside the folder: no ".." in the name'); return; }
        const path = `${root()}/${rel}`;
        if (await api.fs.exists(path)) { flash(`${rel} already exists`); if (kind === 'file') openFile(path); return; }
        try {
          if (kind === 'folder') await api.fs.mkdir(path);
          else { await api.fs.mkdir(dirOf(path)); await api.fs.write(path, ''); }
        } catch (e) { flash(`couldn't create ${rel}: ${e}`); return; }
        // open the folders down to it, so it shows
        const s = new Set(expanded());
        for (let d = kind === 'folder' ? path : dirOf(path); inRoot(d) && d !== root(); d = dirOf(d)) s.add(d);
        setExpanded(s);
        refreshTree();
        setHere(kind === 'folder' ? path : dirOf(path));
        if (kind === 'file') await openFile(path);
      },
    },
  });
}

export default function FilesPane() {
  const pick = async () => { const p = await api.fs.pickFolder(); if (p) openFolder(p as string); };
  const terminal = async () => { const why = (await api.shell.terminal(folderNow())) as string | null; if (why) flash(`couldn't open a terminal: ${why}`, 6000); };
  return (
    <div class="pane files" style={{ height: '100%' }}>
      <div class="ph"><span style={{ color: 'var(--dim)' }}>{root() ? basename(root()) : 'files'}</span><span class="grow" />
        <Show when={root()}>
          <button class="chip" title={`a new file in ${relTo(folderNow()) || 'the project folder'}`} onClick={() => create('file')}>{t('new file')}</button>
          <button class="chip" title={`a new folder in ${relTo(folderNow()) || 'the project folder'}`} onClick={() => create('folder')}>{t('new folder')}</button>
          <button class="chip" title={`your system's terminal, opened in ${relTo(folderNow()) || 'the project folder'}`} onClick={terminal}>{t('terminal')}</button>
        </Show>
        <button class="chip" onClick={pick}>{t('open…')}</button></div>
      <Show when={root()} fallback={<div class="empty"><button style={{ color: 'var(--bright)', 'font-size': '15px' }} onClick={pick}>{t('open a folder')}</button></div>}>
        <div class="tree"><Dir path={root()} depth={0} /></div>
      </Show>
    </div>
  );
}
