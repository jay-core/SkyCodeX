// The hidden window that reads the code with another build setting (configurations): its own clangd, started by
// the main process with the setting's commands. It traces the same entry point with the very code the window uses
// (src/renderer/lib/flow.ts), waits for clangd's index to settle as the window does, and hands the run back.
import { api } from './lib/api';
import { startLsp, lspState, indexing, indexEpoch, diagnosticsFor } from './lib/lsp';
import { findEntries, entryKey, resolveEntry, buildFlow, buildRun } from './lib/flow';
import type { Run } from '../shared/flowrun';
import { functionTexts } from '../shared/flowalign';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(cond: () => boolean, ms: number) { const end = Date.now() + ms; while (!cond() && Date.now() < end) await sleep(100); return cond(); }
/** Until cond has held for hold ms without a break. */
async function quiet(cond: () => boolean, hold: number, ms: number) {
  const end = Date.now() + ms;
  let since = 0;
  while (Date.now() < end) { if (!cond()) since = 0; else if (!since) since = Date.now(); else if (Date.now() - since >= hold) return true; await sleep(100); }
  return false;
}

export async function runSettingWorker() {
  const job = await api.setting.job();
  if (!job) return;
  try {
    await startLsp(job.root);
    if (!(await until(() => lspState() === 'ready', 60000))) throw new Error('clangd did not start for this setting');
    // clangd indexes the project with the setting's commands: wait until it has begun (or had nothing to do), then finished
    await until(() => !!indexing() || indexEpoch() > 0, 10000);
    await quiet(() => !indexing(), 1500, 30 * 60000);
    // the same entry point: by its key, or (another version of the code, where lines move) by its file and name
    const e = (await findEntries(job.root)).find((x) => (job.entry ? entryKey(x) === job.entry : x.rel.replace(/\\/g, '/') === job.entryRel && x.name === job.entryName));
    if (!e) throw new Error('this entry point is not in the code with this setting');
    const start = await resolveEntry(e);
    // as the window settles: build again every 2 s until two builds agree and every call the bodies make is traced (60 s at most)
    let run: Run | null = null, last = '';
    for (const end = Date.now() + 60000; Date.now() < end;) {
      const g = await buildFlow(job.root, undefined, [start]);
      run = await buildRun(g.lanes[0].start);
      const sig = JSON.stringify(run.rows.map((r) => r.key));
      if (sig === last && !run.unlisted?.length) break;
      last = sig;
      await sleep(2000);
    }
    // what clang says about the run's files with this setting: an #error means it doesn't build so
    await sleep(1500);
    const files = [...new Set(run!.rows.filter((r) => r.kind === 'step').map((r) => r.file))];
    const errors = files.flatMap((f) => diagnosticsFor(f).filter((d) => d.severity === 1).map((d) => ({ file: f, line: d.range.start.line, message: d.message })));
    // each function's lines, for what a change does (how many lines of it differ)
    let texts: Record<string, string[]> | undefined;
    if (job.texts) {
      const read = new Map<string, string>();
      for (const f of files) read.set(f, (await api.fs.read(f).catch(() => '')) as string);
      texts = functionTexts(run!, (f) => read.get(f) ?? null);
    }
    await api.setting.done({ ok: true, run, errors, texts });
  } catch (err) {
    await api.setting.done({ ok: false, message: String((err as Error)?.message ?? err) });
  }
}
