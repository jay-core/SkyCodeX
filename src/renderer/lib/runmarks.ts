import { createRoot, createSignal, createMemo, createEffect, on } from 'solid-js';
import { seq, changed, entryStart } from './flowstore';
import { root } from './store';

export const load = <T,>(key: string, d: T): T => { try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
export const keep = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {  } };
export const runKey = (kind: string) => `flow.${kind}:${root()}:${entryStart()}`;

export const { notesByItem, changedItems, setNote } = createRoot(() => {
  const [noteStore, setNoteStore] = createSignal<Record<string, string>>({});
  createEffect(on([seq, root], () => setNoteStore(load<Record<string, string>>(runKey('notes'), {}))));
  const noteKey = (it: number) => { const s = seq()!, k = s.run.rows[s.items[it]].key; let occ = 0; for (let i = 0; i < it; i++) if (s.run.rows[s.items[i]].key === k) occ++; return `${k}|${occ}`; };
  const notesByItem = createMemo(() => { const s = seq(), out: Record<number, string> = {}; if (!s) return out; const ns = noteStore(); if (!Object.keys(ns).length) return out; for (let i = 0; i < s.items.length; i++) { const t = ns[noteKey(i)]; if (t) out[i] = t; } return out; });
  const changedItems = createMemo(() => { const s = seq(), c = changed(), out = new Set<number>(); if (!s || !c.size) return out; s.items.forEach((row, it) => { const r = s.run.rows[row]; if (c.has(r.kind === 'ref' ? r.ref! : row)) out.add(it); }); return out; });
  function setNote(it: number, text: string) {
    const n = { ...noteStore() }, k = noteKey(it);
    if (text.trim()) n[k] = text.trim(); else delete n[k];
    setNoteStore(n); keep(runKey('notes'), n);
  }
  return { notesByItem, changedItems, setNote };
});
