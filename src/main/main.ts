// SkyCodeX main process: window, portable data, settings, files, clangd and the language packs.
import { app, BrowserWindow, dialog, ipcMain, shell, Menu, MenuItemConstructorOptions, powerMonitor, crashReporter, IpcMainInvokeEvent } from 'electron';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { resolveDataDir, ensureLayout } from './datadir';
import { loadSettings, setSetting } from './settings';
import { defaultFileText, Settings, SettingProblem } from '../shared/settings-schema';
import { atomicWrite, listDir, listSources, listFiles, saveBuffer, dropBuffer, loadBuffers, slashPath } from './files';
import { searchFolder, cancelSearch } from './search';
import { LspClient, findClangd, inbuiltClangd, systemClangd, headerCommand, writeSettingDb, otherCompileDbs } from './lsp';
import { buildTargets } from './targets';
import { resolvePacksDir, listPacks, installRelease, removePack, packExe, PackKind, PackManifest, Release } from './packs';
import { releasesFor, stepsFor, KIND_INFO, serverFor, Lang } from './langpacks';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { findGcc, findMsvc, projectDrivers, describe as describeCompiler, Compiler, ReadAs } from './compilers';
import { openTerminal } from './terminal';
import { candidatesFor, verdict, reason as repairReason, cleanMessage, lineStarts, applyEdit, RDiag, Lang as RLang } from '../shared/repair';

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
  // SKYCODEX_SMOKE_KEEP=1 keeps clangd's index, the kept flow pictures and the window's own storage (the entry point chosen) from the last smoke run: a second visit
  const keep = process.env.SKYCODEX_SMOKE_KEEP === '1' ? new Set(['compile-db', 'flow-kept', 'chromium']) : new Set<string>();
  for (const e of fs.existsSync(STATE) ? fs.readdirSync(STATE) : []) if (!keep.has(e)) fs.rmSync(path.join(STATE, e), { recursive: true, force: true });
  fs.mkdirSync(path.join(STATE, 'buffers'), { recursive: true });
  // files a smoke run saves (exports) start fresh, so a check never sees an earlier run's file
  try { for (const f of fs.readdirSync(path.join(data.dir, 'logs'))) if (/^smoke-.*-(functions|files|folders)\.(svg|png)$/.test(f)) fs.rmSync(path.join(data.dir, 'logs', f), { force: true }); } catch { /* no logs yet */ }
}

// a smoke run reads default settings (state/smoke starts empty), so the user's own fonts and choices never change its results
const SETTINGS_FILE = smoke ? path.join(STATE, 'settings.toml') : path.join(data.dir, 'settings.toml');
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
  // the hidden window reading another build setting goes with it (and never keeps the app open)
  win.on('closed', () => { stopSetting(); stopCheck(); });
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
// the start window's recent folders: newest first, at most 5, kept beside the session (so they travel with the app)
const RECENT = path.join(STATE, 'recent.json');
const readRecent = (): { path: string; at: number }[] => {
  try { const r = JSON.parse(fs.readFileSync(RECENT, 'utf8')); return Array.isArray(r) ? r.filter((x) => x && typeof x.path === 'string' && typeof x.at === 'number') : []; } catch { return []; }
};
const sameFolder = (a: string, b: string) => (process.platform === 'linux' ? a === b : a.toLowerCase() === b.toLowerCase());
ipcMain.handle('recent:get', () => readRecent().slice(0, 5).map((r) => ({ ...r, found: fs.existsSync(r.path) })));
ipcMain.handle('recent:add', (_e, p: string) => atomicWrite(RECENT, JSON.stringify([{ path: p, at: Date.now() }, ...readRecent().filter((r) => !sameFolder(r.path, p))].slice(0, 5), null, 1)));
ipcMain.handle('recent:remove', (_e, p: string) => atomicWrite(RECENT, JSON.stringify(readRecent().filter((r) => !sameFolder(r.path, p)), null, 1)));

// ---------- clangd ----------
const lsp = new LspClient((method, params) => send('lsp:notify', method, params), (line) => log(`clangd: ${line}`));
lsp.onApplyEdit = (edit) => send('lsp:notify', '$/applyEdit', edit);
let lspRoot = '', lspClangd = '';

