// The boxes view, perfected: files as boxes laid out by ELK (as in the app); zoomed in, each box lists its functions in
// execution order with their loops, and every function row is a port, so ELK routes call lines around boxes. Stepping
// lights the current row (amber), keeps an ember trail, draws the return route through the caller, and the cold look.
// usage: node boxgen.mjs <data.json> <root> <out.html> <options.json>   (options: see the boxes-*.json examples)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const [dataPath, root, outPath, optPath] = process.argv.slice(2);
const d = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const O = JSON.parse(fs.readFileSync(optPath, 'utf8'));
const MOCK = fileURLToPath(new URL('./mock', import.meta.url)), STYLES = pathToFileURL(fileURLToPath(new URL('../../renderer/styles.css', import.meta.url))).href;
const ELK = pathToFileURL(fileURLToPath(new URL('../../../node_modules/elkjs/lib/elk.bundled.js', import.meta.url))).href;
d.rows.forEach((r, i) => { if (r.last < i) r.last = i; });
for (const r of d.rows) {
  const L = fs.readFileSync(path.join(root, r.file), 'utf8').split('\n');
  let i = r.line - 1, depth = 0, started = false, end = i;
  for (let k = i; k < Math.min(L.length, i + 80); k++) { for (const ch of L[k]) { if (ch === '{') { depth++; started = true; } else if (ch === '}') depth--; } if (started && depth <= 0) { end = k; break; } }
  r.code = L.slice(i, end + 1).slice(0, 16).map((t, k) => [i + k + 1, t]);
  r.sig = L[i].replace(/\s*\{.*$/, '').trim();
}
// files never reached (large projects): counted from the folder, listed only on request
let unreachedFiles = 0;
if (O.countUnreached) {
  const reached = new Set(d.rows.map((r) => r.file));
  const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { if (e.name.startsWith('.')) continue; const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (/\.(c|cc|cpp|h|hpp)$/.test(e.name) && !reached.has(path.relative(root, p))) unreachedFiles++; } };
  walk(root);
}
const frames = d.frames.filter((f) => f.to >= f.from && f.type === 'loop');

