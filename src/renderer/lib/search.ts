// The folder-wide content search: one query at a time, results streamed from the main process (src/main/search.ts).
import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { api } from './api';
import { root, setPage } from './store';
import type { Hit } from '../../shared/search';

export const [searchOpen, setSearchOpen] = createSignal(false);
export const [query, setQuery] = createSignal('');
export const [result, setResult] = createStore<{ hits: Hit[]; running: boolean; files: number; matches: number; searched: number; capped: boolean; ms: number }>({ hits: [], running: false, files: 0, matches: 0, searched: 0, capped: false, ms: 0 });

let id = 0, timer: number | undefined;
api.search.onHits((sid, hits) => { if (sid === id) setResult('hits', (h) => [...h, ...hits]); });

/** Searches the folder for q (any case), after a short pause in typing. */
export function runSearch(q: string) {
  setQuery(q);
  clearTimeout(timer);
  const sid = ++id;
  setResult({ hits: [], running: !!q.trim(), files: 0, matches: 0, searched: 0, capped: false, ms: 0 });
  if (!q.trim() || !root()) { api.search.cancel(); return; }
  timer = window.setTimeout(async () => {
    const d = (await api.search.run(root(), q.trim(), sid)) as { id: number; files: number; matches: number; searched: number; capped: boolean; ms: number };
    if (d.id === id) setResult({ running: false, files: d.files, matches: d.matches, searched: d.searched, capped: d.capped, ms: d.ms });
  }, 180);
}

/** Opens the search over the code pane, with q if given (else the last query). */
export function openSearch(q?: string) {
  setPage('editor');
  setSearchOpen(true);
  if (q && q !== query()) runSearch(q);
}
export function closeSearch() { setSearchOpen(false); }
