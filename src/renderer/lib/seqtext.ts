// The text of the files the flow page shows code from, read once per file while it is open (both views share it).
import { createSignal } from 'solid-js';
import { api } from './api';

const texts = new Map<string, string[] | null>();
const [textTick, setTextTick] = createSignal(0);
export { textTick };
export const clearSeqTexts = () => { texts.clear(); setTextTick(textTick() + 1); };
/** The file's lines, or null while it is being read (the caller re-runs when it arrives). */
export function lines(file: string): string[] | null {
  textTick();
  const t = texts.get(file);
  if (t) return t;
  if (file && !texts.has(file)) {
    texts.set(file, null);
    (api.fs.read(file) as Promise<string>).then((s) => { texts.set(file, s.split('\n')); setTextTick(textTick() + 1); }).catch(() => texts.delete(file));
  }
  return null;
}
