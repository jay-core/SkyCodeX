// Writes the tinyhttp run (from the recorded clangd fixture, no clangd needed) and the files' text, for ux.html.
// usage (from the repo): npx esbuild src/concepts/flow/ux/data.ts --bundle --platform=node --outfile=<tmp>/data.cjs && node <tmp>/data.cjs <out.json>
import fs from 'node:fs';
import path from 'node:path';
import { loadFixture, describeRun } from '../../../tests/flowrun.fixture';
const REPO = process.cwd();
const root = path.join(REPO, 'samples/tinyhttp');
const { run } = loadFixture(path.join(REPO, 'src/tests/fixtures/tinyhttp-flow.json'), root);
const r = run('src/main.cpp#3');
const files: Record<string, string[]> = {};
for (const row of r.rows) if (row.file && !files[row.file]) files[row.file] = fs.readFileSync(path.join(root, row.file), 'utf8').split('\n');
fs.writeFileSync(process.argv[2], JSON.stringify({ run: r, files }));
console.log(describeRun(r).join('\n'));
