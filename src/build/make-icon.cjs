// Renders assets/icon/lithograph.svg to the PNGs every platform's icon is made from (run with Electron).
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const svg = fs.readFileSync(path.join(root, 'assets/icon/lithograph.svg'), 'utf8');
// the icon's lettering is Selawik Light, embedded so nothing else can stand in for it
const selawik = fs.readFileSync(path.join(root, 'assets/fonts/Selawik/selawkl.ttf')).toString('base64');
const face = `<style>@font-face{font-family:'Selawik';font-weight:300;src:url(data:font/ttf;base64,${selawik}) format('truetype')}</style>`;
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const w = new BrowserWindow({ width: 1024, height: 1024, show: false, transparent: true, backgroundColor: '#00000000', frame: false, useContentSize: true, webPreferences: { offscreen: true } });
  w.webContents.setBackgroundThrottling(false);
  w.webContents.setZoomFactor(1);
  await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<html><head>${face}</head><body style="margin:0;background:rgba(0,0,0,0)">${svg.replace('<svg ', '<svg width="1024" height="1024" ')}</body></html>`));
  await w.webContents.executeJavaScript("document.fonts.load('300 300px Selawik').then(() => document.fonts.ready).then(() => document.fonts.check('300 300px Selawik'))").then((ok) => { if (!ok) throw new Error('Selawik did not load'); });
  await new Promise((r) => setTimeout(r, 300));
  const img = await w.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
  fs.writeFileSync(path.join(root, 'assets/icon/lithograph-1024.png'), img.resize({ width: 1024, height: 1024 }).toPNG());
  app.quit();
});
