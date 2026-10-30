// The UX-ideas demo, played inside the real app (record-ux.cjs injects it): the real sequence view of samples/tinyhttp
// is driven with its own keys and clicks; each idea is drawn over it from the same run (recorded from clangd, see
// data.ts), so every name, number, loop and condition shown is the analyser's own. Nothing here is part of the app.
// build: npx esbuild src/concepts/flow/ux/ux.ts --bundle --format=iife --alias:@data=<run.json> --outfile=<ux.js>
import ELK from 'elkjs/lib/elk.bundled.js';
// @ts-ignore: the run, written by data.ts
import D from '@data';
import { buildSeq } from '../../../shared/flowseq';
import type { Run } from '../../../shared/flowrun';

declare const window: any;
const run: Run = D.run;
const FILES: Record<string, string[]> = D.files;
const s = buildSeq(run);
const R = run.rows, N = s.items.length;
let SLOW = 1;
/** the whole demo's pace: every wait and every scene's length */
const PACE = 0.86;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms * SLOW * PACE));
const raw = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const short = (n: string) => n.replace(/^.*::(?=[^:]+$)/, '');
const base = (f: string) => f.split('/').pop()!;
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const rowOf = (it: number) => R[s.items[it]];
const itemOfRow = (i: number) => s.itemOf[i];
const num = (it: number) => { const r = rowOf(it); return r.kind === 'step' ? String(r.n) : r.kind === 'ref' ? `→${R[r.ref!].n}` : r.kind === 'indirect' ? '⇢' : '·'; };
const label = (it: number) => `${num(it)}|${rowOf(it).kind === 'indirect' ? rowOf(it).text : short(rowOf(it).name)}`;

// ---------- code, coloured as in the app ----------
const KW = /^(if|for|while|return|auto|const|void|bool|int|char|static|true|false|size_t|std|else|break|continue|struct|using|noexcept)$/;
function hl(t: string): string {
  let out = '';
  const re = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\/\/.*$)|([A-Za-z_]\w*)(?=\s*\()|([A-Za-z_]\w*)|([^"'/A-Za-z_]+|.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    if (m[1]) out += `<span style="color:var(--str)">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span style="color:var(--cm)">${esc(m[2])}</span>`;
    else if (m[3]) out += KW.test(m[3]) ? `<span style="color:var(--kw)">${m[3]}</span>` : `<span style="color:var(--fn)">${m[3]}</span>`;
    else if (m[4]) out += KW.test(m[4]) ? `<span style="color:var(--kw)">${m[4]}</span>` : m[4];
    else out += esc(m[5]);
  }
  return out;
}
const codeLines = (file: string, from: number, to: number, mark = -1) =>
  FILES[file].slice(from, to + 1).map((t, k) => `<div class="${from + k === mark ? 'hl' : ''}"><span class="ln">${from + k + 1}</span><span>${hl(t) || ' '}</span></div>`).join('');

// ---------- the real view ----------
const seqv = () => document.querySelector('.seqv') as HTMLElement;
const seqin = () => seqv().querySelector('.seqin') as HTMLElement;
const prevPane = () => seqv().closest('.body')!.querySelector('.pane.prev') as HTMLElement;
interface DR { el: HTMLElement; it: number; top: number; left: number }
function domRows(): DR[] {
  const els = [...seqin().querySelectorAll<HTMLElement>(':scope > .srow:not(.send)')].map((el) => ({ el, top: parseFloat(el.style.top), left: parseFloat(el.style.left) })).sort((a, b) => a.top - b.top);
  const labs = els.map((e) => `${e.el.querySelector('.n')?.textContent ?? ''}|${e.el.querySelector('.nm')?.textContent ?? ''}`);
  for (let st = 0; st + labs.length <= N; st++) if (labs.every((l, k) => l === label(st + k))) return els.map((e, k) => ({ ...e, it: st + k }));
  return [];
}
const rowEl = (it: number) => domRows().find((r) => r.it === it);
const curIt = () => domRows().find((r) => r.el.classList.contains('sel'))?.it ?? (seqin().querySelector('.send.sel') ? N : -1);
const bars = () => [...seqin().querySelectorAll<HTMLElement>(':scope > .sbar')].map((el) => ({ el, left: parseFloat(el.style.left), top: parseFloat(el.style.top), h: parseFloat(el.style.height) }));
const barOf = (it: number) => { const r = rowEl(it); return r ? bars().find((b) => Math.abs(b.top - (r.top + 4)) < 1.5) : undefined; };
function press(key: string, shift = false) { seqv().focus(); seqv().dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey: shift, bubbles: true })); }
async function jumpTo(it: number) {
  const r = rowEl(it);
  if (r) { r.el.click(); return; }
  let k = it;
  while (k > 0 && rowOf(k).kind !== 'step') k--;
  press('g');
  await raw(80);
  const inp = document.querySelector('.sgoto') as HTMLInputElement;
  inp.value = String(rowOf(k).n);
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}
/** The box under the selected row is as tall as its content, measured when the view's width changes. */
let nudge = false;
function remeasure() { nudge = !nudge; seqv().style.marginRight = nudge ? '1px' : '0px'; }
const rect = (el: Element) => el.getBoundingClientRect();

// ---------- the demo's own layer, moving with the view's scroll ----------
let L!: HTMLElement;   // in .seqin's coordinates
function mk(cls: string, parent: HTMLElement, html = '', tag = 'div'): HTMLElement { const e = document.createElement(tag); e.className = cls; e.innerHTML = html; parent.appendChild(e); return e; }
function syncLayer() { if (L && seqin()) L.style.transform = getComputedStyle(seqin()).transform; requestAnimationFrame(syncLayer); }

