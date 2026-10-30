// SkyCodeX main process: window, portable data, settings, files, clangd and the language packs.
import { app, BrowserWindow, dialog, ipcMain, shell, Menu, MenuItemConstructorOptions, powerMonitor, crashReporter } from 'electron';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { resolveDataDir, ensureLayout } from './datadir';
import { loadSettings, setSetting } from './settings';
import { defaultFileText, Settings, SettingProblem } from '../shared/settings-schema';
import { atomicWrite, listDir, listSources, listFiles, saveBuffer, dropBuffer, loadBuffers, slashPath } from './files';
import { searchFolder, cancelSearch } from './search';
import { LspClient, findClangd, inbuiltClangd, systemClangd, headerCommand } from './lsp';
import { buildTargets } from './targets';
import { resolvePacksDir, listPacks, installRelease, removePack, packExe, PackKind, PackManifest, Release } from './packs';
import { releasesFor, stepsFor, KIND_INFO, serverFor, Lang } from './langpacks';
import { execFile, execFileSync } from 'node:child_process';
import { findGcc, findMsvc, projectDrivers, describe as describeCompiler, Compiler, ReadAs } from './compilers';
import { openTerminal } from './terminal';

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
// a smoke run keeps the interface's own storage apart too (state/smoke is emptied at its start, below), so it never
// changes the user's choices and every run starts the same
const CHROMIUM = path.join(data.dir, 'state', process.argv.includes('--smoke') ? 'smoke' : '', 'chromium');
app.setPath('userData', CHROMIUM);
app.setPath('sessionData', CHROMIUM);
app.setPath('logs', path.join(data.dir, 'logs'));
app.setPath('crashDumps', path.join(data.dir, 'logs', 'crashes'));

// ---------- smoke mode: scripted run that captures screenshots, used for verification ----------
const smokeIdx = process.argv.indexOf('--smoke');
const smoke = smokeIdx > 0 ? path.resolve(process.argv[smokeIdx + 1] ?? '') : null;
const scenarioIdx = process.argv.indexOf('--scenario');
const scenario = scenarioIdx > 0 ? process.argv[scenarioIdx + 1] ?? null : null;   // one part of the smoke run only
// a smoke run keeps its session and unsaved buffers apart, so it never replaces the user's own
const STATE = smoke ? path.join(data.dir, 'state', 'smoke') : path.join(data.dir, 'state');
if (smoke) {
  fs.rmSync(STATE, { recursive: true, force: true }); fs.mkdirSync(path.join(STATE, 'buffers'), { recursive: true });
  // files a smoke run saves (exports) start fresh, so a check never sees an earlier run's file
  try { for (const f of fs.readdirSync(path.join(data.dir, 'logs'))) if (/^smoke-.*-(functions|files|folders)\.(svg|png)$/.test(f)) fs.rmSync(path.join(data.dir, 'logs', f), { force: true }); } catch { /* no logs yet */ }
}

const SETTINGS_FILE = path.join(data.dir, 'settings.toml');
const BUFFERS = path.join(STATE, 'buffers');
const SESSION = path.join(STATE, 'session.json');
// the inbuilt clangd: inside the app (Resources/tools) when packaged, else tools/ beside it (or in the project while developing)
const TOOLS = !app.isPackaged ? path.join(appRoot, 'tools')
  : [path.join(process.resourcesPath, 'tools'), path.join(path.dirname(data.dir), 'tools')].find((d) => fs.existsSync(path.join(d, 'clangd'))) ?? path.join(process.resourcesPath, 'tools');
// language packs live beside the app (the project folder while developing)
const PACKS = resolvePacksDir(app.isPackaged ? path.dirname(data.dir) : appRoot, data.dir);
if (!fs.existsSync(SETTINGS_FILE)) atomicWrite(SETTINGS_FILE, defaultFileText());

let settings!: Settings;   // set by reloadSettings() just below
let problems: SettingProblem[];
const reloadSettings = () => ({ settings, problems } = loadSettings(fs.readFileSync(SETTINGS_FILE, 'utf8')));
reloadSettings();

