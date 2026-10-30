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
  !(r.flowBoxes > 0) && 'the flow view is empty',
  !(r.runSteps?.length >= 10) && `the run from main has ${r.runSteps?.length ?? 0} steps`,
  !(r.seqRows > 3) && 'the sequence view shows no rows',
  !(r.seqAround?.after < r.seqAround?.before && r.seqAround?.folds > 0 && !r.seqAround?.collisions?.length) && `around the step did not fold the rest: ${JSON.stringify(r.seqAround)}`,
  !(r.seqCode?.rows > 5) && `all code shows no code rows: ${JSON.stringify(r.seqCode)}`,
  r.seqCode?.collisions?.length && `code rows land on other text: ${r.seqCode.collisions.join('; ')}`,
  r.seqCollisions?.length && `text on text in the sequence view: ${r.seqCollisions.slice(0, 5).join('; ')}`,
  r.seqKeptStep === false && 'switching views lost the selected step',
  r.seqFold === false && 'folding a call showed no folded row',
  r.seqChapters != null && !(r.seqChapters > 1) && `the spine lists ${r.seqChapters} chapters`,
  r.seqCallCode != null && !(r.seqCallCode >= 2) && `the step's box quotes ${r.seqCallCode} lines around its call`,
  r.boxKeptStep === false && 'the boxes view does not show the selected step',
  r.boxCollisions?.length && `numbers over numbers or boxes in the boxes view: ${r.boxCollisions.slice(0, 5).join('; ')}`,
  r.boxRoutes != null && r.boxRoutes !== 2 && `main to split should have 2 routes, the boxes view shows ${r.boxRoutes}`,
  !(r.seqCodeLines > 1) && `the step's code shows ${r.seqCodeLines ?? 0} lines`,
  !(r.refresh?.finished && r.refresh?.seqRows > 3 && !/failed/.test(r.refresh?.toast ?? '')) && `refresh did not bring the views back: ${JSON.stringify(r.refresh)}`,
].filter(Boolean);
if (problems.length) { console.error(`\nboot check failed:\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('\nboot check passed');