// ---------- another build setting (configurations): a hidden window of the same interface, with its own clangd ----------
// It builds the same entry point's run with the very code the window uses, reading the code with the setting's
// commands, and hands the run back. The window's own clangd, index and state are never touched.
/** What the hidden window reads: a folder (the project, or an older version of it), with these commands, from this entry point. */
interface WorkerJob { id: string; root: string; entry?: string; entryRel?: string; entryName?: string; flags: string[]; folder?: string; label: string; ccDir: string; texts?: boolean }
type WorkerResult = { ok: boolean; message?: string; run?: unknown; errors?: unknown[]; texts?: Record<string, string[]> };
let settingWin: BrowserWindow | null = null, settingJob: WorkerJob | null = null, workerDone: ((r: WorkerResult) => void) | null = null;
const lspSetting = new LspClient((m, p) => { if (settingWin && !settingWin.isDestroyed()) settingWin.webContents.send('lsp:notify', m, p); }, (line) => log(`clangd (setting): ${line}`));
const fromWorker = (e: IpcMainInvokeEvent) => !!settingWin && !settingWin.isDestroyed() && e.sender === settingWin.webContents;
const clangdOf = (e: IpcMainInvokeEvent) => (fromWorker(e) ? lspSetting : lsp);
function stopSetting() {
  lspSetting.stop();
  const w = settingWin, done = workerDone;
  settingWin = null; settingJob = null; workerDone = null;
  if (w && !w.isDestroyed()) setImmediate(() => { if (!w.isDestroyed()) w.destroy(); });
  done?.({ ok: false, message: 'stopped' });
}
/** Starts the hidden window on a job (one at a time: a new one stops the last); resolves with what it hands back. */
function runWorker(job: WorkerJob): Promise<WorkerResult> {
  stopSetting();
  settingJob = job;
  const p = new Promise<WorkerResult>((res) => { workerDone = res; });
  settingWin = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false } });
  settingWin.webContents.on('will-frame-navigate', (e) => { if (!e.isMainFrame) e.preventDefault(); });
  settingWin.loadFile(path.join(appRoot, 'dist', 'renderer', 'index.html'), { hash: 'setting' });
  return p;
}
ipcMain.handle('setting:options', (_e, root: string) => ({ folders: root === lspRoot ? otherCompileDbs(root, lsp.ccDir) : [], commands: !!lsp.ccDir }));
ipcMain.handle('setting:start', (_e, j: Omit<WorkerJob, 'id' | 'ccDir'>) => {
  if (j.root !== lspRoot || !lspClangd) return { ok: false, message: 'clangd is not reading this folder yet' };
  if (!j.folder && !lsp.ccDir) return { ok: false, message: 'no build commands to change' };
  const id = sha1(`${j.root}\n${j.folder ?? ''}\n${j.flags.join('\u0001')}`).slice(0, 12);
  let ccDir: string;
  try { ccDir = j.folder ?? writeSettingDb(lsp.ccDir!, j.flags, path.join(STATE, 'settings', id)); } catch (e) { return { ok: false, message: String(e) }; }
  void runWorker({ ...j, id, ccDir }).then((r) => { if (r.message !== 'stopped') send('setting:done', { id, ...r }); });
  return { ok: true, id };
});
ipcMain.handle('setting:job', (e) => (fromWorker(e) ? settingJob : null));
ipcMain.handle('setting:done', (e, result: WorkerResult) => {
  if (!fromWorker(e)) return;
  const done = workerDone;
  workerDone = null;
  stopSetting();
  done?.(result);
});
ipcMain.handle('setting:stop', () => stopSetting());

