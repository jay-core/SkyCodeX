// The refresh button (bottom right): everything read from disk or worked out from it is forgotten and built again —
// the previews at the cursor, the flow graph, the run and its views, the file tree. clangd's own index is left to
// clangd, which keeps it up to date as files change. One refresh at a time; a click while one runs is ignored.
import { createSignal } from 'solid-js';
import { files, getMainView, flash } from './store';
import { lspState, clearDefinitionCache } from './lsp';
import { refreshForCursor, clearTextCache, clearDepths } from './preview';
import { clearFlowCaches } from './flow';
import { rebuild, graph } from './flowstore';
import { refreshTree } from '../components/FilesPane';
import { clearSeqTexts } from './seqtext';
import { offsetToPos } from './cm';

export const [refreshing, setRefreshing] = createSignal(false);

export async function refreshAll(): Promise<{ ok: boolean; message: string }> {
  if (refreshing()) return { ok: false, message: 'a refresh is already running' };
  setRefreshing(true);
  try {
    clearFlowCaches(); clearTextCache(); clearDefinitionCache(); clearDepths(); clearSeqTexts();
    refreshTree();
    if (lspState() !== 'ready') { const m = 'files re-read · clangd is not ready yet, so calls are traced when it is'; flash(m); return { ok: true, message: m }; }
    const v = getMainView();
    const previews = v && files.active ? refreshForCursor(files.active, offsetToPos(v.state.doc, v.state.selection.main.head), true) : Promise.resolve();
    await Promise.all([previews, rebuild()]);
    const g = graph(), m = g ? `refreshed · ${g.fns.length} functions traced` : 'refreshed';
    flash(m);
    return { ok: true, message: m };
  } catch (e) {
    const m = `refresh failed: ${String((e as Error)?.message ?? e)}`;
    flash(m);
    return { ok: false, message: m };
  } finally {
    setRefreshing(false);
  }
}