// ---------- cursor, title, captions ----------
let cursorEl!: HTMLElement, cx = 700, cy = 500;
function cursorTo(x: number, y: number, ms = 520) {
  cursorEl.style.opacity = '1';
  cursorEl.style.transition = `left ${ms * SLOW * PACE}ms cubic-bezier(.3,.7,.2,1), top ${ms * SLOW * PACE}ms cubic-bezier(.3,.7,.2,1), opacity ${200 * SLOW}ms`;
  cursorEl.style.left = `${x}px`; cursorEl.style.top = `${y}px`; cx = x; cy = y;
  return wait(ms);
}
const cursorAt = (el: Element, fx = 0.5, fy = 0.5, ms?: number) => { const b = rect(el); return cursorTo(b.left + b.width * fx, b.top + b.height * fy, ms); };
async function clickFx() {
  const r = mk('ux-ring', document.body); r.style.left = `${cx}px`; r.style.top = `${cy}px`;
  r.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.4)', opacity: 0 }], { duration: 420 * SLOW, easing: 'ease-out' });
  setTimeout(() => r.remove(), 450 * SLOW);
  await wait(140);
}
const hideCursor = () => { cursorEl.style.opacity = '0'; };
let titleEl!: HTMLElement;
function title(k: string, what: string, why = '') { titleEl.innerHTML = `<span class="k">${k}</span>${what}${why ? `<span class="w">${why}</span>` : ''}`; titleEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 * SLOW }); }
let capEl: HTMLElement | null = null, capT: any;
function say(key: string, what: string, why = '', ms = 1700) {
  capEl?.remove(); clearTimeout(capT);
  capEl = mk('scap ux', seqv(), `${key ? `<span class="key">${key}</span>` : ''}${what}${why ? `<span class="why">${why}</span>` : ''}`);
  if (ms) capT = setTimeout(() => { capEl?.remove(); capEl = null; }, ms * SLOW);
}
function toast(html: string, ms = 1800) {
  const t = mk('ux-toast', document.body, html);
  t.animate([{ opacity: 0, transform: 'translate(-50%, 6px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 260 * SLOW, easing: 'ease-out' });
  setTimeout(() => t.remove(), ms * SLOW);
}

// ---------- breadcrumbs (sequence 5), kept on from that scene ----------
let crumbsEl: HTMLElement | null = null, crumbHot = '';
function chainNames(it: number): { name: string; it: number }[] {
  if (it < 0 || it >= N) return [];
  const out: { name: string; it: number }[] = [];
  for (let i: number | null = s.items[it]; i != null; i = R[i].caller) out.unshift({ name: short(R[i].name), it: itemOfRow(i) });
  return out;
}
let readNote = '';
function drawCrumbs() {
  if (!crumbsEl) return;
  const sp = document.querySelector('.seqpath') as HTMLElement | null;
  if (sp) { const b = rect(sp); crumbsEl.style.left = `${b.left}px`; crumbsEl.style.top = `${b.top}px`; crumbsEl.style.height = `${b.height}px`; }
  const html = chainNames(curIt()).map((c) => `<span class="c${c.name === crumbHot ? ' hot' : ''}" data-it="${c.it}">${c.name}</span>`).join('<span class="sep">›</span>') + (readNote ? `<span class="rd">${readNote}</span>` : '');
  if (crumbsEl.innerHTML !== html) crumbsEl.innerHTML = html;
}

// ---------- collapsing a span of rows (fold, what-if) ----------
interface Saved { el: HTMLElement; transform: string; opacity: string; height: string; transition: string }
let saved: Saved[] = [];
function collapse(a: number, b: number, stripH: number) {
  const ra = rowEl(a)!, rb = rowEl(b + 1);
  const topA = ra.top, topB = rb ? rb.top : Infinity, delta = (topB === Infinity ? 0 : topB - topA) - stripH;
  const T = `${0.42 * SLOW}s cubic-bezier(.16,1,.3,1)`;
  const els = [...seqin().children, ...L.children].filter((e) => !(e as HTMLElement).classList.contains('ux-keep')) as HTMLElement[];
  for (const el of els) {
    const top = parseFloat(el.style.top);
    if (Number.isNaN(top)) continue;
    const h = el.classList.contains('srow') ? 23 : parseFloat(el.style.height) || 0;
    const sv: Saved = { el, transform: el.style.transform, opacity: el.style.opacity, height: el.style.height, transition: el.style.transition };
    if (top >= topA && top < topB) { saved.push(sv); el.style.transition = `opacity ${0.3 * SLOW}s`; el.style.opacity = '0'; }
    else if (top >= topB) { saved.push(sv); el.style.transition = `transform ${T}`; el.style.transform = `translateY(${-delta}px)`; }
    else if (top + h > topA && el.style.height) {
      saved.push(sv);
      const bottom = top + h, nb = bottom >= topB ? bottom - delta : topA + stripH;
      el.style.transition = `height ${T}`; el.style.height = `${nb - top}px`;
    }
  }
  return { top: topA, left: ra.left };
}
function expand() {
  for (const v of saved) { v.el.style.transform = v.transform; v.el.style.opacity = v.opacity; v.el.style.height = v.height; }
  const list = saved; saved = [];
  setTimeout(() => { for (const v of list) v.el.style.transition = v.transition; }, 500 * SLOW);
}

// ---------- the boxes view, built from the run ----------
type Level = 'functions' | 'files' | 'folders';
const stepRows = R.map((_, i) => i).filter((i) => R[i].kind === 'step');
const fileList: string[] = [];
for (const i of stepRows) if (!fileList.includes(R[i].file)) fileList.push(R[i].file);
const rowsOfFile = (f: string) => stepRows.filter((i) => R[i].file === f).sort((a, b) => R[a].n - R[b].n);
const loopsOwned = (i: number) => run.frames.map((f, k) => ({ f, k })).filter(({ f }) => f.kind === 'loop' && f.owner === i);
const dirOf = (f: string) => (f.includes('/') ? f.replace(/\/[^/]+$/, '') : '.');
const targetOf = (i: number) => (R[i].kind === 'step' ? i : R[i].kind === 'ref' ? R[i].ref! : null);
/** caller step → callee step, once per pair, with how many calls it stands for */
const calls: { a: number; b: number; n: number }[] = [];
for (let i = 0; i < R.length; i++) {
  const t = targetOf(i), c = R[i].caller;
  if (t == null || c == null) continue;
  const e = calls.find((x) => x.a === c && x.b === t);
  if (e) e.n++; else calls.push({ a: c, b: t, n: 1 });
}
interface BRow { type: 'fn' | 'loop'; i: number; y: number; k?: number }
const BW = { functions: 262, files: 250, folders: 230 };
function boxGeom(f: string, level: Level): { w: number; h: number; rows: BRow[] } {
  if (level !== 'functions') return { w: BW[level], h: level === 'files' ? 72 : 60, rows: [] };
  const rows: BRow[] = [];
  let y = 36;
  for (const i of rowsOfFile(f)) { rows.push({ type: 'fn', i, y }); y += 21; for (const l of loopsOwned(i)) { rows.push({ type: 'loop', i, k: l.k, y }); y += 16; } }
  return { w: BW.functions, h: y + 10, rows };
}
interface Lay { pos: Record<string, { x: number; y: number; w: number; h: number }>; edges: { a: number; b: number; n: number; fa: string; fb: string; pts: { x: number; y: number }[] }[]; groups: { dir: string; x: number; y: number; w: number; h: number }[]; w: number; h: number }
const lays: Partial<Record<Level, Lay>> = {};
async function layout(level: Level): Promise<Lay> {
  const elk = new (ELK as any)();
  const nodes = fileList.map((f) => {
    const g = boxGeom(f, level), node: any = { id: f, width: g.w, height: g.h, layoutOptions: {} };
    if (level === 'functions') {
      node.layoutOptions['elk.portConstraints'] = 'FIXED_POS';
      node.ports = g.rows.filter((r) => r.type === 'fn').flatMap((r) => [
        { id: `in${r.i}`, x: 0, y: r.y + 10, width: 1, height: 1, layoutOptions: { 'elk.port.side': 'WEST' } },
        { id: `out${r.i}`, x: g.w - 1, y: r.y + 10, width: 1, height: 1, layoutOptions: { 'elk.port.side': 'EAST' } }]);
    }
    return node;
  });
  const edges: any[] = [], meta: any[] = [], seen = new Set<string>();
  for (const c of calls) {
    const fa = R[c.a].file, fb = R[c.b].file;
    if (fa === fb) continue;   // calls inside one box need no line: the numbers show them
    if (level === 'functions') { edges.push({ id: `e${edges.length}`, sources: [`out${c.a}`], targets: [`in${c.b}`] }); meta.push({ ...c, fa, fb }); }
    else { const k = `${fa}>${fb}`; if (seen.has(k)) continue; seen.add(k); edges.push({ id: `e${edges.length}`, sources: [fa], targets: [fb] }); meta.push({ ...c, fa, fb }); }
  }
  let children: any[] = nodes;
  if (level === 'folders') {
    const by: Record<string, any[]> = {};
    for (const n of nodes) (by[dirOf(n.id)] ||= []).push(n);
    children = Object.entries(by).map(([dir, kids]) => ({ id: `dir:${dir}`, children: kids, layoutOptions: { 'elk.padding': '[top=36,left=14,bottom=14,right=14]' } }));
  }
  const g = await elk.layout({ id: 'root', layoutOptions: { 'elk.hierarchyHandling': level === 'folders' ? 'INCLUDE_CHILDREN' : 'SEPARATE_CHILDREN', 'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.edgeRouting': 'ORTHOGONAL',
    'elk.layered.spacing.nodeNodeBetweenLayers': level === 'functions' ? '84' : '70', 'elk.spacing.nodeNode': level === 'functions' ? '26' : '24', 'elk.layered.spacing.edgeNodeBetweenLayers': '22',
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES', 'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF' }, children, edges });
  const pos: Lay['pos'] = {}, groups: Lay['groups'] = [];
  for (const c of g.children) {
    if (c.children) { groups.push({ dir: c.id.slice(4), x: c.x, y: c.y, w: c.width, h: c.height }); for (const k of c.children) pos[k.id] = { x: c.x + k.x, y: c.y + k.y, w: k.width, h: k.height }; }
    else pos[c.id] = { x: c.x, y: c.y, w: c.width, h: c.height };
  }
  const all = [...(g.edges || []), ...g.children.flatMap((c: any) => c.edges || [])];
  const out = all.map((e: any) => {
    const k = Number(e.id.slice(1)), off = e.container && e.container !== 'root' ? groups.find((q) => `dir:${q.dir}` === e.container) : null;
    const sc = e.sections?.[0];
    const pts = sc ? [sc.startPoint, ...(sc.bendPoints || []), sc.endPoint].map((q: any) => (off ? { x: q.x + off.x, y: q.y + off.y } : { x: q.x, y: q.y })) : [];
    return { ...meta[k], pts };
  });
  return { pos, edges: out, groups, w: g.width, h: g.height };
}

const PAD = 28;
let BX: { root: HTMLElement; scroll: HTMLElement; sizer: HTMLElement; world: HTMLElement; svg: SVGSVGElement; ctl: HTMLElement; mini: HTMLElement; level: Level; sc: number; boxes: Record<string, HTMLElement>; rows: Record<number, HTMLElement> } | null = null;
const svgNS = 'http://www.w3.org/2000/svg';
function boxRowsHTML(f: string, level: Level) {
  const fns = rowsOfFile(f), loops = fns.reduce((a, i) => a + loopsOwned(i).length, 0);
  const callers = new Set(calls.filter((c) => R[c.b].file === f && R[c.a].file !== f).map((c) => R[c.a].file));
  let h = `<div class="t">${base(f)}<i>${f.includes('/') ? dirOf(f) : ''}</i></div>${loops ? `<div class="lc">↻ ${loops}</div>` : ''}`;
  if (level === 'files') h += `<div class="s">${fns.length} function${fns.length === 1 ? '' : 's'}${callers.size > 1 ? ` · used by ${callers.size} files` : ''}</div>`;
  if (level === 'folders') h = `<div class="t sm">${base(f)}</div>`;
  if (level === 'functions') for (const r of boxGeom(f, level).rows) {
    if (r.type === 'fn') h += `<div class="fr" data-i="${r.i}" style="top:${r.y}px"><span class="n">${R[r.i].n}</span><span class="nm">${short(R[r.i].name)}</span><span class="c"></span></div>`;
    else { const fr = run.frames[r.k!]; h += `<div class="lpl" data-loop="${r.k}" style="top:${r.y}px">↻ ${esc(fr.count != null ? `×${fr.count} · ${fr.text}` : fr.text)}</div>`; }
  }
  return h;
}
/** The numbers of the calls a line stands for: 15, →12 ×2 … (the first four, then +n) */
function edgeNums(e: { a: number; b: number; fa: string; fb: string }, level: Level) {
  const out: string[] = [];
  for (let i = 0; i < R.length; i++) {
    const t = targetOf(i), c = R[i].caller;
    if (t == null || c == null) continue;
    if (level === 'functions' ? c !== e.a || t !== e.b : R[c].file !== e.fa || R[t].file !== e.fb) continue;
    out.push(R[i].kind === 'step' ? String(R[i].n) : `→${R[t].n}`);
  }
  const by: [string, number][] = [];
  for (const x of out) { const f = by.find((y) => y[0] === x); if (f) f[1]++; else by.push([x, 1]); }
  const parts = by.map(([x, n]) => (n > 1 ? `${x} ×${n}` : x));
  return parts.length > 4 ? `${parts.slice(0, 4).join(' · ')} +${parts.length - 4}` : parts.join(' · ');
}
function drawEdges(level: Level) {
  const B = BX!, lay = lays[level]!;
  B.svg.innerHTML = '';
  B.world.querySelectorAll('.ux-lab').forEach((e) => e.remove());
  for (const e of lay.edges) {
    if (!e.pts.length) continue;
    const p = document.createElementNS(svgNS, 'path');
    p.setAttribute('d', `M${e.pts.map((q) => `${q.x} ${q.y}`).join(' L')}`);
    p.setAttribute('class', 'ed'); p.dataset.a = String(e.a); p.dataset.b = String(e.b); p.dataset.fa = e.fa; p.dataset.fb = e.fb;
    B.svg.appendChild(p);
    const q = e.pts[e.pts.length - 1], ah = document.createElementNS(svgNS, 'path');
    ah.setAttribute('d', `M${q.x - 6} ${q.y - 3.5} L${q.x} ${q.y} L${q.x - 6} ${q.y + 3.5} Z`);
    ah.setAttribute('class', 'ah'); ah.dataset.a = String(e.a); ah.dataset.b = String(e.b); ah.dataset.fa = e.fa; ah.dataset.fb = e.fb;
    B.svg.appendChild(ah);
    // the call numbers, on every line by default (as in the app's boxes view)
    // lines that end at the same place share one label
    const at = `${Math.round(q.x)},${Math.round(q.y)}`, key = `${e.a}>${e.b}`;
    const same = B.world.querySelector<HTMLElement>(`.ux-lab[data-at="${at}"]`);
    if (same) { same.textContent += ` · ${edgeNums(e, level)}`; same.dataset.keys += `,${key}`; continue; }
    const lab = mk('ux-lab', B.world, esc(edgeNums(e, level)));
    lab.style.left = `${q.x - 12}px`; lab.style.top = `${q.y}px`;   // its right edge just before the arrowhead
    lab.dataset.at = at; lab.dataset.keys = key;
  }
  for (const g of lay.groups) { const r = mk('ux-grp', B.world, `<span>${g.dir}</span>`); r.style.cssText = `left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px`; r.dataset.grp = '1'; }
}
function setLevel(level: Level) {
  const B = BX!, lay = lays[level]!;
  B.level = level;
  B.root.classList.toggle('lv-files', level === 'files'); B.root.classList.toggle('lv-folders', level === 'folders');
  B.world.querySelectorAll('[data-grp]').forEach((e) => e.remove());
  for (const f of fileList) {
    const b = B.boxes[f], p = lay.pos[f];
    b.style.left = `${p.x}px`; b.style.top = `${p.y}px`; b.style.width = `${p.w}px`; b.style.height = `${p.h}px`;
    b.innerHTML = boxRowsHTML(f, level);
    b.className = `ux-bx lv-${level}`;
  }
  B.rows = {};
  B.world.querySelectorAll<HTMLElement>('.fr[data-i]').forEach((e) => { B.rows[Number(e.dataset.i)] = e; });
  drawEdges(level);
  sizeWorld();
}
const worldW = () => lays[BX!.level]!.w, worldH = () => lays[BX!.level]!.h;
function sizeWorld() {
  const B = BX!;
  B.world.style.transform = `scale(${B.sc})`;
  B.sizer.style.width = `${worldW() * B.sc + PAD * 2}px`; B.sizer.style.height = `${worldH() * B.sc + PAD * 2}px`;
  const ro = B.ctl.querySelector('.ro'); if (ro) ro.textContent = `${Math.round(B.sc * 100)}%`;
  drawMini();
}
function fitScale(kind: 'width' | 'all') {
  const B = BX!, w = B.scroll.clientWidth - PAD * 2, h = B.scroll.clientHeight - PAD * 2 - 40;
  return kind === 'width' ? Math.min(1.5, w / worldW()) : Math.min(1.5, w / worldW(), h / worldH());
}
function animate(ms: number, f: (t: number) => void) {
  return new Promise<void>((done) => {
    const t0 = performance.now(), d = ms * SLOW;
    const tick = () => { const t = Math.min(1, (performance.now() - t0) / (d * PACE)), e = 1 - Math.pow(1 - t, 3); f(e); if (t < 1) requestAnimationFrame(tick); else done(); };
    requestAnimationFrame(tick);
  });
}
async function zoomTo(sc: number, ms = 480, anchor?: { x: number; y: number }) {
  const B = BX!, s0 = B.sc, el = B.scroll;
  const ax = anchor?.x ?? el.clientWidth / 2, ay = anchor?.y ?? el.clientHeight / 2;
  const wx = (el.scrollLeft + ax - PAD) / s0, wy = (el.scrollTop + ay - PAD) / s0;
  await animate(ms, (t) => {
    B.sc = s0 + (sc - s0) * t;
    sizeWorld();
    el.scrollLeft = wx * B.sc + PAD - ax; el.scrollTop = wy * B.sc + PAD - ay;
  });
  activeChip();
}
function scrollToSmooth(x: number, y: number, ms = 600) {
  const el = BX!.scroll, x0 = el.scrollLeft, y0 = el.scrollTop;
  return animate(ms, (t) => { el.scrollLeft = x0 + (x - x0) * t; el.scrollTop = y0 + (y - y0) * t; drawMini(); });
}
let chipOn = '';
function activeChip(k?: string) { if (k != null) chipOn = k; BX?.ctl.querySelectorAll<HTMLElement>('[data-z]').forEach((b) => b.classList.toggle('on', b.dataset.z === chipOn)); }
function drawMini() {
  const B = BX;
  if (!B) return;
  const el = B.scroll, over = el.scrollWidth > el.clientWidth + 4 || el.scrollHeight > el.clientHeight + 4;
  B.mini.style.opacity = over ? '1' : '0';
  const lay = lays[B.level]!, W = 190, k = W / (lay.w + PAD * 2), H = (lay.h + PAD * 2) * k;
  B.mini.style.width = `${W}px`; B.mini.style.height = `${H}px`;
  let h = '';
  for (const f of fileList) { const p = lay.pos[f]; h += `<i style="left:${(p.x + PAD) * k}px;top:${(p.y + PAD) * k}px;width:${p.w * k}px;height:${p.h * k}px"></i>`; }
  const vx = el.scrollLeft / B.sc, vy = el.scrollTop / B.sc, vw = el.clientWidth / B.sc, vh = el.clientHeight / B.sc;
  h += `<b style="left:${vx * k}px;top:${vy * k}px;width:${Math.min(W, vw * k)}px;height:${Math.min(H, vh * k)}px"></b>`;
  B.mini.innerHTML = h;
}
/** screen point of a world point */
function scr(x: number, y: number) { const B = BX!, r = rect(B.scroll); return { x: r.left + PAD + x * B.sc - B.scroll.scrollLeft, y: r.top + PAD + y * B.sc - B.scroll.scrollTop }; }
const rowWorld = (i: number) => { const lay = lays.functions!, f = R[i].file, p = lay.pos[f], g = boxGeom(f, 'functions').rows.find((r) => r.type === 'fn' && r.i === i)!; return { x: p.x, y: p.y + g.y, w: p.w }; };

function openBoxes(): HTMLElement {
  const v = seqv();
  const root = mk('ux-boxes', v);
  const scroll = mk('ux-scroll', root), sizer = mk('ux-sizer', scroll), world = mk('ux-world', sizer);
  const svg = document.createElementNS(svgNS, 'svg') as SVGSVGElement; svg.setAttribute('class', 'ux-ed'); svg.setAttribute('width', '3000'); svg.setAttribute('height', '3000'); world.appendChild(svg);
  const ctl = mk('ux-ctl', root, `<button class="chip" data-z="export">export</button><span class="gap"></span><button class="chip" data-z="all">fit all</button><button class="chip" data-z="width">fit width</button><button class="chip" data-z="100">100%</button><button class="chip" data-z="150">150%</button><span class="gap"></span><button class="chip" data-z="-">−</button><span class="ro"></span><button class="chip" data-z="+">+</button>`);
  const mini = mk('ux-mini', root);
  const boxes: Record<string, HTMLElement> = {};
  for (const f of fileList) { boxes[f] = mk('ux-bx', world); boxes[f].dataset.f = f; }
  BX = { root, scroll, sizer, world, svg, ctl, mini, level: 'functions', sc: 1, boxes, rows: {} };
  scroll.addEventListener('scroll', drawMini);
  setLevel('functions');
  BX.sc = fitScale('width'); sizeWorld(); activeChip('width');
  return root;
}
function chipEl(k: string) { return BX!.ctl.querySelector(`[data-z="${k}"]`) as HTMLElement; }
function lightRow(i: number | null) { const B = BX!; for (const [k, e] of Object.entries(B.rows)) e.classList.toggle('sel', Number(k) === i); }
function resetMarks() {
  const B = BX!;
  B.world.querySelectorAll('.dim,.on,.lit,.fade,.hot').forEach((e) => e.classList.remove('dim', 'on', 'lit', 'fade', 'hot'));
  B.world.querySelectorAll<HTMLElement>('.fr .c').forEach((e) => { e.textContent = ''; });
  B.world.querySelectorAll<HTMLElement>('.fr').forEach((e) => { e.style.background = ''; });
}
function edgeEls(a: number, b: number) { return [...BX!.svg.querySelectorAll<SVGElement>(`[data-a="${a}"][data-b="${b}"]`)]; }

/** Every route from function row A to function row B through the run's calls: [rows], with how often it is taken. */
function routes(a: number, bName: string) {
  const out: { rows: number[]; n: number; at: number[] }[] = [];
  for (let i = 0; i < R.length; i++) {
    if (short(R[i].name) !== bName || (R[i].kind !== 'step' && R[i].kind !== 'ref')) continue;
    const chain: number[] = [targetOf(i)!];
    for (let c = R[i].caller; c != null; c = R[c].caller) chain.unshift(c);
    const k = chain.indexOf(a);
    if (k < 0) continue;
    const rows = chain.slice(k), key = rows.join('>'), e = out.find((x) => x.rows.join('>') === key);
    if (e) { e.n++; e.at.push(i); } else out.push({ rows, n: 1, at: [i] });
  }
  return out;
}
const frameWords = (i: number) => R[i].frames.map((k) => run.frames[k]).filter((f) => f.kind === 'loop' || f.kind === 'guard').map((f) => (f.kind === 'loop' ? `in ${f.text}` : `past ${f.text} → ${f.label}`));
function routePts(rows: number[]) {
  const lay = lays.functions!, pts: { x: number; y: number }[] = [];
  const add = (p: { x: number; y: number }) => { const l = pts[pts.length - 1]; if (!l || Math.abs(l.x - p.x) > 0.5 || Math.abs(l.y - p.y) > 0.5) pts.push(p); };
  for (let k = 0; k + 1 < rows.length; k++) {
    const a = rows[k], b = rows[k + 1], e = lay.edges.find((x) => x.a === a && x.b === b), ra = rowWorld(a), rb = rowWorld(b);
    if (e) { add({ x: ra.x + ra.w - 30, y: ra.y + 10 }); for (const q of e.pts) add(q); add({ x: rb.x + 34, y: rb.y + 10 }); }
    else { add({ x: ra.x + 34, y: ra.y + 10 }); add({ x: ra.x + 10, y: ra.y + 10 }); add({ x: rb.x + 10, y: rb.y + 10 }); add({ x: rb.x + 34, y: rb.y + 10 }); }
  }
  return pts;
}
function showRoutes(rs: { rows: number[] }[], only = -1) {
  const B = BX!;
  resetMarks();
  const on = new Set<number>(), edges = new Set<string>(), files = new Set<string>();
  rs.forEach((r, k) => { if (only >= 0 && k !== only) return; r.rows.forEach((i) => { on.add(i); files.add(R[i].file); }); for (let j = 0; j + 1 < r.rows.length; j++) edges.add(`${r.rows[j]}>${r.rows[j + 1]}`); });
  for (const f of fileList) B.boxes[f].classList.toggle('fade', !files.has(f));
  for (const [k, e] of Object.entries(B.rows)) { e.classList.toggle('lit', on.has(Number(k))); e.classList.toggle('dim', !on.has(Number(k))); }
  B.world.querySelectorAll('.lpl').forEach((e) => e.classList.add('dim'));
  B.svg.querySelectorAll<SVGElement>('[data-a]').forEach((e) => { const k = `${e.dataset.a}>${e.dataset.b}`; e.classList.toggle('on', edges.has(k)); e.classList.toggle('dim', !edges.has(k)); });
  B.world.querySelectorAll<HTMLElement>('.ux-lab').forEach((e) => { const k = e.dataset.keys!.split(',').some((x) => edges.has(x)); e.classList.toggle('on', k); e.classList.toggle('dim', !k); });
}
async function travel(pts: { x: number; y: number }[], ms: number, onPoint?: (p: { x: number; y: number }) => void) {
  const B = BX!, dot = mk('ux-dot', B.world), trail = document.createElementNS(svgNS, 'path');
  trail.setAttribute('class', 'trail'); B.svg.appendChild(trail);
  const seg: number[] = [0];
  for (let k = 1; k < pts.length; k++) seg.push(seg[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y));
  const total = seg[seg.length - 1];
  await animate(ms, (t) => {
    const d = total * t;
    let k = 1; while (k < seg.length - 1 && seg[k] < d) k++;
    const f = (d - seg[k - 1]) / Math.max(1e-6, seg[k] - seg[k - 1]), p = { x: pts[k - 1].x + (pts[k].x - pts[k - 1].x) * f, y: pts[k - 1].y + (pts[k].y - pts[k - 1].y) * f };
    dot.style.left = `${p.x}px`; dot.style.top = `${p.y}px`;
    trail.setAttribute('d', `M${pts.slice(0, k).map((q) => `${q.x} ${q.y}`).join(' L')} L${p.x} ${p.y}`);
    onPoint?.(p);
  });
  await wait(250);
  dot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 * SLOW }).onfinish = () => dot.remove();
  trail.remove();
}
let prevCover: HTMLElement | null = null;
function coverPreview(html: string) {
  prevCover?.remove();
  const p = prevPane(), b = rect(p);
  prevCover = mk('ux-prev', document.body, html);
  prevCover.style.cssText = `left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px`;
  prevCover.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 * SLOW });
  return prevCover;
}
const uncoverPreview = () => { const c = prevCover; prevCover = null; if (c) c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250 * SLOW }).onfinish = () => c.remove(); };
function setViewChips(boxes: boolean) {
  document.querySelectorAll<HTMLElement>('.pane .ph .chip').forEach((c) => { const t = c.textContent!.trim(); if (t === 'sequence') c.classList.toggle('on', !boxes); if (t === 'boxes') c.classList.toggle('on', boxes); });
}