// ---------- what a change does: an older version of the project, from git, read the same way ----------
// git is only asked to read: the history, and a commit's files (git archive) into SkyCodeX's state folder. Nothing in
// the repository is written, checked out or switched.
const gitOut = (root: string, args: string[]) => new Promise<string>((res, rej) => execFile('git', ['-C', root, ...args], { maxBuffer: 64 << 20 }, (err, out) => (err ? rej(err) : res(String(out)))));
ipcMain.handle('change:history', async (_e, root: string) => {
  try {
    const out = await gitOut(root, ['log', '-n', '40', '--format=%H%x1f%h%x1f%s%x1f%cr']);
    return { ok: true, commits: out.split('\n').filter(Boolean).map((l) => { const [sha, short, subject, when] = l.split('\x1f'); return { sha, short, subject, when }; }) };
  } catch (e) {
    const m = String((e as Error).message ?? e);
    return { ok: false, message: /ENOENT/.test(m) ? 'git is not installed: what a change does reads the history with it' : /not a git repository/i.test(m) ? 'this folder is not in a git repository' : m.split('\n')[0] };
  }
});
const CHANGES = path.join(STATE, 'changes');
/** A commit's files under the state folder (once; the last 4 are kept), and where the project's root is inside them. */
async function exportCommit(root: string, sha: string): Promise<string> {
  const top = (await gitOut(root, ['rev-parse', '--show-toplevel'])).trim();
  const rel = path.relative(fs.realpathSync(top), fs.realpathSync(root));
  const dir = path.join(CHANGES, sha.slice(0, 12)), tree = path.join(dir, 'tree');
  if (!fs.existsSync(path.join(dir, 'done'))) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(tree, { recursive: true });
    await new Promise<void>((res, rej) => {
      const g = spawn('git', ['-C', top, 'archive', '--format=tar', sha, ...(rel ? ['--', rel] : [])]);
      const t = spawn('tar', ['-x', '-C', tree]);
      g.stdout.pipe(t.stdin);
      let err = '';
      g.stderr.on('data', (d) => { err += d; });
      g.on('error', rej); t.on('error', rej);
      t.on('close', (code) => (code === 0 ? res() : rej(new Error(err || `tar exited ${code}`))));
    });
    fs.writeFileSync(path.join(dir, 'done'), sha);
  }
  const now = new Date();
  fs.utimesSync(dir, now, now);
  const all = fs.readdirSync(CHANGES).map((n) => ({ n, t: fs.statSync(path.join(CHANGES, n)).mtimeMs })).sort((a, b) => b.t - a.t);
  for (const o of all.slice(4)) fs.rmSync(path.join(CHANGES, o.n), { recursive: true, force: true });
  return path.join(tree, rel);
}
/** The commands in use, pointed at another copy of the project (every path under root moved to there). */
function movedDb(inUse: string, root: string, there: string, dir: string): string {
  // on the parsed commands (a Windows path is escaped in the file's text), and only where root ends a path's part
  const at = new RegExp(`${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[\\\\/"'\\s]|$)`, 'g');
  const mv = (s: unknown) => (typeof s === 'string' ? s.replace(at, () => there) : s);
  const db = (JSON.parse(fs.readFileSync(path.join(inUse, 'compile_commands.json'), 'utf8')) as Record<string, unknown>[])
    .map((e) => Object.fromEntries(Object.entries(e).map(([k, v]) => [k, Array.isArray(v) ? v.map(mv) : mv(v)])));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'compile_commands.json'), JSON.stringify(db, null, 1));
  return dir;
}
/** One version's run: 'work' is the files on disk (the window's own run, so nothing to read here), else a commit. */
async function versionRun(root: string, rev: string, entry: { rel: string; name: string }, label: string): Promise<WorkerResult & { root?: string }> {
  const there = await exportCommit(root, rev);
  const ccDir = movedDb(lsp.ccDir!, root, there, path.join(CHANGES, rev.slice(0, 12), 'db'));
  const r = await runWorker({ id: rev, root: there, entryRel: entry.rel, entryName: entry.name, flags: [], label, ccDir, texts: true });
  return { ...r, root: there };
}
ipcMain.handle('change:start', async (_e, j: { root: string; entryRel: string; entryName: string; older: string; newer: string; olderLabel: string; newerLabel: string }) => {
  if (j.root !== lspRoot || !lspClangd || !lsp.ccDir) return { ok: false, message: 'clangd is not reading this folder yet' };
  void (async () => {
    try {
      const older = await versionRun(j.root, j.older, { rel: j.entryRel, name: j.entryName }, j.olderLabel);
      if (!older.ok) { if (older.message !== 'stopped') send('change:done', { ok: false, message: `${j.olderLabel}: ${older.message}` }); return; }
      const newer = j.newer === 'work' ? null : await versionRun(j.root, j.newer, { rel: j.entryRel, name: j.entryName }, j.newerLabel);
      if (newer && !newer.ok) { if (newer.message !== 'stopped') send('change:done', { ok: false, message: `${j.newerLabel}: ${newer.message}` }); return; }
      send('change:done', { ok: true, older, newer });
    } catch (e) { send('change:done', { ok: false, message: String((e as Error).message ?? e).split('\n')[0] }); }
  })();
  return { ok: true };
});

