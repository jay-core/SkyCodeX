import { createSignal } from 'solid-js';
import { buildFlow, buildRun, findEntries, resolveEntry, entryKey, FlowGraph, Entry } from './flow';
import { MAX_RUN_DEPTH, type Run } from '../../shared/flowrun';
import type { Hit } from '../../shared/flowwatch';
import { rankEntries } from '../../shared/entries';
import { root, files, states } from './store';
import { api } from './api';
import { lspState, indexEpoch, indexing, projectRoot } from './lsp';
import { buildSeq, startState, move, Move, Seq, StepState } from '../../shared/flowseq';
import { alignRuns, alignChange, functionTexts, Side } from '../../shared/flowalign';
import { t } from './i18n';
import { syncSeqTexts } from './seqtext';

export type FlowView = 'metro' | 'grid';
export const [waysOut, setWaysOut] = createSignal(false);
export const earlyExits = (run: Run, row: number) => { const r = run.rows[row]; return r?.kind === 'step' ? (run.exits?.[r.key] ?? []).filter((x) => x.early) : []; };
export const [followed, setFollowed] = createSignal<{ label: string; hits: Hit[] } | null>(null);
export const hitWords = (h: Hit) => h.how === 'set' ? (h.copy ? `▲ sets its copy ${h.as}` : `▲ sets ${h.as}`) : h.how === 'read' ? `▽ reads ${h.as}` : h.how === 'passed' ? `→ ${h.from} passed on as ${h.as}${h.copy ? ' · a copy' : ''}` : `↩ returns ${h.as}`;
export const leavingCount = (run: Run) => Object.values(run.exits ?? {}).filter((xs) => xs.some((x) => x.early)).length;
const stored = ((): FlowView => { try { const v = localStorage.getItem('flow.view'); return v === 'grid' || v === 'boxes' ? 'grid' : 'metro'; } catch { return 'metro'; } })();
export const [flowView, setFlowViewRaw] = createSignal<FlowView>(stored);
export function setFlowView(v: FlowView) { setFlowViewRaw(v); try { localStorage.setItem('flow.view', v); } catch {  } }

export const [graph, setGraph] = createSignal<FlowGraph | null>(null);
export const [status, setStatus] = createSignal('');
export const [entries, setEntries] = createSignal<Entry[]>([]);
export const [lane, setLaneRaw] = createSignal(0);
export const [seq, setSeq] = createSignal<Seq | null>(null);
export const [trail, setTrail] = createSignal<StepState[]>([]);
export const [walkSpeed, setWalkSpeed] = createSignal(0);
export const [runStatus, setRunStatus] = createSignal('');
export const entryStart = () => graph()?.lanes[0]?.start ?? '';
export const [programs, setPrograms] = createSignal(true);
export const isChosen = (i: number) => { const e = entries()[i]; return !!chosen && !!e && entryKey(e) === chosen; };

let builtFor = '', firstBuild = 0, building: Promise<void> | null = null, again = false;
let builtEpoch = -1;
let chosen = '';
const chosenKey = () => `flow.entry:${root()}`;

let side: Promise<unknown> | null = null;
export async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  while (building) await building.catch(() => {});
  const p = fn();
  side = p;
  try { return await p; } finally { if (side === p) side = null; }
}

