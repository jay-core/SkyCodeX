const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const svg = fs.readFileSync(path.join(root, 'assets/icon/skycodex.svg'), 'utf8');
const selawik = fs.readFileSync(path.join(root, 'assets/fonts/Selawik/selawkl.ttf')).toString('base64');
const face = `<style>@font-face{font-family:'Selawik';font-weight:300;src:url(data:font/ttf;base64,${selawik}) format('truetype')}</style>`;
function writeIco(src, out) {
  const big = nativeImage.createFromPath(src);
  const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
  const pngs = sizes.map((s) => big.resize({ width: s, height: s, quality: 'best' }).toPNG());
  const head = Buffer.alloc(6 + 16 * sizes.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let offset = head.length;
  sizes.forEach((s, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(s >= 256 ? 0 : s, e); head.writeUInt8(s >= 256 ? 0 : s, e + 1);
    head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(pngs[i].length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += pngs[i].length;
  });
  fs.writeFileSync(out, Buffer.concat([head, ...pngs]));
}

app.disableHardwareAcceleration();
async function render(w, svgText, out) {
  await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<html><head>${face}</head><body style="margin:0;background:rgba(0,0,0,0)">${svgText.replace('<svg ', '<svg width="1024" height="1024" ')}</body></html>`));
  await w.webContents.executeJavaScript("document.fonts.load('300 300px Selawik').then(() => document.fonts.ready)");
  await new Promise((r) => setTimeout(r, 300));
  const img = await w.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
  fs.writeFileSync(out, img.resize({ width: 1024, height: 1024 }).toPNG());
}

app.whenReady().then(async () => {
  const w = new BrowserWindow({ width: 1024, height: 1024, show: false, transparent: true, backgroundColor: '#00000000', frame: false, useContentSize: true, webPreferences: { offscreen: true } });
  await render(w, svg, path.join(root, 'assets/icon/skycodex-1024.png'));
  const flat = svg.replace(/translate\(100 100\) scale\(([\d.]+)\)/, (_, k) => `translate(16 16) scale(${(Number(k) * 992 / 824).toFixed(7)})`).replace(/ filter="url\(#shadow\)"/, '');
  await render(w, flat, path.join(root, 'assets/icon/skycodex-square-1024.png'));
  writeIco(path.join(root, 'assets/icon/skycodex-square-1024.png'), path.join(root, 'assets/icon/skycodex.ico'));
  app.quit();
});