ipcMain.handle('lsp:start', async (e, root: string) => {
  if (fromWorker(e)) {
    // the setting's clangd: the same clangd and compilers, the setting's commands
    const j = settingJob!, c = readingAs();
    try {
      await lspSetting.start(lspClangd, root, settings['clangd.args'] as string[], STATE, c.compiler,
        c.compiler?.kind === 'msvc' && c.compiler.include?.length ? { INCLUDE: c.compiler.include.join(';') } : undefined,
        (cc) => projectDrivers(cc, root), j.ccDir);
      return { ok: true, clangd: lspClangd, capabilities: lspSetting.capabilities };
    } catch (err) { return { ok: false, message: String(err) }; }
  }
  stopSetting();   // a folder opened (or opened again): a setting read for the last one is no longer asked for
  stopCheck();
  lspRoot = root; lspClangd = '';
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
    lspClangd = clangd;
    return { ok: true, clangd, capabilities: lsp.capabilities };
  } catch (e) { return { ok: false, message: String(e) }; }
});
ipcMain.handle('lsp:stale', () => !!lspRoot && lsp.ccChanged(lspRoot));
ipcMain.handle('lsp:request', (e, method: string, params: unknown) => clangdOf(e).request(method, params));

// ---------- the error repair engine: every candidate fix is read by clangd before it is shown ----------
// A clangd of its own, with no index, reads the file being checked: first as it is, then with one candidate edit at a
// time (src/shared/repair.ts). The window's clangd, its index and the editor's text are never touched. It reads the
// code with the same commands as the window's clangd, and stops when no check has come for a while.
const lspCheck = new LspClient((m, p) => checkNotify(m, p), (line) => log(`clangd (repair): ${line}`));
let checkRoot = '', checkCc: string | null = null, checkIdle: NodeJS.Timeout | undefined, checkGen = 0, checkChain: Promise<unknown> = Promise.resolve();
/** Per file: the version sent, and the last text with what clangd found in it (a text sent again is not read again). */
const checkDocs = new Map<string, { version: number; text: string; diags: RDiag[] | null }>();
const checkWait = new Map<string, { version: number; done: (d: RDiag[] | null) => void }>();
const pathOfUri = (uri: string) => { try { return path.resolve(fileURLToPath(uri)); } catch { return uri; } };
function checkNotify(method: string, params: any) {
  if (method === '$/exit') { checkDocs.clear(); for (const w of checkWait.values()) w.done(null); checkWait.clear(); return; }
  if (method !== 'textDocument/publishDiagnostics') return;
  const f = pathOfUri(params.uri), w = checkWait.get(f);
  if (w && params.version === w.version) { checkWait.delete(f); w.done(params.diagnostics ?? []); }
}
/** Stops the check clangd (idle, a new folder, the window closed); a check under way ends with what it has. */
function stopCheck() {
  clearTimeout(checkIdle);
  lspCheck.stop();
  checkDocs.clear();
  for (const w of checkWait.values()) w.done(null);
  checkWait.clear();
  checkRoot = ''; checkCc = null;
}
/** What the check clangd finds in the file with this text (null when it doesn't answer in ms). */
function readWith(file: string, uri: string, text: string, langId: string, ms: number): Promise<RDiag[] | null> {
  const doc = checkDocs.get(file);
  if (doc && doc.text === text && doc.diags) return Promise.resolve(doc.diags);
  const version = (doc?.version ?? 0) + 1;
  const p = new Promise<RDiag[] | null>((res) => {
    const t = setTimeout(() => { if (checkWait.get(file)?.version === version) checkWait.delete(file); res(null); }, ms);
    checkWait.set(file, { version, done: (d) => { clearTimeout(t); res(d); } });
  }).then((d) => { const now = checkDocs.get(file); if (now?.version === version) now.diags = d; return d; });
  if (!doc) {
    // a header clang can't recognise by its name gets the same command of its own as in the window's clangd
    const cmd = headerCommand(file, lspRoot, lspCheck.ccDir);
    if (cmd) lspCheck.notify('workspace/didChangeConfiguration', { settings: { compilationDatabaseChanges: { [file]: cmd } } });
    lspCheck.notify('textDocument/didOpen', { textDocument: { uri, languageId: langId, version, text } });
  } else lspCheck.notify('textDocument/didChange', { textDocument: { uri, version }, contentChanges: [{ text }] });
  checkDocs.set(file, { version, text, diags: null });
  return p;
}
interface Suggestion { error: { range: RDiag['range']; message: string }; edit: { from: number; to: number; insert: string }; src: string; why: string; clang: boolean; cleared: number }
/** Each edit tried and what clangd found with it (asked for by the coverage check). */
interface Tried { error: string; src: string; insert: string; cleared: number; after: string[] | null }
/**
 * The checked fixes for the errors in a file with this text: the first 12 errors, about 25 s in all. Of the fixes for
 * one error, only those that clear the most errors are kept (at most 3): a fix that leaves an error clang made up for
 * its own guess behind (cout read as count) gives way to one that clears both.
 */
