// The only bridge between the sandboxed interface and the main process.
import { contextBridge, ipcRenderer, webFrame } from 'electron';

const invoke = (ch: string, ...a: unknown[]) => ipcRenderer.invoke(ch, ...a);
const on = (ch: string, cb: (...a: any[]) => void) => {
  const h = (_e: unknown, ...a: unknown[]) => cb(...a);
  ipcRenderer.on(ch, h);
  return () => ipcRenderer.removeListener(ch, h);
};

const api = {
  info: () => invoke('app:info'),
  log: (line: string) => invoke('log', line),
  compiler: { info: () => invoke('compiler:info') },
  packs: {
    available: (kind: string) => invoke('packs:available', kind),
    install: (kind: string, version: string, replaces?: string) => invoke('packs:install', kind, version, replaces),
    cancel: () => invoke('packs:cancel'),
    remove: (id: string) => invoke('packs:remove', id),
    show: () => invoke('packs:show'),
    onProgress: (cb: (p: unknown) => void) => on('packs:progress', cb),
  },
  settings: {
    get: () => invoke('settings:get'),
    set: (key: string, value: unknown) => invoke('settings:set', key, value),
    onChange: (cb: (s: unknown) => void) => on('settings:changed', cb),
  },
  search: {
    run: (root: string, q: string, id: number) => invoke('search:run', root, q, id),
    cancel: () => invoke('search:cancel'),
    onHits: (cb: (id: number, hits: { file: string; line: number; col: number; len: number; text: string }[]) => void) => on('search:hits', cb),
  },
  shell: {
    terminal: (dir: string) => invoke('shell:terminal', dir),
  },
  fs: {
    pickFolder: () => invoke('fs:pickFolder'),
    pickFile: (dir: string) => invoke('fs:pickFile', dir),
    saveDialog: (defaultPath: string) => invoke('fs:saveDialog', defaultPath),
    list: (dir: string) => invoke('fs:list', dir),
    sources: (root: string) => invoke('fs:sources', root),
    files: (root: string) => invoke('fs:files', root) as Promise<string[]>,
    writeBase64: (file: string, b64: string) => invoke('fs:writeBase64', file, b64),
    targets: (root: string) => invoke('fs:targets', root),
    read: (file: string) => invoke('fs:read', file),
    exists: (file: string) => invoke('fs:exists', file),
    mkdir: (dir: string) => invoke('fs:mkdir', dir),
    write: (file: string, text: string) => invoke('fs:write', file, text),
    mtime: (file: string) => invoke('fs:mtime', file),
    watch: (root: string) => invoke('fs:watch', root),
    onChange: (cb: (paths: string[]) => void) => on('fs:changedBatch', cb),
  },
  buffers: {
    save: (file: string, text: string) => invoke('buffers:save', file, text),
    drop: (file: string) => invoke('buffers:drop', file),
    load: () => invoke('buffers:load'),
  },
  session: { get: () => invoke('session:get'), set: (s: unknown) => invoke('session:set', s) },
  recent: { get: () => invoke('recent:get'), add: (p: string) => invoke('recent:add', p), remove: (p: string) => invoke('recent:remove', p) },
  lang: {
    start: (lang: string, root: string) => invoke('lang:start', lang, root),
    request: (lang: string, method: string, params: unknown) => invoke('lang:request', lang, method, params),
    notify: (lang: string, method: string, params: unknown) => invoke('lang:notify', lang, method, params),
    onNotify: (cb: (lang: string, method: string, params: any) => void) => on('lang:notify', cb),
  },
  power: { battery: () => invoke('power:battery') as Promise<boolean>, onChange: (cb: (battery: boolean) => void) => on('power:battery', cb) },
  lsp: {
    start: (root: string) => invoke('lsp:start', root),
    stale: () => invoke('lsp:stale') as Promise<boolean>,
    request: (method: string, params: unknown) => invoke('lsp:request', method, params),
    notify: (method: string, params: unknown) => invoke('lsp:notify', method, params),
    onNotify: (cb: (method: string, params: any) => void) => on('lsp:notify', cb),
  },
  repair: {
    /** The checked fixes for the errors in a C/C++ file with this text (src/main/main.ts repair:check). */
    check: (file: string, uri: string, text: string, detail = false) => invoke('repair:check', file, uri, text, detail) as Promise<{ ok: boolean; message?: string; errors?: number; tries?: number; ms?: number;
      base?: string[]; tried?: { error: string; src: string; insert: string; cleared: number; after: string[] | null }[];
      suggestions?: { error: { range: { start: { line: number; character: number }; end: { line: number; character: number } }; message: string }; edit: { from: number; to: number; insert: string }; src: string; why: string; clang: boolean; cleared: number }[] }>,
  },
  setting: {
    options: (root: string) => invoke('setting:options', root) as Promise<{ folders: string[]; commands: boolean }>,
    start: (job: { root: string; entry: string; flags: string[]; folder?: string; label: string }) => invoke('setting:start', job) as Promise<{ ok: boolean; id?: string; message?: string }>,
    stop: () => invoke('setting:stop'),
    onDone: (cb: (r: any) => void) => on('setting:done', cb),
    /** The hidden window's side: what to read, and the result. */
    job: () => invoke('setting:job') as Promise<{ id: string; root: string; entry?: string; entryRel?: string; entryName?: string; flags: string[]; label: string; texts?: boolean } | null>,
    done: (result: unknown) => invoke('setting:done', result),
  },
  change: {
    history: (root: string) => invoke('change:history', root) as Promise<{ ok: boolean; message?: string; commits?: { sha: string; short: string; subject: string; when: string }[] }>,
    start: (job: { root: string; entryRel: string; entryName: string; older: string; newer: string; olderLabel: string; newerLabel: string }) => invoke('change:start', job) as Promise<{ ok: boolean; message?: string }>,
    onDone: (cb: (r: any) => void) => on('change:done', cb),
  },
  flow: {
    fingerprint: (root: string) => invoke('flow:fingerprint', root) as Promise<string>,
    kept: (root: string, key: string) => invoke('flow:kept', root, key) as Promise<string | null>,
    keep: (root: string, key: string, text: string) => invoke('flow:keep', root, key, text),
  },
  win: {
    minimize: () => invoke('win:minimize'),
    maximize: () => invoke('win:maximize'),
    close: () => invoke('win:close'),
    onMaximized: (cb: (m: boolean) => void) => on('win:maximized', cb),
    zoom: (f: number) => webFrame.setZoomFactor(Math.min(2, Math.max(0.75, f || 1))),
  },
  menu: { onCommand: (cb: (id: string) => void) => on('menu:command', cb) },
  smoke: {
    capture: (name: string) => invoke('smoke:capture', name),
    done: (report: unknown) => invoke('smoke:done', report),
    resize: (w: number, h: number) => invoke('smoke:resize', w, h),
    /** Starts a CPU profile (no name), or stops it and writes logs/smoke-<name>.cpuprofile. */
    profile: (name: string | null) => invoke('smoke:profile', name) as Promise<string | null>,
  },
};

contextBridge.exposeInMainWorld('litho', api);
export type LithoApi = typeof api;
