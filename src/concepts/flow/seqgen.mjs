// Draws the cascading sequence (time down, one column per file or folder) from flowtree.mjs's data, as a mock-up page.
// usage: node seqgen.mjs <data.json> <out.html> <title> [lanes: file|folder] [max rows]
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const [dataPath, outPath, title, laneMode = 'file', maxRows = '40'] = process.argv.slice(2);
const d = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const MAX = Number(maxRows);
const rows = d.rows.slice(0, MAX);
const laneOf = (f, r) => (laneMode === 'depth' ? `depth ${r.depth}` : laneMode === 'folder' ? f.replace(/\/[^/]+$/, '') || '.' : f.split('/').pop());
const lanes = [];
for (const r of rows) if (!lanes.includes(laneOf(r.file, r))) lanes.push(laneOf(r.file, r));
if (laneMode === 'depth') lanes.sort((a, b) => Number(a.split(' ')[1]) - Number(b.split(' ')[1]));
const clipped = d.frames.filter((f) => f.to >= f.from && f.from < rows.length).map((f) => ({ ...f, to: Math.min(f.to, rows.length - 1) }));
// on a big codebase only loops are frames; a condition is a short note on the first step it guards
const frames = laneMode === 'depth' ? clipped.filter((f) => f.type === 'loop') : clipped;
if (laneMode === 'depth') for (const f of clipped) if (f.type === 'branch' && !rows[f.from].cond) rows[f.from].cond = f.text;
for (const r of rows) r.last = Math.min(r.last, rows.length - 1);
const more = d.rows.length - rows.length;
const MOCK = fileURLToPath(new URL('./mock', import.meta.url)), STYLES = pathToFileURL(fileURLToPath(new URL('../../renderer/styles.css', import.meta.url))).href;
const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${STYLES}"><link rel="stylesheet" href="file://${MOCK}/mock.css">
<script src="file://${MOCK}/shell.js"></script>
<style>
.lane-h { position: absolute; top: 8px; white-space: nowrap; }
.lane-h .t { font: 300 14.5px var(--ui); color: var(--bright); }
.lane-line { position: absolute; width: 1px; background: #232623; }
.bar { position: absolute; width: 5px; background: #3a403a; }
.step { position: absolute; height: 20px; display: flex; align-items: center; gap: 7px; font: 12px var(--mono); color: var(--bright); white-space: nowrap; }
.step .n { color: #c9b98f; min-width: 18px; text-align: right; }
.step .f { font: 300 11px var(--ui); color: #4f564f; }
.step .u { font: 300 11px var(--ui); color: #586058; margin-left: 4px; }
.frame { position: absolute; border: 1px dashed #355252; }
.frame.branch { border-color: #3d3a30; border-style: dotted; }
.frame span { position: absolute; left: 8px; top: -8px; padding: 0 5px; background: var(--bg); font: 300 11.5px var(--ui); color: #5f8a8a; white-space: nowrap; max-width: 520px; overflow: hidden; text-overflow: ellipsis; }
.frame.branch span { color: #7d7458; }
.step .q { font: 300 11px var(--ui); color: #8a7f5f; margin-left: 4px; }
.more { position: absolute; font: 300 12.5px var(--ui); color: #4f564f; }
</style></head><body><div id="root"></div><script>
const D = ${JSON.stringify({ rows, frames, lanes, more, laneMode })};
const canvas = shell({ tabs: [['flow', true], ['folder', false]], ph: ${JSON.stringify(title)}, preview: null,
  chips: '<button class="chip">map</button><button class="chip on">sequence</button>',
  overlay: '<div class="legend"><span><b>▌</b> still running</span><span><b>↻</b> repeats</span><span><b>?</b> only when the condition holds</span><span><b>→ 12</b> already shown at step 12</span>${laneMode === 'depth' ? '<span>each call one column to the right · small helpers folded into the line of their caller</span>' : ''}</div>' });
const W = canvas.clientWidth - 40, LW = D.laneMode === 'depth' ? 118 : Math.min(190, Math.floor(W / D.lanes.length)), L0 = 22, TOP = 48;
const RH = Math.min(26, Math.floor((canvas.clientHeight - TOP - 60) / (D.rows.length + (D.more ? 1 : 0))));
const lx = (i) => L0 + i * LW, ry = (r) => TOP + r * RH;
const layer = document.createElement('div'); layer.style.cssText = 'position:absolute;inset:0'; canvas.appendChild(layer);
const svgNS = 'http://www.w3.org/2000/svg';
const svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('width', '1440'); svg.setAttribute('height', '900'); svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible';
const add = (h, css, cls) => { const e = document.createElement('div'); e.className = cls; e.style.cssText = css; e.innerHTML = h; layer.appendChild(e); return e; };
const lane = (r) => D.lanes.indexOf(D.laneMode === 'depth' ? 'depth ' + r.depth : D.laneMode === 'folder' ? (r.file.replace(/\\/[^/]+$/, '') || '.') : r.file.split('/').pop());
D.lanes.forEach((l, i) => { add('<div class="t">' + (D.laneMode === 'depth' ? (i === 0 ? 'entry' : i === 1 ? 'calls' : '') : l) + '</div>', 'left:' + lx(i) + 'px;max-width:' + (LW - 8) + 'px;overflow:hidden;text-overflow:ellipsis', 'lane-h'); add('', 'left:' + (lx(i) + 4) + 'px;top:' + (TOP - 8) + 'px;height:' + (D.rows.length * RH + 8) + 'px', 'lane-line'); });
// nesting inside a lane: a running function's bar shifts the ones it calls in the same column
const nest = D.rows.map(() => 0);
D.rows.forEach((r, i) => { let k = 0; for (let j = 0; j < i; j++) if (D.rows[j].last >= i && D.rows[j].last > j && lane(D.rows[j]) === lane(r)) k++; nest[i] = k; });
for (const f of D.frames) {
  const own = lane(D.rows[f.owner] ?? D.rows[f.from]);
  const ls = D.rows.slice(f.from, f.to + 1).map(lane).concat([own]);
  const a = Math.min(...ls), b = Math.max(...ls);
  const label = (f.type === 'loop' ? '↻ ' + (f.count != null ? '×' + f.count + ' · ' : '') : '? ') + f.text;
  add('<span>' + label.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>', 'left:' + (lx(a) - 8) + 'px;top:' + (ry(f.from) - 2) + 'px;width:' + (lx(b) + LW - 14 - lx(a)) + 'px;height:' + ((f.to - f.from + 1) * RH + 1) + 'px', 'frame ' + f.type);
}
layer.appendChild(svg);
D.rows.forEach((r, i) => { if (r.last > i) add('', 'left:' + (lx(lane(r)) + 2 + nest[i] * 6) + 'px;top:' + (ry(i) + 2) + 'px;height:' + ((r.last - i) * RH + RH - 6) + 'px', 'bar'); });
D.rows.forEach((r, i) => {
  const x = lx(lane(r)) + 13 + nest[i] * 6;
  const uses = r.uses && r.uses.length ? '<span class="u">' + r.uses.slice(0, 4).join(' · ') + (r.uses.length > 4 ? ' +' + (r.uses.length - 4) : '') + '</span>' : '';
  add('<span class="n">' + r.n + '</span><span>' + r.name + '</span>' + (D.laneMode !== 'file' ? '<span class="f">' + r.file.split('/').pop() + '</span>' : '') + (r.cond ? '<span class="q">? ' + r.cond.replace(/^if\s*/, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').slice(0, 48) + (r.cond.length > 52 ? '…' : '') + '</span>' : '') + uses, 'left:' + x + 'px;top:' + ry(i) + 'px', 'step');
  if (r.caller == null || r.caller >= D.rows.length) return;
  const c = D.rows[r.caller], y = ry(i) + RH / 2 - 2, x1 = lx(lane(c)) + 7 + nest[r.caller] * 6, x2 = x - 4;
  const col = r.thread ? '#7a6f8a' : '#5f665f';
  const p = document.createElementNS(svgNS, 'path'); p.setAttribute('d', 'M' + x1 + ' ' + y + ' L' + (x2 - 2) + ' ' + y); p.setAttribute('stroke', col); p.setAttribute('stroke-width', '1.4'); p.setAttribute('fill', 'none');
  if (r.thread) p.setAttribute('stroke-dasharray', '5 4');
  svg.appendChild(p);
  const h = document.createElementNS(svgNS, 'path'); h.setAttribute('d', 'M0 0 L-8 -4.5 L-8 4.5 Z'); h.setAttribute('fill', col); h.setAttribute('transform', 'translate(' + x2 + ' ' + y + ')'); svg.appendChild(h);
});
if (D.more) add('… ' + D.more + ' more steps below — scroll, or fold a call to see past it', 'left:' + (L0 + 10) + 'px;top:' + (ry(D.rows.length) + 4) + 'px', 'more');
document.fonts.ready.then(() => { document.title = 'ready'; });
</script></body></html>`;
fs.writeFileSync(outPath, html);
console.log(outPath, rows.length, 'rows', lanes.length, 'lanes');
