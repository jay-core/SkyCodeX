import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const GEN = path.resolve('data/gen'), OUT = path.resolve(process.argv[2] ?? 'data/logs/sweep/rules'), RUNS = path.join(OUT, 'runs');
const args = process.argv.slice(3), projects = args.filter((a) => a.includes(':')), only = args.filter((a) => !a.includes(':'));
const WIDTH = Number(process.env.SWEEP_JOBS) || Math.max(2, Math.min(6, Math.floor(os.cpus().length / 2)));
const ids = fs.readdirSync(GEN).filter((d) => fs.statSync(path.join(GEN, d)).isDirectory() && (!only.length || only.includes(d))).sort();
fs.mkdirSync(RUNS, { recursive: true });

const run = (folder, scenario, dir) => new Promise((done) => {
  fs.rmSync(dir, { recursive: true, force: true });
  const t0 = Date.now(), child = spawn('npx', ['electron', '.', '--smoke', folder, '--scenario', scenario, '--smoke-out', dir], { stdio: 'ignore' });
  child.on('exit', (code) => {
    const file = path.join(dir, 'smoke-report.json');
    done({ code, secs: Math.round((Date.now() - t0) / 1000), report: fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null, file });
  });
});

const merge = (reps) => {
  const rules = {};
  for (const rep of reps) for (const [k, v] of Object.entries(rep.rules ?? {})) {
    const t = rules[k] ?? (rules[k] = { count: 0, steps: 0, first: [] });
    t.count += v.count; t.steps += v.steps; t.first.push(...v.first);
  }
  for (const t of Object.values(rules)) t.first = t.first.slice(0, 20);
  const stop = reps.find((r) => r.stoppedAtStep);
  return { ...reps[0], walked: reps.reduce((a, r) => a + (r.walked ?? 0), 0), ...(stop ? { stoppedAtStep: stop.stoppedAtStep } : {}), errors: reps.flatMap((r) => r.errors ?? []), ms: Math.max(...reps.map((r) => r.ms ?? 0)), slice: reps.map((r) => r.slice), rules };
};
const table = {};
const jobs = [
  ...ids.map((id) => async () => {
    const dir = path.join(RUNS, id), r = await run(path.join('data/gen', id), 'rules', dir);
    if (!r.report) { table[id] = { verdict: 'not checked', exit: r.code, secs: r.secs }; console.log(`${id}: not checked (exit ${r.code}, ${r.secs} s)`); return; }
    fs.copyFileSync(r.file, path.join(OUT, `${id}.json`));
    const shot = path.join(dir, 'smoke-rules-step-1.png');
    if (fs.existsSync(shot)) fs.copyFileSync(shot, path.join(OUT, `${id}.png`));
    const rep = r.report, counts = Object.fromEntries(Object.entries(rep.rules ?? {}).map(([k, v]) => [k, v.count]));
    const stopped = rep.stoppedAtStep ? ` stopped at step ${rep.stoppedAtStep} of ${rep.steps}` : '';
    table[id] = { exit: r.code, secs: r.secs, steps: rep.steps, walked: rep.walked, stoppedAtStep: rep.stoppedAtStep ?? null, errors: rep.errors, counts };
    console.log(`${id}: ${rep.walked ?? 0}/${rep.steps ?? '?'} steps${stopped}, ${r.secs} s, faults ${Object.values(counts).reduce((a, b) => a + b, 0)}${rep.errors?.length ? `, errors ${JSON.stringify(rep.errors)}` : ''}`);
  }),
  ...projects.map((spec) => async () => {
    const at = spec.lastIndexOf(':'), folder = spec.slice(0, at), name = path.basename(folder);
    for (const item of spec.slice(at + 1).split(',')) {
      const [scenario, parts] = item.split('@'), n = Number(parts) || 1;
      const rs = await Promise.all(Array.from({ length: n }, (_, k) => run(folder, n > 1 ? `${scenario}@${k}/${n}` : scenario, path.join(RUNS, `${name}-${scenario}${n > 1 ? `-${k}` : ''}`))));
      console.log(`${name} ${scenario} exit ${rs.map((r) => r.code).join(',')}, ${Math.max(...rs.map((r) => r.secs))} s${n > 1 ? ` in ${n} parts` : ''}`);
      if (rs.some((r) => !r.report)) continue;
      fs.writeFileSync(path.join(OUT, `${name}-${scenario}.json`), JSON.stringify(n > 1 ? merge(rs.map((r) => r.report)) : rs[0].report, null, 1));
      for (const r of rs) for (const f of fs.readdirSync(path.dirname(r.file))) if (/^smoke-overlaps-grid-step19\.png$/.test(f)) fs.copyFileSync(path.join(path.dirname(r.file), f), path.join(OUT, f));
    }
  }),
];

const heavy = jobs.filter((_, k) => k >= ids.length && projects[k - ids.length].includes('@')), light = jobs.filter((j) => !heavy.includes(j));
const queue = [...light.slice(ids.length), ...light.slice(0, ids.length)];
await Promise.all(Array.from({ length: Math.min(WIDTH, queue.length) }, async () => { while (queue.length) await queue.shift()(); }));
for (const job of heavy) await job();
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(Object.fromEntries(Object.keys(table).sort().map((k) => [k, table[k]])), null, 1));
console.log('done');