export async function rebuild(): Promise<void> {
  if (!root() || lspState() !== 'ready' || projectRoot() !== root()) return;
  while (side) await side.catch(() => {});
  if (building) { again = true; return building; }
  building = (async () => { try {
    if (builtFor !== root()) {
      firstBuild = Date.now(); setPrograms(true); setLaneRaw(0); setSeq(null); setTrail([]); setEntries([]); setGraph(null);
      try { chosen = localStorage.getItem(chosenKey()) ?? ''; } catch { chosen = ''; }
      dropKept(); live = null; clearSetting(); clearCompare();
      await showKept();
    }
    builtFor = root();
    builtEpoch = indexEpoch();
    const fp = api.flow.fingerprint(root()), from = chosen, refining = !!graph();
    say(refining ? 'refining as clangd indexes…' : t('finding entry points…'));
    const found = rankEntries(await findEntries(root()));
    const i = Math.max(0, found.findIndex((e) => entryKey(e) === chosen));
    if (!held) { if (!sameJson(found, entries())) setEntries(found); setLaneRaw(i); }
    const e = found[i];
    const start = e ? await resolveEntry(e) : null;
    const what = e ? `${e.name === 'main' ? '' : `${e.name} in `}${e.label}` : 'the public API';
    say(refining ? 'refining as clangd indexes…' : `tracing calls from ${what}…`);
    const g = await buildFlow(root(), (n) => say(refining ? `refining as clangd indexes… · ${n} functions` : `tracing calls from ${what}… ${n} functions`), start ? [start] : []);
    live = { g, run: null, entries: found, lane: i, fp: await fp, chosen: from };
    if (!held) { if (!sameGraph(g, graph())) setGraph(g); setStatus(statusOf(g)); }
    await buildLaneRun(g);
    const missing = live?.run?.unlisted ?? [];
    if (missing.length && !settlingNow() && `${signature(g)}~${missing.join()}` !== stuck) void rebuildSettled();
    if (g.unresolved && Date.now() - firstBuild < 30000) { clearTimeout(retryTimer); retryTimer = window.setTimeout(() => { retryTimer = 0; void rebuild(); }, 2000); }
  } catch (e) {
    const why = String((e as Error)?.message ?? e).split('\n')[0];
    setRunStatus('');
    if (held) { clearTimeout(holdTimer); setStatus(`${statusOf(held.graph)} · as last time · could not check it: ${why}`); }
    else setStatus(`could not build the flow: ${why}`);
    void api.log(`flow build: ${String((e as Error)?.stack ?? e)}`);
  } })();
  try { await building; } finally { building = null; }
  if (again) { again = false; await rebuild(); }
  void checkpoint();
}
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const sameGraph = (a: FlowGraph | null, b: FlowGraph | null) => !!a && !!b && sameJson({ ...a, ms: 0 }, { ...b, ms: 0 });
function statusOf(g: FlowGraph): string {
  const files = g.boxes.filter((b) => !b.dead).length, stop = g.truncated ? ` · stopped at ${g.limit} functions` : '';
  return g.note || (g.library
    ? `from the public API (${g.library} functions) · ${g.fns.length} functions reached · ${files} files${stop}`
    : `${g.fns.length} functions · ${files} files${stop}`);
}
const say = (text: string) => { if (!held) setStatus(text); };
let retryTimer = 0;

declare const __ANALYSER__: string;
interface Kept { analyser: string; fp: string; entries: Entry[]; lane: number; graph: FlowGraph; run: Run }
let live: { g: FlowGraph; run: Run | null; entries: Entry[]; lane: number; fp: string; chosen: string } | null = null;
let held: Kept | null = null;
let holdTimer = 0, keptText = '';
const unsaved = () => files.list.some((f) => f.dirty);
const samePicture = (a: { entries: Entry[]; lane: number; graph: FlowGraph; run: Run }, b: { entries: Entry[]; lane: number; graph: FlowGraph; run: Run }) =>
  a.lane === b.lane && sameJson(a.entries, b.entries) && sameGraph(a.graph, b.graph) && sameJson(a.run, b.run);

