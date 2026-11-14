import fs from 'node:fs';

const [a, b] = process.argv.slice(2);
if (!a || !b) { console.error('usage: node tools/sweep/compare-layers.mjs <report-before.json> <report-after.json>'); process.exit(2); }
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8')).layers ?? null;
const A = read(a), B = read(b);
if (!A || !B) { console.error(`no layers field in ${!A ? a : b}`); process.exit(2); }
const kinds = (list) => {
  const m = new Map();
  for (const x of list) { const i = x.lastIndexOf(' '), k = x.slice(0, i), z = x.slice(i + 1); if (!m.has(k)) m.set(k, new Set()); m.get(k).add(z); }
  return m;
};
const differences = [], notChecked = [];
let compared = 0;
const screens = [...new Set([...Object.keys(A), ...Object.keys(B)])].sort();
for (const s of screens) {
  if (!(s in A) || !(s in B)) { notChecked.push(`${s}: screen only in ${s in A ? a : b}`); continue; }
  const ka = kinds(A[s]), kb = kinds(B[s]);
  for (const k of new Set([...ka.keys(), ...kb.keys()])) {
    if (!ka.has(k) || !kb.has(k)) { notChecked.push(`${s}: ${k} only in ${ka.has(k) ? a : b}`); continue; }
    compared++;
    const za = [...ka.get(k)].sort().join(','), zb = [...kb.get(k)].sort().join(',');
    if (za !== zb) differences.push(`${s}: ${k} — ${za} before, ${zb} after`);
  }
}
console.log(JSON.stringify({ screens: screens.length, compared, differences: differences.length, notChecked: notChecked.length, problems: differences, notCheckedList: notChecked }, null, 1));
process.exit(differences.length ? 1 : 0);
