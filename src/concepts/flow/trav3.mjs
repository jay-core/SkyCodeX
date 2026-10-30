// Traversal prototype, third version: detail levels per function (calls, decisions, all code), so the code between
// calls appears in place; ← retraces the path walked, ⇧← jumps to the previous pass of a loop. Moves are scripted, every
// position is worked out from the analysed data (calls from the index, statements from clangd's syntax tree).
// usage: node trav3.mjs <data.json> <root> <out.html> <title> <start row> <moves, comma-separated>
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const [dataPath, root, outPath, title, startArg, movesArg] = process.argv.slice(2);
const d = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const MOCK = fileURLToPath(new URL('./mock', import.meta.url)), STYLES = pathToFileURL(fileURLToPath(new URL('../../renderer/styles.css', import.meta.url))).href;
d.rows.forEach((r, i) => { if (r.last < i) r.last = i; });
for (const r of d.rows) {
  const L = fs.readFileSync(path.join(root, r.file), 'utf8').split('\n');
  let i = r.line - 1, depth = 0, started = false, end = i;
  for (let k = i; k < Math.min(L.length, i + 80); k++) { for (const ch of L[k]) { if (ch === '{') { depth++; started = true; } else if (ch === '}') depth--; } if (started && depth <= 0) { end = k; break; } }
  r.code = L.slice(i, end + 1).slice(0, 18).map((t, k) => [i + k + 1, t]);
  r.sig = L[i].replace(/\s*\{\s*$/, '').trim();
  const cm = []; for (let k = i - 1; k >= 0 && /^\s*\/\//.test(L[k]); k--) cm.unshift(L[k].replace(/^\s*\/\/\s?/, ''));
  r.comment = cm.join(' ');
}
const frames = d.frames.filter((f) => f.to >= f.from && f.type === 'loop');

const html = `<!doctype html><html><head><meta charset="utf-8"><title>traversal</title>
<link rel="stylesheet" href="${STYLES}"><link rel="stylesheet" href="file://${MOCK}/mock.css">
<script src="file://${MOCK}/shell.js"></script>
<script>
const SLOW = Number(new URLSearchParams(location.search).get('slow') || 1);
if (SLOW > 1) document.write('<style>.mv{transition-duration:' + (.4 * SLOW) + 's!important}#seq{transition-duration:' + (.45 * SLOW) + 's!important}.flash{animation-duration:' + (.6 * SLOW) + 's!important}.cap,.lvl{transition-duration:' + (.25 * SLOW) + 's!important}</style>');
</script>
<style>
#seq { position: absolute; left: 0; top: 0; right: 0; transition: transform .45s cubic-bezier(.16,1,.3,1); }
.lane-h { position: absolute; top: 8px; white-space: nowrap; font: 300 13.5px var(--ui); color: var(--bright); }
.lane-line { position: absolute; width: 1px; background: #212421; }
.mv { transition: top .4s cubic-bezier(.16,1,.3,1), height .4s cubic-bezier(.16,1,.3,1), left .4s cubic-bezier(.16,1,.3,1), opacity .4s, background .3s, border-color .3s, color .3s; }
.bar { position: absolute; width: 5px; background: #333833; }
.bar.on { background: #7d7356; }
.step { position: absolute; display: flex; align-items: center; gap: 7px; height: 22px; font: 12px var(--mono); color: var(--bright); white-space: nowrap; }
.step .n { color: #c9b98f; min-width: 18px; text-align: right; }
.step .u { font: 300 11px var(--ui); color: #586058; margin-left: 4px; }
.step .loc { font: 300 11px var(--ui); color: #6f766e; }
.step .tag { font: 300 11px var(--ui); color: #ad9b6f; margin-left: 6px; }
.step.far { opacity: .4; }
.step.part { height: 26px; padding: 0 10px 0 6px; background: color-mix(in srgb, #ad9b6f 9%, #1b1c1b); border: 1px solid #5a5442; }
.step.sel { height: 26px; padding: 0 10px 0 6px; background: color-mix(in srgb, #ad9b6f 20%, #1b1c1b); border: 1.5px solid #ad9b6f; color: #e3e6df; font-size: 13px; }
/* code between calls: quieter, in the function's own column, indented by nesting */
.stmt { position: absolute; display: flex; align-items: center; gap: 8px; height: 20px; font: 11.5px var(--mono); color: #7b8279; white-space: nowrap; }
.stmt .ln { font: 300 10.5px var(--ui); color: #3f453f; min-width: 22px; text-align: right; }
.stmt .k { font: 11.5px var(--mono); min-width: 12px; text-align: center; }
.stmt.if .k, .stmt.else .k { color: #a8955f; } .stmt.if, .stmt.else { color: #a39a80; }
.stmt.return .k { color: #b8766b; } .stmt.return { color: #b39a92; }
.stmt.continue .k, .stmt.break .k, .stmt.loop .k { color: #6f9e9e; } .stmt.continue, .stmt.break, .stmt.loop { color: #8aa5a5; }
.stmt.far { opacity: .4; }
.stmt.part { background: color-mix(in srgb, #ad9b6f 7%, #1b1c1b); outline: 1px solid #4a4636; padding: 0 8px 0 4px; }
.stmt.part .tag { font: 300 11px var(--ui); color: #ad9b6f; }
.stmt.sel { background: color-mix(in srgb, #ad9b6f 18%, #1b1c1b); outline: 1.5px solid #ad9b6f; color: #e3e6df; padding: 0 8px 0 4px; height: 24px; }
.band { position: absolute; left: 8px; right: 8px; background: color-mix(in srgb, #ad9b6f 7%, #191a19); border: 1px solid #4f4a3b; border-top: 0; overflow: hidden; }
.band .in { position: absolute; top: 9px; right: 12px; }
.band .sum { font: 300 13px var(--ui); color: #b9beb5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.band .sum.code { font: 12px var(--mono); color: #7f9e82; }
.band .bd { display: flex; gap: 12px; margin-top: 5px; font: 300 11.5px var(--ui); color: #6f766e; white-space: nowrap; }
.band .bd .lp { color: #5f8a8a; }
.band .facts { margin-top: 7px; display: grid; grid-template-columns: 84px 1fr; gap: 2px 10px; font: 300 12px/1.55 var(--ui); color: var(--fg); }
.band .facts span:nth-child(odd) { color: #586058; }
.band .facts b { font: 12px var(--mono); color: #c9b98f; font-weight: 400; }
.band .facts .t { color: #a8955f; } .band .facts .f { color: #b8766b; }
.chipc { display: inline-block; font: 11.5px var(--mono); color: var(--bright); background: #222422; padding: 0 6px; margin: 0 4px 3px 0; }
.chipc i { font-style: normal; color: #c9b98f; margin-right: 4px; }
.frame { position: absolute; border: 1px dashed #304848; }
.frame.hot { border-color: #4f7a7a; }
.frame span { position: absolute; right: 10px; top: -8px; padding: 0 5px; background: var(--bg); font: 300 11.5px var(--ui); color: #557a7a; white-space: nowrap; }
.frame.hot span { color: #8fc0c0; }
.arw { position: absolute; height: 0; border-top: 1.4px solid #464c46; }
.arw::after { content: ''; position: absolute; right: -1px; top: -5px; border: 4.5px solid transparent; border-left: 8px solid #464c46; border-right: 0; }
.arw.thread { border-top-style: dashed; border-top-color: #6a6078; }
.arw.hot { border-top: 2px solid #ad9b6f; }
.arw.hot::after { border-left-color: #ad9b6f; top: -5.5px; }
.arw.dim { opacity: .35; }
.flash { animation: flash .6s ease-out; }
@keyframes flash { from { box-shadow: 0 0 0 6px rgba(173,155,111,.35); } to { box-shadow: 0 0 0 0 rgba(173,155,111,0); } }
.cap { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); background: #222422; box-shadow: 0 12px 30px rgba(0,0,0,.5); padding: 8px 16px; font: 300 14px var(--ui); color: var(--bright); white-space: nowrap; transition: opacity .25s; z-index: 20; }
.cap .key { font: 13px var(--mono); color: #c9b98f; margin-right: 10px; }
.cap .why { color: #8b9189; margin-left: 8px; }
.lvl { display: inline-flex; gap: 14px; margin-left: 18px; font: 300 12.5px var(--ui); color: #4a504a; transition: color .25s; }
.lvl b { font-weight: 300; color: var(--bright); }
.lvl i { font-style: normal; color: #c9b98f; font: 11.5px var(--mono); margin-right: 3px; }
</style></head><body><div id="root"></div><script>
const D = ${JSON.stringify({ rows: d.rows, frames, title, start: Number(startArg), moves: movesArg.split(',') })};
const canvas = shell({ tabs: [['flow', true], ['folder', false]], ph: '<span id="ph"></span>',
  chips: '<span class="lvl" id="lvl"></span><button class="chip" style="margin-left:18px">map</button><button class="chip on">sequence</button>', preview: '<div id="pv"></div>', previewW: 440 });
const seq = document.createElement('div'); seq.id = 'seq'; canvas.appendChild(seq);
const cap = document.createElement('div'); cap.className = 'cap'; cap.style.opacity = 0; canvas.parentElement.appendChild(cap);
const mk = (cls, parent = seq) => { const e = document.createElement('div'); e.className = cls; parent.appendChild(e); return e; };
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const hlc = (t) => esc(t).replace(/("[^"]*"|'[^']*')/g, '<span class="st">$1</span>').replace(/\\b(static|const|bool|char|int|void|auto|return|if|for|while|continue|break|std|size_t|true|false|else)\\b(?![^<]*<\\/span>)/g, '<span class="kw">$1</span>');
const R = D.rows;
const lanes = []; for (const r of R) { const l = r.file.split('/').pop(); if (!lanes.includes(l)) lanes.push(l); }
const lane = (i) => lanes.indexOf(R[i].file.split('/').pop());
const CW = canvas.clientWidth, LW = 112, L0 = 18, TOP = 44;
const lx = (i) => L0 + i * LW;
const nest = R.map(() => 0);
R.forEach((r, i) => { let k = 0; for (let j = 0; j < i; j++) if (R[j].last >= i && R[j].last > j && lane(j) === lane(i)) k++; nest[i] = k; });
const sx = (i) => lx(lane(i)) + 13 + nest[i] * 6;
lanes.forEach((l, i) => { const h = mk('lane-h'); h.textContent = l; h.style.left = lx(i) + 'px'; });
const laneLines = lanes.map((l, i) => { const e = mk('lane-line mv'); e.style.left = (lx(i) + 4) + 'px'; e.style.top = (TOP - 8) + 'px'; return e; });
const before = (a, b) => a.line < b.line || (a.line === b.line && a.character <= b.character);
const SHOWN = { calls: new Set(), decisions: new Set(['if', 'else', 'return', 'break', 'continue', 'loop']), all: new Set(['if', 'else', 'return', 'break', 'continue', 'loop', 'code']) };

// ---- the list of rows for a set of levels: calls in order, with each function's statements in between ----
function build(levels) {
  const items = [];
  const emit = (i) => {
    items.push({ key: 'c' + i, type: 'call', i, fn: i });
    const lv = levels[R[i].name] ?? levels['*'] ?? 'calls';
    const parts = [];
    R.forEach((k, j) => { if (k.caller === i) parts.push({ at: k.at, call: j }); });
    (R[i].stmts || []).forEach((s, k) => { if (s.call == null && SHOWN[lv].has(s.kind)) parts.push({ at: s.at, stmt: k }); });
    parts.sort((a, b) => (a.at && b.at ? (before(a.at, b.at) ? -1 : 1) : 0));
    for (const p of parts) p.call != null ? emit(p.call) : items.push({ key: 's' + i + '.' + p.stmt, type: 'stmt', fn: i, k: p.stmt, s: R[i].stmts[p.stmt] });
  };
  emit(0);
  // how far each call's work reaches down the list (its bar)
  const pos = new Map(items.map((it, j) => [it.key, j]));
  const anc = (it) => { const out = []; for (let i = it.fn; i != null; i = R[i].caller) out.push(i); return out; };
  const end = R.map((r, i) => pos.get('c' + i) ?? -1);
  items.forEach((it, j) => { for (const a of anc(it)) if (end[a] < j) end[a] = j; });
  return { items, pos, end };
}
// loops: from their header (when shown) or first call, to the end of their last call's work and any body code after it
function frameSpan(L, f) {
  const own = f.owner, hdr = L.items.findIndex((it) => it.type === 'stmt' && it.fn === own && it.s.kind === 'loop' && it.s.text === f.text);
  let a = hdr >= 0 ? hdr : L.pos.get('c' + f.from), b = L.end[f.to];
  const depth = hdr >= 0 ? L.items[hdr].s.depth : -1;
  while (b + 1 < L.items.length && L.items[b + 1].type === 'stmt' && L.items[b + 1].fn === own && L.items[b + 1].s.depth > depth && depth >= 0) b++;
  return [a, b];
}

// ---- the walk: each move worked out from the list as it is at that moment ----
const walk = [];
let st = { key: 'c' + D.start, levels: { '*': 'calls' }, passes: {}, key2: '', what: 'start', why: '' };
walk.push(st);
const trail = [st];   // the path walked forward; ← walks it back
const loopsAt = (L, j) => D.frames.map((f, k) => ({ f, k, span: frameSpan(L, f) })).filter((x) => x.span[0] <= j && x.span[1] >= j).sort((a, b) => b.span[0] - a.span[0]);
for (const m of D.moves) {
  const L = build(st.levels), j = L.pos.get(st.key), it = L.items[j];
  let to = j + 1, levels = st.levels, passes = { ...st.passes }, key = '→', what = 'next', why = '';
  if (m === 'over') { to = L.end[it.i] + 1; key = '⇧ →'; what = 'step over'; why = 'skipped ' + (L.end[it.i] - j) + ' rows inside ' + R[it.i].name; }
  if (m === 'back') { trail.pop(); const prev = trail[trail.length - 1]; st = { ...prev, key2: '←', what: 'back', why: 'retraces the path you walked' }; walk.push(st); continue; }
  if (m === 'prevpass') {
    const l = loopsAt(L, j)[0], want = (st.passes[l.k] || 1) - 1;
    const prev = [...walk].reverse().find((w) => w.key === st.key && w.passes[l.k] === want);
    st = { ...prev, key2: '⇧ ←', what: 'previous pass', why: 'pass ' + want + ' of ' + l.f.text.slice(0, 34) }; walk.push(st); trail.push(st); continue;
  }
  if (m === 'again') { const l = loopsAt(L, j)[0]; to = l.span[0]; passes[l.k] = (passes[l.k] || 1) + 1; key = 'R'; what = 'another pass'; why = 'pass ' + passes[l.k]; }
  if (m === 'leave') { const l = loopsAt(L, j)[0]; to = l.span[1] + 1; key = 'L'; what = 'leave the loop'; why = 'skipped its other passes'; }
  if (m.startsWith('level:')) {
    const [, fn, lv] = m.split(':');
    levels = fn === '*' ? { '*': lv } : { ...st.levels, [fn]: lv };
    const L2 = build(levels);
    let k2 = st.key; if (!L2.pos.has(k2)) k2 = 'c' + it.fn;   // a hidden row hands the selection to its function
    key = { all: 'A', decisions: 'D', calls: 'C' }[lv]; what = (lv === 'all' ? 'all code' : lv === 'decisions' ? 'decisions only' : 'calls only') + (fn === '*' ? ' everywhere' : ' in ' + fn);
    why = lv === 'all' ? 'the code between calls, in place' : lv === 'decisions' ? 'only where the path can change' : 'the bird’s-eye view';
    st = { key: k2, levels, passes, key2: key, what, why }; walk.push(st); trail.push(st); continue;
  }
  const L2 = L, tgt = L2.items[to];
  if (!tgt) { st = { key: 'end', levels, passes, key2: key, what: 'end of the run', why: '' }; walk.push(st); continue; }
  const inside = new Set(loopsAt(L2, to).map((x) => x.k));
  for (const k of Object.keys(passes)) if (!inside.has(Number(k))) delete passes[k];
  for (const k of inside) if (!passes[k]) passes[k] = 1;
  if (m === 'next' && !why) {
    if (tgt.type === 'call' && R[tgt.i].caller !== (it.type === 'call' ? it.i : it.fn)) why = 'back in ' + R[R[tgt.i].caller].name;
    if (tgt.type === 'stmt' && it.type === 'call' && tgt.fn !== it.i) why = 'back in ' + R[tgt.fn].name;
  }
  st = { key: tgt.key, levels, passes, key2: key, what, why }; walk.push(st); trail.push(st);
}

// ---- drawing: elements by row key, so rows that appear or go fade in place ----
const els = new Map();
const frameEls = D.frames.map(() => { const e = mk('frame mv'); e.innerHTML = '<span></span>'; return e; });
const bars = R.map(() => mk('bar mv'));
const arrows = R.map((r) => (r.caller == null ? null : mk('arw mv' + (r.thread ? ' thread' : ''))));
const band = mk('band mv'); const bandIn = mk('in', band);
let at = 0;
function render() {
  const s = walk[at], L = build(s.levels), S = s.key === 'end' ? -1 : L.pos.get(s.key);
  const prevK = at > 0 ? walk[at - 1].key : null, nextK = at < walk.length - 1 ? walk[at + 1].key : null;
  const P = prevK != null && prevK !== s.key ? L.pos.get(prevK) ?? -1 : -1, N = nextK != null && nextK !== s.key ? L.pos.get(nextK) ?? -1 : -1;
  const cur = S >= 0 ? L.items[S] : null;
  const chain = new Set(); for (let i = cur ? cur.fn : null; i != null; i = R[i].caller) chain.add(i);
  const BAND = cur && cur.type === 'call' ? 136 : 96;
  const H = (j) => (j === S ? 28 + BAND + 8 : j === P || j === N ? 28 : L.items[j].type === 'stmt' ? 21 : 24);
  const ys = []; let y = TOP; L.items.forEach((it, j) => { ys[j] = y; y += H(j); });
  laneLines.forEach((e) => (e.style.height = (y - TOP + 8) + 'px'));
  // rows
  const live = new Set();
  L.items.forEach((it, j) => {
    live.add(it.key);
    let e = els.get(it.key);
    if (!e) { e = mk(it.type === 'call' ? 'step mv' : 'stmt mv'); e.style.opacity = 0; e.style.top = (ys[j] - 6) + 'px'; els.set(it.key, e); void e.offsetWidth; }
    const kind = j === S ? 'sel' : j === P || j === N ? 'part' : 'line';
    const tag = j === P ? '← back' : j === N ? 'next →' : '';
    if (it.type === 'call') {
      const r = R[it.i];
      e.className = 'step mv' + (kind === 'sel' ? ' sel' : kind === 'part' ? ' part' : chain.has(it.i) ? '' : ' far');
      e.innerHTML = '<span class="n">' + r.n + '</span><span>' + r.name + '</span>' + (kind !== 'line' ? '<span class="loc">' + r.file.split('/').pop() + ':' + r.line + '</span>' : '') + (tag ? '<span class="tag">' + tag + '</span>' : '') +
        (kind === 'line' && r.uses.length ? '<span class="u">' + r.uses.join(' · ') + '</span>' : '');
      e.style.left = Math.min(sx(it.i), CW - e.offsetWidth - 12) + 'px';
    } else {
      const st2 = it.s, mark = { if: '?', else: ':', return: '↩', continue: '↻', break: '⤓', loop: '↻', code: '·' }[st2.kind];
      e.className = 'stmt mv ' + st2.kind + (kind === 'sel' ? ' sel' : kind === 'part' ? ' part' : chain.has(it.fn) ? '' : ' far');
      e.innerHTML = '<span class="ln">' + st2.line + '</span><span class="k">' + mark + '</span><span>' + esc(st2.text.length > 58 ? st2.text.slice(0, 57) + '…' : st2.text) + '</span>' + (tag ? '<span class="tag">' + tag + '</span>' : '');
      e.style.left = Math.min(sx(it.fn) + 4 + st2.depth * 16, CW - e.offsetWidth - 12) + 'px';
    }
    e.style.top = (ys[j] + (it.type === 'stmt' && kind === 'line' ? 1 : 0)) + 'px';
    e.style.opacity = '';
  });
  for (const [k, e] of els) if (!live.has(k)) { e.style.opacity = 0; els.delete(k); setTimeout(() => e.remove(), 450 * SLOW); }
  // bars and arrows
  R.forEach((r, i) => {
    const j = L.pos.get('c' + i), b = bars[i];
    if (L.end[i] > j) { Object.assign(b.style, { display: '', left: (lx(lane(i)) + 2 + nest[i] * 6) + 'px', top: (ys[j] + 2) + 'px', height: (ys[L.end[i]] + H(L.end[i]) - 4 - ys[j] - 2) + 'px' }); b.classList.toggle('on', chain.has(i)); } else b.style.display = 'none';
    const a = arrows[i]; if (!a) return;
    const c = r.caller, x1 = lx(lane(c)) + 7 + nest[c] * 6, x2 = parseFloat(els.get('c' + i).style.left) - 4;
    Object.assign(a.style, { left: x1 + 'px', top: (ys[j] + (j === S || j === P || j === N ? 13 : 11)) + 'px', width: Math.max(0, x2 - x1) + 'px' });
    const hot = j === S || (j === N && N >= 0);
    a.classList.toggle('hot', hot); a.classList.toggle('dim', !hot && !chain.has(i));
  });
  // loops
  D.frames.forEach((f, k) => {
    const [a, b] = frameSpan(L, f), e = frameEls[k];
    const ls = [lane(f.owner)]; for (let j = a; j <= b; j++) ls.push(lane(L.items[j].fn));
    const left = lx(Math.min(...ls)) - 7, hot = S >= a && S <= b;
    Object.assign(e.style, { left: left + 'px', top: (ys[a] - 3) + 'px', width: Math.min(CW - 12 - left, (hot ? CW : lx(Math.max(...ls)) + LW + 160) - left) + 'px', height: (ys[b] + H(b) - ys[a] + 4) + 'px' });
    e.classList.toggle('hot', hot);
    e.firstChild.textContent = '↻ ' + (f.count != null ? '×' + f.count + ' · ' : '') + f.text + (hot && s.passes[k] ? ' · pass ' + s.passes[k] : '');
  });
  // the selected row's box
  band.style.opacity = cur ? 1 : 0;
  if (cur) {
    Object.assign(band.style, { top: (ys[S] + 28) + 'px', height: BAND + 'px' });
    bandIn.style.left = Math.max(10, Math.min((cur.type === 'call' ? sx(cur.i) : sx(cur.fn)) - 8, CW - 540)) + 'px';
    const ctr = Object.entries(s.passes).map(([k, p]) => D.frames[k].text.slice(0, 30) + ' · pass ' + p).join(' · ');
    if (cur.type === 'call') {
      const r = R[cur.i], calls = R.filter((k) => k.caller === cur.i);
      bandIn.innerHTML = '<div class="sum' + (r.comment ? '' : ' code') + '">' + (r.comment ? '“' + esc(r.comment) + '”' : esc(r.sig)) + '</div><div class="bd">' + (ctr ? '<span class="lp">↻ ' + esc(ctr) + '</span>' : '') + '</div>' +
        '<div class="facts"><span>calls</span><span>' + (calls.length ? calls.map((k) => '<span class="chipc"><i>' + k.n + '</i>' + k.name + '</span>').join('') : 'nothing in the project — a leaf') + '</span>' +
        '<span>code</span><span>' + (r.stmts || []).filter((x) => x.call == null).length + ' statements between its calls · ' + (r.stmts || []).filter((x) => /if|return|continue|break/.test(x.kind)).length + ' decisions</span></div>';
    } else {
      const x = cur.s, f = R[cur.fn];
      const meaning = x.kind === 'if' ? '<span>decides</span><span><span class="t">if true</span> → the indented rows below · <span class="f">if false</span> → past them</span>'
        : x.kind === 'return' ? '<span>leaves</span><span>' + f.name + ' ends here and returns to ' + (R[f.caller] ? R[f.caller].name : 'the start') + (x.depth ? ' — early, only on this branch' : '') + '</span>'
        : x.kind === 'continue' ? '<span>loop</span><span>skips to the next pass</span>' : x.kind === 'loop' ? '<span>loop</span><span>the indented rows repeat</span>' : '<span>code</span><span>runs here, between calls — no project call inside</span>';
      bandIn.innerHTML = '<div class="sum code">' + esc(x.text) + '</div><div class="bd"><span>' + f.name + ' · ' + f.file.split('/').pop() + ':' + x.line + '</span>' + (ctr ? '<span class="lp">↻ ' + esc(ctr) + '</span>' : '') + '</div><div class="facts">' + meaning + '</div>';
    }
    band.classList.remove('flash'); void band.offsetWidth; band.classList.add('flash');
  }
  const view = canvas.clientHeight, focusY = cur ? ys[S] : y;
  seq.style.transform = 'translateY(' + Math.min(0, Math.max(view - y - 60, view * 0.32 - focusY)) + 'px)';
  // header, level switch, caption, preview
  const fnOf = cur ? cur.fn : 0, lvNow = s.levels[R[fnOf].name] ?? s.levels['*'];
  document.getElementById('lvl').innerHTML = ['calls', 'decisions', 'all'].map((l) => (l === lvNow ? '<b>' : '<span>') + '<i>' + { calls: 'C', decisions: 'D', all: 'A' }[l] + '</i>' + (l === 'all' ? 'all code' : l) + (l === lvNow ? '</b>' : '</span>')).join('') + '<span style="color:#3f453f">· ' + (s.levels[R[fnOf].name] ? 'in ' + R[fnOf].name : 'everywhere') + '</span>';
  const names = []; for (let i = fnOf; i != null; i = R[i].caller) names.unshift(R[i].name);
  const ctr = Object.entries(s.passes).map(([k, p]) => D.frames[k].text.slice(0, 26) + ' · pass ' + p).join(' · ');
  document.getElementById('ph').innerHTML = '<span class="steps"><span class="k">' + (cur ? (cur.type === 'call' ? R[cur.i].n + ' / ' + R.length : 'line ' + cur.s.line) : 'end') + '</span>' + (ctr ? '<span class="ctr">' + esc(ctr) + '</span>' : '') + '<span class="path">' + names.slice(-3).join('<i>›</i>') + '</span></span>';
  cap.innerHTML = s.what === 'start' ? '<span class="key">▶</span>' + esc(D.title) : '<span class="key">' + s.key2 + '</span>' + s.what + (s.why ? '<span class="why">' + esc(s.why) + '</span>' : '');
  cap.style.opacity = 1;
  if (!cur) return;
  const show = cur.type === 'call' ? cur.i : cur.fn, r = R[show], hl = cur.type === 'stmt' ? cur.s.line : null;
  document.getElementById('pv').innerHTML = '<div class="ph"><span style="color:var(--bright)">' + (cur.type === 'call' ? 'step ' + r.n : r.name + ' · line ' + hl) + '</span><span class="grow"></span><button class="chip">open file ›</button></div><div style="padding:0 14px">' +
    '<div class="card lit" style="--c:#ad9b6f"><div class="card-h"><span class="sw" style="background:#ad9b6f"></span><span class="num">' + r.n + '</span><span class="nm">' + r.name + '</span><span class="loc">' + r.file + ':' + r.line + '</span></div><div class="mcode">' +
    r.code.map(([n, l]) => '<div class="' + (n === hl ? 'hl' : '') + '"><span class="ln">' + n + '</span><span class="tx">' + hlc(l) + '</span></div>').join('') + '</div></div>' +
    '<div class="sub" style="margin:18px 6px 6px">keys</div>' +
    '<div class="choice"><span class="key">→ ←</span><span>next · back along your path</span></div><div class="choice"><span class="key">⇧ →</span><span>step over a call</span></div>' +
    '<div class="choice"><span class="key">R L ⇧←</span><span>another pass · leave the loop · previous pass</span></div><div class="choice"><span class="key">C D A</span><span>calls · decisions · all code</span></div></div>';
}
window.trav = { len: walk.length, set: (k) => { at = k; render(); } };
window.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { at = Math.min(walk.length - 1, at + 1); render(); } if (e.key === 'ArrowLeft') { at = Math.max(0, at - 1); render(); } });
document.fonts.ready.then(() => { render(); document.title = 'ready'; });
</script></body></html>`;
fs.writeFileSync(outPath, html);
console.log(outPath);