// ---------- the scenes ----------
interface Step { d: number; run: () => Promise<void> | void }
const visited = new Set<number>();
let noteEl: HTMLElement | null = null, footer: HTMLElement | null = null;
const S: Step[] = [];
const add = (d: number, run: Step['run']) => S.push({ d, run });

// intro
add(2.4, async () => {
  title('ideas', 'for the flow page', 'drawn on the real run of samples/tinyhttp · nothing here is built yet');
  await wait(600); press('ArrowRight'); await wait(700); press('ArrowRight');
});
// sequence 1 + 10
add(4.2, async () => {
  title('sequence 1 · 10', 'quieter structure, readable dimming', 'only the chain you are in keeps its bars · rows off it stay readable');
  const r = rowEl(13)!;
  await cursorAt(r.el.querySelector('.nm')!, 0.5, 0.5, 600); await clickFx(); await jumpTo(13);
  await wait(1300);
  seqv().classList.add('ux-quiet');
  say('', 'bars: only main › start › handle › parse_headers › trim', '· far rows at .55 instead of .42', 2000);
  await wait(400); hideCursor();
});
// sequence 2 + 13
add(4.6, async () => {
  title('sequence 2 · 13', 'the return route, with motion', 'a dashed line back through the caller · glide into a call, arc out of it');
  press('ArrowRight'); await wait(650); press('ArrowRight'); await wait(900);
  press('ArrowRight');
  await wait(650);
  const a = rowEl(15)!, b = rowEl(16)!, ba = barOf(10), bb = barOf(9);
  if (!ba || !bb) return;
  const y1 = a.top + 11.5, y2 = b.top + 11.5, x0 = a.left - 6, xa = ba.left + 1.5, xb = bb.left + 1.5, ybot = ba.top + ba.h;
  const sv = document.createElementNS(svgNS, 'svg'); sv.setAttribute('class', 'ux-ret'); sv.setAttribute('width', '1000'); sv.setAttribute('height', '2000');
  sv.innerHTML = `<path class="arc" d="M${x0} ${y1} L${xa + 5} ${y1} Q${xa} ${y1} ${xa} ${y1 + 5} L${xa} ${ybot} Q${xa} ${ybot + 4} ${xa - 4} ${ybot + 4} L${xb + 4} ${ybot + 4} Q${xb} ${ybot + 4} ${xb} ${ybot + 8} L${xb} ${y2 - 4} Q${xb} ${y2} ${xb + 4} ${y2} L${b.left - 8} ${y2}"/><path class="hd" d="M${b.left - 14} ${y2 - 3.5} L${b.left - 8} ${y2} L${b.left - 14} ${y2 + 3.5}"/>`;
  L.appendChild(sv);
  const lab = mk('ux-retlab', L, '↩ parse_headers returned · back in handle'); lab.style.left = '470px'; lab.style.top = `${y2 - 8}px`;
  const path = sv.querySelector('.arc') as SVGPathElement, len = path.getTotalLength(), dot = mk('ux-rdot', L);
  await animate(700, (t) => { const p = path.getPointAtLength(len * t); dot.style.left = `${p.x}px`; dot.style.top = `${p.y}px`; });
  dot.remove();
  await wait(1500);
  sv.remove(); lab.remove();
});
// sequence 3
let codeBox: HTMLElement | null = null;
function putCode(it: number) {
  codeBox?.remove(); codeBox = null;
  const r = rowOf(it);
  if (r.caller == null || !r.at) return;
  const f = R[r.caller].file, l = r.at.line;
  const inn = document.querySelector('.sband .in');
  if (!inn) return;
  codeBox = document.createElement('div'); codeBox.className = 'ux-code';
  codeBox.innerHTML = `<div class="from">from ${short(R[r.caller].name)} · ${base(f)}:${l + 1}</div>${codeLines(f, l - 1, l + 1, l)}`;
  inn.insertBefore(codeBox, inn.querySelector('.facts'));
  remeasure();
}
add(3.8, async () => {
  title('sequence 3', 'code in the box', 'the lines around the call, inside the step itself');
  await wait(300); putCode(16); await wait(3000);
});
// sequence 4
add(3.6, async () => {
  title('sequence 4', 'peek', 'hover any row to read its code · the selected step stays where it is');
  const r = rowEl(22)!, nm = r.el.querySelector('.nm')!;
  await cursorAt(nm, 0.6, 0.5, 600);
  const row = R[s.items[22]], b = rect(nm), lb = rect(L);
  const pk = mk('ux-peek', L, `<div class="h">${row.n} ${short(row.name)} <i>${base(row.file)}:${row.line + 1}</i></div><div class="mc">${codeLines(row.file, row.start, row.start + Math.min(row.lines, 7) - 1)}</div>`);
  const end = rect(r.el.lastElementChild!), up = b.top > rect(seqv()).top + seqv().clientHeight * 0.55;
  pk.style.left = `${end.right - lb.left + 30}px`;
  pk.style.top = up ? `${b.bottom - lb.top - pk.offsetHeight + 6}px` : `${b.top - lb.top - 4}px`;
  pk.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 220 * SLOW });
  await wait(2200);
  await cursorTo(cx + 260, cy + 120, 400);
  pk.remove(); hideCursor();
});
// sequence 5
add(4, async () => {
  title('sequence 5', 'breadcrumbs', 'the whole call chain above the run · click a name to go there');
  crumbsEl = mk('ux-crumbs', document.body); document.body.classList.add('ux-crumbs-on'); drawCrumbs();
  crumbsEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 * SLOW });
  await wait(900);
  const c = crumbsEl.querySelectorAll<HTMLElement>('.c')[1];
  await cursorAt(c, 0.5, 0.6, 600); crumbHot = 'start'; drawCrumbs(); await wait(500); await clickFx();
  codeBox?.remove(); codeBox = null;
  crumbHot = ''; await jumpTo(4); remeasure();
  await wait(1200); hideCursor();
});
// sequence 6
add(4, async () => {
  title('sequence 6', 'chapters on the spine', 'the run’s parts, from main’s own calls and loops · click one to go there');
  const sp = seqv().querySelector('.sspine')!, b = rect(sp), v = rect(seqv());
  await cursorTo(b.left + 3, b.top + b.height * 0.3, 600);
  const H = b.height - 6, y = (it: number) => b.top + 3 - v.top + (it / N) * H;
  const ch: [number, number, string, string][] = [[0, 4, '1–4', 'start-up · load_config, Server'], [4, 29, '5–22', 'start · listen, the metrics thread, the request loop'], [29, 31, '23', 'shutdown · stop']];
  const box = mk('ux-chap', seqv());
  ch.forEach(([a, z], k) => { const seg = mk(`seg s${k % 2}`, box); seg.style.cssText = `top:${y(a) + 3}px;height:${y(z) - y(a) - 6}px;left:${b.left - v.left - 6}px`; });
  const list = mk('ux-chlist', seqv(), ch.map(([a, , k, t]) => `<div data-a="${a}"><b>${k}</b>${t}</div>`).join('') + '<div class="sub" data-a="8"><b>9–22</b>↻ while (running_ &amp;&amp; socket_.accept(req))</div>');
  list.style.right = `${v.right - b.left + 14}px`; list.style.top = `${y(0) + 4}px`;
  list.animate([{ opacity: 0, transform: 'translateX(6px)' }, { opacity: 1, transform: 'none' }], { duration: 240 * SLOW });
  await wait(900);
  const target = list.querySelector('[data-a="8"]') as HTMLElement;
  await cursorAt(target, 0.4, 0.5, 600); target.classList.add('hot'); await wait(300); await clickFx();
  await jumpTo(8); remeasure();
  await wait(500); list.remove(); box.remove(); hideCursor();
});
// sequence 7
add(4.4, async () => {
  title('sequence 7', 'fold a big call', 'handle’s steps fold into one row with a mini spine of its own · Enter unfolds');
  const r = rowEl(9)!;
  await cursorAt(r.el.querySelector('.nm')!, 0.5, 0.5, 500);
  say('⇧ F', 'fold handle', '19 rows', 1500);
  await wait(300);
  const at = collapse(10, 28, 25);
  const inside = Array.from({ length: 19 }, (_, k) => 10 + k), steps = inside.filter((it) => rowOf(it).kind === 'step').length;
  const names = inside.filter((it) => rowOf(it).caller === s.items[9]).map((it) => short(rowOf(it).kind === 'indirect' ? rowOf(it).text! : rowOf(it).name));
  const st = mk('ux-strip ux-keep', L, `<span class="pl">+</span>${steps} steps<span class="w">${names.join(' · ')}</span><span class="mini">${inside.map((it) => `<i style="height:${(rowOf(it).depth - 2) * 3}px"></i>`).join('')}</span>`);
  st.style.left = `${at.left + 16}px`; st.style.top = `${at.top}px`;
  st.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 * SLOW, delay: 200 * SLOW, fill: 'backwards' });
  await wait(2400);
  say('Enter', 'unfold', '', 1200);
  st.remove(); expand(); hideCursor();
});
// sequence 8
add(6.4, async () => {
  title('sequence 8', 'search and paths', 'find a function, pick one of its paths from main · → then follows that path');
  const pal = mk('ux-pal', seqv(), '<div class="in"><span class="q">/</span><span class="tx"></span><span class="caret"></span></div><div class="res"></div>');
  pal.animate([{ opacity: 0, transform: 'translate(-50%,-6px)' }, { opacity: 1, transform: 'translate(-50%,0)' }], { duration: 220 * SLOW });
  const tx = pal.querySelector('.tx')!;
  for (const ch of 'split') { tx.textContent += ch; await wait(110); }
  const rs = routes(0, 'split');
  const res = pal.querySelector('.res')!;
  res.innerHTML = `<div class="h">split · strings.cpp · runs at 12, →12 ×2 · ${rs.length} paths from main</div>` +
    rs.map((r, k) => `<div class="p" data-k="${k}"><b>${k + 1}</b>${r.rows.map((i) => short(R[i].name)).join('<i>›</i>')}<span class="w">${r.n > 1 ? `×${r.n} · ` : ''}${frameWords(r.at[0]).slice(-1)[0] ?? ''}</span></div>`).join('');
  await wait(900);
  const p2 = res.querySelector('[data-k="1"]') as HTMLElement;
  await cursorAt(p2, 0.3, 0.5, 500); p2.classList.add('hot'); await wait(300); await clickFx();
  pal.remove();
  const path = rs[1].rows.slice(0, -1).map(itemOfRow).concat(rs[1].at.map(itemOfRow));
  seqv().classList.add('ux-path'); document.body.classList.add('ux-nocap');
  const mark = () => { for (const d of domRows()) d.el.classList.toggle('ux-on', path.includes(d.it)); };
  mark();
  say('', 'following path 2', 'main › start › handle › route › match_path › split');
  hideCursor();
  for (const it of [4, 9, 16, 17, 18]) { await wait(560); await jumpTo(it); await raw(30); mark(); }
  await wait(500); document.body.classList.remove('ux-nocap');
});
// sequence 11
add(3.4, async () => {
  title('sequence 11', 'share a walk', 'a link reopens this exact walk · or export it as a walkthrough');
  seqv().classList.remove('ux-path'); domRows().forEach((d) => d.el.classList.remove('ux-on'));
  const chip = [...document.querySelectorAll<HTMLElement>('.pane .ph .chip')].find((c) => c.textContent!.trim() === 'refresh')!;
  const share = document.createElement('button'); share.className = 'chip ux-share'; share.textContent = 'share'; chip.after(share);
  await cursorAt(share, 0.5, 0.6, 600); await clickFx();
  const b = rect(share);
  const menu = mk('ux-menu', document.body, '<div class="hot">copy link to this walk</div><div>export walkthrough (.md)</div><div>export picture (SVG · PNG)</div>');
  menu.style.right = `${innerWidth - b.right}px`; menu.style.top = `${b.bottom + 4}px`;
  await wait(600);
  await cursorAt(menu.firstElementChild!, 0.4, 0.5, 400); await clickFx();
  menu.remove();
  toast('link copied <span>skycodex://walk/tinyhttp/main?at=→12&amp;path=2&amp;pass=1</span>', 1700);
  await wait(1400); share.remove(); hideCursor();
});
// sequence 12
add(7.2, async () => {
  title('sequence 12', 'tour', 'plays on its own, names each step and who called it, and waits at each loop and decision');
  document.body.classList.add('ux-nocap');
  press('Home'); await wait(500);
  const tell = (it: number) => {
    const r = rowOf(it), c = r.caller != null ? short(R[r.caller].name) : '';
    const loop = r.frames.map((k) => run.frames[k]).filter((f) => f.kind === 'loop').pop();
    say('tour', `${r.n} ${short(r.name)}`, `${c ? `called by ${c}` : 'the start of the run'}${loop ? ` · ${loop.count != null ? `×${loop.count}` : 'in a loop'}` : ' · once'}`, 0);
  };
  tell(0);
  for (let it = 1; it <= 8; it++) { await wait(470); press('ArrowRight'); tell(it); }
  await wait(300);
  say('tour waits', 'a loop: while (running_ && socket_.accept(req))', 'R another pass · L leave · ↵ go on', 0);
  await wait(1700);
  capEl?.remove(); capEl = null; document.body.classList.remove('ux-nocap');
});
// boxes 1 + 2
add(4.2, async () => {
  title('boxes 1 · 2 · 7', 'built from the run, one selected step', 'Tab: rows glide into their files · numbered lines go row to row · entry points left, helpers right');
  say('Tab', 'boxes', '', 1200);
  const src = domRows().filter((d) => d.it < N && rowOf(d.it).kind === 'step').map((d) => ({ i: s.items[d.it], b: rect(d.el.querySelector('.n')!), sel: d.el.classList.contains('sel') }));
  const root = openBoxes();
  root.style.opacity = '0';
  root.querySelectorAll<HTMLElement>('.fr').forEach((e) => { e.style.opacity = '0'; });
  setViewChips(true);
  const fly: HTMLElement[] = [];
  for (const x of src) {
    const tgt = BX!.rows[x.i];
    if (!tgt) continue;
    const tb = rect(tgt.querySelector('.n')!);
    const c = mk('ux-fly', document.body, `<span class="n">${R[x.i].n}</span><span>${short(R[x.i].name)}</span>`);
    c.style.left = `${x.b.left}px`; c.style.top = `${x.b.top}px`; if (x.sel) c.classList.add('sel');
    fly.push(c);
    requestAnimationFrame(() => requestAnimationFrame(() => { c.style.transform = `translate(${tb.left - x.b.left}px, ${tb.top - x.b.top}px) scale(${BX!.sc})`; }));
  }
  root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380 * SLOW, fill: 'forwards' });
  await wait(700);
  root.style.opacity = '1';
  root.querySelectorAll<HTMLElement>('.fr').forEach((e) => { e.style.opacity = ''; });
  fly.forEach((c) => c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 * SLOW }).onfinish = () => c.remove());
  lightRow(s.items[curIt()]);
  await wait(2600);
});
// boxes: scale
add(7.6, async () => {
  title('boxes', 'fit width, fit all or any scale · scroll for the rest', 'presets or ⌥ wheel · scrollbars and a minimap when it is larger than the view');
  const z100 = chipEl('100');
  await cursorAt(z100, 0.5, 0.6, 600); await clickFx(); activeChip('100'); await zoomTo(1, 520);
  await wait(500);
  hideCursor();
  const el = BX!.scroll;
  await scrollToSmooth(el.scrollWidth - el.clientWidth, el.scrollTop + 160, 900);
  await wait(300);
  const z150 = chipEl('150');
  await cursorAt(z150, 0.5, 0.6, 450); await clickFx(); activeChip('150'); await zoomTo(1.5, 520);
  await wait(300);
  const m = BX!.mini;
  await cursorAt(m, 0.2, 0.3, 450);
  await scrollToSmooth(0, 0, 700);
  await wait(300);
  const zw = chipEl('width');
  await cursorAt(zw, 0.5, 0.6, 500); await clickFx(); activeChip('width'); await zoomTo(fitScale('width'), 520);
  await wait(400); hideCursor();
});
// boxes 3
add(5.4, async () => {
  title('boxes 3', 'semantic zoom', 'functions → files → folders as you zoom out · every level stays readable');
  const minus = chipEl('-');
  await cursorAt(minus, 0.5, 0.6, 500);
  await clickFx(); activeChip(''); await zoomTo(BX!.sc * 0.86, 300);
  await clickFx();
  BX!.root.classList.add('swap'); await wait(160);
  setLevel('files'); BX!.sc = 0.56; sizeWorld(); BX!.scroll.scrollTo(0, 0); BX!.root.classList.remove('swap');
  say('', 'files', 'each box says what is inside', 1100);
  await wait(1300);
  await clickFx();
  BX!.root.classList.add('swap'); await wait(160);
  setLevel('folders'); BX!.sc = 0.44; sizeWorld(); BX!.scroll.scrollTo(0, 0); BX!.root.classList.add('lv-folders'); BX!.root.classList.remove('swap');
  say('', 'folders', 'src · src/net · src/http · src/util', 1100);
  await wait(1300);
  const plus = chipEl('+');
  await cursorAt(plus, 0.5, 0.6, 300); await clickFx();
  BX!.root.classList.add('swap'); await wait(160);
  setLevel('functions'); BX!.sc = fitScale('width'); sizeWorld(); activeChip('width'); BX!.root.classList.remove('swap', 'lv-folders');
  lightRow(s.items[curIt()]);
  await wait(500); hideCursor();
});
// boxes 4: routes between two functions
add(11, async () => {
  title('boxes 4', 'every route between two functions', 'numbers stay on every line · pick a start and an end: its routes light, the rest steps back');
  lightRow(null);
  const B = BX!;
  await cursorAt(B.rows[0].querySelector('.nm')!, 0.5, 0.5, 600); await clickFx();
  B.rows[0].classList.add('lit');
  const bar = mk('ux-pathbar', B.root, '<span class="h">route</span> from <b>main</b> to <span class="pick">⇧-click a second function</span>');
  bar.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 * SLOW });
  await wait(500);
  await cursorAt(B.rows[11].querySelector('.nm')!, 0.5, 0.5, 700);
  say('⇧ click', 'split', '', 1000); await clickFx();
  const rs = routes(0, 'split');
  bar.innerHTML = `<span class="h">route</span> from <b>main</b> to <b>split</b> · ${rs.length} routes <span class="esc">Esc clears</span>`;
  showRoutes(rs);
  const list = coverPreview(`<div class="ph"><span style="color:var(--bright)">${rs.length} routes · main → split</span><span class="grow"></span><span class="chip">both</span></div>` +
    rs.map((r, k) => `<div class="ux-route" data-k="${k}"><div class="t"><b>${k + 1}</b>${r.rows.map((i) => short(R[i].name)).join('<i>›</i>')}</div><div class="w">${r.rows.length - 1} calls${r.n > 1 ? ` · taken ×${r.n}` : ''}</div>${frameWords(r.at[0]).map((w) => `<div class="f">${esc(w)}</div>`).join('')}</div>`).join('') +
    '<div class="ways pv"><span><b>1 2</b> one route</span><span><b>→</b> walk it</span><span><b>Esc</b> clear</span></div>');
  await wait(1800);
  const r2 = list.querySelector('[data-k="1"]') as HTMLElement;
  await cursorAt(r2, 0.35, 0.3, 600); r2.classList.add('hot'); list.querySelector('[data-k="0"]')!.classList.add('dim');
  showRoutes(rs, 1);
  await wait(700); await clickFx();
  say('→', 'walk route 2', 'main › start › handle › route › match_path › split', 2400);
  hideCursor();
  const pts = routePts(rs[1].rows);
  const seen = new Set<number>();
  await travel(pts, 3200, (p) => {
    for (const i of rs[1].rows) { if (seen.has(i)) continue; const w = rowWorld(i); if (Math.abs(p.y - (w.y + 10)) < 3 && p.x >= w.x && p.x <= w.x + w.w) { seen.add(i); B.rows[i].classList.add('hot'); } }
  });
  await wait(600);
  r2.classList.remove('hot'); list.querySelector('[data-k="0"]')!.classList.remove('dim');
  showRoutes(rs);
  await wait(900);
  bar.remove(); uncoverPreview(); resetMarks(); lightRow(s.items[curIt()]);
});
// boxes 5
add(4, async () => {
  title('boxes 5', 'focus', 'one function and two levels around it · the rest fades');
  const B = BX!, me = 10;
  await cursorAt(B.rows[me].querySelector('.nm')!, 0.5, 0.5, 600); await clickFx();
  say('F', 'focus parse_headers', 'callers: handle, start · calls: split, trim, is_space', 1900);
  const keep = new Set<number>([me]);
  let up: number[] = [me];
  for (let d = 0; d < 2; d++) up = up.flatMap((i) => calls.filter((c) => c.b === i).map((c) => c.a)), up.forEach((i) => keep.add(i));
  let dn: number[] = [me];
  for (let d = 0; d < 2; d++) dn = dn.flatMap((i) => calls.filter((c) => c.a === i).map((c) => c.b)), dn.forEach((i) => keep.add(i));
  const files = new Set([...keep].map((i) => R[i].file));
  for (const f of fileList) B.boxes[f].classList.toggle('fade', !files.has(f));
  for (const [k, e] of Object.entries(B.rows)) { e.classList.toggle('dim', !keep.has(Number(k))); e.classList.toggle('lit', Number(k) === me); }
  B.world.querySelectorAll('.lpl').forEach((e) => e.classList.add('dim'));
  const kept = (x: string) => { const [a, b] = x.split('>').map(Number); return keep.has(a) && keep.has(b); };
  B.svg.querySelectorAll<SVGElement>('[data-a]').forEach((e) => { const k = kept(`${e.dataset.a}>${e.dataset.b}`); e.classList.toggle('on', k); e.classList.toggle('dim', !k); });
  B.world.querySelectorAll<HTMLElement>('.ux-lab').forEach((e) => { const k = e.dataset.keys!.split(',').some(kept); e.classList.toggle('on', k); e.classList.toggle('dim', !k); });
  await wait(2600);
  resetMarks(); lightRow(s.items[curIt()]); hideCursor();
});
// boxes 6
add(4, async () => {
  title('boxes 6', 'how often', 'a row’s shade comes from the loops around it: once · a known count · one, two or three loops deep');
  const B = BX!;
  for (const [k, e] of Object.entries(B.rows)) {
    const loops = R[Number(k)].frames.map((f) => run.frames[f]).filter((f) => f.kind === 'loop');
    const known = loops.length === 1 && loops[0].count != null;
    const lv = known ? 1 : loops.length;
    e.style.background = lv ? `rgba(111,158,158,${[0, 0.1, 0.2, 0.32, 0.4][Math.min(4, lv)]})` : '';
    e.querySelector('.c')!.textContent = known ? `×${loops[0].count}` : lv ? `${lv} loop${lv > 1 ? 's' : ''}` : 'once';
  }
  const lg = mk('ux-legend', B.root, '<span><i style="background:transparent;border:1px solid #2e322e"></i>once</span><span><i style="background:rgba(111,158,158,.1)"></i>×4 · 1 loop</span><span><i style="background:rgba(111,158,158,.2)"></i>2 loops</span><span><i style="background:rgba(111,158,158,.32)"></i>3 loops</span>');
  lg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 * SLOW });
  await wait(3400);
  lg.remove(); resetMarks(); lightRow(s.items[curIt()]);
});
// boxes 9
add(4.6, async () => {
  title('boxes 9', 'follow a line', 'click a line: the view glides to the other end and the call site lights');
  const B = BX!;
  activeChip('100'); await zoomTo(1, 380, { x: 0, y: 0 });
  const sx = lays.functions!.pos['src/server.cpp'];
  await scrollToSmooth(Math.max(0, sx.x - 120), Math.max(0, sx.y - 60), 400);
  const e = edgeEls(9, 22)[0] as SVGPathElement;
  const L0 = e.getTotalLength(), mid = e.getPointAtLength(L0 * 0.35), p = scr(mid.x, mid.y);
  await cursorTo(p.x, p.y, 600); e.classList.add('on'); B.world.querySelectorAll<HTMLElement>('.ux-lab').forEach((l) => { if (l.dataset.keys!.split(',').includes('9>22')) l.classList.add('on'); }); await wait(250); await clickFx();
  const t = rowWorld(22);
  hideCursor();
  await scrollToSmooth(Math.max(0, t.x * B.sc + PAD - B.scroll.clientWidth / 2 + 130), Math.max(0, t.y * B.sc + PAD - B.scroll.clientHeight / 2), 800);
  B.rows[22].classList.add('hot');
  await jumpTo(22); lightRow(22);
  say('', 'send_response', 'called from handle · server.cpp:30', 1500);
  await wait(1800);
  e.classList.remove('on'); B.rows[22].classList.remove('hot');
});
// boxes 10
add(3, async () => {
  title('boxes 10', 'export', 'the view as a picture for docs and reviews');
  const ex = chipEl('export');
  await cursorAt(ex, 0.5, 0.6, 500); await clickFx();
  const b = rect(ex);
  const menu = mk('ux-menu', document.body, '<div class="hot">picture · SVG</div><div>picture · PNG</div><div>this view only · or the whole map</div>');
  menu.style.left = `${b.left}px`; menu.style.top = `${b.top - 92}px`;
  await wait(600); await cursorAt(menu.firstElementChild!, 0.4, 0.5, 350); await clickFx(); menu.remove();
  toast('saved <span>tinyhttp-flow.svg · 8 boxes, 7 lines</span>', 1500);
  await wait(1200); hideCursor();
});
// new: loupe
add(4.6, async () => {
  title('new', 'loupe', 'hold ⌥ over a small diagram to read it at full size, without zooming');
  const B = BX!;
  const za = chipEl('all');
  await cursorAt(za, 0.5, 0.6, 450); await clickFx(); activeChip('all'); await zoomTo(fitScale('all') * 0.72, 450, { x: 0, y: 0 });
  await scrollToSmooth(0, 0, 200);
  say('⌥', 'loupe', '', 1200);
  const lens = mk('ux-lens', document.body), inner = B.world.cloneNode(true) as HTMLElement;
  inner.className = 'ux-world'; lens.appendChild(inner);
  const K = 1.25, LW = 330, LH = 200;
  let live = true;
  const follow = () => {
    if (!live) return;
    const r = rect(B.scroll), wx = (cx - r.left + B.scroll.scrollLeft - PAD) / B.sc, wy = (cy - r.top + B.scroll.scrollTop - PAD) / B.sc;
    lens.style.left = `${cx - LW / 2}px`; lens.style.top = `${cy - LH / 2}px`;
    inner.style.transform = `translate(${LW / 2 - wx * K}px, ${LH / 2 - wy * K}px) scale(${K})`;
    requestAnimationFrame(follow);
  };
  const p0 = scr(lays.functions!.pos['src/server.cpp'].x + 60, lays.functions!.pos['src/server.cpp'].y + 60);
  await cursorTo(p0.x, p0.y, 400); follow();
  lens.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 * SLOW });
  const p1 = scr(lays.functions!.pos['src/util/strings.cpp'].x + 90, lays.functions!.pos['src/util/strings.cpp'].y + 50);
  await cursorTo(p1.x, p1.y, 2200);
  await wait(500);
  live = false; lens.remove(); hideCursor();
});
// back to the sequence
add(1.4, async () => {
  title('', 'back to the sequence', 'Tab');
  say('Tab', 'sequence', '', 1000);
  const r = BX!.root; BX = null;
  r.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350 * SLOW }).onfinish = () => r.remove();
  setViewChips(false);
  await jumpTo(9);
});
// new: what if (+ sequence 9, compare)
add(6.6, async () => {
  title('new · sequence 9', 'what if · compare', 'flip a condition: what it skips folds away · compare both shapes side by side');
  await wait(200);
  const r = rowEl(16)!, nt = r.el.querySelector('.nt')!;
  await cursorAt(nt, 0.4, 0.5, 600); await clickFx();
  const b = rect(nt), lb = rect(L);
  const menu = mk('ux-menu ux-keep', L, '<div class="hot">what if headers.empty() is true?</div><div>where is headers set?</div>');
  menu.style.left = `${b.left - lb.left}px`; menu.style.top = `${b.bottom - lb.top + 4}px`;
  await wait(600); await cursorAt(menu.firstElementChild!, 0.4, 0.5, 350); await clickFx(); menu.remove();
  const at = collapse(16, 28, 27);
  const st = mk('ux-strip what ux-keep', L, '<span class="pl">?</span>if headers.empty(): handle returns<span class="w">13 rows skip</span><span class="chip ux-cmp">compare ⇄</span>');
  st.style.left = `${at.left - 10}px`; st.style.top = `${at.top}px`;
  st.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 * SLOW, delay: 200 * SLOW, fill: 'backwards' });
  await wait(1300);
  const cmp = st.querySelector('.ux-cmp')!;
  await cursorAt(cmp, 0.5, 0.6, 450); await clickFx();
  const yes = [16, 17, 18, 20, 21, 22, 23, 25, 26, 27, 28].map((it) => `<div><span class="n">${num(it)}</span>${rowOf(it).kind === 'indirect' ? rowOf(it).text : short(rowOf(it).name)}${it === 18 || it === 23 ? ' <i>×2</i>' : ''}</div>`).join('');
  const pan = mk('ux-cmp-pan ux-keep', L, `<div class="col"><div class="h">headers present</div>${yes}</div><div class="col"><div class="h">headers.empty()</div><div class="rt">return Response{400, …}</div><div class="no">13 rows skipped</div><div class="no">↻ next pass of while (running_ &amp;&amp; …)</div></div>`);
  pan.style.left = '545px';
  pan.style.top = `${rect(seqv()).bottom - 14 - pan.offsetHeight - rect(L).top}px`;
  pan.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260 * SLOW });
  hideCursor();
  await wait(2400);
  pan.remove(); st.remove(); expand();
});
// new: depth skyline
add(5, async () => {
  title('new', 'depth skyline', 'the whole run as a profile of call depth · drag along it to scrub');
  document.body.classList.add('ux-nocap');
  const v = seqv();
  footer = mk('ux-sky', v, '<canvas></canvas>');
  const cv = footer.querySelector('canvas')!, W = v.clientWidth - 40, H = 46, dpr = devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = `${W}px`; cv.style.height = `${H}px`;
  const draw = (at: number) => {
    const x = cv.getContext('2d')!; x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
    const bw = W / N;
    for (let i = 0; i < N; i++) {
      const r = rowOf(i), loops = r.frames.filter((k) => run.frames[k].kind === 'loop').length;
      if (loops) { x.fillStyle = `rgba(111,158,158,${0.05 + loops * 0.05})`; x.fillRect(i * bw, 0, bw, H); }
      const h = 6 + r.depth * 7;
      x.fillStyle = i === at ? '#ad9b6f' : r.kind === 'step' ? '#4a504a' : '#33373a';
      x.fillRect(i * bw + 1, H - h, bw - 2, h);
    }
  };
  draw(curIt());
  footer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 * SLOW });
  const fb = rect(cv);
  await cursorTo(fb.left + 8, fb.top + 30, 500);
  for (let k = 0; k <= 14; k++) {
    const it = Math.min(N - 1, Math.round((k / 14) * 22));
    await cursorTo(fb.left + (it + 0.5) * (fb.width / N), fb.top + 30, 170);
    if (rowEl(it) || rowOf(it).kind === 'step') { await jumpTo(it); draw(it); }
  }
  await wait(400);
  hideCursor();
  document.body.classList.remove('ux-nocap');
});
// new: jump letters
add(4, async () => {
  title('new', 'jump letters', 'press F: every row in view gets two letters · type them to go there');
  footer?.remove(); footer = null;
  say('F', 'jump', '', 1000);
  const keys = 'as ad af aj ak al sd sf sj sk sl df dj dk dl fj fk fl jk jl kl qa qs qd qf qj qk ql wa ws wd'.split(' ');
  const rows = domRows().filter((d) => !d.el.classList.contains('sel'));
  const lbs = rows.map((d, k) => { const e = mk('ux-hint', L, keys[k]); e.style.left = `${d.left - 4}px`; e.style.top = `${d.top + 3}px`; return { e, d, k: keys[k] }; });
  const tgt = lbs.find((x) => x.d.it === 26) ?? lbs[lbs.length - 1];
  await wait(1100);
  say('', tgt.k[0], '', 700);
  for (const x of lbs) if (x.k[0] !== tgt.k[0]) x.e.style.opacity = '.15';
  await wait(700);
  say('', tgt.k, '', 700);
  await wait(250);
  lbs.forEach((x) => x.e.remove());
  await jumpTo(tgt.d.it);
  await wait(1200);
});
// new: what you have read
add(3.6, async () => {
  title('new', 'what you’ve read', 'steps you have been to are ticked · the count says what is left');
  readNote = `read ${[...visited].filter((it) => it < N && rowOf(it).kind === 'step').length} of 23 steps`;
  const ticks: HTMLElement[] = [];
  for (const d of domRows()) if (visited.has(d.it)) { const t = mk('ux-tick', L, '✓'); t.style.left = '4px'; t.style.top = `${d.top}px`; ticks.push(t); t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 * SLOW, delay: ticks.length * 30 * SLOW, fill: 'backwards' }); }
  await wait(3200);
  ticks.forEach((t) => t.remove()); readNote = '';
});
// new: margin notes
add(4.4, async () => {
  title('new', 'margin notes', 'a note pinned to a step · it travels with the walk’s link');
  say('N', 'note', '', 900);
  const d = rowEl(curIt())!;
  noteEl = mk('ux-note ux-keep', L, '<span class="i">✎</span><span class="tx"></span><span class="caret"></span>');
  noteEl.style.left = '470px'; noteEl.style.top = `${d.top}px`;
  const ld = mk('ux-lead ux-keep', L); const nm = rect(d.el.lastElementChild!), lb = rect(L);
  ld.style.left = `${nm.right - lb.left + 10}px`; ld.style.top = `${d.top + 11.5}px`; ld.style.width = `${470 - (nm.right - lb.left + 10) - 6}px`;
  const tx = noteEl.querySelector('.tx')!;
  for (const ch of 'check: what if the Connection header is missing?') { tx.textContent += ch; await wait(28); }
  await wait(300);
  noteEl.querySelector('.caret')!.remove(); noteEl.classList.add('pinned');
  const sp = rect(seqv().querySelector('.sspine')!), v = rect(seqv());
  const pin = mk('ux-pin', seqv()); pin.style.top = `${sp.top - v.top + 3 + (curIt() / N) * (sp.height - 6) - 2}px`; pin.style.right = '13px';
  await wait(1400);
  noteEl.remove(); ld.remove(); pin.remove(); noteEl = null;
});
// new: change ripple
add(5, async () => {
  title('new', 'change ripple', 'after an edit, where the changed function runs and every chain that reaches it');
  await jumpTo(12); await wait(500);
  const marks: HTMLElement[] = [];
  const chain = new Set([0, 4, 9, 10].map(itemOfRow));
  const tinted: HTMLElement[] = [];
  for (const d of domRows()) {
    if (short(rowOf(d.it).name) === 'trim') { const m = mk('ux-chg', L); m.style.left = '4px'; m.style.top = `${d.top + 4}px`; marks.push(m); d.el.classList.add('ux-chg-row'); tinted.push(d.el); }
    else if (chain.has(d.it)) { const m = mk('ux-chg c', L); m.style.left = '4px'; m.style.top = `${d.top + 4}px`; marks.push(m); d.el.classList.add('ux-chain-row'); tinted.push(d.el); }
  }
  say('', 'trim() changed', 'runs at 13 and →13 · reached by main › start › handle › parse_headers', 0);
  const card = mk('ux-ripple ux-keep', L, '<div class="h">trim() · edited, not saved</div><div>runs at <b>13</b> and <b>→13</b> · order with its sibling: compiler’s choice</div><div>in while (running_ &amp;&amp; socket_.accept(req))</div><div>in for (auto line : split(raw, "\\r\\n"))</div>');
  const d = rowEl(12)!; card.style.left = '520px'; card.style.top = `${d.top - 120}px`;
  card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 * SLOW });
  await wait(3800);
  marks.forEach((m) => m.remove()); tinted.forEach((e) => e.classList.remove('ux-chg-row', 'ux-chain-row')); card.remove(); capEl?.remove(); capEl = null;
});
// end
add(2.6, () => {
  title('that’s the set', 'sequence 1–13 · boxes 1–10 · seven new ideas', 'tell me what to build first');
});