async function showKept() {
  const r = root();
  if (unsaved()) return;
  const text = await api.flow.kept(r, chosen).catch(() => null);
  if (!text || r !== root()) return;
  let k: Kept;
  try { k = JSON.parse(text); } catch { return; }
  if (k.analyser !== __ANALYSER__ || !k.fp || k.fp !== await api.flow.fingerprint(r).catch(() => '') || r !== root() || unsaved()) return;
  const s = buildSeq(k.run);
  setEntries(k.entries); setLaneRaw(k.lane); setGraph(k.graph); setSeq(s); setTrail([startState(s)]);
  setStatus(`${statusOf(k.graph)} · ${t('as last time, checking…')}`);
  held = k; keptText = text;
  holdTimer = window.setTimeout(() => releaseKept(true), 120000);
}
function releaseKept(publish: boolean) {
  const k = held;
  if (!k) return;
  held = null; clearTimeout(holdTimer);
  if (!publish || !live) return;
  setStatus(statusOf(live.g));
  if (live.run && samePicture({ ...live, graph: live.g, run: live.run }, k)) return;
  setEntries(live.entries); setLaneRaw(live.lane); setGraph(live.g);
  if (live.run) showRun(live.run); else { setSeq(null); setTrail([]); }
}
export const dropKept = () => releaseKept(false);
async function checkpoint() {
  if (held && live?.run && samePicture({ ...live, graph: live.g, run: live.run }, held)) releaseKept(true);
  if (building || settlingNow() || retryTimer || indexing() || !live?.run) return;
  if (held) releaseKept(true);
  const r = root(), l = live;
  if (!l.fp || unsaved() || r !== builtFor) return;
  if (await api.flow.fingerprint(r).catch(() => '') !== l.fp || live !== l || unsaved()) return;
  const text = JSON.stringify({ analyser: __ANALYSER__, fp: l.fp, entries: l.entries, lane: l.lane, graph: l.g, run: l.run! } satisfies Kept);
  if (text === keptText) return;
  keptText = text;
  await api.flow.keep(r, l.chosen, text);
}
const signature = (g: FlowGraph | null) => (g ? `${g.fns.map((f) => f.key).sort().join('|')}#${g.edges.map((e) => `${e.from}>${e.to}`).sort().join('|')}` : '');
let settling = 0;
let stuck = '';
export const [settlingNow, setSettlingNow] = createSignal(false);
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
      if (signature(live?.g ?? null) === before && !live?.run?.unlisted?.length) return;
    }
    if (mine === settling) stuck = `${signature(live?.g ?? null)}~${(live?.run?.unlisted ?? []).join()}`;
  } finally { if (mine === settling) { setSettlingNow(false); void checkpoint(); } }
}
export function ensureBuilt() { if (builtFor !== root() || !graph()) rebuild(); else if (builtEpoch !== indexEpoch()) rebuildSettled(); }

