// Records the traversal prototype: steps through the walk in a hidden window with animations slowed down,
// captures frames as JPEGs with their playback time. Run with Electron: electron record.cjs <page.html> <frames dir> <from> [slow]
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const [page, outDir, fromArg, slowArg] = process.argv.slice(2);
const SLOW = Number(slowArg ?? 2.5), HOLD = Number(process.env.HOLD ?? 1.75), FROM = Number(fromArg ?? 0), TICK = 90;
app.whenReady().then(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) if (/^f\d+\.jpg$/.test(f)) fs.unlinkSync(path.join(outDir, f));
  const w = new BrowserWindow({ width: 1440, height: 900, show: false, useContentSize: true, webPreferences: { backgroundThrottling: false } });
  await w.loadFile(page, { search: `slow=${SLOW}` });
  for (let i = 0; i < 80 && w.getTitle() !== 'ready'; i++) await new Promise((r) => setTimeout(r, 100));
  const len = await w.webContents.executeJavaScript('trav.len');
  await w.webContents.executeJavaScript(`trav.set(${FROM})`);
  await new Promise((r) => setTimeout(r, 600 * SLOW));
  const list = [];
  let n = 0;
  const t0 = Date.now();
  const grab = async () => {
    const img = (await w.webContents.capturePage()).resize({ width: 1920, height: 1200, quality: 'good' });
    const name = `f${String(n++).padStart(5, '0')}.jpg`;
    fs.writeFileSync(path.join(outDir, name), img.toJPEG(90));
    list.push(`${name} ${((Date.now() - t0) / 1000 / SLOW).toFixed(4)}`);
  };
  for (let k = FROM; k < len; k++) {
    if (k > FROM) await w.webContents.executeJavaScript(`trav.set(${k})`);
    const end = Date.now() + HOLD * SLOW * 1000 * (k === len - 1 ? 1.6 : 1);
    while (Date.now() < end) { const s = Date.now(); await grab(); const wait = TICK - (Date.now() - s); if (wait > 0) await new Promise((r) => setTimeout(r, wait)); }
  }
  fs.writeFileSync(path.join(outDir, 'frames.txt'), list.join('\n') + '\n');
  console.log(n, 'frames,', ((Date.now() - t0) / 1000 / SLOW).toFixed(1), 's of video');
  app.quit();
});
