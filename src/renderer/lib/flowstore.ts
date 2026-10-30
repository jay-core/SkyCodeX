// What the flow page's two views share: the graph, the run of the chosen entry point, the walk through it, and which
// view shows. Kept outside the components so switching views (Tab) keeps everything, the selected step included.
import { createSignal } from 'solid-js';
import { buildFlow, buildRun, FlowGraph } from './flow';
import { root, files, states } from './store';
import { api } from './api';
import { lspState } from './lsp';
import { buildSeq, startState, move, Move, Seq, StepState } from '../../shared/flowseq';
import { t } from './i18n';

export type FlowView = 'sequence' | 'boxes';
const stored = (() => { try { return localStorage.getItem('flow.view') === 'boxes' ? 'boxes' : 'sequence'; } catch { return 'sequence'; } })();
export const [flowView, setFlowViewRaw] = createSignal<FlowView>(stored);
export function setFlowView(v: FlowView) { setFlowViewRaw(v); try { localStorage.setItem('flow.view', v); } catch { /* kept for this run */ } }

export const [graph, setGraph] = createSignal<FlowGraph | null>(null);
export const [status, setStatus] = createSignal('');
export const [lane, setLaneRaw] = createSignal(0);
export const [seq, setSeq] = createSignal<Seq | null>(null);
export const [trail, setTrail] = createSignal<StepState[]>([]);
export const [runStatus, setRunStatus] = createSignal('');

let builtFor = '', firstBuild = 0, building: Promise<void> | null = null, again = false;

/** Builds the graph (and the run of the current entry point). Calls made while one is running wait for it, then run once more. */
export async function rebuild(): Promise<void> {
  if (!root() || lspState() !== 'ready') return;
  if (building) { again = true; return building; }
  building = (async () => {
    if (builtFor !== root()) { firstBuild = Date.now(); setLaneRaw(0); setSeq(null); setTrail([]); }
    builtFor = root();
    setStatus(t('tracing calls from main…'));
    const g = await buildFlow(root(), (n) => setStatus(`tracing calls from main… ${n} functions`));
    setGraph(g);
    const files = g.boxes.filter((b) => !b.dead).length, stop = g.truncated ? ` · stopped at ${g.limit} functions` : '';
    setStatus(g.note || (g.library
      ? `from the public API (${g.library} functions) · ${g.fns.length} functions reached · ${files} files${stop}`
      : `${g.entries.length > 1 ? `${g.entries.length} entry points · ` : ''}${g.fns.length} functions · ${files} files${stop}`));
    await buildLaneRun();
    // clangd may still be loading its index: rebuild until every call resolves to a definition (30 s at most)
    if (g.unresolved && Date.now() - firstBuild < 30000) setTimeout(rebuild, 2000);
  })();
  try { await building; } finally { building = null; }
  if (again) { again = false; await rebuild(); }
}
export function ensureBuilt() { if (builtFor !== root() || !graph()) rebuild(); }

/** The run of the chosen entry point. A rebuild keeps the place in the walk when the same rows come back. */
async function buildLaneRun() {
  const g = graph(), l = g?.lanes[lane()];
  if (!g || !l) { setSeq(null); setTrail([]); return; }
  setRunStatus(t('reading each function…'));
  const run = await buildRun(l.start, (d, n) => setRunStatus(`reading each function… ${d} of ${n}`));
  const s = buildSeq(run);
  const old = seq(), keep = old && old.items.length === s.items.length && old.run.rows.every((r, i) => r.key === run.rows[i]?.key);
  setSeq(s);
  if (!keep) setTrail([startState(s)]);
  setRunStatus('');
}
export async function setLane(i: number) {
  if (i === lane()) return;
  setLaneRaw(i);
  setSeq(null);
  setTrail([]);
  await buildLaneRun();
}

/** One move along the run, for either view: the new place, or a note saying why it can't be made here. */
export function stepMove(m: Move): { state?: StepState; note?: string } {
  const s = seq();
  if (!s || !trail().length) return {};
  const r = move(s, trail(), m);
  if (r.note) return { note: r.note };
  setTrail(r.trail);
  return { state: r.trail[r.trail.length - 1] };
}

// ---------- the change ripple: functions of the run edited and not yet saved ----------
/** Step rows whose function's code in an unsaved buffer differs from the file on disk. */
export const [changed, setChanged] = createSignal<Set<number>>(new Set());
let changedGen = 0;
export async function refreshChanged() {
  const s = seq(), g = ++changedGen;
  if (!s) { setChanged(new Set<number>()); return; }
  const out = new Set<number>();
  for (const f of files.list) {
    if (!f.dirty || !states.has(f.path)) continue;
    const buf = states.get(f.path)!.doc.toString().split('\n');
    const disk = ((await api.fs.read(f.path).catch(() => '')) as string).split('\n');
    if (g !== changedGen) return;
    // the edited region: everything between the lines that still match from the top and from the bottom
    let p = 0, q = 0;
    while (p < buf.length && p < disk.length && buf[p] === disk[p]) p++;
    while (q < buf.length - p && q < disk.length - p && buf[buf.length - 1 - q] === disk[disk.length - 1 - q]) q++;
    const a = p, b = Math.max(p, buf.length - q);   // buffer lines [a, b) changed (an empty range is a pure deletion at a)
    s.run.rows.forEach((r, i) => {
      if (r.kind !== 'step' || r.file !== f.path) return;
      const end = r.start + Math.max(1, r.lines);
      if (r.start < Math.max(b, a + 1) && end > a) out.add(i);
    });
  }
  if (g === changedGen) setChanged(out);
}

// ---------- the magnifier (both views): off, or how much larger the lens shows ----------
const storedMag = (() => { try { const v = Number(localStorage.getItem('flow.magnify')); return v >= 1.5 && v <= 4 ? v : 0; } catch { return 0; } })();
const lastMag = (() => { try { const v = Number(localStorage.getItem('flow.magnify.last')); return v >= 1.5 && v <= 4 ? v : 2; } catch { return 2; } })();
export const [magnify, setMagnifyRaw] = createSignal(storedMag);
let magStrength = storedMag || lastMag;
export function setMagnify(z: number) {
  setMagnifyRaw(z);
  if (z) magStrength = z;
  try { localStorage.setItem('flow.magnify', String(z)); if (z) localStorage.setItem('flow.magnify.last', String(z)); } catch { /* kept for this run */ }
}
export const toggleMagnify = () => setMagnify(magnify() ? 0 : magStrength);
/** One step stronger or weaker: 1.5×, 2×, 3×, 4×. */
export function stepMagnify(dir: 1 | -1) {
  const steps = [1.5, 2, 3, 4], i = steps.indexOf(magnify() || magStrength);
  setMagnify(steps[Math.max(0, Math.min(steps.length - 1, (i < 0 ? 1 : i) + dir))]);
}
