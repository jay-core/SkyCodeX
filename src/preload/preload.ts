// The only bridge between the sandboxed interface and the main process.
import { contextBridge, ipcRenderer } from 'electron';

const invoke = (ch: string, ...a: unknown[]) => ipcRenderer.invoke(ch, ...a);
const on = (ch: string, cb: (...a: any[]) => void) => {
  const h = (_e: unknown, ...a: unknown[]) => cb(...a);
  ipcRenderer.on(ch, h);
  return () => ipcRenderer.removeListener(ch, h);
};

const api = {
  info: () => invoke('app:info'),
  sys: { shells: () => invoke('sys:shells') },
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
  },
  menu: { onCommand: (cb: (id: string) => void) => on('menu:command', cb) },
  smoke: {
    capture: (name: string) => invoke('smoke:capture', name),
    done: (report: unknown) => invoke('smoke:done', report),
  },
};

contextBridge.exposeInMainWorld('litho', api);
export type LithoApi = typeof api;
