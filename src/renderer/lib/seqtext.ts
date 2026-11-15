import { createSignal } from 'solid-js';
import { api } from './api';
import { states } from './store';
import { builtText } from './flow';

const texts = new Map<string, string[] | null>(), unread = new Set<string>();
const [textTick, setTextTick] = createSignal(0);
export { textTick };
export const cannotRead = (file: string) => { textTick(); return unread.has(file); };
export const clearSeqTexts = () => { texts.clear(); unread.clear(); setTextTick(textTick() + 1); };
export function invalidateSeqText(file: string) { const had = texts.delete(file); if (unread.delete(file) || had) setTextTick(textTick() + 1); }
export function syncSeqTexts(files: Iterable<string>) {
  let changed = false;
  for (const f of files) {
    const b = builtText(f) ?? states.get(f)?.doc.toString();
    if (b == null) continue;
    const cur = texts.get(f);
    if (!cur || cur.join('\n') !== b) { texts.set(f, b.split('\n')); changed = true; }
  }
  if (changed) setTextTick(textTick() + 1);
}
export function lines(file: string): string[] | null {
  textTick();
  const t = texts.get(file);
  if (t) return t;
  const known = file ? builtText(file) ?? states.get(file)?.doc.toString() : undefined;
  if (known != null) { const l = known.split('\n'); texts.set(file, l); return l; }
  if (file && !texts.has(file)) {
    texts.set(file, null);
    (api.fs.read(file) as Promise<string>).then((s) => { texts.set(file, s.split('\n')); setTextTick(textTick() + 1); }).catch(() => { unread.add(file); setTextTick(textTick() + 1); });
  }
  return null;
}
