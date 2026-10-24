// Lithograph main process: window, portable data, settings, files, clangd, terminals, memory analysis.
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { resolveDataDir, ensureLayout } from './datadir';
import { loadSettings, setSetting } from './settings';
import { defaultFileText, Settings, SettingProblem } from '../shared/settings-schema';
import { atomicWrite, listDir, listSources, saveBuffer, dropBuffer, loadBuffers } from './files';
import { LspClient, findClangd } from './lsp';
import { findBinaries, analyze } from './memory';

// ---------- portable data dir: decided before anything else touches the disk ----------
const appRoot = path.resolve(__dirname, '..', '..');
const data = resolveDataDir({
  isPackaged: app.isPackaged,
  execPath: process.execPath,
  platform: process.platform,
  appRoot,
  appDataFallback: app.getPath('appData'),
});
ensureLayout(data.dir);
app.setPath('userData', path.join(data.dir, 'state', 'chromium'));
app.setPath('sessionData', path.join(data.dir, 'state', 'chromium'));
app.setPath('logs', path.join(data.dir, 'logs'));
app.setPath('crashDumps', path.join(data.dir, 'logs', 'crashes'));

const SETTINGS_FILE = path.join(data.dir, 'settings.toml');
const BUFFERS = path.join(data.dir, 'state', 'buffers');
const SESSION = path.join(data.dir, 'state', 'session.json');
const TOOLS = path.join(app.isPackaged ? path.dirname(data.dir) : appRoot, 'tools');
if (!fs.existsSync(SETTINGS_FILE)) atomicWrite(SETTINGS_FILE, defaultFileText());

let settings: Settings;
let problems: SettingProblem[];
const reloadSettings = () => ({ settings, problems } = loadSettings(fs.readFileSync(SETTINGS_FILE, 'utf8')));
reloadSettings();

const log = (line: string) => {
  try { fs.appendFileSync(path.join(data.dir, 'logs', 'lithograph.log'), `${new Date().toISOString()} ${line.trimEnd()}\n`); } catch { /* logging never breaks the app */ }
};

// ---------- smoke mode: scripted run that captures screenshots, used for verification ----------
const smokeIdx = process.argv.indexOf('--smoke');
const smoke = smokeIdx > 0 ? path.resolve(process.argv[smokeIdx + 1] ?? '') : null;

let win: BrowserWindow | null = null;
const send = (ch: string, ...args: unknown[]) => { if (win && !win.isDestroyed()) win.webContents.send(ch, ...args); };

function createWindow() {
  const native = settings['window.chrome'] === 'native';
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 760, minHeight: 480,
    show: false,
    frame: native,
    backgroundColor: '#171817',
    title: 'Lithograph',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
  });
  win.loadFile(path.join(appRoot, 'dist', 'renderer', 'index.html'));
  win.once('ready-to-show', () => win!.show());
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.on('maximize', () => send('win:maximized', true));
  win.on('unmaximize', () => send('win:maximized', false));
}

// ---------- settings ----------
let watchTimer: NodeJS.Timeout | undefined;
fs.watch(path.dirname(SETTINGS_FILE), (_e, name) => {
  if (name !== 'settings.toml') return;
  clearTimeout(watchTimer);
  watchTimer = setTimeout(() => {
    try { reloadSettings(); send('settings:changed', { settings, problems }); } catch (e) { log(`settings reload: ${e}`); }
  }, 120);
});
ipcMain.handle('settings:get', () => ({ settings, problems, path: SETTINGS_FILE }));
ipcMain.handle('settings:set', (_e, key: string, value: unknown) => {
  atomicWrite(SETTINGS_FILE, setSetting(fs.readFileSync(SETTINGS_FILE, 'utf8'), key, value));
  reloadSettings();
  send('settings:changed', { settings, problems });
  return { settings, problems };
});

ipcMain.handle('app:info', () => ({
  dataDir: data.dir, fallbackReason: data.reason ?? null, platform: process.platform,
  version: app.getVersion(), smoke, settingsFile: SETTINGS_FILE,
}));