const log = (line: string) => {
  try { fs.appendFileSync(path.join(data.dir, 'logs', 'skycodex.log'), `${new Date().toISOString()} ${line.trimEnd()}\n`); } catch { /* logging never breaks the app */ }
};


let win: BrowserWindow | null = null;
const send = (ch: string, ...args: unknown[]) => { if (win && !win.isDestroyed()) win.webContents.send(ch, ...args); };

function createWindow() {
  const native = settings['window.chrome'] === 'native';
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 760, minHeight: 480,
    show: false,
    frame: native,
    backgroundColor: '#171817',
    title: 'SkyCodeX',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
  });
  // nothing in a frame may load from the network
  win.webContents.on('will-frame-navigate', (e) => { if (!e.isMainFrame) e.preventDefault(); });
  // the interface may list installed fonts (settings) and write to the clipboard; nothing else is granted
  const allowed = new Set(['local-fonts', 'clipboard-sanitized-write']);
  win.webContents.session.setPermissionRequestHandler((wc, perm, cb) => cb(wc === win?.webContents && allowed.has(perm)));
  win.webContents.session.setPermissionCheckHandler((wc, perm) => wc === win?.webContents && allowed.has(perm));
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
function writeSetting(key: string, value: unknown) {
  atomicWrite(SETTINGS_FILE, setSetting(fs.readFileSync(SETTINGS_FILE, 'utf8'), key, value));
  reloadSettings();
}
// the bundled code font was renamed from "ARX F1" to "ArX F1": settings that named it follow
for (const k of ['font.family', 'font.ui.family']) if (settings[k] === 'ARX F1') writeSetting(k, 'ArX F1');
ipcMain.handle('settings:set', (_e, key: string, value: unknown) => {
  writeSetting(key, value);
  send('settings:changed', { settings, problems });
  return { settings, problems };
});

ipcMain.handle('app:info', () => ({
  dataDir: data.dir, fallbackReason: data.reason ?? null, platform: process.platform,
  version: app.getVersion(), smoke, scenario, settingsFile: SETTINGS_FILE,
}));

// ---------- files ----------
ipcMain.handle('fs:pickFolder', async () => {
  const r = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] });
  return r.canceled ? null : slashPath(r.filePaths[0]);
});
ipcMain.handle('fs:pickFile', async (_e, dir: string) => {
  const r = await dialog.showOpenDialog(win!, { properties: ['openFile'], defaultPath: dir || undefined });
  return r.canceled ? null : slashPath(r.filePaths[0]);
});
ipcMain.handle('fs:saveDialog', async (_e, defaultPath: string) => {
  // smoke runs never wait on a dialog: the file goes beside their screenshots
  if (smoke) return slashPath(path.join(data.dir, 'logs', `smoke-${path.basename(defaultPath || 'untitled')}`));
  const r = await dialog.showSaveDialog(win!, { defaultPath: defaultPath || undefined });
  return r.canceled ? null : slashPath(r.filePath);
});
ipcMain.handle('fs:list', (_e, dir: string) => listDir(dir));
ipcMain.handle('fs:sources', (_e, root: string) => listSources(root));
ipcMain.handle('fs:files', (_e, root: string) => listFiles(root));
ipcMain.handle('fs:writeBase64', (_e, file: string, b64: string) => fs.writeFileSync(file, Buffer.from(b64, 'base64')));
ipcMain.handle('search:run', (_e, root: string, q: string, id: number) => searchFolder(root, q, id, (hits) => send('search:hits', id, hits)));
ipcMain.handle('search:cancel', () => cancelSearch());
ipcMain.handle('fs:targets', (_e, root: string) => buildTargets(root));
ipcMain.handle('fs:read', (_e, file: string) => fs.readFileSync(file, 'utf8'));
ipcMain.handle('fs:exists', (_e, file: string) => fs.existsSync(file));
ipcMain.handle('fs:mkdir', (_e, dir: string) => { fs.mkdirSync(dir, { recursive: true }); return true; });
ipcMain.handle('shell:terminal', (_e, dir: string) => openTerminal(dir));
ipcMain.handle('fs:write', (_e, file: string, text: string) => { atomicWrite(file, text); dropBuffer(BUFFERS, file); return fs.statSync(file).mtimeMs; });
ipcMain.handle('fs:mtime', (_e, file: string) => { try { return fs.statSync(file).mtimeMs; } catch { return 0; } });

