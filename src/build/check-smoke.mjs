// Fails unless a packaged app's boot check passed: node src/build/check-smoke.mjs <folder holding data/>
import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.argv[2], 'data', 'logs', 'smoke-report.json');
if (!fs.existsSync(file)) { console.error(`no smoke report at ${file} — the app didn't finish`); process.exit(1); }
const r = JSON.parse(fs.readFileSync(file, 'utf8'));
console.log(JSON.stringify(r, null, 1));
const problems = [
  r.errors?.length && `errors: ${r.errors.join('; ')}`,
  r.lsp !== 'ready' && `clangd is ${r.lsp}`,
  !r.clangd?.inbuilt && `not using the inbuilt clangd (${r.clangd?.active})`,
  !(r.previewCards > 0) && 'no preview cards',
  !r.definition && 'go to definition failed',
  !r.terminal && 'the terminal printed nothing',
  !(r.flowBoxes > 0) && 'the flow view is empty',
].filter(Boolean);
if (problems.length) { console.error(`\nboot check failed:\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('\nboot check passed');
