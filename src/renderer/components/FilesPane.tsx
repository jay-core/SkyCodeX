import { For, Show, createSignal, createResource, createMemo } from 'solid-js';
import { matchesIn, SKIPPED_NOTE } from '../../shared/search';
import { openSearch } from '../lib/search';
import { api, DirEntry, basename } from '../lib/api';
import { root, files, openFile, openFolder, flash } from '../lib/store';
import { setPalette } from '../lib/actions';
import { t } from '../lib/i18n';

const [expanded, setExpanded] = createSignal<Set<string>>(new Set());
const [here, setHere] = createSignal('');
const dirOf = (p: string) => p.replace(/[\\/][^\\/]*$/, '');
const indent = (depth: number) => 12 + depth * 13;
const inRoot = (p: string) => !!p && !!root() && (p === root() || p.startsWith(root() + '/') || p.startsWith(root() + '\\'));
const folderNow = () => (inRoot(here()) ? here() : inRoot(files.active) ? dirOf(files.active) : root());
const relTo = (p: string) => (p === root() ? '' : p.slice(root().length + 1).replace(/\\/g, '/'));
const [listVersion, setListVersion] = createSignal(0);
let treeTimer: number | undefined;
export const refreshTree = () => { clearTimeout(treeTimer); treeTimer = window.setTimeout(() => setListVersion((n) => n + 1), 250); };

function Dir(props: { path: string; depth: number }) {
  const [entries] = createResource(() => [props.path, listVersion()] as const, async ([p]) => (await api.fs.list(p)) as DirEntry[]);
  const note = (text: string) => <div class="ti" style={{ 'padding-left': `${indent(props.depth + 1)}px`, color: 'var(--faint)' }}>{text}</div>;
  return (
    <Show when={!entries.error} fallback={note(`couldn't list this folder: ${String(entries.error)}`)}>
    <Show when={entries() !== undefined} fallback={note(t('listing…'))}>
    <Show when={entries()!.length} fallback={note(t('empty'))}>
    <For each={entries() ?? []}>{(e) => {
      const open = () => expanded().has(e.path);
      return (
        <>
          <div class="ti" classList={{ on: files.active === e.path }} style={{ 'padding-left': `${indent(props.depth)}px` }}
            onClick={() => {
              if (e.dir) { const s = new Set(expanded()); s.has(e.path) ? s.delete(e.path) : s.add(e.path); setExpanded(s); setHere(e.path); }
              else { setHere(dirOf(e.path)); openFile(e.path); }
            }}>
            <span class="ic">{e.dir ? (open() ? '▾' : '▸') : ''}</span>
            <span class="tn" title={e.name}>{e.name}</span>
            <Show when={!e.dir && files.list.some((f) => f.path === e.path && f.dirty)}><span class="dot" style={{ background: 'var(--ty)' }} /></Show>
          </div>
          <Show when={e.dir && open()}><Dir path={e.path} depth={props.depth + 1} /></Show>
        </>
      );
    }}</For>
    </Show>
    </Show>
    </Show>
  );
}

export function Marked(props: { text: string; q: string }) {
  const parts = () => {
    const out: { t: string; m: boolean }[] = [];
    let at = 0;
    for (const [a, b] of matchesIn(props.text, props.q)) { if (a > at) out.push({ t: props.text.slice(at, a), m: false }); out.push({ t: props.text.slice(a, b), m: true }); at = b; }
    if (at < props.text.length) out.push({ t: props.text.slice(at), m: false });
    return out;
  };
  return <span class="mk" title={props.text}><For each={parts()}>{(p) => (p.m ? <mark>{p.t}</mark> : p.t)}</For></span>;
}

const [filter, setFilter] = createSignal('');
function Found() {
  const [all] = createResource(() => [root(), listVersion()] as const, async ([r]) => (r ? await api.fs.files(r) : []));
  const [sel, setSel] = createSignal(0);
  const matched = createMemo(() => {
    const q = filter().trim();
    return (all() ?? []).filter((f) => matchesIn(relTo(f), q, 1).length);
  });
  const hits = createMemo(() => matched().slice(0, 500));
  const groups = createMemo(() => {
    const g = new Map<string, string[]>();
    for (const f of hits()) { const d = relTo(dirOf(f)); g.set(d, [...(g.get(d) ?? []), f]); }
    return [...g];
  });
  const flat = createMemo(() => groups().flatMap(([, fs]) => fs));
  Found.key = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(Math.min(flat().length - 1, sel() + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(Math.max(0, sel() - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const f = flat()[sel()]; if (f) { setHere(dirOf(f)); openFile(f); } }
  };
  return (
    <div class="tree found">
      <div class="fcount" title={SKIPPED_NOTE}>{all.loading ? t('listing files…') : matched().length > hits().length ? `the first ${hits().length} of ${matched().length} matching files · type more to narrow` : `${hits().length} of ${(all() ?? []).length} files`}</div>
      <For each={groups()}>{([d, fs]) => (
        <>
          <div class="ti fdir"><Marked text={d ? `${d}/` : './'} q={filter().trim()} /></div>
          <For each={fs}>{(f) => (
            <div class="ti" classList={{ on: flat()[sel()] === f }} style={{ 'padding-left': `${indent(1)}px` }} onMouseEnter={() => setSel(flat().indexOf(f))}
              onClick={() => { setHere(dirOf(f)); openFile(f); }}><Marked text={basename(f)} q={filter().trim()} /></div>
          )}</For>
        </>
      )}</For>
    </div>
  );
}
Found.key = (_e: KeyboardEvent) => {};

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
      <div class="ph fwrap"><span style={{ color: 'var(--dim)' }}>{root() ? basename(root()) : 'files'}</span><span class="grow" />
        <Show when={root()}>
          <button class="chip" title={`a new file in ${relTo(folderNow()) || 'the project folder'}`} onClick={() => create('file')}>{t('new file')}</button>
          <button class="chip" title={`a new folder in ${relTo(folderNow()) || 'the project folder'}`} onClick={() => create('folder')}>{t('new folder')}</button>
          <button class="chip" title={`your system's terminal, opened in ${relTo(folderNow()) || 'the project folder'}`} onClick={terminal}>{t('terminal')}</button>
        </Show>
        <button class="chip" onClick={pick}>{t('open…')}</button></div>
      <Show when={root()} fallback={<div class="empty"><button style={{ color: 'var(--bright)', 'font-size': '15px' }} onClick={pick}>{t('open a folder')}</button></div>}>
        <div class="ffind">
          <input value={filter()} placeholder={t('find a file — any case')} aria-label={t('find a file by name or path')} spellcheck={false}
            onInput={(e) => setFilter(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setFilter(''); e.currentTarget.blur(); } else Found.key(e); }} />
          <button class="chip" title={t('search the text of every file in the folder (⌘/Ctrl ⇧ F)')} onClick={() => openSearch(filter().trim())}>{t('in contents')}</button>
        </div>
        <Show when={filter().trim()} fallback={<div class="tree"><Dir path={root()} depth={0} /></div>}><Found /></Show>
      </Show>
    </div>
  );
}