// ---------- styles ----------
function styles() {
  const k = SLOW, T = `cubic-bezier(.16,1,.3,1)`;
  const css = `
.seqin { transition-duration: ${0.5 * k}s !important; }
.srow, .sframe, .sbar, .sarw { transition-duration: ${0.42 * k}s !important; }
.sband { transition-duration: ${0.42 * k}s, ${0.3 * k}s !important; animation-duration: ${0.42 * k}s !important; }
.ux-layer { position: absolute; left: 0; top: 0; right: 0; height: 0; z-index: 4; pointer-events: none; }
.ux-cursor { position: fixed; z-index: 100000; pointer-events: none; width: 18px; height: 22px; margin: -2px 0 0 -3px; opacity: 0; filter: drop-shadow(0 2px 3px rgba(0,0,0,.6)); }
.ux-ring { position: fixed; z-index: 99999; width: 26px; height: 26px; border: 1.5px solid var(--accent); pointer-events: none; }
.ux-title { position: fixed; left: 300px; right: 150px; text-align: center; z-index: 9999; font: 300 13.5px var(--ui); color: #c9cdc5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }
.ux-title .k { font: 12px var(--mono); color: var(--accent); margin-right: 12px; }
.ux-title .w { color: #6f766e; margin-left: 12px; }
.seqv.ux-quiet .sbar:not(.on) { width: 1px; background: #1f221f; }
.seqv.ux-quiet .sbar.on { background: #6a6248; }
.seqv.ux-quiet .srow.far { opacity: .58; }
.seqv.ux-quiet .sframe:not(.hot) { border-left-color: #233030; }
body.ux-nocap .seqv > .scap:not(.ux) { display: none; }
.ux-ret { position: absolute; left: 0; top: 0; overflow: visible; }
.ux-ret path { fill: none; stroke: var(--now); stroke-width: 1.6; }
.ux-rdot { position: absolute; width: 7px; height: 7px; margin: -3.5px 0 0 -3.5px; background: #f0e3bd; box-shadow: 0 0 8px 2px rgba(232,217,173,.5); }
.ux-ret .arc { stroke-dasharray: 4 3; animation: uxdraw ${0.8 * k}s ease-out both; }
.ux-ret .hd { animation: uxfade ${0.3 * k}s ${0.7 * k}s both; }
@keyframes uxdraw { from { clip-path: inset(0 0 100% 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes uxfade { from { opacity: 0; } }
.ux-retlab { position: absolute; font: 300 12px var(--ui); color: #b8a676; white-space: nowrap; animation: uxfade ${0.3 * k}s ${0.6 * k}s both; }
.ux-code { margin-top: 8px; font: 12px/1.6 var(--mono); color: #8b9189; }
.ux-code .from { font: 300 11.5px var(--ui); color: #5f665f; margin-bottom: 2px; }
.ux-code > div:not(.from) { display: flex; white-space: pre; }
.ux-code .ln, .mc .ln { width: 30px; flex: none; text-align: right; padding-right: 12px; color: #3a3f3a; }
.ux-code .hl { background: rgba(173,155,111,.14); box-shadow: inset 3px 0 #ad9b6f; color: #e3e6df; } .ux-code .hl .ln { color: #8a7f5f; }
.ux-peek { position: absolute; background: #202220; box-shadow: 0 16px 36px rgba(0,0,0,.55); padding: 8px 14px 8px 4px; z-index: 6; }
.ux-peek .h { font: 300 12px var(--ui); color: #c9cdc5; padding: 0 0 4px 14px; } .ux-peek .h i { font-style: normal; color: #5f665f; margin-left: 6px; }
.mc { font: 12px/1.6 var(--mono); color: #9ea39b; } .mc > div { display: flex; white-space: pre; }
.ux-crumbs { position: fixed; z-index: 50; display: flex; align-items: center; gap: 8px; font: 300 15px var(--ui); color: #9aa094; white-space: nowrap; }
.ux-crumbs .c { cursor: pointer; } .ux-crumbs .c.hot { color: var(--accent); text-decoration: underline; text-underline-offset: 4px; text-decoration-thickness: 1px; }
.ux-crumbs .c:last-of-type { color: var(--bright); } .ux-crumbs .sep { color: #3f453f; font-size: 13px; }
.ux-crumbs .rd { font-size: 12.5px; color: #79a98f; margin-left: 14px; }
body.ux-crumbs-on .seqpath { visibility: hidden; }
.ux-chap .seg { position: absolute; width: 2px; background: #6f9e9e; } .ux-chap .seg.s1 { background: #ad9b6f; }
.ux-chap { position: absolute; inset: 0; pointer-events: none; z-index: 5; }
.ux-chlist { position: absolute; z-index: 21; background: #1f201f; box-shadow: 0 16px 36px rgba(0,0,0,.5); padding: 8px 0; font: 300 12.5px var(--ui); color: #9aa094; }
.ux-chlist div { padding: 3px 16px; white-space: nowrap; } .ux-chlist b { display: inline-block; width: 44px; font: 11.5px var(--mono); color: var(--accent); font-weight: 400; }
.ux-chlist .sub { padding-left: 32px; color: #7fb0b0; } .ux-chlist .hot { background: rgba(173,155,111,.12); color: #e3e6df; }
.ux-strip { position: absolute; height: 23px; display: flex; align-items: baseline; gap: 10px; line-height: 23px; font: 12px var(--mono); color: #c9c2ac; white-space: nowrap; }
.ux-strip .pl { color: var(--accent); width: 14px; text-align: center; }
.ux-strip .w { font: 300 11.5px var(--ui); color: #6f766e; }
.ux-strip .mini { display: inline-flex; align-items: flex-end; gap: 1px; height: 14px; margin-left: 6px; } .ux-strip .mini i { width: 2px; background: #4a504a; }
.ux-strip.what { color: #c9cdc5; } .ux-strip.what .pl { color: #8a7f5f; }
.ux-strip .chip { pointer-events: auto; margin-left: 8px; color: var(--accent); }
.ux-pal { position: absolute; left: 50%; top: 18px; transform: translateX(-50%); z-index: 22; width: 620px; background: #1f201f; box-shadow: 0 18px 40px rgba(0,0,0,.55); }
.ux-pal .in { display: flex; align-items: baseline; gap: 10px; padding: 10px 16px; font: 13px var(--mono); color: #e3e6df; border-bottom: 1px solid #2a2d2a; }
.ux-pal .q { color: var(--accent); }
.caret { display: inline-block; width: 1px; height: 15px; background: #c9cdc5; animation: uxblink 1s steps(1) infinite; align-self: center; }
@keyframes uxblink { 50% { opacity: 0; } }
.ux-pal .res { padding: 6px 0 8px; } .ux-pal .res .h { padding: 4px 16px 6px; font: 300 12px var(--ui); color: #6f766e; }
.ux-pal .p { padding: 4px 16px; font: 12.5px var(--mono); color: #9ea39b; white-space: nowrap; } .ux-pal .p b { color: var(--accent); font-weight: 400; margin-right: 12px; }
.ux-pal .p i { font-style: normal; color: #3f453f; padding: 0 6px; } .ux-pal .p .w { display: block; padding-left: 22px; font: 300 11.5px var(--ui); color: #5a6a6a; }
.ux-pal .p.hot { background: rgba(173,155,111,.12); color: #e3e6df; }
.seqv.ux-path .srow:not(.ux-on):not(.sel) { opacity: .22 !important; }
.seqv.ux-path .srow.ux-on::after { content: ''; position: absolute; left: 0; top: 10px; width: 3px; height: 3px; background: var(--accent); }
.ux-share { margin-left: 18px; }
.ux-menu { position: fixed; z-index: 60; background: #202220; box-shadow: 0 16px 36px rgba(0,0,0,.55); padding: 6px 0; font: 300 12.5px var(--ui); color: #c9cdc5; white-space: nowrap; }
.ux-layer .ux-menu { position: absolute; }
.ux-menu div { padding: 4px 16px; } .ux-menu .hot { background: rgba(173,155,111,.12); color: #f0eadb; }
.ux-toast { position: fixed; left: 50%; bottom: 52px; transform: translateX(-50%); z-index: 70; background: #202220; box-shadow: 0 12px 28px rgba(0,0,0,.5); padding: 8px 16px; font: 300 13px var(--ui); color: #c9cdc5; white-space: nowrap; }
.ux-toast span { font: 12px var(--mono); color: #8b9189; margin-left: 10px; }
.ux-boxes { position: absolute; inset: 0; z-index: 30; background: var(--bg); }
.ux-boxes.swap .ux-world { opacity: 0; } .ux-world { transition: opacity ${0.16 * k}s; }
.ux-scroll { position: absolute; left: 0; top: 0; right: 0; bottom: 34px; overflow: auto; }
.ux-sizer { position: relative; overflow: hidden; }
.ux-world { position: absolute; left: ${PAD}px; top: ${PAD}px; transform-origin: 0 0; }
.ux-bx { position: absolute; background: #1a1b1a; border: 1px solid #2e322e; overflow: hidden; transition: left ${0.45 * k}s ${T}, top ${0.45 * k}s ${T}, width ${0.45 * k}s ${T}, height ${0.45 * k}s ${T}, opacity ${0.35 * k}s; }
.ux-bx.fade { opacity: .28; }
.ux-bx .t { position: absolute; left: 12px; top: 8px; right: 34px; font: 300 15px var(--ui); color: #c9cdc5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ux-bx.lv-files .t { font-size: 20px; top: 10px; } .ux-bx.lv-files .t i { font-size: 14px; } .ux-bx.lv-files .lc { font-size: 15px; top: 13px; } .ux-bx.lv-files .s { font-size: 15px; top: 42px; }
.ux-bx .t.sm { font-size: 27px; top: 12px; } .ux-bx.lv-folders .lc { font-size: 15px; top: 14px; }
.ux-boxes.lv-folders .ux-grp span { font-size: 19px; top: 7px; } .ux-boxes.lv-folders .ux-ed .ed { stroke-width: 1.6; }
.ux-bx .t i { font-style: normal; color: #4f564f; font-size: 11.5px; margin-left: 6px; }
.ux-bx .lc { position: absolute; right: 10px; top: 10px; font: 300 11.5px var(--ui); color: #4f7a7a; }
.ux-bx .s { position: absolute; left: 12px; top: 32px; font: 300 11.5px var(--ui); color: #5f665f; white-space: nowrap; }
.ux-bx .fr { position: absolute; left: 0; right: 0; height: 21px; display: flex; align-items: baseline; gap: 9px; padding: 0 12px; font: 12px var(--mono); line-height: 21px; color: #8b9189; white-space: nowrap; transition: opacity ${0.3 * k}s, background ${0.3 * k}s, color ${0.3 * k}s; }
.ux-bx .fr .n { width: 20px; text-align: right; color: #6f6650; font-variant-numeric: tabular-nums; flex: none; }
.ux-bx .fr .c { margin-left: auto; font: 300 11px var(--ui); color: #5a7a7a; }
.ux-bx .fr.sel { background: rgba(173,155,111,.17); color: #f0eadb; box-shadow: inset 3px 0 var(--now); } .ux-bx .fr.sel .n { color: var(--now); }
.ux-bx .fr.lit { background: rgba(173,155,111,.1); color: #e3e6df; } .ux-bx .fr.lit .n { color: #b8a676; }
.ux-bx .fr.hot { background: rgba(173,155,111,.22); color: #f0eadb; box-shadow: inset 3px 0 var(--now); }
.ux-bx .fr.dim, .ux-bx .lpl.dim { opacity: .3; }
.ux-bx .lpl { position: absolute; left: 44px; right: 10px; height: 16px; font: 300 11px/16px var(--ui); color: #3f5a5a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: opacity ${0.3 * k}s; }
.ux-ed { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
.ux-ed .ed { fill: none; stroke: #3c413c; stroke-width: 1; transition: opacity ${0.3 * k}s, stroke ${0.3 * k}s; }
.ux-ed .ah { fill: #3c413c; stroke: none; transition: opacity ${0.3 * k}s; }
.ux-ed .en { font: 300 10.5px var(--ui); fill: #5f665f; }
.ux-ed .ed.on { stroke: var(--now); stroke-width: 1.4; stroke-dasharray: 6 4; animation: uxflow ${0.9 * k}s linear infinite; } .ux-ed .ah.on { fill: var(--now); }
@keyframes uxflow { from { stroke-dashoffset: 10; } to { stroke-dashoffset: 0; } }
.ux-ed .dim { opacity: .18; }
.ux-lab { position: absolute; transform: translate(-100%, -50%); background: var(--bg); padding: 0 5px; font: 11.5px/15px var(--mono); color: #c9b98f; white-space: nowrap; z-index: 2; transition: opacity ${0.3 * k}s, color ${0.3 * k}s; }
.ux-lab.on { color: #f0e3bd; box-shadow: inset 0 0 0 1px #5a5442; } .ux-lab.dim { opacity: .2; }
.ux-boxes.lv-files .ux-lab { font-size: 16px; line-height: 20px; } .ux-boxes.lv-folders .ux-lab { font-size: 22px; line-height: 26px; }
.ux-ed .trail { fill: none; stroke: #e8d9ad; stroke-width: 2.2; opacity: .55; }
.ux-dot { position: absolute; width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px; background: #f0e3bd; box-shadow: 0 0 10px 3px rgba(232,217,173,.45); z-index: 4; }
.ux-grp { position: absolute; background: rgba(111,158,158,.035); border: 1px solid #263030; z-index: -1; }
.ux-grp span { position: absolute; left: 10px; top: 7px; font: 300 10.5px var(--ui); letter-spacing: .14em; text-transform: uppercase; color: #4f6a6a; }
.ux-ctl { position: absolute; left: 0; right: 16px; bottom: 0; height: 34px; display: flex; align-items: center; justify-content: flex-end; gap: 14px; background: var(--bg); border-top: 1px solid #222522; padding: 0 14px; z-index: 3; }
.ux-ctl .gap { width: 10px; } .ux-ctl .ro { font: 12px var(--mono); color: #8b9189; min-width: 38px; text-align: center; }
.ux-mini { position: absolute; left: 16px; bottom: 48px; background: #141514; border: 1px solid #2a2d2a; transition: opacity ${0.25 * k}s; z-index: 3; }
.ux-mini i { position: absolute; background: #2c302c; } .ux-mini b { position: absolute; border: 1px solid var(--accent); }
.ux-fly { position: fixed; z-index: 80; display: flex; gap: 8px; font: 12px var(--mono); color: #c9cdc5; white-space: nowrap; transform-origin: 0 0; transition: transform ${0.62 * k}s ${T}; line-height: 15px; pointer-events: none; }
.ux-fly .n { min-width: 20px; text-align: right; color: #b8a676; } .ux-fly.sel { color: #f0eadb; }
.ux-pathbar { position: absolute; left: 22px; top: 12px; z-index: 3; background: var(--bg); padding: 4px 10px 4px 0; font: 300 13px var(--ui); color: #9aa094; }
.ux-pathbar .h { color: var(--accent); margin-right: 6px; } .ux-pathbar b { font: 12.5px var(--mono); font-weight: 400; color: #e3e6df; }
.ux-pathbar .pick { color: #6f766e; } .ux-pathbar .esc { color: #4f564f; margin-left: 14px; font-size: 12px; }
.ux-prev { position: fixed; z-index: 40; background: var(--prev); display: flex; flex-direction: column; }
.ux-prev .ph { padding: 0 20px; }
.ux-route { padding: 10px 20px 10px 20px; border-left: 3px solid transparent; transition: background ${0.25 * k}s, opacity ${0.25 * k}s; }
.ux-route .t { font: 12.5px var(--mono); color: #c9cdc5; white-space: nowrap; } .ux-route .t b { color: var(--accent); font-weight: 400; margin-right: 12px; } .ux-route .t i { font-style: normal; color: #3f453f; padding: 0 5px; }
.ux-route .w { font: 300 12px var(--ui); color: #6f766e; margin: 4px 0 2px 22px; } .ux-route .f { font: 300 11.5px var(--ui); color: #5a7a7a; margin-left: 22px; }
.ux-route.hot { background: rgba(173,155,111,.09); border-left-color: var(--now); } .ux-route.dim { opacity: .4; }
.ux-legend { position: absolute; left: 22px; bottom: 6px; display: flex; gap: 20px; font: 300 12px var(--ui); color: #6f766e; z-index: 3; background: var(--bg); padding: 4px 0; }
.ux-legend i { display: inline-block; width: 22px; height: 11px; margin-right: 7px; vertical-align: -1px; }
.ux-lens { position: fixed; z-index: 90; width: 330px; height: 200px; overflow: hidden; background: var(--bg); border: 1px solid #5a5442; box-shadow: 0 18px 40px rgba(0,0,0,.6); pointer-events: none; }
.ux-lens .ux-world { left: 0; top: 0; transition: none; }
.ux-cmp-pan { position: absolute; display: flex; gap: 0; background: #1c1d1c; box-shadow: inset 0 0 0 1px #2a2d2a; z-index: 5; }
.ux-cmp-pan .col { padding: 10px 18px 12px; min-width: 170px; font: 12px/1.7 var(--mono); color: #9ea39b; }
.ux-cmp-pan .col + .col { border-left: 1px solid #2a2d2a; }
.ux-cmp-pan .h { font: 300 12.5px var(--ui); color: var(--accent); margin-bottom: 4px; }
.ux-cmp-pan .n { display: inline-block; min-width: 30px; color: #6f6650; }
.ux-cmp-pan .rt { color: #c9cdc5; white-space: nowrap; } .ux-cmp-pan i { font-style: normal; color: #5f665f; } .ux-cmp-pan .no { font: 300 12px/1.8 var(--ui); color: #6f766e; }
.ux-sky { position: absolute; left: 0; right: 16px; bottom: 0; height: 60px; background: var(--bg); border-top: 1px solid #232623; z-index: 6; padding: 7px 20px 0; }
.ux-hint { position: absolute; z-index: 7; width: 30px; height: 17px; background: #2e2b20; color: #f0e3bd; font: 11.5px/17px var(--mono); text-align: center; transition: opacity ${0.2 * k}s; }
.ux-tick { position: absolute; width: 14px; text-align: center; font: 11px/23px var(--ui); color: #79a98f; }
.ux-note { position: absolute; height: 23px; display: flex; align-items: center; gap: 8px; padding: 0 10px; background: #1f201f; font: 300 12.5px var(--ui); color: #c9cdc5; white-space: nowrap; box-shadow: inset 2px 0 #8a7f5f; z-index: 6; }
.ux-note .i { color: var(--accent); } .ux-note.pinned { background: #1c1d1b; }
.ux-lead { position: absolute; height: 0; border-top: 1px dashed #4a4636; }
.ux-pin { position: absolute; width: 5px; height: 5px; background: var(--accent); z-index: 6; }
.ux-chg { position: absolute; width: 3px; height: 15px; background: #79c9ae; }
.ux-chg.c { background: #79c9ae; opacity: .4; }
.srow.ux-chg-row .nm, .srow.ux-chg-row .n { color: #9fd8c0 !important; } .srow.ux-chg-row { opacity: 1 !important; }
.srow.ux-chain-row .nm { color: #7fae9c !important; } .srow.ux-chain-row { opacity: 1 !important; }
.ux-ripple { position: absolute; background: #1f201f; box-shadow: 0 16px 36px rgba(0,0,0,.5); padding: 10px 16px; font: 300 12.5px/1.7 var(--ui); color: #9aa094; white-space: nowrap; z-index: 6; box-shadow: inset 2px 0 #79c9ae, 0 16px 36px rgba(0,0,0,.5); }
.ux-ripple .h { color: #c9cdc5; } .ux-ripple b { font: 12px var(--mono); font-weight: 400; color: #79c9ae; }
`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
}

