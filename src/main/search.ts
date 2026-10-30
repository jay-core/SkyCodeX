// Folder-wide content search: every text file under the project, read a few at a time so the window stays
// responsive, matches sent in batches as they are found. Case-free (src/shared/search.ts). A newer search cancels
// the one running.
import fs from 'node:fs/promises';
import { listFiles } from './files';
import { hitsIn, Hit } from '../shared/search';

const MAX_BYTES = 4 * 1024 * 1024, MAX_HITS = 20000;
let current = 0;

export interface SearchDone { id: number; files: number; matches: number; searched: number; capped: boolean; ms: number }

export async function searchFolder(root: string, q: string, id: number, send: (hits: Hit[]) => void): Promise<SearchDone> {
  current = id;
  const t0 = Date.now(), all = listFiles(root);
  let matches = 0, files = 0, searched = 0, i = 0, batch: Hit[] = [], last = Date.now();
  const flush = () => { if (batch.length) { send(batch); batch = []; } last = Date.now(); };
  const one = async (f: string) => {
    let buf: Buffer;
    try { const st = await fs.stat(f); if (st.size > MAX_BYTES) return; buf = await fs.readFile(f); } catch { return; }
    if (buf.subarray(0, 8000).includes(0)) return;   // binary
    searched++;
    const hits = hitsIn(f, buf.toString('utf8'), q, MAX_HITS - matches);
    if (!hits.length) return;
    files++; matches += hits.length; batch.push(...hits);
    if (batch.length >= 200 || Date.now() - last > 120) flush();
  };
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (i < all.length && current === id && matches < MAX_HITS) await one(all[i++]);
  }));
  if (current === id) flush();
  return { id, files, matches, searched, capped: matches >= MAX_HITS || all.length >= 50000, ms: Date.now() - t0 };
}
export const cancelSearch = () => { current = 0; };