// ---------- files ----------
ipcMain.handle('fs:pickFolder', async () => {
  const r = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('fs:list', (_e, dir: string) => listDir(dir));
ipcMain.handle('fs:sources', (_e, root: string) => listSources(root));
ipcMain.handle('fs:read', (_e, file: string) => fs.readFileSync(file, 'utf8'));
ipcMain.handle('fs:exists', (_e, file: string) => fs.existsSync(file));
ipcMain.handle('fs:write', (_e, file: string, text: string) => { atomicWrite(file, text); dropBuffer(BUFFERS, file); return fs.statSync(file).mtimeMs; });
ipcMain.handle('fs:mtime', (_e, file: string) => { try { return fs.statSync(file).mtimeMs; } catch { return 0; } });

let watcher: fs.FSWatcher | null = null;
ipcMain.handle('fs:watch', (_e, root: string) => {
  watcher?.close();
  try {
    watcher = fs.watch(root, { recursive: true }, (_ev, name) => {
      if (!name || /(^|[\\/])(\.git|node_modules)([\\/]|$)/.test(name) || name.includes('.lithograph-')) return;
      send('fs:changed', path.join(root, name));
    });
  } catch (e) { log(`watch: ${e}`); }
});

ipcMain.handle('buffers:save', (_e, file: string, text: string) => saveBuffer(BUFFERS, file, text));
ipcMain.handle('buffers:drop', (_e, file: string) => dropBuffer(BUFFERS, file));
ipcMain.handle('buffers:load', () => loadBuffers(BUFFERS));
ipcMain.handle('session:get', () => { try { return JSON.parse(fs.readFileSync(SESSION, 'utf8')); } catch { return null; } });
ipcMain.handle('session:set', (_e, s: unknown) => atomicWrite(SESSION, JSON.stringify(s, null, 1)));

// ---------- clangd ----------
const lsp = new LspClient((method, params) => send('lsp:notify', method, params), (line) => log(`clangd: ${line}`));
lsp.onApplyEdit = (edit) => send('lsp:notify', '$/applyEdit', edit);
ipcMain.handle('lsp:start', async (_e, root: string) => {
  const clangd = findClangd(String(settings['clangd.path']), TOOLS);
  if (!clangd) return { ok: false, message: 'clangd not found. Install it (Xcode Command Line Tools, LLVM, or your package manager) or set clangd.path in settings.toml.' };
  try {
    await lsp.start(clangd, root, settings['clangd.args'] as string[]);
    return { ok: true, clangd, capabilities: lsp.capabilities };
  } catch (e) { return { ok: false, message: String(e) }; }
});
ipcMain.handle('lsp:request', (_e, method: string, params: unknown) => lsp.request(method, params));
ipcMain.handle('lsp:notify', (_e, method: string, params: unknown) => { if (lsp.running) lsp.notify(method, params); });

// ---------- terminals ----------
type Pty = { write(d: string): void; resize(c: number, r: number): void; kill(): void; onData(cb: (d: string) => void): void; onExit(cb: (e: { exitCode: number }) => void): void };
const ptys = new Map<number, Pty>();
function defaultShell(): { file: string; args: string[] } {
  const s = String(settings['terminal.shell']);
  if (s && s !== 'auto') return { file: s, args: [] };
  if (process.platform === 'win32') return { file: 'powershell.exe', args: ['-NoLogo'] };
  return { file: process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash'), args: ['-l'] };
}
ipcMain.handle('pty:spawn', (_e, id: number, cwd: string, cols: number, rows: number) => {
  let nodePty: { spawn: (f: string, a: string[], o: object) => Pty };
  try { nodePty = require('node-pty'); } catch (e) { return { ok: false, message: `terminal unavailable: ${e}` }; }
  const sh = defaultShell();
  const p = nodePty.spawn(sh.file, sh.args, { name: 'xterm-256color', cols, rows, cwd: fs.existsSync(cwd) ? cwd : process.env.HOME, env: { ...process.env, TERM_PROGRAM: 'Lithograph' } });
  ptys.set(id, p);
  p.onData((d) => send('pty:data', id, d));
  p.onExit((ev) => { ptys.delete(id); send('pty:exit', id, ev.exitCode); });
  return { ok: true, shell: sh.file };
});
ipcMain.handle('pty:write', (_e, id: number, d: string) => ptys.get(id)?.write(d));
ipcMain.handle('pty:resize', (_e, id: number, c: number, r: number) => { try { ptys.get(id)?.resize(c, r); } catch { /* exited */ } });
ipcMain.handle('pty:kill', (_e, id: number) => { ptys.get(id)?.kill(); ptys.delete(id); });

// ---------- memory ----------
ipcMain.handle('memory:binaries', (_e, root: string) => findBinaries(root));
ipcMain.handle('memory:analyze', (_e, bin: string, root: string) => analyze(bin, root));

// ---------- window ----------
ipcMain.handle('win:minimize', () => win?.minimize());
ipcMain.handle('win:maximize', () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()));
ipcMain.handle('win:close', () => win?.close());

// ---------- smoke captures ----------
ipcMain.handle('smoke:capture', async (_e, name: string) => {
  const img = await win!.webContents.capturePage();
  const out = path.join(data.dir, 'logs', `smoke-${name}.png`);
  fs.writeFileSync(out, img.toPNG());
  return out;
});
ipcMain.handle('smoke:done', (_e, report: unknown) => {
  fs.writeFileSync(path.join(data.dir, 'logs', 'smoke-report.json'), JSON.stringify(report, null, 1));
  setTimeout(() => app.quit(), 100);
});

process.on('uncaughtException', (e) => log(`uncaught: ${e.stack ?? e}`));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { lsp.stop(); for (const p of ptys.values()) p.kill(); app.quit(); });