async function repairCheck(file: string, uri: string, text: string, gen: number, detail: boolean): Promise<{ ok: boolean; message?: string; errors?: number; suggestions?: Suggestion[]; tries?: number; ms?: number; base?: string[]; tried?: Tried[] }> {
  const stale = { ok: false, message: 'stale' };
  if (gen !== checkGen) return stale;
  if (!lspCheck.running || checkRoot !== lspRoot || checkCc !== lsp.ccDir) {
    stopCheck();
    const c = readingAs();
    await lspCheck.start(lspClangd, lspRoot, settings['clangd.args'] as string[], undefined, c.compiler,
      c.compiler?.kind === 'msvc' && c.compiler.include?.length ? { INCLUDE: c.compiler.include.join(';') } : undefined,
      // the compilers the window's clangd may ask: the project's own database's only when it has one (ccSeen)
      (cc) => (lsp.ccSeen ? projectDrivers(cc, lspRoot) : []), lsp.ccDir ?? undefined, true);
    checkRoot = lspRoot; checkCc = lsp.ccDir;
  }
  const t0 = Date.now(), lang: RLang = /\.c$/i.test(file) ? 'c' : 'cpp';
  const base = await readWith(file, uri, text, lang, 45000);
  if (gen !== checkGen) return stale;
  if (!base) return { ok: false, message: 'clangd did not answer' };
  const errors = base.filter((d) => (d.severity ?? 1) === 1).slice(0, 12), starts = lineStarts(text);
  const out: Suggestion[] = [], tried: Tried[] = [];
  let tries = 0;
  for (const d of errors) {
    const ok: Suggestion[] = [];
    for (const c of candidatesFor(text, d, lang, starts)) {
      if (tries >= 40 || Date.now() - t0 > 25000) break;
      const after = await readWith(file, uri, applyEdit(text, c.edit), lang, 8000);
      tries++;
      if (gen !== checkGen) return stale;
      const v = after ? verdict(base, after, d, c.edit, text, starts) : { cleared: 0, revealed: [] };
      if (detail) tried.push({ error: d.message, src: c.src, insert: c.edit.insert, cleared: v.cleared, after: after && after.filter((x) => (x.severity ?? 1) <= 2).map((x) => `${x.range.start.line + 1}: ${x.message}`) });
      if (v.cleared) ok.push({ error: { range: d.range, message: cleanMessage(d.message) }, edit: c.edit, src: c.src, why: repairReason(c, v), clang: !!c.clang, cleared: v.cleared });
    }
    const best = Math.max(0, ...ok.map((s) => s.cleared));
    out.push(...ok.filter((s) => s.cleared === best).slice(0, 3));
  }
  return { ok: true, errors: errors.length, suggestions: out, tries, ms: Date.now() - t0, ...(detail ? { base: base.map((x) => `${x.range.start.line + 1}: ${x.message}`), tried } : {}) };
}
ipcMain.handle('repair:check', (e, file: string, uri: string, text: string, detail = false) => {
  if (fromWorker(e) || !lspRoot || !lspClangd) return { ok: false, message: 'clangd is not reading a folder' };
  clearTimeout(checkIdle);
  const gen = ++checkGen;   // a newer check makes an older one stop at its next step
  const run = checkChain.then(() => repairCheck(path.resolve(file), uri, text, gen, detail)).catch((err) => ({ ok: false, message: String((err as Error).message ?? err) }))
    .finally(() => { if (gen === checkGen) { clearTimeout(checkIdle); checkIdle = setTimeout(stopCheck, 90000); } });
  checkChain = run;
  return run;
});

