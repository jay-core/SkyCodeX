import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const GEN = path.resolve('data/gen'), OUT = path.resolve(process.argv[2] ?? 'data/logs/sweep/rules'), REPORT = path.resolve('data/logs/smoke-report.json');
const only = process.argv.slice(3);
const ids = fs.readdirSync(GEN).filter((d) => fs.statSync(path.join(GEN, d)).isDirectory() && (!only.length || only.includes(d))).sort();
fs.mkdirSync(OUT, { recursive: true });
const table = {};
for (const id of ids) {
  fs.rmSync(REPORT, { force: true });
  const t0 = Date.now();
  const r = spawnSync('npx', ['electron', '.', '--smoke', path.join('data/gen', id), '--scenario', 'rules'], { stdio: 'ignore' });
  const secs = Math.round((Date.now() - t0) / 1000);
  if (!fs.existsSync(REPORT)) { table[id] = { verdict: 'not checked', exit: r.status, secs }; console.log(`${id}: not checked (exit ${r.status}, ${secs} s)`); continue; }
  fs.copyFileSync(REPORT, path.join(OUT, `${id}.json`));
  const shot = path.resolve('data/logs/smoke-rules-step-1.png');
  if (fs.existsSync(shot)) fs.copyFileSync(shot, path.join(OUT, `${id}.png`));
  const rep = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  const counts = Object.fromEntries(Object.entries(rep.rules ?? {}).map(([k, v]) => [k, v.count]));
  const stopped = rep.stoppedAtStep ? ` stopped at step ${rep.stoppedAtStep} of ${rep.steps}` : '';
  table[id] = { exit: r.status, secs, steps: rep.steps, walked: rep.walked, stoppedAtStep: rep.stoppedAtStep ?? null, errors: rep.errors, counts };
  console.log(`${id}: ${rep.walked ?? 0}/${rep.steps ?? '?'} steps${stopped}, ${secs} s, faults ${Object.values(counts).reduce((a, b) => a + b, 0)}${rep.errors?.length ? `, errors ${JSON.stringify(rep.errors)}` : ''}`);
}
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(table, null, 1));
