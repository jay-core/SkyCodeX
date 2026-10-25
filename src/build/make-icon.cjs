// Renders assets/icon/lithograph.svg to lithograph-1024.png (macOS and Linux icons are made from it) and
// lithograph.ico for Windows (16–256 px, each a PNG inside the .ico). Run with Electron: npm run icon.
const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const svg = fs.readFileSync(path.join(root, 'assets/icon/lithograph.svg'), 'utf8');
// the icon's lettering is Selawik Light, embedded so nothing else can stand in for it
const selawik = fs.readFileSync(path.join(root, 'assets/fonts/Selawik/selawkl.ttf')).toString('base64');
const face = `<style>@font-face{font-family:'Selawik';font-weight:300;src:url(data:font/ttf;base64,${selawik}) format('truetype')}</style>`;
/** An .ico whose entries are PNGs (Windows Vista and later read these), made from the 1024 px image. */
function writeIco(src, out) {
  const big = nativeImage.createFromPath(src);
  const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
  const pngs = sizes.map((s) => big.resize({ width: s, height: s, quality: 'best' }).toPNG());
  const head = Buffer.alloc(6 + 16 * sizes.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let offset = head.length;
  sizes.forEach((s, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(s >= 256 ? 0 : s, e); head.writeUInt8(s >= 256 ? 0 : s, e + 1);   // 0 means 256
    head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(pngs[i].length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += pngs[i].length;
  });
  fs.writeFileSync(out, Buffer.concat([head, ...pngs]));
}

app.disableHardwareAcceleration();
/** Renders an SVG to a 1024 px PNG, with Selawik available to it. */
async function render(w, svgText, out) {
  await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<html><head>${face}</head><body style="margin:0;background:rgba(0,0,0,0)">${svgText.replace('<svg ', '<svg width="1024" height="1024" ')}</body></html>`));
  await w.webContents.executeJavaScript("document.fonts.load('300 300px Selawik').then(() => document.fonts.ready)");
  await new Promise((r) => setTimeout(r, 300));
  const img = await w.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
  fs.writeFileSync(out, img.resize({ width: 1024, height: 1024 }).toPNG());
}

app.whenReady().then(async () => {
  const w = new BrowserWindow({ width: 1024, height: 1024, show: false, transparent: true, backgroundColor: '#00000000', frame: false, useContentSize: true, webPreferences: { offscreen: true } });
  // macOS: the tile on Apple's icon grid (824 px with a margin and a shadow)
  await render(w, svg, path.join(root, 'assets/icon/lithograph-1024.png'));
  // Windows and Linux: the same tile filling the square, without the shadow, so it isn't small in a taskbar
  const flat = svg.replace(/translate\(100 100\) scale\([\d.]+\)/, 'translate(16 16) scale(2.0666667)').replace(/ filter="url\(#shadow\)"/, '');
  await render(w, flat, path.join(root, 'assets/icon/lithograph-square-1024.png'));
  writeIco(path.join(root, 'assets/icon/lithograph-square-1024.png'), path.join(root, 'assets/icon/lithograph.ico'));
  app.quit();
});
