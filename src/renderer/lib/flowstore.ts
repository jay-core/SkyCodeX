// What the flow page's two views share: the graph, the run of the chosen entry point, the walk through it, and which
// view shows. Kept outside the components so switching views (Tab) keeps everything, the selected step included.
import { createSignal } from 'solid-js';
import { buildFlow, buildRun, findEntries, resolveEntry, entryKey, FlowGraph, Entry } from './flow';
import type { Run } from '../../shared/flowrun';
import type { Hit } from '../../shared/flowwatch';
import { rankEntries } from '../../shared/entries';
import { root, files, states } from './store';
import { api } from './api';
import { lspState, indexEpoch, indexing, projectRoot } from './lsp';
import { buildSeq, startState, move, Move, Seq, StepState } from '../../shared/flowseq';
import { t } from './i18n';

export type FlowView = 'sequence' | 'boxes';
/** Ways out (E, both views): the usual path dims and every early return, throw, goto and call that never returns lights. */
export const [waysOut, setWaysOut] = createSignal(false);
/** A step's early ways out (src/shared/flowrun.ts exitsOf); none for other rows. */
export const earlyExits = (run: Run, row: number) => { const r = run.rows[row]; return r?.kind === 'step' ? (run.exits?.[r.key] ?? []).filter((x) => x.early) : []; };
/** A value followed (W: watch a variable · V: a value's journey from a step), in both views: what, and its hits. */
export const [followed, setFollowed] = createSignal<{ label: string; hits: Hit[] } | null>(null);
/** One hit as the views word it. */
export const hitWords = (h: Hit) => h.how === 'set' ? (h.copy ? `▲ sets its copy ${h.as}` : `▲ sets ${h.as}`) : h.how === 'read' ? `▽ reads ${h.as}` : h.how === 'passed' ? `→ ${h.from} passed on as ${h.as}${h.copy ? ' · a copy' : ''}` : `↩ returns ${h.as}`;
/** How many functions of a run can leave early. */
export const leavingCount = (run: Run) => Object.values(run.exits ?? {}).filter((xs) => xs.some((x) => x.early)).length;
const stored = (() => { try { return localStorage.getItem('flow.view') === 'boxes' ? 'boxes' : 'sequence'; } catch { return 'sequence'; } })();
export const [flowView, setFlowViewRaw] = createSignal<FlowView>(stored);
export function setFlowView(v: FlowView) { setFlowViewRaw(v); try { localStorage.setItem('flow.view', v); } catch { /* kept for this run */ } }

export const [graph, setGraph] = createSignal<FlowGraph | null>(null);
export const [status, setStatus] = createSignal('');
/** The project's entry points (its mains), best first; lane is the one shown. */
export const [entries, setEntries] = createSignal<Entry[]>([]);
export const [lane, setLaneRaw] = createSignal(0);
export const [seq, setSeq] = createSignal<Seq | null>(null);
export const [trail, setTrail] = createSignal<StepState[]>([]);
export const [runStatus, setRunStatus] = createSignal('');
/** The start key of the run shown (a function's uri#line), for links and what is kept per start. */
export const entryStart = () => graph()?.lanes[0]?.start ?? '';
/** Whether the flow page shows the list of every program (a project with several mains opens on it). */
export const [programs, setPrograms] = createSignal(true);
/** Whether entry e is the one picked last time in this folder. */
export const isChosen = (i: number) => { const e = entries()[i]; return !!chosen && !!e && entryKey(e) === chosen; };

let builtFor = '', firstBuild = 0, building: Promise<void> | null = null, again = false;
/** The clangd index the graph was traced with: once clangd finishes indexing, calls into other files resolve, so the page rebuilds. */
let builtEpoch = -1;
/** The entry chosen in this folder (kept between sessions), by its key. */
let chosen = '';
const chosenKey = () => `flow.entry:${root()}`;

/**
 * Finds the entry points (text only), then traces and runs only the one chosen — the one picked last time in this
 * folder, else the best ranked — so a project with hundreds of mains shows its first picture in seconds. Calls made
 * while one is running wait for it, then run once more.
 */
/** Work that traces other programs (how they connect) runs on its own: a rebuild waits for it, and it for a rebuild. */
let side: Promise<unknown> | null = null;
export async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  while (building) await building.catch(() => {});
  const p = fn();
  side = p;
  try { return await p; } finally { if (side === p) side = null; }
}