async function buildLaneRun(g: FlowGraph) {
  const l = g.lanes[0];
  if (!l) { if (!held) { setSeq(null); setTrail([]); } return; }
  if (!held) setRunStatus(t('reading each function…'));
  const run = await buildRun(l.start, (d, n) => { if (!held) setRunStatus(`reading each function… ${d} of ${n}`); });
  if (live?.g === g) live.run = run;
  if (!held) showRun(run);
  setRunStatus('');
  if (run.deep?.length && !held) setStatus(`${statusOf(g)} · ${run.deep.length} function${run.deep.length > 1 ? 's' : ''} called more than ${MAX_RUN_DEPTH} levels down not followed`);
}
export interface Setting { label: string; flags: string[]; folder?: string; state: 'reading' | 'ready' | 'failed'; note: string; run?: Run; base?: string }
export const [setting, setSettingRaw] = createSignal<Setting | null>(null);
let settingFor = '';
api.setting.onDone((r: { ok: boolean; run?: Run; errors?: { file: string; line: number; message: string }[]; message?: string }) => {
  const s = setting();
  if (!s || s.state !== 'reading') return;
  if (!r.ok || !r.run) { setSettingRaw({ ...s, state: 'failed', note: r.message ?? 'could not read the code with this setting' }); return; }
  const stop = (r.errors ?? []).find((x) => /^#error\b|^"?#error/.test(x.message) || /\berror directive\b/i.test(x.message));
  if (stop) { setSettingRaw({ ...s, state: 'failed', note: `doesn't build with ${s.label}: ${stop.message} · ${stop.file.replace(/^.*[\\/]/, '')}:${stop.line + 1}` }); return; }
  const n = (r.errors ?? []).length;
  setSettingRaw({ ...s, state: 'ready', run: r.run, base: JSON.stringify(live?.run ?? null), note: n ? `${n} error${n > 1 ? 's' : ''} in these files with ${s.label} (clang read past them)` : '' });
  if (live?.run) showRun(live.run);
});
export async function chooseSetting(c: { label: string; flags: string[]; folder?: string } | null) {
  if (!c) { clearSetting(); if (live?.run) showRun(live.run); return; }
  clearCompare();
  if (unsaved()) { setSettingRaw({ ...c, state: 'failed', note: 'save your edits first: another setting reads the files on disk' }); return; }
  const start = entryStart();
  setSettingRaw({ ...c, state: 'reading', note: `reading the code with ${c.label}…` });
  settingFor = `${root()}|${start}`;
  const r = await api.setting.start({ root: root(), entry: start, flags: c.flags, folder: c.folder, label: c.label });
  if (!r.ok && setting()?.label === c.label) setSettingRaw({ ...c, state: 'failed', note: r.message ?? 'could not start' });
}
function clearSetting() { if (setting()) { setSettingRaw(null); void api.setting.stop(); } settingFor = ''; }

export interface Compare { older: string; newer: string; olderLabel: string; newerLabel: string; state: 'reading' | 'ready' | 'failed'; note: string; summary?: string; old?: Side; new?: Side; work?: { base: string; texts: Record<string, string[]> } }
export const [comparing, setComparingRaw] = createSignal<Compare | null>(null);
let compareFor = '', workReading = false;
api.change.onDone((r: { ok: boolean; message?: string; older?: { run: Run; root: string; texts: Record<string, string[]> }; newer?: { run: Run; root: string; texts: Record<string, string[]> } | null }) => {
  const c = comparing();
  if (!c || c.state !== 'reading') return;
  if (!r.ok || !r.older) { setComparingRaw({ ...c, state: 'failed', note: r.message ?? 'could not read the older version' }); return; }
  setComparingRaw({ ...c, state: 'ready', note: '', old: r.older, new: r.newer ?? undefined });
  if (live?.run) showRun(live.run);
});
export async function chooseCompare(c: { older: string; newer: string; olderLabel: string; newerLabel: string } | null) {
  clearCompare();
  if (!c) { if (live?.run) showRun(live.run); return; }
  clearSetting();
  const e = entries()[lane()];
  if (unsaved()) { setComparingRaw({ ...c, state: 'failed', note: 'save your edits first: a comparison reads the files on disk' }); return; }
  if (!e) { setComparingRaw({ ...c, state: 'failed', note: 'no entry point to compare' }); return; }
  setComparingRaw({ ...c, state: 'reading', note: `reading ${c.olderLabel}${c.newer === 'work' ? '' : ` and ${c.newerLabel}`}…` });
  compareFor = `${root()}|${entryStart()}`;
  if (live?.run) showRun(live.run);
  const r = await api.change.start({ root: root(), entryRel: e.rel.replace(/\\/g, '/'), entryName: e.name, ...c });
  if (!r.ok && comparing()?.state === 'reading') setComparingRaw({ ...comparing()!, state: 'failed', note: r.message ?? 'could not start' });
}
function clearCompare() { if (comparing()) { setComparingRaw(null); void api.setting.stop(); } compareFor = ''; }
async function readWork(run: Run) {
  if (workReading) return;
  workReading = true;
  try {
    const text = new Map<string, string>();
    for (const f of new Set(run.rows.filter((r) => r.kind === 'step').map((r) => r.file))) text.set(f, (await api.fs.read(f).catch(() => '')) as string);
    const c = comparing();
    if (!c || c.state !== 'ready') return;
    setComparingRaw({ ...c, work: { base: JSON.stringify(run), texts: functionTexts(run, (f) => text.get(f) ?? null) } });
  } finally { workReading = false; }
  if (live?.run) showRun(live.run);
}
function comparedRun(run: Run): Run {
  const c = comparing();
  if (!c || c.state !== 'ready' || !c.old) return run;
  if (compareFor !== `${root()}|${entryStart()}`) { setComparingRaw({ ...c, state: 'failed', note: 'the entry point changed · choose the comparison again' }); return run; }
  let newer: Side;
  if (c.newer === 'work') {
    if (unsaved()) return run;
    if (c.work?.base !== JSON.stringify(run)) { void readWork(run); return run; }
    newer = { run, root: root(), texts: c.work.texts };
  } else if (c.new) newer = c.new; else return run;
  const m = alignChange(newer, c.old, c.olderLabel);
  if (m.summary !== c.summary) setComparingRaw({ ...c, summary: m.summary });
  return m.run;
}

function shownRun(run: Run): Run {
  try { return linedUp(run); } catch (e) {
    const why = `could not line the runs up: ${String((e as Error)?.message ?? e).split('\n')[0]}`;
    void api.log(`flow align: ${String((e as Error)?.stack ?? e)}`);
    const c = comparing(), s = setting();
    if (c) setComparingRaw({ ...c, state: 'failed', note: why });
    else if (s) setSettingRaw({ ...s, state: 'failed', run: undefined, note: why });
    return run;
  }
}
function linedUp(run: Run): Run {
  if (comparing()) return comparedRun(run);
  const s = setting();
  if (!s || s.state !== 'ready' || !s.run) return run;
  if (settingFor !== `${root()}|${entryStart()}` || s.base !== JSON.stringify(run) || unsaved()) {
    setSettingRaw({ ...s, state: 'failed', run: undefined, note: 'the code changed since this setting was read · choose it again' });
    return run;
  }
  return alignRuns(s.run, run, `only with ${s.label}`, 'only as built').run;
}

function showRun(run0: Run) {
  const run = shownRun(run0);
  if (sameJson(run, seq()?.run)) return;
  syncSeqTexts(new Set(run.rows.map((r) => r.file).filter(Boolean)));
  setFollowed(null);
  const s = buildSeq(run);
  const old = seq(), keep = old && old.items.length === s.items.length && old.run.rows.every((r, i) => r.key === run.rows[i]?.key);
  setSeq(s);
  if (!keep) setTrail(placeIn(old, s));
}
function placeIn(old: Seq | null, s: Seq): StepState[] {
  const start = [startState(s)], c = trail()[trail().length - 1];
  if (!old || !c || c.at <= 0 || c.at >= old.items.length) return start;
  const key = old.run.rows[old.items[c.at]].key;
  if (!key) return start;
  let nth = 0;
  for (let i = 0; i < c.at; i++) if (old.run.rows[old.items[i]].key === key) nth++;
  for (let j = 0, seen = 0; j < s.items.length; j++) {
    if (s.run.rows[s.items[j]].key !== key || seen++ !== nth) continue;
    const r = move(s, start, { jump: j });
    return r.trail && !r.note ? r.trail : start;
  }
  return start;
}
export async function setLane(i: number) {
  const e = entries()[i];
  if (!e || i === lane() && seq()) return;
  chosen = entryKey(e);
  try { localStorage.setItem(chosenKey(), chosen); } catch {  }
  dropKept();
  clearSetting(); clearCompare();
  setLaneRaw(i);
  setSeq(null);
  setTrail([]);
  setGraph(null);
  await rebuild();
}

export function stepMove(m: Move): { state?: StepState; note?: string } {
  const s = seq();
  if (!s || !trail().length) return {};
  const r = move(s, trail(), m);
  if (r.note) return { note: r.note };
  setTrail(r.trail);
  return { state: r.trail[r.trail.length - 1] };
}

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
    let p = 0, q = 0;
    while (p < buf.length && p < disk.length && buf[p] === disk[p]) p++;
    while (q < buf.length - p && q < disk.length - p && buf[buf.length - 1 - q] === disk[disk.length - 1 - q]) q++;
    const a = p, b = Math.max(p, buf.length - q);
    s.run.rows.forEach((r, i) => {
      if (r.kind !== 'step' || r.file !== f.path) return;
      const end = r.start + Math.max(1, r.lines);
      if (r.start < Math.max(b, a + 1) && end > a) out.add(i);
    });
  }
  if (g === changedGen) setChanged(out);
}

const storedMag = (() => { try { const v = Number(localStorage.getItem('flow.magnify')); return v >= 1.5 && v <= 4 ? v : 0; } catch { return 0; } })();
const lastMag = (() => { try { const v = Number(localStorage.getItem('flow.magnify.last')); return v >= 1.5 && v <= 4 ? v : 2; } catch { return 2; } })();
export const [magnify, setMagnifyRaw] = createSignal(storedMag);
let magStrength = storedMag || lastMag;
export function setMagnify(z: number) {
  setMagnifyRaw(z);
  if (z) magStrength = z;
  try { localStorage.setItem('flow.magnify', String(z)); if (z) localStorage.setItem('flow.magnify.last', String(z)); } catch {  }
}
export const toggleMagnify = () => setMagnify(magnify() ? 0 : magStrength);
export function stepMagnify(dir: 1 | -1) {
  const steps = [1.5, 2, 3, 4], i = steps.indexOf(magnify() || magStrength);
  setMagnify(steps[Math.max(0, Math.min(steps.length - 1, (i < 0 ? 1 : i) + dir))]);
}