const html = `<!doctype html><html><head><meta charset="utf-8"><title>boxes</title>
<link rel="stylesheet" href="${STYLES}"><link rel="stylesheet" href="file://${MOCK}/mock.css">
<script src="${ELK}"></script><script src="file://${MOCK}/shell.js"></script>
<script>
const SLOW = Number(new URLSearchParams(location.search).get('slow') || 1);
if (SLOW > 1) document.write('<style>.mv{transition-duration:' + (.5 * SLOW) + 's!important}.cap{transition-duration:' + (.25 * SLOW) + 's!important}.sweep{animation-duration:' + (1.1 * SLOW) + 's!important}.arc{animation-duration:' + (.7 * SLOW) + 's!important}.unfold{animation-duration:' + (.42 * SLOW) + 's!important}</style>');
</script>
<style>
:root { --now: #ad9b6f; --rep: #6f9e9e; --risk: #b8605a; }
#world { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.mv { transition: left .5s cubic-bezier(.16,1,.3,1), top .5s cubic-bezier(.16,1,.3,1), width .5s cubic-bezier(.16,1,.3,1), height .5s cubic-bezier(.16,1,.3,1), opacity .45s, transform .5s cubic-bezier(.16,1,.3,1), color .4s, background .4s, border-color .4s; }
.bx { position: absolute; background: #1a1b1a; border: 1px solid #2e322e; overflow: hidden; }
.bx.dead { border-style: dashed; border-color: #262926; }
.bx.lit { border-color: #4a4636; }
.bx .t { position: absolute; left: 12px; top: 8px; right: 34px; font: 300 15px var(--ui); color: #c9cdc5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bx .t i { font-style: normal; color: #4f564f; font-size: 11.5px; margin-left: 6px; }
.bx .lc { position: absolute; right: 10px; top: 10px; font: 300 11.5px var(--ui); color: #4f7a7a; }
.bx .s { position: absolute; left: 12px; top: 32px; font: 300 11.5px var(--ui); color: #4f564f; white-space: nowrap; }
.fr { position: absolute; left: 0; right: 0; height: 21px; display: flex; align-items: baseline; gap: 9px; padding: 0 12px; font: 12px var(--mono); line-height: 21px; color: #8b9189; white-space: nowrap; }
.fr .n { width: 20px; text-align: right; color: #6f6650; font-variant-numeric: tabular-nums; flex: none; }
.fr .c { margin-left: auto; font: 300 11px var(--ui); color: #464c46; padding-left: 8px; }
.fr.no { color: #3f453f; } .fr.no .n { color: #3f453f; }
.fr.e1 { color: #c9c2ac; } .fr.e1 .n { color: #b8a676; } .fr.e2 { color: #b5b09f; } .fr.e2 .n { color: #a39467; } .fr.e3 { color: #a39f92; } .fr.e4 { color: #969389; }
.fr.near { background: rgba(173,155,111,.06); color: #c4c6bd; }
.fr .tag ~ .c { display: none; }
.fr.near .tag { margin-left: auto; font: 300 11px var(--ui); color: #8a7f5f; }
.fr.sel { background: rgba(173,155,111,.17); color: #f0eadb; box-shadow: inset 3px 0 var(--now); } .fr.sel .n { color: var(--now); }
.lpl { position: absolute; left: 44px; right: 10px; height: 16px; font: 300 11px/16px var(--ui); color: #3f5a5a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lpl.hot { color: #8fc0c0; }
.start { position: absolute; font: 300 12px var(--ui); color: var(--now); white-space: nowrap; }
.tagt { position: absolute; font: 300 11px var(--ui); color: #6a6078; white-space: nowrap; }
svg.ed { position: absolute; left: 0; top: 0; overflow: visible; }
.lab { position: absolute; font: 11.5px var(--mono); color: #8a7f5f; background: var(--bg); padding: 0 5px; white-space: nowrap; transform: translate(-50%, -50%); }
.lab .lpi, .s .lpi { color: #6f9e9e; }
.pop { position: absolute; background: #202220; box-shadow: 0 16px 36px rgba(0,0,0,.55); padding: 7px 0; z-index: 5; }
.pop div { display: flex; gap: 12px; padding: 2px 14px; font: 12.5px var(--mono); color: #c9cdc5; white-space: nowrap; }
.pop .n { width: 22px; text-align: right; color: #b8a676; } .pop .no { color: #4a4f4a; }
.note { position: absolute; font: 300 11px var(--ui); white-space: nowrap; }
.shelf { position: absolute; font: 300 12px var(--ui); color: #4a504a; white-space: nowrap; }
.shelf b { font-weight: 300; color: #6f766e; }
.grp { position: absolute; border: 1px dashed #262a26; }
.grp span { position: absolute; left: 10px; top: 6px; font: 300 10.5px var(--ui); letter-spacing: .14em; text-transform: uppercase; color: #4a504a; }
.spine { position: absolute; right: 4px; top: 8px; bottom: 8px; width: 3px; }
.spine i { position: absolute; left: 0; width: 3px; height: 1px; background: #3a3f3a; } .spine i.rep { background: #355a5a; } .spine i.risk { background: var(--risk); height: 2px; }
.spine b { position: absolute; left: -2px; width: 7px; height: 7px; border-radius: 50%; background: var(--now); margin-top: -3px; transition: top .5s cubic-bezier(.16,1,.3,1); }
.sweep { position: absolute; top: 0; bottom: 0; width: 40%; background: linear-gradient(90deg, transparent, rgba(111,158,158,.12), transparent); animation: sweep 1.1s ease-out forwards; pointer-events: none; }
@keyframes sweep { from { left: -40%; } to { left: 100%; } }
.arc { stroke-dasharray: 900; animation: arc .7s ease-out forwards; } @keyframes arc { from { stroke-dashoffset: 900; } to { stroke-dashoffset: 0; } }
.cap { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); background: #1f201f; padding: 7px 15px; font: 300 13.5px var(--ui); color: #c9cdc5; white-space: nowrap; transition: opacity .25s; z-index: 20; }
.cap .key { font: 12.5px var(--mono); color: var(--now); margin-right: 10px; } .cap .why { color: #6f766e; margin-left: 8px; }
.pv { padding: 0 14px; }
.pv .facts { display: grid; grid-template-columns: 86px 1fr; gap: 4px 12px; margin-top: 12px; font: 300 12.5px/1.5 var(--ui); }
.pv .facts .h { color: #464c46; }
.g-proved { color: #c9cdc5; } .g-possible { color: #8b9189; text-decoration: underline dotted #5f665f; text-underline-offset: 3px; } .g-risk { color: var(--risk); }
.pv .facts b { font: 12px var(--mono); font-weight: 400; color: #b8a676; } .pv .facts code { font: 11.5px var(--mono); }
</style></head><body><div id="root"></div><script>
const D = ${JSON.stringify({ rows: d.rows, frames, O, unreachedFiles })};
const O = D.O, R = D.rows;
const canvas = shell({ tabs: [['flow', true], ['folder', false]], ph: '<span id="ph"></span>',
  chips: '<span id="zoomtag" style="font:300 12.5px var(--ui);color:#4f564f"></span><button class="chip" style="margin-left:18px">sequence</button><button class="chip on">boxes</button>', preview: O.preview === false ? null : '<div id="pv"></div>', previewW: 430 });
const world = document.createElement('div'); world.id = 'world'; canvas.appendChild(world);
const spine = document.createElement('div'); spine.className = 'spine'; canvas.appendChild(spine);
const cap = document.createElement('div'); cap.className = 'cap'; cap.style.opacity = 0; canvas.parentElement.appendChild(cap);
const svgNS = 'http://www.w3.org/2000/svg';
const edSvg = document.createElementNS(svgNS, 'svg'); edSvg.setAttribute('class', 'ed'); edSvg.setAttribute('width', '4000'); edSvg.setAttribute('height', '4000'); world.appendChild(edSvg);
const mk = (cls, parent = world) => { const e = document.createElement('div'); e.className = cls; parent.appendChild(e); return e; };
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const hlc = (t) => esc(t).replace(/("[^"]*"|'[^']*')/g, '<span class="st">$1</span>').replace(/\\b(static|const|bool|char|int|void|auto|return|if|for|while|continue|break|std|size_t|true|false|else|noexcept)\\b(?![^<]*<\\/span>)/g, '<span class="kw">$1</span>');
const files = []; for (const r of R) if (!files.includes(r.file)) files.push(r.file);
const extra = O.extraFns || {};   // functions in a reached file that never run
for (const f of Object.keys(extra)) if (!files.includes(f)) files.push(f);
const isDeadFile = (f) => !R.some((r) => r.file === f);
// a file called from many others is a shared utility: no lines to it, just "used by N files" in its box
const callerFiles = (f) => new Set(R.filter((r) => r.file === f && r.caller != null && R[r.caller].file !== f).map((r) => R[r.caller].file));
const isUtil = (f) => O.utilAt && callerFiles(f).size >= O.utilAt;
const rowsOf = (f) => R.map((r, i) => (r.file === f ? i : null)).filter((v) => v != null);
const loopsOf = (i) => D.frames.map((fr, k) => ({ fr, k })).filter(({ fr }) => fr.owner === i);
const BW = { files: O.groups ? 196 : 214, functions: 262 };
function boxGeom(f, level) {
  if (level === 'files') return { w: BW.files, h: 58, rows: [] };
  const rows = []; let y = 36;
  for (const i of rowsOf(f)) { rows.push({ type: 'fn', i, y }); y += 21; for (const l of loopsOf(i)) { rows.push({ type: 'loop', k: l.k, y }); y += 16; } }
  for (const [name] of extra[f] || []) { rows.push({ type: 'no', name, y }); y += 21; }
  return { w: BW.functions, h: y + 10, rows };
}

// ---- layout by ELK, as the app does; zoomed in, every function row is a port so lines are routed around boxes ----
const elk = new ELK();
async function layout(level) {
  const nodes = files.filter((f) => !isDeadFile(f)).map((f) => {
    const g = boxGeom(f, level), node = { id: f, width: g.w, height: g.h, layoutOptions: {} };
    if (level === 'functions') {
      node.layoutOptions['elk.portConstraints'] = 'FIXED_POS';
      node.ports = g.rows.filter((r) => r.type === 'fn').flatMap((r) => [
        { id: 'in' + r.i, x: 0, y: r.y + 10, width: 1, height: 1, layoutOptions: { 'elk.port.side': 'WEST' } },
        { id: 'out' + r.i, x: g.w - 1, y: r.y + 10, width: 1, height: 1, layoutOptions: { 'elk.port.side': 'EAST' } }]);
    }
    return node;
  });
  const edges = [], seen = new Set(), utilLinks = [];
  R.forEach((r, i) => {
    if (r.caller == null) return;
    const a = R[r.caller].file, b = r.file;
    if (a === b) return;   // calls inside one box need no line: the numbers show them
    if (level === 'files') { const k = a + '>' + b; if (seen.has(k)) return; if (isUtil(b)) { utilLinks.push(k); seen.add(k); return; } seen.add(k); edges.push({ id: 'e' + edges.length, sources: [a], targets: [b], key: k }); }
    else edges.push({ id: 'e' + i, sources: ['out' + r.caller], targets: ['in' + i], row: i });
  });
  // large projects: files sit inside their folder, laid out as one graph (ELK nests them and routes across folders)
  let children = nodes;
  if (level === 'files' && O.groups) {
    const by = {}; for (const n of nodes) (by[n.id.replace(/\\/[^/]+$/, '')] ||= []).push(n);
    children = Object.entries(by).map(([dir, kids]) => ({ id: 'dir:' + dir, children: kids, layoutOptions: { ...(O.wrap ? { 'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.layered.wrapping.strategy': 'MULTI_EDGE', 'elk.aspectRatio': String(O.wrap) } : {}), 'elk.padding': '[top=30,left=16,bottom=16,right=16]' } }));
  }
  const g = await elk.layout({ id: 'root', layoutOptions: { 'elk.hierarchyHandling': O.groups && level === 'files' ? 'INCLUDE_CHILDREN' : 'SEPARATE_CHILDREN', 'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.edgeRouting': 'ORTHOGONAL', 'elk.layered.spacing.nodeNodeBetweenLayers': level === 'files' ? (O.groups ? '60' : '96') : '84', 'elk.spacing.nodeNode': level === 'files' ? '30' : '26', 'elk.layered.spacing.edgeNodeBetweenLayers': '22', 'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES', 'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF', ...(O.wrap && level === 'files' ? { 'elk.layered.wrapping.strategy': 'MULTI_EDGE', 'elk.aspectRatio': String(O.wrap) } : {}) }, children, edges });
  const pos = {}, groups = [];
  for (const c of g.children) {
    if (c.children) { groups.push({ dir: c.id.slice(4), x: c.x, y: c.y, w: c.width, h: c.height }); for (const k of c.children) pos[k.id] = { x: c.x + k.x, y: c.y + k.y, w: k.width, h: k.height }; }
    else pos[c.id] = { x: c.x, y: c.y, w: c.width, h: c.height };
  }
  // an edge's points are relative to the folder that holds both ends
  const dirOf = (id) => groups.find((q) => id.startsWith(q.dir + '/') && !id.slice(q.dir.length + 1).includes('/'));
  let sx = 0, gh = g.height; const dead = files.filter(isDeadFile);
  if (dead.length) { gh += 44; for (const f of dead) { const b = boxGeom(f, level); pos[f] = { x: sx, y: gh, w: b.w, h: b.h }; sx += b.w + 24; } gh += Math.max(...dead.map((f) => pos[f].h)); }
  const allEdges = [...(g.edges || []), ...g.children.flatMap((c) => c.edges || [])];
  const routes = allEdges.map((e) => {
    const src = edges.find((x) => x.id === e.id), off = e.container && e.container !== 'root' ? groups.find((q) => 'dir:' + q.dir === e.container) : null;
    const pts = e.sections ? [e.sections[0].startPoint, ...(e.sections[0].bendPoints || []), e.sections[0].endPoint].map((q) => (off ? { x: q.x + off.x, y: q.y + off.y } : q)) : [];
    return { ...src, pts };
  });
  return { pos, routes, groups, utilLinks, w: Math.max(g.width, sx), h: gh, gh: g.height };
}

// ---- the walk ----
const walk = [];
const loopsAt = (i) => D.frames.map((f, k) => ({ f, k })).filter(({ f }) => f.from <= i && f.to >= i).sort((a, b) => b.f.from - a.f.from);
let st = { level: O.levels[0], row: O.startRow ?? null, passes: {}, key: '', what: 'start', why: '', how: 'start' };
walk.push(st);
for (const m of O.moves || []) {
  if (m === 'zoom') { st = { ...st, level: 'functions', key: '⌥ +', what: 'zoom in', why: 'functions in their boxes, in the order they run', how: 'zoom' }; walk.push(st); continue; }
  let to = st.row == null ? 0 : st.row + 1, passes = { ...st.passes }, key = '→', what = 'next', why = '';
  if (m === 'again') { const l = loopsAt(st.row)[0]; to = l.f.from; passes[l.k] = (passes[l.k] || 1) + 1; key = 'R'; what = 'another pass'; why = 'pass ' + passes[l.k]; }
  if (m === 'leave') { const l = loopsAt(st.row)[0]; to = l.f.to + 1; key = 'L'; what = 'leave the loop'; why = 'skipped its other passes'; }
  if (m === 'over') { to = R[st.row].last + 1; key = '⇧ →'; what = 'step over'; why = 'skipped ' + (R[st.row].last - st.row) + ' steps inside ' + R[st.row].name; }
  const inside = new Set(loopsAt(to).map((x) => x.k));
  for (const k of Object.keys(passes)) if (!inside.has(Number(k))) delete passes[k];
  for (const k of inside) if (!passes[k]) passes[k] = 1;
  const how = m === 'again' ? 'again' : st.row != null && R[to].caller !== st.row ? 'return' : 'call';
  if (how === 'return' && !why) why = 'back in ' + R[R[to].caller].name;
  st = { level: st.level, row: to, passes, key, what, why, how };
  walk.push(st);
}

// ---- drawing ----
const L = {};
const boxEls = {}, rowEls = {}, loopEls = {};
let at = 0, curLevel = null, lastPasses = {};
function buildBoxes(level) {
  for (const f of files) {
    let b = boxEls[f];
    if (!b) { b = boxEls[f] = mk('bx mv' + (isDeadFile(f) ? ' dead' : '')); }
    const fns = rowsOf(f), loops = fns.reduce((a, i) => a + loopsOf(i).length, 0), callers = new Set(R.filter((r) => r.file === f && r.caller != null && R[r.caller].file !== f).map((r) => R[r.caller].file));
    b.innerHTML = '<div class="t">' + f.split('/').pop() + '<i>' + (f.includes('/') ? f.replace(/\\/[^/]+$/, '') : '') + '</i></div>' + (loops ? '<div class="lc">↻ ' + loops + '</div>' : '') +
      (level === 'files' ? '<div class="s">' + (isDeadFile(f) ? 'not reached from main' : (fns.length + (extra[f] || []).length) + (fns.length + (extra[f] || []).length === 1 ? ' function' : ' functions') + ' · ' + fns.length + ' run' + (callers.size > 1 ? ' · <span style="color:' + (isUtil(f) ? '#7d8a7d' : 'inherit') + '">used by ' + callers.size + ' files</span>' : '')) + '</div>' : '');
    if (level === 'functions') for (const r of boxGeom(f, level).rows) {
      const e = mk(r.type === 'loop' ? 'lpl' : 'fr', b); e.style.top = r.y + 'px';
      if (r.type === 'fn') { const q = R[r.i]; e.innerHTML = '<span class="n">' + q.n + '</span><span class="nm">' + q.name + '</span><span class="c">' + (q.uses.length ? q.uses.slice(0, 2).join(' · ') : '') + '</span>'; rowEls[r.i] = e; }
      else if (r.type === 'no') { e.className = 'fr no'; e.innerHTML = '<span class="n">·</span><span>' + r.name + '</span><span class="c">' + ((O.whyNot || {})[r.name] || 'never runs') + '</span>'; }
      else { const fr = D.frames[r.k]; const span = R[fr.from].n + (fr.to > fr.from ? '–' + R[fr.to].n : ''); e.innerHTML = '↻ ' + span + ' · ' + esc(fr.count != null ? '×' + fr.count + ' · ' + fr.text : fr.text); loopEls[r.k] = e; e.dataset.base = e.innerHTML; }
    }
  }
}
const overlay = [];
function clearOverlay() { overlay.forEach((e) => e.remove()); overlay.length = 0; edSvg.innerHTML = ''; }
function render() {
  const s = walk[at], lay = L[s.level], S = s.row;
  if (curLevel !== s.level) { for (const f of files) boxEls[f] && (boxEls[f].innerHTML = ''); Object.keys(rowEls).forEach((k) => delete rowEls[k]); buildBoxes(s.level); curLevel = s.level; }
  // fit: the whole graph in view when zoomed out; zoomed in, readable size, following the selection
  const CW = canvas.clientWidth - 16, CH = canvas.clientHeight;
  let k = Math.min(s.level === 'files' ? 1.25 : 1, (CW - 60) / (lay.w + 40), (CH - 70) / (lay.h + 40));
  if (s.level === 'functions') k = Math.max(k, Math.min(1, (CW - 40) / (lay.w + 20)));
  let ox = 30, oy = 34;
  if (s.level === 'functions' && S != null) { const f = R[S].file, p = lay.pos[f], g = boxGeom(f, 'functions'), ry = g.rows.find((r) => r.type === 'fn' && r.i === S).y; oy = Math.min(34, Math.max(CH - 60 - lay.h * k, CH * .38 - (p.y + ry) * k)); }
  world.style.transform = 'translate(' + ox + 'px,' + oy + 'px) scale(' + k + ')';
  for (const f of files) { const p = lay.pos[f], b = boxEls[f]; Object.assign(b.style, { left: p.x + 'px', top: p.y + 'px', width: p.w + 'px', height: p.h + 'px' }); }
  clearOverlay();
  for (const q of lay.groups || []) { const e = mk('grp'); Object.assign(e.style, { left: q.x + 'px', top: q.y + 'px', width: q.w + 'px', height: q.h + 'px' }); e.innerHTML = '<span>' + q.dir + '</span>'; world.insertBefore(e, world.firstChild); overlay.push(e); }
  const chain = new Set(); for (let i = S; i != null; i = R[i].caller) chain.add(i);
  const hist = []; for (let j = at - 1; j >= 0 && hist.length < 4; j--) { const r = walk[j].row; if (r != null && r !== S && !hist.includes(r)) hist.push(r); }
  const prevRow = at > 0 ? walk[at - 1].row : null, nextRow = at < walk.length - 1 ? walk[at + 1].row : null;
  // rows: selected, back and next, embers
  for (const [i, e] of Object.entries(rowEls)) {
    const n = Number(i), h = hist.indexOf(n);
    e.className = 'fr' + (n === S ? ' sel' : (n === prevRow || n === nextRow) ? ' near' : '') + (n !== S && h >= 0 ? ' e' + (h + 1) : '');
    const tag = e.querySelector('.tag'); if (tag) tag.remove();
    if (n !== S && (n === prevRow || n === nextRow)) { const t = document.createElement('span'); t.className = 'tag'; t.textContent = n === prevRow ? '← back' : 'next →'; e.insertBefore(t, e.querySelector('.c')); }
  }
  for (const f of files) boxEls[f].classList.toggle('lit', S != null && rowsOf(f).some((i) => chain.has(i)));
  for (const [kk, e] of Object.entries(loopEls)) {
    const fr = D.frames[kk], hot = S != null && S >= fr.from && S <= fr.to;
    e.classList.toggle('hot', hot);
    e.innerHTML = e.dataset.base + (hot && s.passes[kk] ? ' · pass ' + s.passes[kk] : '');
    if (hot && s.passes[kk] && lastPasses[kk] !== s.passes[kk]) { const b = e.parentElement, sw = mk('sweep', b); setTimeout(() => sw.remove(), 1200 * SLOW); }
  }
  lastPasses = { ...s.passes };
  // lines: ELK's orthogonal routes, rounded; the one into the current step is amber
  const draw = (pts, col, w, op, dash) => { let dd = 'M' + pts[0].x + ' ' + pts[0].y; for (let j = 1; j < pts.length; j++) dd += ' L' + pts[j].x + ' ' + pts[j].y; const p = document.createElementNS(svgNS, 'path'); p.setAttribute('d', dd); p.setAttribute('fill', 'none'); p.setAttribute('stroke', col); p.setAttribute('stroke-width', w); p.setAttribute('opacity', op); p.setAttribute('stroke-linejoin', 'round'); if (dash) p.setAttribute('stroke-dasharray', dash); edSvg.appendChild(p); const end = pts[pts.length - 1], prev = pts[pts.length - 2]; const a = Math.atan2(end.y - prev.y, end.x - prev.x) * 180 / Math.PI; const hd = document.createElementNS(svgNS, 'path'); hd.setAttribute('d', 'M0 0 L-7 -3.5 L-7 3.5 Z'); hd.setAttribute('fill', col); hd.setAttribute('opacity', op); hd.setAttribute('transform', 'translate(' + end.x + ' ' + end.y + ') rotate(' + a + ')'); edSvg.appendChild(hd); return p; };
  if (s.level === 'files' && O.hover) for (const k of lay.utilLinks || []) if (k.startsWith(O.hover + '>')) lay.routes.some((x) => x.key === k) || lay.routes.push({ key: k, pts: [], util: true });
  for (const e of lay.routes) {
    if (e.util && s.level === 'files') { const [a, b] = e.key.split('>'), nums = R.filter((r) => r.caller != null && R[r.caller].file === a && r.file === b).map((r) => r.n); const sEl = boxEls[b].querySelector('.s'); sEl.innerHTML = '<span style="color:#8a7f5f">steps <span style="font-family:var(--mono)">' + nums.join(' · ') + '</span></span>'; continue; }
    if (!e.pts.length) continue;
    if (s.level === 'files') {
      const hot = O.hover && (e.key.startsWith(O.hover + '>') || e.key.endsWith('>' + O.hover));
      draw(e.pts, hot ? '#7d7356' : '#3a3f3a', 1.2, O.hover && !hot ? .45 : 1);
      if (hot) {   // the steps on this line, written inside the box at its other end: never on a line, never over another label
        const [a, b] = e.key.split('>'), nums = R.filter((r) => r.caller != null && R[r.caller].file === a && r.file === b).map((r) => (loopsAt(R.indexOf(r)).length ? '<span class="lpi">↻</span> ' : '') + r.n);
        const cap = O.groups ? 4 : 5, text = nums.length > cap ? nums.slice(0, cap).join(' · ') + ' +' + (nums.length - cap) : nums.join(' · ');
        const other = a === O.hover ? b : a, sEl = boxEls[other].querySelector('.s');
        if (!sEl.dataset.base) sEl.dataset.base = sEl.innerHTML;
        sEl.innerHTML = '<span style="color:#8a7f5f">' + (a === O.hover ? 'steps ' : 'calls ') + '<span style="font-family:var(--mono)">' + text + '</span></span>';
      }
    } else {
      const hot = e.row === S, onChain = chain.has(e.row), isThread = R[e.row].thread;
      draw(e.pts, hot ? '#ad9b6f' : isThread ? '#5a5268' : onChain ? '#5a5442' : '#333733', hot ? 1.8 : 1.1, S == null || hot || onChain ? 1 : .55, isThread ? '5 4' : '');
    }
  }
  // the return route: when the next step is not called from here, a falling arc to the caller it comes back through
  if (s.level === 'functions' && S != null && nextRow != null && walk[at + 1].how === 'return') {
    const owner = R[nextRow].caller;
    // back along the lines it came in on (already routed around every box), dashed, drawn from here to the caller
    for (let i = S; i != null && i !== owner; i = R[i].caller) {
      const e = lay.routes.find((x) => x.row === i); if (!e || !e.pts.length) continue;
      const p = draw([...e.pts].reverse(), '#ad9b6f', 1.3, .9, '5 4');
    }
    const oe = rowEls[owner]; if (oe && owner !== S) { oe.classList.add('near'); const old = oe.querySelector('.tag'); if (old) old.remove(); const t = document.createElement('span'); t.className = 'tag'; t.textContent = '↩ returns here'; oe.insertBefore(t, oe.querySelector('.c')); }
  }
  // the race: a hairline red crack between the two rows on the box's right edge
  if (s.level === 'functions' && O.race && rowEls[O.race.a] && rowEls[O.race.b]) {
    const a = anchor(O.race.a, 'e'), b = anchor(O.race.b, 'e'), x = Math.max(a.x, b.x) + 14;
    let dd = 'M' + (a.x + 2) + ' ' + a.y + ' L' + x + ' ' + a.y; const dir = b.y < a.y ? -1 : 1;
    for (let yy = a.y, kk = 0; dir * (b.y - yy) > 7; yy += dir * 6, kk++) dd += ' L' + (x + (kk % 2 ? 1.2 : -1.2)) + ' ' + (yy + dir * 6);
    dd += ' L' + x + ' ' + b.y + ' L' + (b.x + 2) + ' ' + b.y;
    const p = document.createElementNS(svgNS, 'path'); p.setAttribute('d', dd); p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#b8605a'); p.setAttribute('stroke-width', .8); p.setAttribute('opacity', .8); edSvg.appendChild(p);
    const n = mk('note'); n.innerHTML = '<span style="font-family:var(--mono)">' + O.race.v + '</span> · two threads, no common lock'; n.style.color = '#b8605a'; n.style.left = (x + 8) + 'px'; n.style.top = ((a.y + b.y) / 2 - 8) + 'px'; overlay.push(n);
  }
  // start marker, thread tags, the hover list, the shelf of files never reached
  { const p = lay.pos[R[0].file]; const n = mk('start'); n.textContent = 'start ▸'; n.style.left = (p.x - 50) + 'px'; n.style.top = (p.y + 8) + 'px'; overlay.push(n); }
  for (const f of files) if (rowsOf(f).length && rowsOf(f).every((i) => R[i].thread || (R[i].caller != null && R[R[i].caller].thread)) && s.level === 'files') { const p = lay.pos[f]; const n = mk('tagt'); n.textContent = 'thread'; n.style.left = p.x + 'px'; n.style.top = (p.y - 17) + 'px'; overlay.push(n); }
  if (s.level === 'files' && O.hover) {
    const p = lay.pos[O.hover], pop = mk('pop');
    pop.innerHTML = rowsOf(O.hover).map((i) => '<div><span class="n">' + R[i].n + '</span><span>' + R[i].name + '</span></div>').join('') + (extra[O.hover] || []).map(([nm]) => '<div><span class="n"></span><span class="no">' + nm + '</span></div>').join('');
    // placed where it covers no other box, or not drawn at all (the pane lists it anyway)
    const w = pop.offsetWidth, h = pop.offsetHeight, others = Object.entries(lay.pos).filter(([f]) => f !== O.hover).map(([, q]) => q).concat((lay.groups || []).map((q) => ({ x: q.x, y: q.y, w: 160, h: 22 })));
    const free = (x, y) => !others.some((q) => x < q.x + q.w && x + w > q.x && y < q.y + q.h && y + h > q.y);
    const spot = [[p.x, p.y + p.h + 8], [p.x + p.w + 8, p.y], [p.x, p.y - h - 8], [p.x - w - 8, p.y]].find(([x, y]) => free(x, y));
    if (spot) { pop.style.left = spot[0] + 'px'; pop.style.top = spot[1] + 'px'; overlay.push(pop); } else pop.remove();
  }
  if (O.shelf) { const n = mk('shelf'); n.innerHTML = O.shelf.replace('{n}', D.unreachedFiles); n.style.left = '0px'; n.style.top = (lay.h + 22) + 'px'; overlay.push(n); }
  // spine
  spine.innerHTML = ''; const hh = canvas.clientHeight - 16;
  R.forEach((r, i) => { const t = document.createElement('i'); t.className = O.race && (i === O.race.a || i === O.race.b) ? 'risk' : D.frames.some((f) => i >= f.from && i <= f.to) ? 'rep' : ''; t.style.top = (i / R.length) * (hh - 10) + 'px'; spine.appendChild(t); if (i === S) { const b = document.createElement('b'); b.style.top = t.style.top; spine.appendChild(b); } });
  // header, caption, preview
  const names = []; for (let i = S; i != null; i = R[i].caller) names.unshift(R[i].name);
  // only the innermost loop's pass in the header; the outer ones are counted, not spelled out
  const open = Object.keys(s.passes).map(Number).sort((x, y) => D.frames[y].from - D.frames[x].from);
  const ctr = open.length ? 'pass ' + s.passes[open[0]] + ' · ' + D.frames[open[0]].text.slice(0, 24) + (D.frames[open[0]].text.length > 24 ? '…' : '') + (open.length > 1 ? ' · in ' + (open.length - 1) + ' more loop' + (open.length > 2 ? 's' : '') : '') : '';
  document.getElementById('ph').innerHTML = S == null ? '<span class="steps"><span class="path">' + esc(O.title) + '</span></span>' : '<span class="steps"><span class="k">' + R[S].n + ' / ' + R.length + '</span>' + (ctr ? '<span class="ctr">' + esc(ctr) + '</span>' : '') + '<span class="path">' + names.slice(-3).join('<i>›</i>') + '</span></span>';
  document.getElementById('zoomtag').innerHTML = s.level === 'files' ? '<b style="font-weight:300;color:#c9cdc5">files</b> · functions' : 'files · <b style="font-weight:300;color:#c9cdc5">functions</b>';
  cap.innerHTML = s.what === 'start' ? '<span class="key">▶</span>' + esc(O.title) : '<span class="key">' + s.key + '</span>' + s.what + (s.why ? '<span class="why">' + esc(s.why) + '</span>' : '');
  cap.style.opacity = O.caption === false ? 0 : 1;
  const pv = document.getElementById('pv'); if (!pv) return;
  if (S == null) { pv.innerHTML = '<div class="ph"><span style="color:var(--bright)">' + (O.hover ? O.hover.split('/').pop() : '') + '</span></div><div class="pv"><div class="sub">' + (O.hover ? rowsOf(O.hover).length + ' of ' + (rowsOf(O.hover).length + (extra[O.hover] || []).length) + ' functions run in this flow · in execution order' : 'click a box to see what’s inside') + '</div>' + (O.hover ? '<div class="pop" style="position:static;box-shadow:none;background:none;margin-top:10px;padding:0">' + rowsOf(O.hover).map((i) => '<div style="padding:3px 0"><span class="n">' + R[i].n + '</span><span>' + R[i].name + '</span><span style="color:#4f564f;font:300 11.5px var(--ui)">' + R[i].file.split('/').pop() + ':' + R[i].line + '</span></div>').join('') + '</div>' : '') + '</div>'; return; }
  const r = R[S], calls = R.filter((q) => q.caller === S), F = (h, t, g) => '<span class="h">' + h + '</span><span class="g-' + g + '">' + t + '</span>';
  const facts = [F('called from', r.caller != null ? '<b>' + R[r.caller].n + '</b> ' + R[r.caller].name : 'the start', 'proved'), F('calls', calls.length ? calls.map((q) => '<b>' + q.n + '</b> ' + q.name).join(' · ') : 'nothing in the project', 'proved')];
  for (const fx of (O.facts || {})[r.name] || []) facts.push(F(fx[0], fx[1], fx[2]));
  const nn = nextRow != null ? R[nextRow] : null;
  pv.innerHTML = '<div class="ph"><span style="color:var(--bright)">step ' + r.n + '</span><span class="grow"></span><button class="chip">open file ›</button></div><div class="pv">' +
    '<div class="card" style="background:#1b1c1b"><div class="card-h"><span class="sw" style="background:#ad9b6f"></span><span class="num">' + r.n + '</span><span class="nm" style="color:#c9cdc5">' + r.name + '</span><span class="loc">' + r.file + ':' + r.line + '</span></div><div class="mcode">' +
    r.code.map(([n, l]) => '<div class="' + (nn && nn.caller === S && new RegExp('\\\\b' + nn.name + '\\\\s*\\\\(').test(l) ? 'hl' : '') + '"><span class="ln">' + n + '</span><span class="tx">' + hlc(l) + '</span></div>').join('') + '</div></div>' +
    '<div class="facts">' + facts.join('') + '</div></div>';
}
function anchor(i, side) { const f = R[i].file, p = L[walk[at].level].pos[f], g = boxGeom(f, 'functions'), r = g.rows.find((q) => q.type === 'fn' && q.i === i); return { x: side === 'w' ? p.x : p.x + p.w, y: p.y + r.y + 10 }; }
// every piece of text, as boxes; text over text, or a line through text, is a collision
function audit() {
  const view = canvas.getBoundingClientRect(), boxes = [];
  const sel = [...world.querySelectorAll('.bx .t, .bx .lc, .bx .s, .fr > span, .lpl, .start, .tagt, .lab, .note, .shelf, .pop div > span, .grp span')];
  for (const e of sel) {
    if (!e.textContent.trim() || e.offsetParent === null) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.bottom < view.top || r.top > view.bottom || r.right < view.left || r.left > view.right) continue;
    boxes.push({ r, t: e.textContent.trim().slice(0, 24), owner: e.closest('.fr, .pop div') || e });
  }
  const hits = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], c = boxes[j]; if (a.owner === c.owner) continue;
    const w = Math.min(a.r.right, c.r.right) - Math.max(a.r.left, c.r.left), h = Math.min(a.r.bottom, c.r.bottom) - Math.max(a.r.top, c.r.top);
    if (w > 2 && h > 2) hits.push(a.t + '  ×  ' + c.t);
  }
  const m = edSvg.getScreenCTM();
  for (const p of edSvg.querySelectorAll('path')) {
    if (!p.getTotalLength || p.getAttribute('fill') !== 'none') continue;
    const len = p.getTotalLength();
    for (const b of boxes) {
      if (b.owner.closest && b.owner.closest('.pop')) continue;
      for (let d = 0; d <= len; d += 3) { const q = p.getPointAtLength(d).matrixTransform(m); if (q.x > b.r.left + 1 && q.x < b.r.right - 1 && q.y > b.r.top + 2 && q.y < b.r.bottom - 2) { hits.push('line × ' + b.t); break; } }
    }
  }
  return hits;
}
window.trav = { len: walk.length, set: (k) => { at = k; render(); }, audit };
window.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { at = Math.min(walk.length - 1, at + 1); render(); } if (e.key === 'ArrowLeft') { at = Math.max(0, at - 1); render(); } });
Promise.all([document.fonts.ready, ...[...new Set(O.levels)].map(async (lv) => { L[lv] = await layout(lv); })]).then(() => { render(); document.title = 'ready'; }).catch((e) => { document.title = 'error: ' + e.message; });
</script></body></html>`;
fs.writeFileSync(outPath, html);
console.log(outPath, 'walk', (O.moves || []).length + 1);
