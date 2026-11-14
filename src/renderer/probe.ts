import { api, fileToUri, normPath } from './lib/api';
import { definitionFiles } from './lib/flow';
import { root, setPage, settings, applySettings, problems, getMainView } from './lib/store';
import { lspState, indexing, ensureOpen } from './lib/lsp';
import { callResult } from '../shared/metrofacts';
import { passMode } from '../shared/gridlinks';
import { setFlowView, seq, trail, entries, setLane, setPrograms, runStatus, settlingNow, status, stepMove, followed, leavingCount, earlyExits } from './lib/flowstore';
import { lines } from './lib/seqtext';
import { stepNumbers, stepFacts, whatIf, ownFrames, chapters, findings, codeBlocks, layoutSeq, loopsAt, foldable, Seq, Detail } from '../shared/flowseq';
import { metroRow, detailCard } from '../shared/metrofacts';
import { stepLinks } from '../shared/gridlinks';
import { junctionsOf } from '../shared/junctions';
import { buildGrid, GridOrder } from '../shared/gridmodel';
import { watchable, watch, journey } from '../shared/flowwatch';
import { junctionNav, junctionPick } from './components/StepPreview';
import { auditSequence, auditGrid } from './smoke';

interface Rec { t: number; phase: string; what: string; ok: boolean; warn?: true; gap?: true; item?: number; ms?: number; detail?: string; shot?: string }

const GOLD = 'rgb(227, 214, 173)';
const ENTRY_CAP = 40, WALK_ENTRIES = 3, UI_CAP = 2000, WATCH_CAP = 60, JOURNEY_CAP = 300, JUNCTION_CAP = 80, SHOT_CAP = 12;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const frames = (n: number) => new Promise<void>((r) => { const f = (k: number) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); });
async function until(cond: () => boolean, ms: number) { const end = Date.now() + ms; while (!cond() && Date.now() < end) await sleep(200); return cond(); }
async function quiet(cond: () => boolean, hold: number, ms: number) {
  const end = Date.now() + ms;
  let since = cond() ? Date.now() : 0;
  while (Date.now() < end) { if (!cond()) since = 0; else if (!since) since = Date.now(); else if (Date.now() - since >= hold) return true; await sleep(100); }
  return false;
}
const rectOf = (e: Element) => e.getBoundingClientRect();
const cross = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
const short = (n: string) => n.replace(/^.*::(?=[^:]+$)/, '');