export async function rebuild(): Promise<void> {
  // clangd must be running for this folder: just after another is opened, it is still the previous folder's
  if (!root() || lspState() !== 'ready' || projectRoot() !== root()) return;
  while (side) await side.catch(() => {});
  if (building) { again = true; return building; }
  building = (async () => {
    if (builtFor !== root()) {
      firstBuild = Date.now(); setPrograms(true); setLaneRaw(0); setSeq(null); setTrail([]); setEntries([]); setGraph(null);
      try { chosen = localStorage.getItem(chosenKey()) ?? ''; } catch { chosen = ''; }
      dropKept(); live = null;
      await showKept();
    }
    builtFor = root();
    builtEpoch = indexEpoch();
    const fp = api.flow.fingerprint(root()), from = chosen;
    say(t('finding entry points…'));
    const found = rankEntries(await findEntries(root()));
    const i = Math.max(0, found.findIndex((e) => entryKey(e) === chosen));
    if (!held) { if (!sameJson(found, entries())) setEntries(found); setLaneRaw(i); }
    const e = found[i];
    const start = e ? await resolveEntry(e) : null;
    const what = e ? `${e.name === 'main' ? '' : `${e.name} in `}${e.label}` : 'the public API';
    say(`tracing calls from ${what}…`);
    const g = await buildFlow(root(), (n) => say(`tracing calls from ${what}… ${n} functions`), start ? [start] : []);
    live = { g, run: null, entries: found, lane: i, fp: await fp, chosen: from };
    // the same graph as on screen (a rebuild while clangd settles): the one on screen stays, so nothing is drawn again
    if (!held) { if (!sameGraph(g, graph())) setGraph(g); setStatus(statusOf(g)); }
    await buildLaneRun(g);
    // a body calls one of the project's functions the graph leaves out: clangd's index is still filling in, so settle
    // (once per graph: calls clangd never lists, e.g. made inside a macro, don't start it again)
    const missing = live?.run?.unlisted ?? [];
    if (missing.length && !settlingNow() && `${signature(g)}~${missing.join()}` !== stuck) void rebuildSettled();
    // clangd may still be loading its index: rebuild until every call resolves to a definition (30 s at most)
    if (g.unresolved && Date.now() - firstBuild < 30000) { clearTimeout(retryTimer); retryTimer = window.setTimeout(() => { retryTimer = 0; void rebuild(); }, 2000); }
  })();
  try { await building; } finally { building = null; }
  if (again) { again = false; await rebuild(); }
  void checkpoint();
}
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** The same graph, its build time aside. */
const sameGraph = (a: FlowGraph | null, b: FlowGraph | null) => !!a && !!b && sameJson({ ...a, ms: 0 }, { ...b, ms: 0 });
/** The status line for a traced graph. */
function statusOf(g: FlowGraph): string {
  const files = g.boxes.filter((b) => !b.dead).length, stop = g.truncated ? ` · stopped at ${g.limit} functions` : '';
  return g.note || (g.library
    ? `from the public API (${g.library} functions) · ${g.fns.length} functions reached · ${files} files${stop}`
    : `${g.fns.length} functions · ${files} files${stop}`);
}
/** A progress note; while a kept picture is shown, its own status line stays. */
const say = (text: string) => { if (!held) setStatus(text); };
let retryTimer = 0;

// ---------- the picture kept from last time ----------
// A folder opened again shows the picture its last settled build ended on at once, while the live build runs
// underneath. The live result replaces it as soon as it is the same (nothing on screen changes), or once the build
// has settled (clangd done, no retries pending), whatever it is — so what stays on screen is always a fresh build's.
// Kept only for code, compile database, clangd and analyser unchanged since (src/main/main.ts, flow:fingerprint).
declare const __ANALYSER__: string;
/** What a settled build ended on, kept per folder and per choice of entry point (state/flow-kept). */
interface Kept { analyser: string; fp: string; entries: Entry[]; lane: number; graph: FlowGraph; run: Run }
/** The live build's latest results: the same as on screen unless a kept picture is held. */
let live: { g: FlowGraph; run: Run | null; entries: Entry[]; lane: number; fp: string; chosen: string } | null = null;
/** The kept picture on screen while the live build checks it. */
let held: Kept | null = null;
let holdTimer = 0, keptText = '';
const unsaved = () => files.list.some((f) => f.dirty);
/** The same picture: entry points, graph (its build time aside) and run. */
const samePicture = (a: { entries: Entry[]; lane: number; graph: FlowGraph; run: Run }, b: { entries: Entry[]; lane: number; graph: FlowGraph; run: Run }) =>
  a.lane === b.lane && sameJson(a.entries, b.entries) && sameGraph(a.graph, b.graph) && sameJson(a.run, b.run);

async function showKept() {
  const r = root();
  if (unsaved()) return;   // unsaved edits were restored: the code on screen is not the code on disk
  const text = await api.flow.kept(r, chosen).catch(() => null);
  if (!text || r !== root()) return;
  let k: Kept;
  try { k = JSON.parse(text); } catch { return; }
  if (k.analyser !== __ANALYSER__ || !k.fp || k.fp !== await api.flow.fingerprint(r).catch(() => '') || r !== root() || unsaved()) return;
  const s = buildSeq(k.run);
  setEntries(k.entries); setLaneRaw(k.lane); setGraph(k.graph); setSeq(s); setTrail([startState(s)]);
  setStatus(`${statusOf(k.graph)} · ${t('as last time, checking…')}`);
  held = k; keptText = text;
  // a build that never settles (clangd stuck indexing) still shows its own result in the end
  holdTimer = window.setTimeout(() => releaseKept(true), 120000);
}
/** Stops showing the kept picture; with publish, the live build's latest result takes its place (unless it is the same). */
function releaseKept(publish: boolean) {
  const k = held;
  if (!k) return;
  held = null; clearTimeout(holdTimer);
  if (!publish || !live) return;
  setStatus(statusOf(live.g));
  if (live.run && samePicture({ ...live, graph: live.g, run: live.run }, k)) return;   // already on screen
  setEntries(live.entries); setLaneRaw(live.lane); setGraph(live.g);
  if (live.run) showRun(live.run); else { setSeq(null); setTrail([]); }
}
/** Drops the kept picture without showing anything else (another entry point chosen, a refresh, a new folder). */
export const dropKept = () => releaseKept(false);
/**
 * After each build: a held picture the live build now matches is released; when nothing more is coming (no build or
 * settle running, no retry pending, clangd not indexing) the live result is final — it replaces a held picture, and
 * is kept for next time.
 */
