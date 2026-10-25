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
  sys: { shells: () => invoke('sys:shells') },
  compiler: { info: () => invoke('compiler:info') },
  packs: {
    available: (kind: string) => invoke('packs:available', kind),
    install: (kind: string, version: string, replaces?: string) => invoke('packs:install', kind, version, replaces),
    installFile: (kind: string) => invoke('packs:installFile', kind),
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
  fs: {
    pickFolder: () => invoke('fs:pickFolder'),
    pickFile: (dir: string) => invoke('fs:pickFile', dir),
    saveDialog: (defaultPath: string) => invoke('fs:saveDialog', defaultPath),
    list: (dir: string) => invoke('fs:list', dir),
    sources: (root: string) => invoke('fs:sources', root),
    read: (file: string) => invoke('fs:read', file),
    exists: (file: string) => invoke('fs:exists', file),
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
  lang: {
    start: (lang: string, root: string) => invoke('lang:start', lang, root),
    request: (lang: string, method: string, params: unknown) => invoke('lang:request', lang, method, params),
    notify: (lang: string, method: string, params: unknown) => invoke('lang:notify', lang, method, params),
    onNotify: (cb: (lang: string, method: string, params: any) => void) => on('lang:notify', cb),
  },
  ref: { index: () => invoke('ref:index') as Promise<Record<string, string> | null> },
  templates: { list: () => invoke('templates:list'), create: (parent: string, name: string, id: string) => invoke('templates:create', parent, name, id) },
  format: { preview: (style: string, sample: string) => invoke('format:preview', style, sample) },
  checks: { run: (root: string, kind: string, args: string[]) => invoke('checks:run', root, kind, args), flags: (kind: string) => invoke('checks:flags', kind) },
  power: { battery: () => invoke('power:battery') as Promise<boolean>, onChange: (cb: (battery: boolean) => void) => on('power:battery', cb) },
  report: { log: (line: string) => invoke('report:log', line), build: () => invoke('report:build') as Promise<string> },
  // the system's spelling checker, used for words in comments and strings
  spell: {
    misspelt: (words: string[]) => words.filter((w) => webFrame.isWordMisspelled(w)),
    suggest: (word: string) => webFrame.getWordSuggestions(word),
  },
  lsp: {
    start: (root: string) => invoke('lsp:start', root),
    request: (method: string, params: unknown) => invoke('lsp:request', method, params),
    notify: (method: string, params: unknown) => invoke('lsp:notify', method, params),
    onNotify: (cb: (method: string, params: any) => void) => on('lsp:notify', cb),
  },
  pty: {
    spawn: (id: number, cwd: string, cols: number, rows: number) => invoke('pty:spawn', id, cwd, cols, rows),
    write: (id: number, d: string) => invoke('pty:write', id, d),
    resize: (id: number, c: number, r: number) => invoke('pty:resize', id, c, r),
    kill: (id: number) => invoke('pty:kill', id),
    onData: (cb: (id: number, d: string) => void) => on('pty:data', cb),
    onExit: (cb: (id: number, code: number) => void) => on('pty:exit', cb),
  },
  memory: {
    binaries: (root: string) => invoke('memory:binaries', root),
    analyze: (bin: string, root: string) => invoke('memory:analyze', bin, root),
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
  },
};

contextBridge.exposeInMainWorld('litho', api);
export type LithoApi = typeof api;
