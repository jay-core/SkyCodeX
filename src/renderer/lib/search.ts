import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { api } from './api';
import { root, setPage } from './store';
import type { Hit } from '../../shared/search';

export const [searchOpen, setSearchOpen] = createSignal(false);
export const [query, setQuery] = createSignal('');
export const [result, setResult] = createStore<{ hits: Hit[]; running: boolean; files: number; matches: number; searched: number; capped: boolean; ms: number; error?: string; big?: number; hitsCapped?: boolean; filesCapped?: boolean }>({ hits: [], running: false, files: 0, matches: 0, searched: 0, capped: false, ms: 0 });

let id = 0, timer: number | undefined;
api.search.onHits((sid, hits) => { if (sid === id) setResult('hits', (h) => [...h, ...hits]); });

export function runSearch(q: string) {
  setQuery(q);
  clearTimeout(timer);
  const sid = ++id;
  setResult({ hits: [], running: !!q.trim(), files: 0, matches: 0, searched: 0, capped: false, ms: 0, error: undefined });
  if (!q.trim() || !root()) { api.search.cancel(); return; }
  timer = window.setTimeout(async () => {
    try {
      const d = (await api.search.run(root(), q.trim(), sid)) as { id: number; files: number; matches: number; searched: number; capped: boolean; ms: number; big: number; hitsCapped: boolean; filesCapped: boolean };
      if (d.id === id) setResult({ running: false, files: d.files, matches: d.matches, searched: d.searched, capped: d.capped, ms: d.ms, big: d.big, hitsCapped: d.hitsCapped, filesCapped: d.filesCapped });
    } catch (e) { if (sid === id) setResult({ running: false, error: String(e) }); }
  }, 180);
}

export function openSearch(q?: string) {
  setPage('editor');
  setSearchOpen(true);
  if (q && q !== query()) runSearch(q);
}
export function closeSearch() { setSearchOpen(false); }
