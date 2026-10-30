// The folder-wide content search, over the code pane: the query, then every matching line grouped by file. ↑ ↓ choose,
// ↵ or a click opens the file at that line, Esc closes (the query is kept for ⌘/Ctrl ⇧ F).
import { For, Show, createMemo, createSignal, onMount } from 'solid-js';
import { basename } from '../lib/api';
import { root, openFile } from '../lib/store';
import { query, runSearch, result, closeSearch } from '../lib/search';
import { Marked } from './FilesPane';
import { t } from '../lib/i18n';

const SHOWN = 3000;

export default function SearchPanel() {
  let input!: HTMLInputElement, list!: HTMLDivElement;
  const [sel, setSel] = createSignal(0);
  const rel = (f: string) => (f.startsWith(root() + '/') ? f.slice(root().length + 1) : f);
  const groups = createMemo(() => {
    const g = new Map<string, number[]>();
    result.hits.slice(0, SHOWN).forEach((h, i) => g.set(h.file, [...(g.get(h.file) ?? []), i]));
    return [...g];
  });
  const open = (i: number) => { const h = result.hits[i]; if (h) { closeSearch(); openFile(h.file, { line: h.line, character: h.col }); } };
  const key = (e: KeyboardEvent) => {
    const n = Math.min(SHOWN, result.hits.length);
    if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(Math.min(n - 1, sel() + 1)); list.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(Math.max(0, sel() - 1)); list.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); open(sel()); }
  };
  onMount(() => { input.focus(); input.select(); });
  const summary = () => {
    if (!query().trim()) return t('type to search every file in the folder — any case');
    const n = `${result.matches.toLocaleString()} match${result.matches === 1 ? '' : 'es'} in ${result.files.toLocaleString()} file${result.files === 1 ? '' : 's'}`;
    if (result.running) return `${result.hits.length.toLocaleString()} so far…`;
    return `${n} · ${result.searched.toLocaleString()} files searched in ${(result.ms / 1000).toFixed(1)} s${result.capped ? ' · stopped at 20,000' : ''}`;
  };
  return (
    <div class="csearch" role="dialog" aria-label={t('search in the folder')} onKeyDown={key}>
      <div class="q"><span class="d">⌕</span>
        <input ref={input} value={query()} placeholder={t('search in the folder')} spellcheck={false} onInput={(e) => { setSel(0); runSearch(e.currentTarget.value); }} />
        <span class="d sum">{summary()}</span>
        <button class="chip" onClick={closeSearch}>{t('close')}</button>
      </div>
      <div class="cres" ref={list}>
        <For each={groups()}>{([file, idx]) => (
          <>
            <div class="grp"><b>{basename(file)}</b><span>{rel(file).slice(0, -basename(file).length)}</span><span class="grow" /><span>{idx.length}</span></div>
            <For each={idx}>{(i) => (
              <div class="hit" classList={{ on: sel() === i }} onMouseEnter={() => setSel(i)} onClick={() => open(i)}>
                <span class="ln">{result.hits[i].line + 1}</span><Marked text={result.hits[i].text} q={query().trim()} />
              </div>
            )}</For>
          </>
        )}</For>
        <Show when={result.hits.length > SHOWN}><div class="grp">{`${(result.hits.length - SHOWN).toLocaleString()} more — narrow the search`}</div></Show>
      </div>
    </div>
  );
}