let watcher: fs.FSWatcher | null = null;
ipcMain.handle('fs:watch', (_e, root: string) => {
  watcher?.close();
  try {
    // clangd's index, git and build output change thousands of files; none of that is shown, so it is ignored,
    // and the rest is sent in batches so a burst of writes costs the interface one refresh
    const IGNORE = /(^|[\\/])(\.git|node_modules|\.cache|CMakeFiles|build|out|cmake-build-[^\\/]*)([\\/]|$)|\.(o|obj|d|su|tmp)$|\.skycodex-/;
    let batch = new Set<string>(), timer: NodeJS.Timeout | undefined;
    watcher = fs.watch(root, { recursive: true }, (_ev, name) => {
      if (!name || IGNORE.test(name)) return;
      batch.add(slashPath(path.join(root, name)));
      clearTimeout(timer);
      timer = setTimeout(() => { const b = [...batch]; batch = new Set(); send('fs:changedBatch', b); }, 150);
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
let lspRoot = '';
ipcMain.handle('lsp:start', async (_e, root: string) => {
  lspRoot = root;
  for (const c of langServers.values()) c.stop();   // a new folder: other languages' servers start again when one of their files opens
  const clangd = findClangd(String(settings['clangd.path']), TOOLS, PACKS.dir);
  if (!clangd) return { ok: false, message: 'clangd not found. Install it (Xcode Command Line Tools, LLVM, or your package manager) or set clangd.path in settings.toml.' };
  try {
    // the compiler the code is read as goes into the compile database SkyCodeX writes (and clangd may ask it for its
    // headers and macros); compilers the project's own database names are asked too, when they are installed ones
    const c = readingAs();
    await lsp.start(clangd, root, settings['clangd.args'] as string[], STATE, c.compiler,
      c.compiler?.kind === 'msvc' && c.compiler.include?.length ? { INCLUDE: c.compiler.include.join(';') } : undefined,
      (cc) => projectDrivers(cc, root));
    return { ok: true, clangd, capabilities: lsp.capabilities };
  } catch (e) { return { ok: false, message: String(e) }; }
});
ipcMain.handle('lsp:stale', () => !!lspRoot && lsp.ccChanged(lspRoot));
ipcMain.handle('lsp:request', (_e, method: string, params: unknown) => lsp.request(method, params));

// ---------- language servers of other packs (Rust, Python, Go), started when a file of that language opens ----------
const langServers = new Map<Lang, LspClient>();
ipcMain.handle('lang:start', async (_e, lang: Lang, root: string) => {
  const s = serverFor(lang, PACKS.dir);
  if (!s) return { ok: false, message: `no ${lang === 'rust' ? 'Rust' : lang === 'go' ? 'Go' : 'Python'} language engine yet — install one from the compiler window` };
  let c = langServers.get(lang);
  if (!c) {
    c = new LspClient((m, p) => send('lang:notify', lang, m, p), (l) => log(`${lang}: ${l}`));
    c.onApplyEdit = (edit) => send('lsp:notify', '$/applyEdit', edit);
    langServers.set(lang, c);
  }
  try { await c.startServer(s.cmd, s.args, root, { env: s.env, name: s.name, settings: s.settings }); return { ok: true, name: s.name }; }
  catch (e) { return { ok: false, message: String((e as Error).message ?? e) }; }
});
ipcMain.handle('lang:request', (_e, lang: Lang, method: string, params: unknown) => {
  const c = langServers.get(lang);
  if (!c?.running) throw new Error(`the ${lang} language engine is not running`);
  return c.request(method, params);
});
ipcMain.handle('lang:notify', (_e, lang: Lang, method: string, params: unknown) => { const c = langServers.get(lang); if (c?.running) c.notify(method, params); });

// ---------- power: calmer on battery ----------
const sendPower = () => send('power:battery', powerMonitor.isOnBatteryPower());
ipcMain.handle('power:battery', () => powerMonitor.isOnBatteryPower());

// ---------- interface errors, written to the log ----------
ipcMain.handle('log', (_e, line: string) => log(`interface: ${String(line).slice(0, 4000)}`));

ipcMain.handle('lsp:notify', (_e, method: string, params: any) => {
  if (!lsp.running) return;
  // a header clang can't recognise by its name gets a command of its own before clangd reads it
  if (method === 'textDocument/didOpen') {
    try {
      const file = fileURLToPath(params.textDocument.uri), cmd = headerCommand(file, lspRoot, lsp.ccDir);
      if (cmd) lsp.notify('workspace/didChangeConfiguration', { settings: { compilationDatabaseChanges: { [file]: cmd } } });
    } catch (e) { log(`header command: ${e}`); }
  }
  lsp.notify(method, params);
});

// ---------- compiler window: engines and language packs ----------
function activeToolchain(): PackManifest | null {
  const want = String(settings['compiler.toolchain'] ?? 'auto');
  if (want === 'none') return null;
  const tcs = listPacks(PACKS.dir).filter((m) => m.kind === 'toolchain' && packExe(PACKS.dir, m, 'clang'));
  return (want === 'auto' ? tcs[0] : tcs.find((m) => m.id === want)) ?? null;
}
/** compiler.read_as: clang (a toolchain pack's clang++, else the system's), gcc or msvc, found once per setting. */
const found = new Map<string, Compiler | null>();
function detect(kind: 'gcc' | 'msvc', given: string): Compiler | null {
  const k = `${kind}|${given}`;
  if (!found.has(k)) found.set(k, kind === 'gcc' ? findGcc(given) : findMsvc(given));
  return found.get(k)!;
}
function readingAs(): { want: ReadAs; compiler: Compiler | null; note: string } {
  const want = (String(settings['compiler.read_as'] ?? 'clang') as ReadAs), given = String(settings['compiler.path'] ?? '');
  if (want === 'gcc' || want === 'msvc') {
    const c = detect(want, given);
    if (c) return { want, compiler: c, note: '' };
    return { want, compiler: null, note: want === 'gcc' ? 'no GCC found (on macOS, g++ is Apple clang) · reading as clang' : process.platform === 'win32' ? 'no Visual Studio C++ tools found · reading as clang' : 'MSVC is on Windows only · reading as clang' };
  }
  const tc = activeToolchain(), cxx = tc ? packExe(PACKS.dir, tc, 'clang++') : null;
  return { want: 'clang', compiler: cxx ? { kind: 'clang', cxx, cc: cxx.replace(/clang\+\+(\.exe)?$/i, 'clang$1'), version: tc!.version } : null, note: '' };
}
let sdk: string | null | undefined;
function sdkPath(): string | null {
  if (sdk !== undefined) return sdk;
  try { sdk = execFileSync('xcrun', ['--show-sdk-path'], { encoding: 'utf8', timeout: 5000 }).trim() || null; } catch { sdk = null; }
  return sdk;
}
/** Whether the standard C/C++ headers a compiler needs are on this machine (they come from the OS, not LLVM). */
function headersStatus(): { ok: boolean; detail: string } {
  if (process.platform === 'darwin') {
    const s = sdkPath();
    return s && fs.existsSync(path.join(s, 'usr/include/stdio.h')) && fs.existsSync(path.join(s, 'usr/include/c++/v1/vector'))
      ? { ok: true, detail: `macOS SDK from the Command Line Tools · ${s}` }
      : { ok: false, detail: 'not found — install the Xcode Command Line Tools (xcode-select --install)' };
  }
  if (process.platform === 'win32') {
    return listPacks(PACKS.dir).some((m) => m.name === 'llvm-mingw')
      ? { ok: true, detail: 'llvm-mingw carries its own headers and libraries' }
      : { ok: false, detail: 'install the llvm-mingw pack below (it brings its own), or Visual Studio' };
  }
  const cxx = fs.existsSync('/usr/include/c++') && fs.readdirSync('/usr/include/c++').length > 0;
  return fs.existsSync('/usr/include/stdio.h') && cxx
    ? { ok: true, detail: 'system headers in /usr/include' }
    : { ok: false, detail: 'not found — install your distribution\'s C/C++ development packages (e.g. build-essential)' };
}
const versions = new Map<string, Promise<string | null>>();
const clangdVersion = (p: string | null): Promise<string | null> => {
  if (!p) return Promise.resolve(null);
  if (!versions.has(p)) versions.set(p, new Promise((res) => execFile(p, ['--version'], { timeout: 8000 }, (_e, out) => res(String(out ?? '').match(/clangd version (\S+)/)?.[1] ?? null))));
  return versions.get(p)!;
};
ipcMain.handle('compiler:info', async () => {
  found.clear();   // a compiler installed since is found when the window opens
  const setting = String(settings['clangd.path'] ?? 'auto');
  const active = findClangd(setting, TOOLS, PACKS.dir), inb = inbuiltClangd(TOOLS), sys = systemClangd();
  const packs = listPacks(PACKS.dir).map((m) => ({ ...m, clangd: packExe(PACKS.dir, m, 'clangd'), clang: packExe(PACKS.dir, m, 'clang') }));
  return {
    setting, active, activeVersion: await clangdVersion(active),
    inbuilt: inb ? { path: inb, version: await clangdVersion(inb) } : null,
    system: sys ? { path: sys, version: await clangdVersion(sys) } : null,
    packs, packsDir: PACKS.dir, packsNote: PACKS.note ?? null,
    toolchainSetting: String(settings['compiler.toolchain'] ?? 'auto'), toolchain: activeToolchain()?.id ?? null,
    headers: headersStatus(), installing: installing?.rel.id ?? null, kinds: KIND_INFO,
    readAs: (() => {
      const r = readingAs(), given = String(settings['compiler.path'] ?? '');
      const gcc = detect('gcc', r.want === 'gcc' ? given : ''), msvc = detect('msvc', r.want === 'msvc' ? given : '');
      return { want: r.want, now: describeCompiler(r.compiler), note: r.note, gcc: gcc && { path: gcc.cxx, version: gcc.version }, msvc: msvc && { path: msvc.cxx, version: msvc.version } };
    })(),
  };
});
let installing: { ctrl: AbortController; rel: Release } | null = null;
ipcMain.handle('packs:available', async (_e, kind: PackKind) => {
  try { return { ok: true, list: await releasesFor(kind) }; } catch (e) { return { ok: false, message: (e as Error).message ?? String(e) }; }
});
/** Installs a release; with `replaces`, the older pack is removed afterwards and settings that named it move to the new one. */
ipcMain.handle('packs:install', async (_e, kind: PackKind, version: string, replaces?: string) => {
  if (installing) return { ok: false, message: `${installing.rel.id} is still installing` };
  let rel: Release | undefined;
  try { rel = (await releasesFor(kind)).find((r) => r.version === version); } catch (e) { return { ok: false, message: (e as Error).message }; }
  if (!rel) return { ok: false, message: `${kind} ${version} isn't available for this machine` };
  return runInstall(rel, replaces);
});
async function runInstall(r: Release, replaces?: string) {
  const ctrl = new AbortController();
  installing = { ctrl, rel: r };
  try {
    const m = await installRelease(r, PACKS.dir, (p) => send('packs:progress', { id: r.id, ...p }), ctrl.signal, stepsFor(r.kind));
    for (const c of langServers.values()) c.stop();   // a new engine is picked up the next time a file of its language opens
    if (replaces && replaces !== m.id) {
      try { removePack(PACKS.dir, replaces); } catch { /* already gone */ }
      if (settings['clangd.path'] === `pack:${replaces}`) writeSetting('clangd.path', `pack:${m.id}`);
      if (settings['compiler.toolchain'] === replaces) writeSetting('compiler.toolchain', m.id);
      send('settings:changed', { settings, problems });
    }
    return { ok: true, pack: m };
  } catch (e) {
    const cancelled = ctrl.signal.aborted;
    send('packs:progress', { id: r.id, phase: cancelled ? 'cancelled' : 'failed', done: 0, total: 0, note: (e as Error).message });
    return { ok: false, message: cancelled ? 'cancelled' : (e as Error).message };
  } finally { installing = null; }
}
ipcMain.handle('packs:cancel', () => installing?.ctrl.abort());
ipcMain.handle('packs:remove', (_e, id: string) => {
  if (installing?.rel.id === id) return { ok: false, message: 'it is installing right now' };
  try { removePack(PACKS.dir, id); } catch (e) { return { ok: false, message: (e as Error).message }; }
  if (settings['clangd.path'] === `pack:${id}`) writeSetting('clangd.path', 'auto');
  if (settings['compiler.toolchain'] === id) writeSetting('compiler.toolchain', 'auto');
  send('settings:changed', { settings, problems });
  return { ok: true };
});
ipcMain.handle('packs:show', () => shell.openPath(PACKS.dir));

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
  // the file the smoke run creates to test new files is removed, so the sample project is left as it was
  if (smoke) fs.rmSync(path.join(smoke, 'smoke_new.cpp'), { force: true });
  fs.writeFileSync(path.join(data.dir, 'logs', 'smoke-report.json'), JSON.stringify(report, null, 1));
  setTimeout(() => app.quit(), 100);
});

process.on('uncaughtException', (e) => log(`uncaught: ${e.stack ?? e}`));

// ---------- menu: the macOS menu bar; on Windows and Linux the same items live in the app's own … menu ----------
function buildMenu() {
  const cmd = (id: string, label: string, accel?: string): MenuItemConstructorOptions =>
    // shortcuts are handled inside the window, so the menu only shows them (registerAccelerator: false)
    ({ label, accelerator: accel, registerAccelerator: false, click: () => send('menu:command', id) });
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ label: 'SkyCodeX', submenu: [{ role: 'about' }, { type: 'separator' }, cmd('settings', 'Settings…', 'Cmd+,'), { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] } as MenuItemConstructorOptions] : []),
    { label: 'File', submenu: [
      cmd('newFile', 'New File', 'CmdOrCtrl+N'), cmd('openFile', 'Open File…', 'CmdOrCtrl+Shift+O'), cmd('openFolder', 'Open Folder…', 'CmdOrCtrl+O'),
      { type: 'separator' }, cmd('save', 'Save', 'CmdOrCtrl+S'), cmd('saveAs', 'Save As…', 'CmdOrCtrl+Shift+S'), cmd('saveAll', 'Save All', 'CmdOrCtrl+Alt+S'),
      { type: 'separator' }, cmd('closeFile', 'Close File', 'CmdOrCtrl+W'),
    ] },
    { label: 'Edit', submenu: [cmd('undo', 'Undo', 'CmdOrCtrl+Z'), cmd('redo', 'Redo', 'CmdOrCtrl+Shift+Z'), { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, cmd('selectAll', 'Select All', 'CmdOrCtrl+A'), { type: 'separator' }, cmd('find', 'Find', 'CmdOrCtrl+F'), cmd('searchFolder', 'Search in Folder', 'CmdOrCtrl+Shift+F')] },
    { label: 'Go', submenu: [cmd('quickOpen', 'Quick Open…', 'CmdOrCtrl+P'), cmd('goToSymbol', 'Go to Symbol…', 'CmdOrCtrl+T'), cmd('commandPalette', 'Command Palette…', 'CmdOrCtrl+Shift+P')] },
    { label: 'View', submenu: [cmd('showEditor', 'Editor'), cmd('showFlow', 'Flow'), cmd('togglePreview', 'Preview Panes', 'CmdOrCtrl+Shift+E')] },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// crash dumps stay in data/logs/crashes; nothing is uploaded
crashReporter.start({ uploadToServer: false, compress: true });
app.whenReady().then(() => {
  powerMonitor.on('on-battery', sendPower); powerMonitor.on('on-ac', sendPower);
  buildMenu(); createWindow();
});
app.on('window-all-closed', () => app.quit());
// every way out (closing the window, Quit, a smoke run ending) stops the language engines; on Windows they would outlive the app otherwise
app.on('will-quit', () => { lsp.stop(); for (const c of langServers.values()) c.stop(); });
// a smoke run that stalls ends itself, so a build machine is never left waiting
if (smoke) setTimeout(() => { log('smoke: timed out after 5 minutes'); app.exit(2); }, 300_000).unref();