// ---------- the flow picture kept from last time (state/flow-kept) ----------
// A folder opened again shows its last settled picture at once while the live build checks it; the live result
// always replaces it. Kept only for a folder whose code, compile database, clangd and analyser are all unchanged.
const KEPT = path.join(STATE, 'flow-kept');
const sha1 = (s: string) => createHash('sha1').update(s).digest('hex');
const keptFile = (root: string, key: string) => path.join(KEPT, sha1(root).slice(0, 12), `${sha1(key).slice(0, 16)}.json`);
/** Everything the picture is built from, short of the code's meaning: each source file's size and time, the compile database, clangd and the app. */
ipcMain.handle('flow:fingerprint', async (_e, root: string) => {
  if (!root || root !== lspRoot || !lspClangd) return '';
  const h = createHash('sha1').update(`${app.getVersion()}\n${lspClangd}\n${await clangdVersion(lspClangd)}\n${lsp.ccDir ?? ''}\n`);
  if (lsp.ccDir) { try { h.update(fs.readFileSync(path.join(lsp.ccDir, 'compile_commands.json'))); } catch { return ''; } }
  for (const f of listSources(root)) {
    try { const st = await fs.promises.stat(f); h.update(`${f}\t${st.size}\t${st.mtimeMs}\n`); } catch { h.update(`${f}\t-\n`); }
  }
  return h.digest('hex');
});
ipcMain.handle('flow:kept', (_e, root: string, key: string) => { try { return fs.readFileSync(keptFile(root, key), 'utf8'); } catch { return null; } });
ipcMain.handle('flow:keep', (_e, root: string, key: string, text: string) => {
  const f = keptFile(root, key), dir = path.dirname(f);
  try {
    fs.mkdirSync(dir, { recursive: true });
    atomicWrite(f, text);
    // the 40 most recent pictures per folder are kept
    const all = fs.readdirSync(dir).filter((n) => n.endsWith('.json')).map((n) => ({ n, t: fs.statSync(path.join(dir, n)).mtimeMs })).sort((a, b) => b.t - a.t);
    for (const o of all.slice(40)) fs.rmSync(path.join(dir, o.n), { force: true });
  } catch (e) { log(`flow-kept: ${e}`); }
});

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
// smoke runs see a fixed power source, so their results don't depend on the charger: SKYCODEX_BATTERY=1 tests battery saver
const onBattery = () => (smoke ? process.env.SKYCODEX_BATTERY === '1' : powerMonitor.isOnBatteryPower());
const sendPower = () => send('power:battery', onBattery());
ipcMain.handle('power:battery', () => onBattery());

// ---------- interface errors, written to the log ----------
ipcMain.handle('log', (_e, line: string) => log(`interface: ${String(line).slice(0, 4000)}`));

ipcMain.handle('lsp:notify', (e, method: string, params: any) => {
  const c = clangdOf(e);
  if (!c.running) return;
  // a header clang can't recognise by its name gets a command of its own before clangd reads it
  if (method === 'textDocument/didOpen') {
    try {
      const file = fileURLToPath(params.textDocument.uri), cmd = headerCommand(file, fromWorker(e) ? settingJob?.root ?? lspRoot : lspRoot, c.ccDir);
      if (cmd) c.notify('workspace/didChangeConfiguration', { settings: { compilationDatabaseChanges: { [file]: cmd } } });
    } catch (err) { log(`header command: ${err}`); }
  }
  c.notify(method, params);
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
ipcMain.handle('smoke:resize', (_e, w: number, h: number) => { if (smoke) win?.setContentSize(w, h); });
// a CPU profile of the window's thread (DevTools protocol), written beside the screenshots: what each slow frame spent its time on
ipcMain.handle('smoke:profile', async (_e, name: string | null) => {
  if (!smoke || !win) return null;
  const dbg = win.webContents.debugger;
  if (name == null) {
    if (!dbg.isAttached()) dbg.attach('1.3');
    await dbg.sendCommand('Profiler.enable');
    await dbg.sendCommand('Profiler.setSamplingInterval', { interval: 500 });
    await dbg.sendCommand('Profiler.start');
    return null;
  }
  const { profile } = await dbg.sendCommand('Profiler.stop');
  const out = path.join(data.dir, 'logs', `smoke-${name}.cpuprofile`);
  fs.writeFileSync(out, JSON.stringify(profile));
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
// (the large scenario indexes a big project from nothing and waits for it to settle: 15 minutes)
const smokeLimit = scenario === 'large' ? 15 : 5;
if (smoke) setTimeout(() => { log(`smoke: timed out after ${smokeLimit} minutes`); app.exit(2); }, smokeLimit * 60_000).unref();