async function checkpoint() {
  if (held && live?.run && samePicture({ ...live, graph: live.g, run: live.run }, held)) releaseKept(true);
  if (building || settlingNow() || retryTimer || indexing() || !live?.run) return;
  if (held) releaseKept(true);
  const r = root(), l = live;
  if (!l.fp || unsaved() || r !== builtFor) return;
  if (await api.flow.fingerprint(r).catch(() => '') !== l.fp || live !== l || unsaved()) return;   // files changed while it was built
  const text = JSON.stringify({ analyser: __ANALYSER__, fp: l.fp, entries: l.entries, lane: l.lane, graph: l.g, run: l.run! } satisfies Kept);
  if (text === keptText) return;
  keptText = text;
  await api.flow.keep(r, l.chosen, text);
}
/** What a graph traced: its functions and calls. Two builds with the same signature traced the same program. */
const signature = (g: FlowGraph | null) => (g ? `${g.fns.map((f) => f.key).sort().join('|')}#${g.edges.map((e) => `${e.from}>${e.to}`).sort().join('|')}` : '');
let settling = 0;
/** The graph (and its unlisted calls) a settle gave up on: rebuilding can't complete it. */
let stuck = '';
/** Whether the page is still rebuilding after clangd finished indexing. */
export const [settlingNow, setSettlingNow] = createSignal(false);
/**
 * After clangd reports that indexing finished, its in-memory index is still being updated for a moment, so a build
 * right then can miss calls into other files. Rebuilds every 2 s until two builds in a row trace the same graph and
 * every call the function bodies make to the project's own functions is in it (60 s at most), so the page settles on
 * the complete one.
 */
export async function rebuildSettled(): Promise<void> {
  const mine = ++settling, until = Date.now() + 60000;
  setSettlingNow(true);
  try {
    await rebuild();
    while (mine === settling && Date.now() < until) {
      const before = signature(live?.g ?? null);
      await new Promise((r) => setTimeout(r, 2000));
      if (mine !== settling) return;
      await rebuild();
      // settled: the same graph twice, and no body calls a project function the graph leaves out
      if (signature(live?.g ?? null) === before && !live?.run?.unlisted?.length) return;
    }
    // gave up: remember this graph, so its unlisted calls don't start another settle
    if (mine === settling) stuck = `${signature(live?.g ?? null)}~${(live?.run?.unlisted ?? []).join()}`;
  } finally { if (mine === settling) { setSettlingNow(false); void checkpoint(); } }
}
/** Builds when the page opens, and again if clangd finished indexing while the page was closed (its calls into other files resolve only now). */
export function ensureBuilt() { if (builtFor !== root() || !graph()) rebuild(); else if (builtEpoch !== indexEpoch()) rebuildSettled(); }

/** The run of the chosen entry point. A rebuild keeps the place in the walk when the same rows come back. */
async function buildLaneRun(g: FlowGraph) {
  const l = g.lanes[0];
  if (!l) { if (!held) { setSeq(null); setTrail([]); } return; }
  if (!held) setRunStatus(t('reading each function…'));
  const run = await buildRun(l.start, (d, n) => { if (!held) setRunStatus(`reading each function… ${d} of ${n}`); });
  if (live?.g === g) live.run = run;
  if (!held) showRun(run);
  setRunStatus('');
}
function showRun(run: Run) {
  if (sameJson(run, seq()?.run)) return;   // the same run as on screen: nothing to draw again, the place in it stays
  setFollowed(null);   // its hits are numbered in the run it was followed on
  const s = buildSeq(run);
  const old = seq(), keep = old && old.items.length === s.items.length && old.run.rows.every((r, i) => r.key === run.rows[i]?.key);
  setSeq(s);
  if (!keep) setTrail([startState(s)]);
}
/** Shows another entry point: kept as this folder's choice, then traced and run. */
export async function setLane(i: number) {
  const e = entries()[i];
  if (!e || i === lane() && seq()) return;
  chosen = entryKey(e);
  try { localStorage.setItem(chosenKey(), chosen); } catch { /* kept for this run */ }
  dropKept();
  setLaneRaw(i);
  setSeq(null);
  setTrail([]);
  setGraph(null);
  await rebuild();
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