window.ux = {
  async init(slow: number) {
    SLOW = slow;
    styles();
    L = mk('ux-layer', seqv()); syncLayer();
    cursorEl = mk('ux-cursor', document.body, '<svg viewBox="0 0 18 22" width="18" height="22"><path d="M1 1 L1 17 L5.2 13.2 L8.2 20 L11 18.8 L8.1 12.2 L13.6 12.2 Z" fill="#f2f2ee" stroke="#111" stroke-width="1.1" stroke-linejoin="round"/></svg>');
    cursorEl.style.left = `${cx}px`; cursorEl.style.top = `${cy}px`;
    const ab = rect(document.querySelector('.appbar')!);
    titleEl = mk('ux-title', document.body); titleEl.style.top = `${ab.top}px`; titleEl.style.height = `${ab.height}px`; titleEl.style.lineHeight = `${ab.height}px`;
    setInterval(() => { const c = curIt(); if (c >= 0) visited.add(c); drawCrumbs(); }, 60);
    lays.functions = await layout('functions'); lays.files = await layout('files'); lays.folders = await layout('folders');
    return true;
  },
  steps: () => S.map((x) => ({ d: x.d * PACE })),
  play: (k: number) => { Promise.resolve(S[k].run()).catch((e) => console.error('ux step', k, e)); },
  probe() { return { rows: domRows().map((d) => [d.it, d.top]), lays: Object.fromEntries(Object.entries(lays).map(([k, v]) => [k, [v!.w, v!.h]])) }; },
};