export async function probeCheck(report: Record<string, unknown>) {
  const t0 = performance.now(), now = () => Math.round(performance.now() - t0);
  const log: Rec[] = [];
  let shots = 0;
  const rec = (phase: string, what: string, ok: boolean, detail = '', item?: number, ms?: number, extra: Partial<Rec> = {}) => {
    const r: Rec = { t: now(), phase, what, ok, ...extra };
    if (item != null) r.item = item;
    if (ms != null) r.ms = Math.round(ms * 10) / 10;
    if (detail) r.detail = detail.slice(0, 600);
    log.push(r);
    return r;
  };
  const shoot = async (r: Rec) => { if (r.ok || shots >= SHOT_CAP) return; const name = `probe-fail-${++shots}`; await api.smoke.capture(name); r.shot = name; };
  const call = <T,>(phase: string, what: string, item: number | undefined, fn: () => T, check?: (v: T) => string): T | null => {
    const a = performance.now();
    try { const v = fn(); const bad = check ? check(v) : ''; rec(phase, what, !bad, bad, item, performance.now() - a); return v; }
    catch (e) { rec(phase, what, false, `threw: ${e instanceof Error ? `${e.message} ${e.stack?.split('\n')[1]?.trim() ?? ''}` : String(e)}`, item, performance.now() - a); return null; }
  };
  window.addEventListener('error', (e) => { rec('runtime', 'window error', false, `${e.message} · ${e.filename}:${e.lineno}`); });
  window.addEventListener('unhandledrejection', (e) => { rec('runtime', 'unhandled rejection', false, String(e.reason?.stack ?? e.reason)); });
  const cerr = console.error.bind(console), cwarn = console.warn.bind(console);
  console.error = (...a: unknown[]) => { rec('runtime', 'console.error', false, a.map(String).join(' ')); cerr(...a); };
  console.warn = (...a: unknown[]) => { rec('runtime', 'console.warn', true, a.map(String).join(' '), undefined, undefined, { warn: true }); cwarn(...a); };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { const ms = Math.round(e.duration); rec('perf', 'long task', ms < 250, `${ms} ms at ${Math.round(e.startTime - t0)} ms · step ${trail()[trail().length - 1]?.at ?? -1}`, trail()[trail().length - 1]?.at, ms, ms < 250 ? { warn: true } : {}); } }).observe({ type: 'longtask', buffered: false }); } catch { rec('perf', 'long task observer', false, 'not available'); }
  let lastLsp = '', lastStatus = '', lastIdx = '', idxLogged = 0;
  const watcher = setInterval(() => {
    const ix = indexing() ?? '';
    if (ix !== lastIdx && (ix === '' || Date.now() - idxLogged > 10000)) { rec('state', 'indexing', true, ix || 'done'); lastIdx = ix; idxLogged = Date.now(); }
    const l = lspState();
    if (l !== lastLsp) { rec('state', 'clangd', l !== 'failed', `${lastLsp || 'start'} → ${l}`); lastLsp = l; }
    const st = `${status()} | ${runStatus()}`;
    if (st !== lastStatus) { const bad = /could not|failed|timed out|error|crash/i.test(st); rec('state', 'status line', !bad, st); lastStatus = st; }
  }, 250);
  const snapshot = settings();
  const at = () => trail()[trail().length - 1]?.at ?? -1;
  const key = (sel: string, k: string, shiftKey = false) => (document.querySelector(sel) as HTMLElement | null)?.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true }));
  const settled = () => quiet(() => !!seq() && !settlingNow() && !runStatus() && !/…/.test(status()), 1500, 600000);
  const coverage: string[] = [];
  const gap = (what: string) => { coverage.push(what); rec('coverage', 'not checked', true, what, undefined, undefined, { gap: true }); };

  async function loadTexts(s: Seq) {
    const files = [...new Set(s.run.rows.map((r) => r.file).filter(Boolean))];
    for (const f of files) lines(f);
    const ok = await until(() => files.every((f) => lines(f) != null), 60000);
    const missing = files.filter((f) => lines(f) == null);
    rec('texts', 'source texts loaded', ok, ok ? `${files.length} files` : `${missing.length} of ${files.length} not readable: ${missing.slice(0, 8).join(', ')}`);
  }

  function pure(s: Seq, name: string) {
    const R = s.run.rows, N = s.items.length, get = (f: string) => lines(f);
    rec('run', `run of ${name}`, true, `${N} steps · ${R.length} rows · ${s.run.frames.length} frames · ${s.run.missing.length} missing · ${s.run.deep?.length ?? 0} too deep`);
    if (s.run.missing.length) rec('run', 'functions not found', true, s.run.missing.slice(0, 30).join(', '), undefined, undefined, { warn: true });
    if (s.run.deep?.length) rec('run', 'calls cut at the depth limit', true, s.run.deep.slice(0, 30).join(', '), undefined, undefined, { warn: true });
    const nums = call('analysis', 'stepNumbers', undefined, () => stepNumbers(s), (v) => (v.length === N ? '' : `${v.length} numbers for ${N} steps`)) ?? [];
    for (let it = 0; it < N; it++) {
      const row = s.items[it], r = R[row];
      call('analysis', 'metroRow', it, () => metroRow(s, it, nums, get), (m) => (r.caller != null && r.at && !m.callText ? `${short(r.name)}: no call text` : ''));
      call('analysis', 'detailCard', it, () => detailCard(s, it, null, it, nums, get), (c) => (c.head ? '' : `${short(r.name)}: empty card head`));
      call('analysis', 'stepFacts', it, () => stepFacts(s, it, {}), (f) => (Array.isArray(f) ? '' : 'not a list'));
      call('analysis', 'stepLinks', it, () => stepLinks(s, it, get), (l) => {
        const bad = l.links.find((x) => x.from < 0 || x.to < 0 || x.from >= N || x.to >= N || x.from === x.to || (x.kind !== 'call' && !x.label));
        if (bad) return `bad link ${JSON.stringify(bad)}`;
        const c = r.caller != null ? R[r.caller] : null;
        const d = l.decisions.find((x) => !c || x.file !== c.file || x.line < c.start || x.line > c.start + Math.max(1, c.lines) - 1);
        return d ? `decision outside ${c ? short(c.name) : 'any caller'}: ${JSON.stringify(d)}` : '';
      });
      call('analysis', 'earlyExits', it, () => earlyExits(s.run, row));
      for (const f of ownFrames(s.run, row)) if (s.span.get(f)?.[0] === it) call('analysis', 'whatIf', it, () => whatIf(s, f));
    }
    call('analysis', 'junctionsOf', undefined, () => junctionsOf(s, get), (js) => {
      for (const j of js) {
        const ow = R[j.ownerRow], end = ow.start + Math.max(1, ow.lines) - 1;
        if (s.items[j.owner] !== j.ownerRow) return `${j.id}: owner ${j.owner} is not its function's step`;
        if (j.after < j.owner || j.after > s.lastItem[j.owner]) return `${j.id}: placed after step ${j.after + 1}, outside ${short(ow.name)} (steps ${j.owner + 1}–${s.lastItem[j.owner] + 1})`;
        if (j.line < ow.start || j.line > end) return `${j.id}: line ${j.line + 1} outside ${short(ow.name)} (lines ${ow.start + 1}–${end + 1})`;
        if (!j.cond.trim()) return `${j.id}: no condition text`;
        if (j.steps < 0) return `${j.id}: ${j.steps} steps`;
        if (j.span && (j.span[0] <= j.owner || j.span[1] > s.lastItem[j.owner])) return `${j.id}: arm outside ${short(ow.name)}`;
        if (j.inFn < 1) return `${j.id}: counted ${j.inFn} junctions in its own function`;
      }
      return '';
    });
    for (const o of ['file', 'run', 'count'] as GridOrder[]) call('analysis', `buildGrid ${o}`, undefined, () => buildGrid(s, nums, o), (g) => {
      const n = [...g.cells.values()].reduce((a, v) => a + v.length, 0), want = s.items.filter((row) => R[row].caller != null).length;
      return n === want ? '' : `${n} calls in squares, ${want} steps with a caller`;
    });
    call('analysis', 'findings', undefined, () => findings(s.run));
    call('analysis', 'chapters', undefined, () => chapters(s));
    for (const d of ['calls', 'decisions', 'all'] as Detail[]) call('analysis', `codeBlocks ${d}`, undefined, () => codeBlocks(s, () => d, get));
    call('analysis', 'layoutSeq', undefined, () => layoutSeq(s, 0, { width: 1000, rowH: 23, slotH: 15, top: 50, boxH: 140, mode: 'metro' }), (g) => { for (let i = 1; i < g.y.length; i++) if (g.y[i] < g.y[i - 1]) return `y goes back at step ${i + 1}`; return ''; });
    const ws = call('analysis', 'watchable', undefined, () => watchable(s.run)) ?? [];
    for (const v of ws.slice(0, WATCH_CAP)) call('analysis', `watch ${v.owner ? `${short(v.owner)}::` : ''}${v.name}`, undefined, () => watch(s.run, v));
    if (ws.length > WATCH_CAP) gap(`${name}: watch for ${ws.length - WATCH_CAP} of ${ws.length} variables beyond the cap of ${WATCH_CAP}`);
    let jn = 0, jall = 0;
    R.forEach((r, row) => {
      if (r.kind !== 'step') return;
      for (const p of s.run.effects?.[r.key]?.params ?? []) { jall++; if (jn < JOURNEY_CAP) { jn++; call('analysis', 'journey', s.itemOf[row], () => journey(s.run, row, p.name)); } }
    });
    if (jall > JOURNEY_CAP) gap(`${name}: journey for ${jall - JOURNEY_CAP} of ${jall} parameters beyond the cap of ${JOURNEY_CAP}`);
  }

  let built: Set<string> | null = null;
  const rel = (f: string) => (f.startsWith(root()) ? f.slice(root().length + 1) : f);
  async function buildCopies(s: Seq, name: string) {
    if (!built) { gap(`${name}: build copies not checked: the folder has no compile database of its own`); return; }
    const done = new Set<string>();
    for (let row = 0; row < s.run.rows.length; row++) {
      const r = s.run.rows[row];
      if (r.kind !== 'step' || !r.file || done.has(r.key)) continue;
      done.add(r.key);
      if (!/\.(c|cc|cpp|cxx|c\+\+|m|mm)$/i.test(r.file) || built.has(normPath(r.file))) { rec('build', 'definition in the build', true, '', s.itemOf[row]); continue; }
      const copies = (await definitionFiles(root(), short(r.name))).filter((f) => built!.has(normPath(f)));
      rec('build', 'definition in the build', copies.length === 0, copies.length ? `${short(r.name)} traced in ${rel(r.file)}; the build compiles it in ${copies.map(rel).join(', ')}` : `${short(r.name)} · ${rel(r.file)} is outside the build and the build has no copy`, s.itemOf[row]);
    }
  }

  const raw: Record<string, unknown[]> = { highlight: [], hover: [] };
  type HL = { range: { start: { line: number; character: number } }; kind?: number };
  const ask = async <T,>(method: string, file: string, line: number, character: number): Promise<T | null> => {
    try { await ensureOpen(file); return (await api.lsp.request(method, { textDocument: { uri: fileToUri(file) }, position: { line, character } })) as T; }
    catch (e) { rec('details', `clangd ${method}`, false, `${file.split('/').pop()}:${line + 1}:${character + 1} · ${e instanceof Error ? e.message : String(e)}`); return null; }
  };
  const highlights = async (file: string, line: number, character: number) => {
    const h = (await ask<HL[]>('textDocument/documentHighlight', file, line, character)) ?? [];
    if (raw.highlight.length < 6) raw.highlight.push({ at: `${file.split('/').pop()}:${line + 1}:${character + 1}`, reply: h });
    return h;
  };
  const hoverType = async (file: string, line: number, character: number) => {
    const h = await ask<{ contents: string | { value: string } }>('textDocument/hover', file, line, character);
    const text = typeof h?.contents === 'string' ? h.contents : h?.contents?.value ?? '';
    if (raw.hover.length < 6) raw.hover.push({ at: `${file.split('/').pop()}:${line + 1}:${character + 1}`, reply: text });
    return /Type:\s*`?([^`\n]+?)`?\s*(?:\n|$)/.exec(text)?.[1]?.trim() ?? '';
  };
  const word = (text: string, w: string, from = 0) => { const m = new RegExp(`(^|[^\\w])(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?!\\w)`).exec(text.slice(from)); return m ? from + m.index + m[1].length : -1; };
  const squash = (t: string) => t.replace(/\s+/g, '');
  const DETAIL_CAP = 1500, DOSSIER = 40;

  async function details(s: Seq, name: string) {
    const R = s.run.rows, get = (f: string) => lines(f), nums = stepNumbers(s), N = Math.min(s.items.length, DETAIL_CAP);
    if (s.items.length > DETAIL_CAP) gap(`${name}: per-line details for steps ${DETAIL_CAP + 1}–${s.items.length} beyond the cap of ${DETAIL_CAP}`);
    const fnDone = new Set<string>();
    for (let it = 0; it < N; it++) {
      const row = s.items[it], r = R[row], c = r.caller != null ? R[r.caller] : null;
      const fn = r.kind === 'ref' && r.ref != null ? R[r.ref] : r;
      if (c && r.at) {
        const L = get(c.file), line = L?.[r.at.line] ?? '', cr = callResult(s, row, get);
        const named = r.kind === 'value' ? word(line, cr.name) >= 0 : !!cr.call;
        rec('details', r.kind === 'value' ? 'named function on its line' : 'call text on its line', named, named ? '' : `${cr.name} not found on ${c.file.split('/').pop()}:${r.at.line + 1}: ${line.trim()}`, it);
        const m = metroRow(s, it, nums, get);
        if (cr.result?.name && cr.result.text !== '→ each item' && cr.call) {
          const col = word(line.slice(0, line.indexOf(cr.call)), cr.result.name);
          const hs = col >= 0 ? await highlights(c.file, r.at.line, col) : [];
          const here = hs.filter((h) => h.range.start.line === r.at!.line);
          rec('details', 'result goes to (→ X)', here.length > 0 && here.some((h) => h.kind === 3 || h.kind === 1), here.length ? '' : `clangd does not see ${cr.result.name} on ${c.file.split('/').pop()}:${r.at.line + 1}`, it);
          const lk = stepLinks(s, it, get), hl = new Set(hs.map((h) => h.range.start.line));
          for (const l of lk.links.filter((x) => x.kind === 'out')) {
            const x = R[s.items[l.to]];
            rec('details', 'reader of the result', !!x.at && hl.has(x.at.line), x.at && hl.has(x.at.line) ? '' : `step ${l.to + 1} (line ${(x.at?.line ?? -1) + 1}) is not a use of this ${cr.result.name}`, it);
          }
          for (const d of lk.decisions) rec('details', 'decision on the result', hl.has(d.line), hl.has(d.line) ? '' : `${d.text} (line ${d.line + 1}) is not a use of this ${cr.result.name}`, it);
        }
        if (m.notes.some((n) => n.text === 'result thrown away') && cr.call) {
          const at = line.indexOf(cr.call), before = line.slice(0, at).trim(), after = line.slice(at + cr.call.length).trim();
          const ok = /^(?:[\w:]+\s*(?:\.|->)\s*)*$/.test(before) && /^;/.test(after);
          rec('details', 'result thrown away', ok, ok ? '' : `not a bare call statement: ${line.trim()}`, it);
        }
        if (m.inside) { const ok = (L ?? []).slice(c.start, r.at.line + 1).some((l) => squash(l).includes(squash(m.inside).slice(0, 40))); rec('details', 'inside loop', ok, ok ? '' : `“${m.inside}” not found in ${short(c.name)} above line ${r.at.line + 1}`, it); }
        const fx = r.kind === 'step' || r.kind === 'ref' ? s.run.effects?.[fn.key] : undefined;
        if (fx?.params && r.args && fn.file && fn.kind === 'step') {
          const FL = get(fn.file) ?? [], sig = FL.slice(fn.start, fn.line + 2).join('\n');
          for (let i = 0; i < Math.min(r.args.length, fx.params.length); i++) {
            const p = fx.params[i];
            let li = -1, col = -1;
            for (let l = fn.start; l <= fn.line + 1 && l < FL.length; l++) { const k = word(FL[l], p.name); if (k >= 0) { li = l; col = k; break; } }
            if (li < 0 || !sig) continue;
            const t = await hoverType(fn.file, li, col);
            if (!t) { rec('details', 'parameter passing', true, `${short(fn.name)}(${p.name}): clangd gave no type`, it, undefined, { warn: true }); continue; }
            const want = passMode(/\(aka (.+)\)\s*$/.exec(t)?.[1] ?? t), got = passMode(p.canon ?? p.type);
            rec('details', 'parameter passing', want === got, want === got ? `${short(fn.name)}(${p.name}): ${got}` : `${short(fn.name)}(${p.name}): engine says ${got} (${p.canon ?? p.type}), clangd type ${t} → ${want}`, it);
          }
        }
      }
      if (fn.kind === 'step' && !fnDone.has(fn.key)) {
        fnDone.add(fn.key);
        const fx = s.run.effects?.[fn.key], FL = get(fn.file) ?? [], end = fn.start + Math.max(1, fn.lines) - 1;
        const open = FL.slice(fn.start, end + 1).findIndex((l) => l.includes('{')), body = open < 0 ? fn.start : fn.start + open;
        const claimWrite = async (full: string, what: string) => {
          const v = full.replace(/^.*::/, ''), ptr = (fx?.params ?? []).find((q) => q.name === v && /\*\s*(?:const\s*)?$/.test(q.type));
          if (ptr) {
            const e = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), through = new RegExp(`(\\*\\s*${e}\\b[^;]*?[^=!<>]=(?!=))|(\\b${e}\\s*(->|\\[)[^;]*?[^=!<>]=(?!=))|(\\b${e}\\s*(->|\\[)[^;]*?(\\+\\+|--))`);
            const hit = FL.slice(body, end + 1).findIndex((l) => through.test(l));
            rec('details', what, hit >= 0, hit >= 0 ? `${short(fn.name)}: through ${v} on line ${body + hit + 1}` : `${short(fn.name)}: no write through pointer ${v} in lines ${body + 1}–${end + 1}`);
            return;
          }
          let li = -1, col = -1;
          for (let l = body; l <= end && l < FL.length; l++) { const k = word(FL[l], v); if (k >= 0) { li = l; col = k; break; } }
          if (li < 0) { rec('details', what, false, `${short(fn.name)}: ${v} does not appear in its body`); return; }
          const hs = await highlights(fn.file, li, col), w = hs.some((h) => h.kind === 3 && h.range.start.line >= body && h.range.start.line <= end);
          if (w) { rec('details', what, true, `${short(fn.name)}: ${v} · clangd write`); return; }
          const e = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const mut = new RegExp(`\\b${e}\\s*(\\[[^\\]]*\\]\\s*)*([+\\-*/%|&^]?=(?!=)|\\+\\+|--)|(\\+\\+|--)\\s*${e}\\b|\\b${e}\\s*(\\.|->)\\s*(push_back|push_front|emplace\\w*|insert|erase|clear|pop_\\w+|push|resize|assign|swap|reset|store|exchange|fetch_\\w+|append|operator\\W+)\\s*\\(`);
          const hit = FL.slice(body, end + 1).findIndex((l) => mut.test(l));
          rec('details', what, hit >= 0, hit >= 0 ? `${short(fn.name)}: ${v} · by text, line ${body + hit + 1}: ${FL[body + hit].trim()}` : `${short(fn.name)}: neither clangd nor the text shows a write to ${v} in lines ${body + 1}–${end + 1}`);
        };
        for (const g of fx?.globalWrites ?? []) await claimWrite(g.replace(/^::/, ''), 'writes a global');
        for (const w of fx?.writes ?? []) await claimWrite(w, 'writes a member');
        for (const p of fx?.paramWrites ?? []) await claimWrite(p, 'writes a parameter');
        for (const p of (fx?.params ?? []).filter((q) => /&\s*$/.test(q.type) && !/^\s*const\b/.test(q.type) && !fx?.paramWrites?.includes(q.name))) {
          let li = -1, col = -1;
          for (let l = body; l <= end && l < FL.length; l++) { const k = word(FL[l], p.name); if (k >= 0) { li = l; col = k; break; } }
          if (li < 0) continue;
          const hs = await highlights(fn.file, li, col), w = hs.some((h) => h.kind === 3 && h.range.start.line > body && h.range.start.line <= end);
          rec('details', 'no write missed (reference parameter)', !w, w ? `${short(fn.name)}: clangd sees a write to ${p.name}, the engine does not` : '');
        }
        for (const x of s.run.exits?.[fn.key] ?? []) {
          if (x.kind === 'noreturn') continue;
          const ok = squash(FL[x.line] ?? '').includes(squash(x.text).slice(0, 30));
          rec('details', 'way out on its line', ok, ok ? '' : `${short(fn.name)}: “${x.text}” not on line ${x.line + 1}: ${(FL[x.line] ?? '').trim()}`);
        }
      }
    }
    for (const j of junctionsOf(s, get)) {
      const FL = get(j.file) ?? [], head = squash(j.cond.replace(/^else of /, '').split(' · ')[0]).slice(0, 40), th = squash(j.then).slice(0, 24);
      const okC = squash(FL[j.line] ?? '').includes(head), okT = squash(FL[j.thenLine] ?? '').includes(th);
      rec('details', 'junction condition on its line', okC, okC ? '' : `${j.cond} not on ${j.file.split('/').pop()}:${j.line + 1}: ${(FL[j.line] ?? '').trim()}`, j.after);
      rec('details', 'junction then on its line', okT, okT ? '' : `${j.then} not on ${j.file.split('/').pop()}:${j.thenLine + 1}: ${(FL[j.thenLine] ?? '').trim()}`, j.after);
    }
    for (const what of ['pure', 'may throw', 'could be (calls through a pointer)', 'findings (races, pairs)', 'values ruled out per call']) gap(`${name}: “${what}” has no independent check; the hand-checked sample covers it`);
    let seed = 12345;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const pick = new Set<number>();
    while (pick.size < Math.min(DOSSIER, s.items.length)) pick.add(Math.floor(rand() * s.items.length));
    const dossier = [...pick].sort((a, b) => a - b).map((it) => {
      const row = s.items[it], r = R[row], c = r.caller != null ? R[r.caller] : null, fn = r.kind === 'ref' && r.ref != null ? R[r.ref] : r;
      const m = (() => { try { return metroRow(s, it, nums, get); } catch { return null; } })(), cd = (() => { try { return detailCard(s, it, null, it, nums, get); } catch { return null; } })(), lk = (() => { try { return stepLinks(s, it, get); } catch { return null; } })();
      const CL = c ? get(c.file) ?? [] : [], FL = get(fn.file) ?? [];
      return {
        step: it + 1, kind: r.kind, fn: fn.name, at: c && r.at ? `${c.file.split('/').pop()}:${r.at.line + 1}` : '',
        source: c && r.at ? CL.slice(Math.max(c.start, r.at.line - 2), r.at.line + 3).map((l, k) => `${Math.max(c.start, r.at!.line - 2) + k + 1}: ${l}`) : [],
        callee: FL.slice(fn.start, fn.start + Math.min(12, Math.max(1, fn.lines))).map((l, k) => `${fn.start + k + 1}: ${l}`),
        metro: m && { who: m.who, call: m.callText, inside: m.inside, result: m.result, notes: m.notes.map((n) => n.text) },
        frames: r.frames.map((f) => s.run.frames[f]).filter((f) => f.owner === r.caller).map((f) => `${f.kind} ${f.label} ${f.text}`),
        card: cd && { passesIn: cd.passesIn, getsBack: cd.getsBack, changes: cd.effects.changes, outside: cd.effects.outside, pure: cd.effects.pure, waysOut: cd.waysOut.map((w) => `${w.text} :${w.line}`) },
        links: lk && { in: lk.links.filter((x) => x.kind === 'in').map((x) => x.label), out: lk.links.filter((x) => x.kind === 'out').map((x) => x.label), calls: lk.calls, decisions: lk.decisions.map((d) => `${d.text} :${d.line + 1}`), takes: lk.takes, gives: lk.gives },
      };
    });
    (report.dossier as unknown[] | undefined)?.push({ program: name, rows: dossier }) ?? (report.dossier = [{ program: name, rows: dossier }]);
  }

  async function metroWalk(s: Seq, name: string) {
    setFlowView('metro');
    if (!(await until(() => !!document.querySelector('.seqv .srow'), 30000))) { await shoot(rec('metro', `draw ${name}`, false, 'the metro drew no rows in 30 s')); return; }
    const N = Math.min(s.items.length, UI_CAP);
    if (s.items.length > UI_CAP) gap(`${name}: metro steps ${UI_CAP + 1}–${s.items.length} beyond the cap of ${UI_CAP}`);
    for (let it = 0; it < N; it++) {
      const a = performance.now();
      stepMove({ jump: it });
      await frames(3);
      const ms = performance.now() - a, bad: string[] = [];
      const sel = document.querySelectorAll('.seqv .srow.sel');
      if (sel.length !== 1) bad.push(`${sel.length} selected rows`);
      else {
        const el = sel[0] as HTMLElement, sp = document.querySelector('.seqv .sspine');
        if (getComputedStyle(el).backgroundColor !== GOLD) bad.push(`selected row is ${getComputedStyle(el).backgroundColor}, not gold`);
        if (sp && rectOf(el).right > rectOf(sp).left) bad.push('selected row crosses the scrollbar');
      }
      const col = auditSequence();
      if (col.length) bad.push(`text on text: ${col.slice(0, 3).join('; ')}`);
      const jr = [...document.querySelectorAll('.seqv .sjn')].map(rectOf), others = [...document.querySelectorAll('.seqv .srow, .seqv .sline, .seqv .sband')].map(rectOf);
      const jc = jr.filter((r) => others.some((o) => cross(r, o))).length;
      if (jc) bad.push(`${jc} junction row(s) overlap other rows`);
      const ps = document.querySelector('.sprev .pstep b')?.textContent;
      if (ps !== String(it + 1)) bad.push(`right pane shows step ${ps}`);
      await shoot(rec('metro', 'step', bad.length === 0, bad.join(' | '), it, ms));
    }
    const list = junctionsOf(s, (f) => lines(f));
    stepMove({ jump: 0 }); await frames(3);
    const seen = new Set<string>();
    for (let k = 0; k < Math.min(list.length, JUNCTION_CAP); k++) {
      const prev = junctionPick()?.id;
      junctionNav.next?.(1);
      await sleep(80); await frames(3);
      const j = junctionPick(), bad: string[] = [];
      if (!j) { rec('metro', 'next junction', false, `no junction picked after ${prev ?? 'the start'}`); break; }
      if (seen.has(j.id)) { rec('metro', 'next junction', false, `${j.id} picked twice`); break; }
      seen.add(j.id);
      const row = document.querySelector('.seqv .sjn.on');
      if (!row) bad.push('its row is not shown filled');
      else if (getComputedStyle(row).backgroundColor !== GOLD) bad.push('its row is not gold');
      if (document.querySelector('.sprev .ibx.full .tg')?.textContent !== 'JUNCTION') bad.push('the card is not the junction card');
      if (!(document.querySelector('.seqk')?.textContent ?? '').includes(`:${j.line + 1}`)) bad.push('the header does not name its line');
      const col = auditSequence();
      if (col.length) bad.push(`text on text: ${col.slice(0, 3).join('; ')}`);
      await shoot(rec('metro', 'junction', bad.length === 0, `${j.cond} · ${j.file.split('/').pop()}:${j.line + 1}${bad.length ? ` · ${bad.join(' | ')}` : ''}`, j.after));
    }
    if (list.length > JUNCTION_CAP) gap(`${name}: junctions ${JUNCTION_CAP + 1}–${list.length} beyond the cap of ${JUNCTION_CAP}`);
    rec('metro', 'all junctions reached by next junction', seen.size === Math.min(list.length, JUNCTION_CAP), `${seen.size} of ${list.length}`);
    key('.seqv', 'Escape'); await frames(2);
    rec('metro', 'Esc leaves the junction', !junctionPick(), junctionPick() ? 'still picked' : '');
  }

  async function gridWalk(s: Seq, name: string) {
    setFlowView('grid');
    if (!(await until(() => document.querySelectorAll('.gview .gcell').length > 0 || !!document.querySelector('.gview .gnote'), 30000))) { await shoot(rec('grid', `draw ${name}`, false, 'the grid drew nothing in 30 s')); return; }
    if (document.querySelector('.gview .gnote')) { gap(`${name}: the grid opens as files × files (large run); per-step squares and arrows not walked`); return; }
    const R = s.run.rows, N = Math.min(s.items.length, UI_CAP), nums = stepNumbers(s);
    if (s.items.length > UI_CAP) gap(`${name}: grid steps ${UI_CAP + 1}–${s.items.length} beyond the cap of ${UI_CAP}`);
    const g = buildGrid(s, nums, 'file');
    for (let it = 0; it < N; it++) {
      const a = performance.now();
      stepMove({ jump: it });
      await frames(3);
      const ms = performance.now() - a, bad: string[] = [], r = R[s.items[it]];
      const on = document.querySelector('.gview .gcell.on') as HTMLElement | null;
      if (r.caller != null && !on) bad.push('no current square');
      if (on && !on.classList.contains('pk') && getComputedStyle(on).backgroundColor !== GOLD) bad.push('current square not gold');
      const L = stepLinks(s, it, (f) => lines(f)), want = new Set<string>();
      for (const l of L.links) { const a1 = g.cellOf[l.from], b1 = g.cellOf[l.to]; if (a1 && b1 && a1 !== b1 && g.cellOf[it]) want.add(`${l.kind}:${a1}|${b1}`); }
      const got = document.querySelectorAll('.gview .glinks .ln').length;
      if (got !== want.size) bad.push(`${got} arrows drawn, ${want.size} expected`);
      const sq = [...document.querySelectorAll('.gview .gcell.has')].map(rectOf), labs = [...document.querySelectorAll('.gview .glab')];
      const covered = labs.filter((l) => sq.some((q) => cross(rectOf(l), q))).map((l) => l.textContent);
      if (covered.length) bad.push(`label over a square: ${covered.slice(0, 3).join('; ')}`);
      const col = auditGrid();
      if (col.length) bad.push(`text on text: ${col.slice(0, 3).join('; ')}`);
      if (!(document.querySelector('.ghd')?.textContent ?? '').includes(`Step ${it + 1} of`)) bad.push(`header shows “${document.querySelector('.ghd')?.textContent ?? 'nothing'}”`);
      await shoot(rec('grid', 'step', bad.length === 0, bad.join(' | '), it, ms));
    }
    const sc = document.querySelector('.gview .gscroll') as HTMLElement | null;
    if (sc && (sc.scrollHeight > sc.clientHeight + 4 || sc.scrollWidth > sc.clientWidth + 4)) {
      sc.scrollTo({ left: sc.scrollWidth, top: sc.scrollHeight });
      await sleep(150); await frames(3);
      const v = sc.getBoundingClientRect(), bad: string[] = [];
      const ch = ([...document.querySelectorAll('.gview .gch')] as HTMLElement[]).map(rectOf).find((r) => r.right > v.left + 240 && r.left < v.right - 80);
      const rh = ([...document.querySelectorAll('.gview .grh')] as HTMLElement[]).map(rectOf).find((r) => r.bottom > v.top + 90 && r.top < v.bottom - 60);
      if (!ch || ch.top < v.top - 1 || ch.bottom > v.top + 84) bad.push(`column headers not at the top (${ch ? `${Math.round(ch.top - v.top)} px down` : 'none in view'})`);
      if (!rh || rh.left < v.left - 1 || rh.right > v.left + 236) bad.push(`row headers not at the left (${rh ? `${Math.round(rh.left - v.left)} px across` : 'none in view'})`);
      const col = auditGrid();
      if (col.length) bad.push(`text on text: ${col.slice(0, 3).join('; ')}`);
      await api.smoke.capture(`probe-grid-scrolled-${name.replace(/[^\w]+/g, '-').slice(0, 40)}`);
      await shoot(rec('grid', 'headers stay in view when scrolled', bad.length === 0, bad.join(' | ') || `scrolled ${Math.round(sc.scrollLeft)} px right, ${Math.round(sc.scrollTop)} px down`));
      sc.scrollTo({ left: 0, top: 0 }); await sleep(100);
    } else gap(`${name}: the grid fits the window, so frozen headers were not exercised`);
  }

  async function features(s: Seq, name: string) {
    const N = s.items.length, R = s.run.rows;
    const f = async (view: string, what: string, run: () => Promise<string>) => {
      const a = performance.now();
      try { const bad = await run(); await shoot(rec('feature', `${view}: ${what}`, !bad, bad, at(), performance.now() - a)); }
      catch (e) { await shoot(rec('feature', `${view}: ${what}`, false, `threw: ${e}`, at(), performance.now() - a)); }
    };
    const M = '.seqv', G = '.gview';
    setFlowView('metro'); await until(() => !!document.querySelector('.seqv .srow'), 20000); await frames(3);
    const jumpTo = async (it: number) => { stepMove({ jump: it }); await frames(3); };
    const cap = () => document.querySelector('.scap')?.textContent ?? '';
    await f('metro', 'Home', async () => { key(M, 'Home'); await frames(3); return at() === 0 ? '' : `at step ${at() + 1}`; });
    await f('metro', 'End', async () => { key(M, 'End'); await frames(3); return at() === N ? '' : `at step ${at() + 1} of ${N}`; });
    await f('metro', 'next →', async () => { key(M, 'Home'); await frames(2); key(M, 'ArrowRight'); await frames(3); return at() === 1 ? '' : `at step ${at() + 1}`; });
    await f('metro', 'back ←', async () => { key(M, 'ArrowLeft'); await frames(3); return at() === 0 ? '' : `at step ${at() + 1}`; });
    const parent = s.items.findIndex((_, it) => s.lastItem[it] > it + 1 && it > 0);
    if (parent >= 0) await f('metro', 'step over ⇧→', async () => { await jumpTo(parent); key(M, 'ArrowRight', true); await frames(3); return at() > s.lastItem[parent] ? '' : `went to step ${at() + 1}, inside the call (ends at ${s.lastItem[parent] + 1})`; });
    else gap(`${name}: step over: no call with calls inside`);
    const deep = s.items.findIndex((row) => R[row].depth >= 2);
    if (deep >= 0) await f('metro', 'step out ↑', async () => { await jumpTo(deep); key(M, 'ArrowUp'); await frames(3); return at() !== deep ? '' : 'did not move'; });
    const sib = s.items.findIndex((row, it) => it > 0 && s.items.some((r2, j) => j > it && R[r2].caller === R[row].caller && R[row].caller != null));
    if (sib >= 0) await f('metro', 'next call in the same function ]', async () => { await jumpTo(sib); key(M, ']'); await frames(3); const c = R[s.items[at()]]?.caller; return c === R[s.items[sib]].caller && at() > sib ? '' : `went to step ${at() + 1}`; });
    const inLoop = s.items.findIndex((_, it) => loopsAt(s, it).length > 0);
    if (inLoop >= 0) {
      await f('metro', 'another pass R', async () => { await jumpTo(inLoop); key(M, 'r'); await frames(3); return /pass 2/.test(document.querySelector('.seqloop')?.textContent ?? '') || /pass|loop/.test(cap()) ? '' : `loop line says “${document.querySelector('.seqloop')?.textContent ?? ''}”, caption “${cap()}”`; });
      await f('metro', 'leave the loop L', async () => { await jumpTo(inLoop); const sp = s.span.get(loopsAt(s, inLoop).slice(-1)[0])!; key(M, 'l'); await frames(3); return at() > sp[1] || /loop/.test(cap()) ? '' : `at step ${at() + 1}, loop ends at ${sp[1] + 1}`; });
    } else gap(`${name}: loops: no step inside a loop`);
    const chipText = () => [...document.querySelectorAll('.ph .chip')].map((c) => c.textContent ?? '').find((t) => /^(calls|decisions|all code)$/.test(t)) ?? '';
    await f('metro', 'detail everywhere ⇧D', async () => { const seenD: string[] = [chipText()]; for (let k = 0; k < 3; k++) { key(M, 'D', true); await frames(3); seenD.push(chipText()); } return seenD.join(' → ') === 'calls → decisions → all code → calls' ? '' : seenD.join(' → '); });
    const fold = s.items.findIndex((_, it) => it > 0 && foldable(s, it));
    if (fold >= 0) await f('metro', 'fold ⇧F', async () => { await jumpTo(fold); key(M, 'F', true); await frames(3); const on = !!document.querySelector('.seqv .srow.sfold'); key(M, 'F', true); await frames(3); const off = !document.querySelector('.seqv .srow.sfold'); return on && off ? '' : `folded row ${on ? 'shown' : 'missing'}, after unfold ${off ? 'gone' : 'still there'}`; });
    await f('metro', 'around A', async () => { key(M, 'a'); await frames(3); const c1 = cap(); key(M, 'a'); await frames(3); return /around the step|the whole run/.test(c1) ? '' : `caption “${c1}”`; });
    if (leavingCount(s.run)) await f('metro', 'ways out E', async () => { key(M, 'e'); await frames(3); const on = !!document.querySelector('.seqv.waysout'); key(M, 'e'); await frames(3); return on && !document.querySelector('.seqv.waysout') ? '' : 'ways out did not toggle'; });
    else gap(`${name}: ways out: no function leaves early`);
    await f('metro', 'watch W', async () => { key(M, 'w'); await frames(3); const inp = document.querySelector('.spick input') as HTMLInputElement | null; if (!inp) return 'no picker'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await frames(3); const on = !!followed(); key(M, 'Escape'); await frames(2); return on ? '' : document.querySelector('.spickl button') ? 'picked nothing' : ''; });
    const withParams = s.items.findIndex((row) => R[row].kind === 'step' && (s.run.effects?.[R[row].key]?.params?.length ?? 0) > 0);
    if (withParams >= 0) await f('metro', 'journey V', async () => { await jumpTo(withParams); key(M, 'v'); await frames(3); const inp = document.querySelector('.spick input') as HTMLInputElement | null; if (!inp) return `no picker · caption “${cap()}”`; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await frames(3); const on = !!followed(); key(M, 'Escape'); await frames(2); return on ? '' : 'nothing followed'; });
    await f('metro', 'go to G', async () => { key(M, 'g'); await frames(3); const inp = document.querySelector('.seqv .sgoto') as HTMLInputElement | null; if (!inp) return 'no input'; const want = Math.min(3, N); inp.value = String(want); inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await sleep(100); await frames(3); return R[s.items[at()]]?.n === want || at() === want - 1 ? '' : `at step ${at() + 1}`; });
    await f('metro', 'find /', async () => { key(M, '/'); await frames(3); const inp = document.querySelector('.sfind input') as HTMLInputElement | null; if (!inp) return 'no find box'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await frames(2); return document.querySelector('.sfind') ? 'find box did not close' : ''; });
    await f('metro', 'tour T', async () => { key(M, 'Home'); await frames(2); key(M, 't'); await frames(3); const c1 = cap(); key(M, 'Escape'); await frames(2); return /tour/.test(c1) ? '' : `caption “${c1}”`; });
    await f('metro', 'jump letters J', async () => { key(M, 'j'); await frames(3); const n = document.querySelectorAll('.seqv .shint').length; key(M, 'Escape'); await frames(2); return n > 0 || N < 3 ? '' : 'no letters'; });
    await f('metro', 'skyline K', async () => { const a1 = !!document.querySelector('.seqv .ssky'); key(M, 'k'); await frames(3); const b1 = !!document.querySelector('.seqv .ssky'); key(M, 'k'); await frames(3); return a1 !== b1 && !!document.querySelector('.seqv .ssky') === a1 ? '' : 'skyline did not toggle'; });
    await f('metro', 'keys ?', async () => { key(M, '?'); await frames(3); const on = !!document.querySelector('.skeys'); (document.querySelector('.skeys') as HTMLElement | null)?.click(); await frames(2); return on && !document.querySelector('.skeys') ? '' : 'key list did not open and close'; });
    await f('metro', 'note N', async () => { await jumpTo(Math.min(1, N - 1)); key(M, 'n'); await frames(3); const inp = document.querySelector('.snoteedit') as HTMLInputElement | null; if (!inp) return 'no note box'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await frames(2); return ''; });
    await f('metro', 'play Space', async () => { key(M, 'Home'); await frames(2); const a0 = at(); key(M, ' '); await sleep(1300); const a1 = at(); key(M, ' '); await frames(2); return a1 > a0 || N < 2 ? '' : 'did not advance'; });
    const ask = s.items.findIndex((row, it) => ownFrames(s.run, row).some((fr) => s.span.get(fr)?.[0] === it && (() => { try { return !!whatIf(s, fr); } catch { return false; } })()));
    if (ask >= 0) await f('metro', 'what if', async () => {
      await jumpTo(ask); await sleep(100);
      const el = [...document.querySelectorAll('.seqv .srow .nt.ask')].find((e) => e.closest('.srow.sel')) as HTMLElement | undefined ?? document.querySelector('.seqv .srow .nt.ask') as HTMLElement | null;
      if (!el) return 'no question mark on the row';
      el.click(); await frames(3);
      (document.querySelector('.swmenu button') as HTMLElement | null)?.click(); await frames(3);
      const on = !!document.querySelector('.seqv .swhat'); key(M, 'Escape'); await frames(3);
      return on && !document.querySelector('.seqv .swhat') ? '' : `what-if row ${on ? 'did not close' : 'did not open'}`;
    });
    else gap(`${name}: what if: no decision the run can flip`);
    await f('metro', 'open file Enter', async () => { await jumpTo(Math.min(1, N - 1)); key(M, 'Enter'); await sleep(600); const v = getMainView(); setPage('flow'); setFlowView('metro'); await until(() => !!document.querySelector('.seqv .srow'), 10000); return v && v.state.doc.length > 0 ? '' : 'no file opened'; });
    await f('metro', 'Tab to the grid and back', async () => { await jumpTo(Math.min(2, N - 1)); const a0 = at(); key(M, 'Tab'); const g1 = await until(() => !!document.querySelector('.gview'), 5000); const kept = at() === a0; setFlowView('metro'); await until(() => !!document.querySelector('.seqv'), 5000); return g1 && kept ? '' : `${g1 ? '' : 'grid did not open'} ${kept ? '' : 'step not kept'}`.trim(); });
    if (!document.querySelector('.seqv') || !document.querySelector(M)) setFlowView('metro');
    setFlowView('grid');
    if (!(await until(() => document.querySelectorAll('.gview .gcell.has').length > 0, 20000))) { gap(`${name}: grid features: grid shows files × files`); return; }
    await frames(3);
    const squares = () => document.querySelectorAll('.gview .gcell.has').length;
    await f('grid', 'orders by file / run order / most called', async () => { const n0 = squares(), seen: string[] = []; for (const b of [...document.querySelectorAll('.gview .gtop .seg button')] as HTMLElement[]) { b.click(); await frames(3); seen.push(`${b.textContent}:${squares()}`); } (document.querySelector('.gview .gtop .seg button') as HTMLElement | null)?.click(); await frames(2); return seen.every((x) => x.endsWith(`:${n0}`)) ? '' : `squares ${n0} then ${seen.join(', ')}`; });
    await f('grid', 'how often H', async () => { key(G, 'h'); await frames(2); const on = !!document.querySelector('.gview.heat'); key(G, 'h'); await frames(2); return on && !document.querySelector('.gview.heat') ? '' : 'did not toggle'; });
    await f('grid', 'focus F', async () => { key(G, 'f'); await frames(2); const on = !!document.querySelector('.gview.focus'); key(G, 'f'); await frames(2); return on && !document.querySelector('.gview.focus') ? '' : 'did not toggle'; });
    if (leavingCount(s.run)) await f('grid', 'ways out E', async () => { key(G, 'e'); await frames(2); const on = !!document.querySelector('.gview.waysout'); key(G, 'e'); await frames(2); return on && !document.querySelector('.gview.waysout') ? '' : 'did not toggle'; });
    await f('grid', 'open a square', async () => { const sq = ([...document.querySelectorAll('.gview .gcell.has')] as HTMLElement[]).find((e) => e.querySelectorAll('i').length >= 2 || !!e.querySelector('.dots')) ?? document.querySelector('.gview .gcell.has') as HTMLElement | null; if (!sq) return 'no square'; sq.click(); await frames(3); const on = !!document.querySelector('.gview .gcell.pk'), tag = document.querySelector('.sprev .ibx.full .tg')?.textContent; key(G, 'Escape'); await frames(2); return on && tag === 'SELECTED' && !document.querySelector('.gview .gcell.pk') ? '' : `opened ${on} · card ${tag}`; });
    await f('grid', 'route ⇧-click', async () => { const hs = [...document.querySelectorAll('.gview .grh')] as HTMLElement[]; if (hs.length < 2) return ''; hs[0].dispatchEvent(new MouseEvent('click', { shiftKey: true, bubbles: true })); hs[hs.length - 1].dispatchEvent(new MouseEvent('click', { shiftKey: true, bubbles: true })); await frames(3); const ok = document.querySelectorAll('.sprev .bxr, .pane .bxr').length > 0 || /route/.test(cap()); key(G, 'Escape'); await frames(2); return ok ? '' : `caption “${cap()}”`; });
    await f('grid', 'play Space', async () => { key(G, 'Home'); await frames(2); const a0 = at(); key(G, ' '); await sleep(1300); const a1 = at(); key(G, ' '); await frames(2); return a1 > a0 || N < 2 ? '' : 'did not advance'; });
    gap(`${name}: grid export: needs a save dialog`);
  }

  try {
    applySettings({ ...snapshot, 'motion.reduce': true }, problems());
    rec('env', 'clangd ready', await until(() => lspState() === 'ready', 180000), lspState());
    const ti = performance.now(), okI = await quiet(() => !indexing(), 3000, 1200000);
    rec('env', 'index finished', okI, okI ? `clangd indexed in ${Math.round((performance.now() - ti) / 1000)} s` : `still indexing after 20 min: ${indexing()}`, undefined, performance.now() - ti);
    const srcs = (await api.fs.sources(root())) as string[];
    rec('env', 'sources listed', srcs.length > 0, `${srcs.length} files under ${root()}`);
    const bl = await api.lsp.built().catch(() => null);
    built = bl?.length ? new Set(bl.map(normPath)) : null;
    rec('env', 'build files', true, built ? `${built.size} files in the compile database` : 'no compile database of its own');
    setPage('flow');
    setFlowView('metro');
    await until(() => entries().length > 0, 180000);
    const es = entries();
    rec('entries', 'programs found', es.length > 0, `${es.length}: ${es.slice(0, 30).map((e: any) => `${e.name} · ${e.rel}`).join(', ')}`);
    await until(() => !!document.querySelector('.progs .pr.top') || !document.querySelector('.progs'), 30000);
    const topText = document.querySelector('.progs .pr.top')?.textContent ?? '', top = es.findIndex((e: any) => !!e.rel && topText.includes(e.rel));
    const order = [...(top >= 0 ? [top] : []), ...es.map((_: unknown, i: number) => i).filter((i: number) => i !== top)].slice(0, ENTRY_CAP);
    rec('entries', 'order', true, `first: ${top >= 0 ? (es[top] as any).rel : 'list order'} (the app’s “most likely first”)`);
    if (es.length > ENTRY_CAP) gap(`programs beyond the cap of ${ENTRY_CAP}: ${es.length - ENTRY_CAP} of ${es.length}: ${es.filter((_: unknown, i: number) => !order.includes(i)).map((e: any) => e.rel).join(', ')}`);
    let walked = 0;
    for (const i of order) {
      const e: any = es[i], name = `${e.name} · ${e.rel}`, a = performance.now();
      try { setPrograms(false); await setLane(i); } catch (x) { rec('entry', `open ${name}`, false, `threw: ${x}`); continue; }
      const ok = await settled(), s = seq();
      const r = rec('entry', `trace ${name}`, ok && !!s, ok && s ? `${s.items.length} steps` : `not ready: ${status()} | ${runStatus()}`, undefined, performance.now() - a);
      if (!s || !ok) { await shoot(r); continue; }
      await loadTexts(s);
      pure(s, name);
      await buildCopies(s, name);
      if (walked < WALK_ENTRIES) {
        walked++;
        await details(s, name);
        await api.smoke.capture(`probe-${walked}-metro`);
        await metroWalk(s, name);
        await gridWalk(s, name);
        await api.smoke.capture(`probe-${walked}-grid`);
        await features(s, name);
      }
    }
    if (es.length > WALK_ENTRIES) gap(`views walked for the first ${Math.min(WALK_ENTRIES, es.length)} programs only; the other ${Math.min(es.length, ENTRY_CAP) - WALK_ENTRIES} had their analyses checked`);
  } catch (e) { rec('probe', 'probe itself', false, `threw: ${e instanceof Error ? e.stack : String(e)}`); }
  clearInterval(watcher);
  console.error = cerr; console.warn = cwarn;
  applySettings(snapshot, problems());
  const groups = new Map<string, { checks: number; passed: number; failed: number; warnings: number; ms: number; first: string[] }>();
  for (const r of log) {
    if (r.gap) continue;
    const k = `${r.phase} · ${r.what.replace(/^(watch|trace|open|draw|run of) .*/, '$1')}`;
    const g = groups.get(k) ?? { checks: 0, passed: 0, failed: 0, warnings: 0, ms: 0, first: [] };
    g.checks++; if (r.warn) g.warnings++; else if (r.ok) g.passed++; else { g.failed++; if (g.first.length < 5) g.first.push(`${r.item != null ? `step ${r.item + 1}: ` : ''}${r.detail ?? ''}${r.shot ? ` [${r.shot}]` : ''}`); }
    g.ms += r.ms ?? 0; groups.set(k, g);
  }
  const all = log.filter((r) => !r.gap);
  report.totals = { checks: all.length, passed: all.filter((r) => r.ok && !r.warn).length, failed: all.filter((r) => !r.ok).length, warnings: all.filter((r) => r.warn).length, minutes: Math.round(now() / 600) / 100 };
  report.summary = [...groups].map(([k, g]) => ({ what: k, ...g, ms: Math.round(g.ms) }));
  report.notChecked = coverage;
  report.clangdReplies = raw;
  report.errors = log.filter((r) => !r.ok).map((r) => `${r.phase} · ${r.what}${r.item != null ? ` · step ${r.item + 1}` : ''}: ${r.detail ?? ''}${r.shot ? ` [${r.shot}]` : ''}`);
  report.log = log;
  await api.smoke.done(report);
}
