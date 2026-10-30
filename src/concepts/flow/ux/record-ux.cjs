// Records the UX-ideas demo on the real app: opens samples/tinyhttp (smoke mode, scenario "hold", so the user's own
// session is untouched), shows the flow page, injects the scene script (ux.ts, bundled) and captures frames as each
// scene plays, with animations slowed for a smooth capture. Frames + frames.txt go to encode.swift.
// usage (from the repo, after npm run build): npx electron src/concepts/flow/ux/record-ux.cjs <ux.js> <frames dir> [slow] [from] [to]
//        PROBE=1 … only writes a screenshot and the layout of the flow page.
const path = require('node:path');
const fs = require('node:fs');
const REPO = path.resolve(__dirname, '../../../..');
const [script, outDir, slowArg, fromArg, toArg] = process.argv.slice(2);
const SLOW = Number(slowArg ?? 2), TICK = 70;
process.argv.push('--smoke', path.join(REPO, 'samples/tinyhttp'), '--scenario', 'hold');
// a smoke run ends itself after 5 minutes; a long recording may need more
const st = global.setTimeout;
global.setTimeout = (f, ms, ...a) => (ms === 300000 ? st(() => {}, 2 ** 31 - 1) : st(f, ms, ...a));
const { app } = require('electron');
const sleep = (ms) => new Promise((r) => st(r, ms));

app.on('browser-window-created', (_e, w) => {
  w.webContents.on('console-message', (e) => { const m = e.message ?? ''; if (/ux step|Error/.test(m)) console.log('page:', m); });
  w.webContents.once('did-finish-load', async () => {
    const js = (s) => w.webContents.executeJavaScript(s);
    // the flow page, once clangd is ready and the run is drawn
    for (let i = 0; i < 300; i++) {
      const ok = await js(`(() => { const b = [...document.querySelectorAll('.pivot button')].find((x) => x.textContent.trim() === 'flow'); if (b && !b.classList.contains('on')) b.click(); const sq = [...document.querySelectorAll('.pane .ph .chip')].find((x) => x.textContent.trim() === 'sequence'); if (sq && !sq.classList.contains('on')) sq.click(); return document.querySelectorAll('.seqv .srow').length > 20 && !!document.querySelector('.scode .cm-content'); })()`);
      if (ok) break;
      await sleep(200);
    }
    await sleep(1500);
    fs.mkdirSync(outDir, { recursive: true });
    await js(fs.readFileSync(script, 'utf8'));
    await js(`ux.init(${SLOW})`);
    if (process.env.PROBE) {
      fs.writeFileSync(path.join(outDir, 'probe.json'), JSON.stringify(await js('ux.probe()'), null, 1));
      fs.writeFileSync(path.join(outDir, 'probe.png'), (await w.webContents.capturePage()).toPNG());
      app.exit(0);
      return;
    }
    const steps = await js('ux.steps()');   // [{ d: seconds }]
    const from = Number(fromArg ?? 0), to = Math.min(steps.length, Number(toArg ?? steps.length));
    for (const f of fs.readdirSync(outDir)) if (/^f\d+\.jpg$/.test(f)) fs.unlinkSync(path.join(outDir, f));
    // the steps before [from] play without being captured, so the app is in the same state
    for (let k = 0; k < from; k++) { js(`ux.play(${k})`); await sleep(steps[k].d * SLOW * 1000); }
    const list = [];
    let n = 0;
    const t0 = Date.now();
    const grab = async () => {
      const img = (await w.webContents.capturePage()).resize({ width: 1920, height: 1200, quality: 'good' });
      const name = `f${String(n++).padStart(5, '0')}.jpg`;
      fs.writeFileSync(path.join(outDir, name), img.toJPEG(90));
      list.push(`${name} ${((Date.now() - t0) / 1000 / SLOW).toFixed(4)}`);
    };
    for (let k = from; k < to; k++) {
      js(`ux.play(${k})`);
      const t1 = Date.now(), end = t1 + steps[k].d * SLOW * 1000;
      // STILLS: no video, a picture of each step at the given fractions of its time instead (e.g. STILLS=.4,.8)
      if (process.env.STILLS) {
        for (const [j, f] of process.env.STILLS.split(',').map(Number).entries()) {
          await sleep(t1 + steps[k].d * SLOW * 1000 * f - Date.now());
          fs.writeFileSync(path.join(outDir, `still-${k}-${j}.png`), (await w.webContents.capturePage()).resize({ width: 1440 }).toPNG());
        }
        await sleep(end - Date.now());
        continue;
      }
      while (Date.now() < end) { const s = Date.now(); await grab(); const wait = TICK - (Date.now() - s); if (wait > 0) await sleep(wait); }
    }
    fs.writeFileSync(path.join(outDir, 'frames.txt'), list.join('\n') + '\n');
    console.log(n, 'frames,', ((Date.now() - t0) / 1000 / SLOW).toFixed(1), 's of video');
    app.exit(0);
  });
});
require(path.join(REPO, 'dist/main/main.cjs'));
