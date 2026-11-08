import { spawn, execFileSync, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { atomicWrite } from './files';
import { createHash } from 'node:crypto';
import { commandFor, Compiler } from './compilers';

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; method: string; timer?: NodeJS.Timeout };
const REQUEST_MS = 60_000, INITIALIZE_MS = 120_000;

const EXE = process.platform === 'win32' ? 'clangd.exe' : 'clangd';
export function inbuiltClangd(toolsDir: string): string | null {
  for (const p of [path.join(toolsDir, 'clangd', 'bin', EXE), path.join(toolsDir, 'clangd', EXE)]) if (fs.existsSync(p)) return p;
  return null;
}

export function findClangd(setting: string, toolsDir: string, packsDir?: string): string | null {
  if (setting === 'inbuilt') return inbuiltClangd(toolsDir);
  if (setting === 'system') return systemClangd();
  if (setting?.startsWith('pack:')) {
    const p = packsDir ? path.join(packsDir, setting.slice(5), 'bin', EXE) : '';
    return p && fs.existsSync(p) ? p : null;
  }
  if (setting && setting !== 'auto') return fs.existsSync(setting) ? setting : null;
  return inbuiltClangd(toolsDir) ?? systemClangd();
}

export function systemClangd(): string | null {
  try {
    if (process.platform === 'darwin') return execFileSync('xcrun', ['--find', 'clangd'], { encoding: 'utf8', timeout: 5000 }).trim() || null;
    const which = process.platform === 'win32' ? 'where' : 'which';
    return execFileSync(which, ['clangd'], { encoding: 'utf8', timeout: 5000 }).split(/\r?\n/)[0].trim() || null;
  } catch {
    return null;
  }
}

export function findCompileCommands(root: string): string | null {
  if (fs.existsSync(path.join(root, 'compile_commands.json')) && !staleCompileCommands(root)) return root;
  for (const e of fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }) : []) {
    if (e.isDirectory() && /^(build|out|cmake-build-)/i.test(e.name) && fs.existsSync(path.join(root, e.name, 'compile_commands.json')) && !staleCompileCommands(path.join(root, e.name)))
      return path.join(root, e.name);
  }
  return null;
}

export function staleCompileCommands(dir: string): boolean {
  let head = '';
  try {
    const fd = fs.openSync(path.join(dir, 'compile_commands.json'), 'r');
    try { const b = Buffer.alloc(65536); head = b.toString('utf8', 0, fs.readSync(fd, b, 0, b.length, 0)); } finally { fs.closeSync(fd); }
  } catch { return false; }
  const m = /"directory"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(head);
  if (!m) return false;
  let d = '';
  try { d = JSON.parse(`"${m[1]}"`); } catch { return false; }
  return path.isAbsolute(d) && !fs.existsSync(d);
}

export function ccStamp(root: string): string {
  const d = root ? findCompileCommands(root) : null;
  if (!d) return '';
  try { return `${d}@${fs.statSync(path.join(d, 'compile_commands.json')).mtimeMs}`; } catch { return ''; }
}

const SKIP_DIR = /^(\.|node_modules$|__pycache__$|language_packs$|third[_-]?party$|vendor$)/i;
const SOURCE = /\.(c|cc|cpp|cxx|c\+\+|m|mm)$/i, HEADER = /\.(h|hh|hpp|hxx|h\+\+|inl|ipp|tcc|tpp)$/i;
const MAX_SOURCES = 20000;

export function scanProject(root: string): { sources: string[]; headerDirs: string[] } {
  const sources: string[] = [], headerDirs: string[] = [];
  let level = [root];
  for (let depth = 0; level.length && depth < 12 && sources.length < MAX_SOURCES; depth++) {
    const next: string[] = [];
    for (const dir of level) {
      let hasHeader = false;
      let entries: fs.Dirent[] = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const e of entries) {
        if (e.isDirectory()) { if (!SKIP_DIR.test(e.name)) next.push(path.join(dir, e.name)); }
        else if (SOURCE.test(e.name)) { if (sources.length < MAX_SOURCES) sources.push(path.join(dir, e.name)); }
        else if (!hasHeader && HEADER.test(e.name)) hasHeader = true;
      }
      if (hasHeader) headerDirs.push(dir);
    }
    level = next.sort();
  }
  return { sources: sources.sort(), headerDirs };
}

export function ensureCompileCommands(root: string, stateDir: string, compiler?: Pick<Compiler, 'kind' | 'cxx' | 'cc' | 'include'> | null): string | null {
  if (!root || findCompileCommands(root)) return null;
  const { sources, headerDirs } = scanProject(root);
  if (!sources.length) return null;
  const own = path.join(root, 'compile_flags.txt');
  const flags = fs.existsSync(own)
    ? fs.readFileSync(own, 'utf8').split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
    : [root, ...headerDirs.filter((d) => d !== root)].slice(0, 400).map((d) => `-I${d}`);
  const db = sources.map((file) => ({ directory: root, file, arguments: commandFor(compiler ?? null, file, flags) }));
  const dir = path.join(stateDir, 'compile-db', createHash('sha1').update(root).digest('hex').slice(0, 12));
  const out = path.join(dir, 'compile_commands.json'), text = JSON.stringify(db, null, 1);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== text) atomicWrite(out, text);
  return dir;
}

export type CompileEntry = { directory: string; file: string; arguments?: string[]; command?: string; output?: string };
export function readCompileDb(dir: string): CompileEntry[] {
  const f = path.join(dir, 'compile_commands.json');
  let db: unknown;
  try { db = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { throw new Error(`${f} can't be read: ${(e as Error).message}`); }
  if (!Array.isArray(db)) throw new Error(`${f} is not a list of compile commands`);
  return db as CompileEntry[];
}

export function writeSettingDb(inUse: string, flags: string[], dir: string): string {
  const db = readCompileDb(inUse);
  const q = (s: string) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);
  const out = db.map((e) => {
    if (e.arguments) { const a = [...e.arguments], k = a.indexOf('--'); a.splice(k < 0 ? a.length : k, 0, ...flags); return { ...e, arguments: a }; }
    const c = e.command ?? '', k = c.indexOf(' -- ');
    const add = flags.map(q).join(' ');
    return { ...e, command: k < 0 ? `${c} ${add}` : `${c.slice(0, k)} ${add}${c.slice(k)}` };
  });
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, 'compile_commands.json'), text = JSON.stringify(out, null, 1);
  if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== text) atomicWrite(f, text);
  return dir;
}
export function otherCompileDbs(root: string, inUse: string | null): string[] {
  const out: string[] = [];
  for (const e of fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }) : []) {
    const d = path.join(root, e.name);
    if (e.isDirectory() && /^(build|out|cmake-build-)/i.test(e.name) && d !== inUse && fs.existsSync(path.join(d, 'compile_commands.json')) && !staleCompileCommands(d)) out.push(d);
  }
  return out.sort();
}

export class LspClient {
  private proc: ChildProcess | null = null;
  private buf = Buffer.alloc(0);
  private nextId = 1;
  private pending = new Map<number, Pending>();
  ready: Promise<unknown> | null = null;
  capabilities: Record<string, unknown> = {};

  constructor(
    private onNotify: (method: string, params: unknown) => void,
    private onLog: (line: string) => void,
  ) {}
  onApplyEdit: (edit: unknown) => void = () => {};

  name = 'clangd';
  settings: Record<string, unknown> = {};

  ccDir: string | null = null;
  ccSeen = '';
  ccChanged(root: string): boolean { return ccStamp(root) !== this.ccSeen; }

  start(clangd: string, root: string, extraArgs: string[], stateDir?: string, compiler?: Pick<Compiler, 'kind' | 'cxx' | 'cc' | 'include'> | null, env?: Record<string, string>, drivers: (ccDir: string) => string[] = () => [], ccOverride?: string, check = false): Promise<unknown> {
    const args = check ? ['--background-index=false', '--header-insertion=never', '--log=error', '--pch-storage=memory']
      : ['--background-index', '--background-index-priority=low', '--header-insertion=never', '--log=error', '--pch-storage=memory'];
    if (check) extraArgs = extraArgs.filter((a) => !/^--background-index/.test(a));
    let cc = ccOverride ?? findCompileCommands(root);
    const own = !!cc;
    if (!cc && stateDir) { try { cc = ensureCompileCommands(root, stateDir, compiler); } catch (e) { this.onLog(`compile database: ${e}`); } }
    this.ccDir = cc;
    this.ccSeen = ccStamp(root);
    if (cc) args.push(`--compile-commands-dir=${cc}`);
    const q = [...(compiler && compiler.kind !== 'msvc' ? [compiler.cxx, compiler.cc] : []), ...(own && cc ? drivers(cc) : [])];
    if (q.length) args.push(`--query-driver=${[...new Set(q)].join(',')}`);
    args.push(...extraArgs);
    return this.startServer(clangd, args, root, { initializationOptions: { clangdFileStatus: true }, env, diagnostics: check ? { codeActionsInline: true, versionSupport: true } : undefined });
  }

  startServer(cmd: string, args: string[], root: string, opts: { env?: Record<string, string>; name?: string; initializationOptions?: unknown; settings?: Record<string, unknown>; diagnostics?: Record<string, unknown> } = {}): Promise<unknown> {
    this.stop();
    if (opts.name) this.name = opts.name;
    this.settings = opts.settings ?? {};
    const p = spawn(cmd, args, { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ...opts.env } });
    this.proc = p;
    p.stdout!.on('data', (d: Buffer) => this.onData(d));
    p.stderr!.on('data', (d: Buffer) => this.onLog(d.toString()));
    p.on('exit', (code) => {
      if (this.proc !== p) return;
      this.onLog(`${this.name} exited (${code})`);
      this.failAll(`${this.name} exited (${code})`);
      this.proc = null;
      this.onNotify('$/exit', { code });
    });
    let started = false;
    p.on('spawn', () => { started = true; });
    p.on('error', (e) => {
      this.onLog(`${this.name} ${started ? 'stopped' : 'failed to start'}: ${e.message}`);
      if (this.proc !== p) return;
      this.proc = null;
      this.failAll(`${this.name} ${started ? 'stopped' : 'failed to start'}: ${e.message}`);
      if (started) { try { p.kill(); } catch {  } this.onNotify('$/exit', { code: null }); }
    });
    p.stdin?.on('error', (e) => this.onLog(`${this.name}: ${e.message}`));
    const rootUri = pathToFileURL(root).href;
    this.ready = this.request('initialize', {
      processId: process.pid,
      rootUri,
      workspaceFolders: [{ uri: rootUri, name: path.basename(root) }],
      capabilities: {
        textDocument: {
          synchronization: { didSave: true },
          completion: { completionItem: { snippetSupport: false, documentationFormat: ['plaintext', 'markdown'] } },
          hover: { contentFormat: ['plaintext', 'markdown'] },
          publishDiagnostics: { relatedInformation: true, ...opts.diagnostics },
          documentSymbol: { hierarchicalDocumentSymbolSupport: true },
          definition: {},
          callHierarchy: {},
          signatureHelp: { signatureInformation: { parameterInformation: { labelOffsetSupport: true } } },
          codeAction: {},
        },
        workspace: { workspaceFolders: true, symbol: {}, configuration: true },
        window: { workDoneProgress: true },
      },
      initializationOptions: opts.initializationOptions,
    }).then((r) => {
      this.capabilities = ((r as { capabilities?: Record<string, unknown> }).capabilities) ?? {};
      this.notify('initialized', {});
      if (Object.keys(this.settings).length) this.notify('workspace/didChangeConfiguration', { settings: this.settings });
      return r;
    });
    return this.ready;
  }

  stop(): void {
    const p = this.proc;
    if (!p) return;
    try { this.notify('exit', null); } catch {  }
    p.removeAllListeners('exit');
    p.stdout?.removeAllListeners('data');
    p.stderr?.removeAllListeners('data');
    p.kill();
    this.proc = null;
    this.failAll(`${this.name} restarted`);
    this.buf = Buffer.alloc(0);
  }

  private failAll(why: string): void {
    for (const q of this.pending.values()) { clearTimeout(q.timer); q.reject(new Error(why)); }
    this.pending.clear();
  }

  get running(): boolean { return !!this.proc; }

  private send(msg: unknown): void {
    if (!this.proc?.stdin?.writable) throw new Error(`${this.name} is not running`);
    const body = Buffer.from(JSON.stringify(msg), 'utf8');
    this.proc.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
    this.proc.stdin.write(body);
  }

  request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const ms = method === 'initialize' ? INITIALIZE_MS : REQUEST_MS;
      const timer = setTimeout(() => {
        if (!this.pending.delete(id)) return;
        this.onLog(`${this.name}: ${method} had no answer in ${ms / 1000} s`);
        try { this.notify('$/cancelRequest', { id }); } catch {  }
        reject(new Error(`${method}: no answer from ${this.name} in ${ms / 1000} s`));
      }, ms);
      timer.unref?.();
      this.pending.set(id, { resolve, reject, method, timer });
      try { this.send({ jsonrpc: '2.0', id, method, params }); }
      catch (e) { clearTimeout(timer); this.pending.delete(id); reject(e as Error); }
    });
  }

  notify(method: string, params: unknown): void {
    this.send({ jsonrpc: '2.0', method, params });
  }

  private onData(d: Buffer): void {
    this.buf = Buffer.concat([this.buf, d]);
    for (;;) {
      const sep = this.buf.indexOf('\r\n\r\n');
      if (sep < 0) return;
      const m = this.buf.subarray(0, sep).toString().match(/Content-Length:\s*(\d+)/i);
      if (!m) { this.buf = this.buf.subarray(sep + 4); continue; }
      const len = Number(m[1]);
      if (this.buf.length < sep + 4 + len) return;
      const body = this.buf.subarray(sep + 4, sep + 4 + len).toString('utf8');
      this.buf = this.buf.subarray(sep + 4 + len);
      let msg: { id?: number; method?: string; params?: unknown; result?: unknown; error?: { message: string } };
      try { msg = JSON.parse(body); } catch { continue; }
      if (msg.method !== undefined && msg.id !== undefined) this.answerServerRequest(msg.id, msg.method, msg.params);
      else if (msg.method !== undefined) this.onNotify(msg.method, msg.params);
      else if (msg.id !== undefined) {
        const q = this.pending.get(msg.id);
        if (!q) continue;
        clearTimeout(q.timer);
        this.pending.delete(msg.id);
        if (msg.error) q.reject(new Error(`${q.method}: ${msg.error.message}`));
        else q.resolve(msg.result ?? null);
      }
    }
  }

  private answerServerRequest(id: number, method: string, params?: unknown): void {
    let result: unknown = null;
    if (method === 'workspace/configuration') {
      result = ((params as { items?: { section?: string }[] })?.items ?? []).map((it) => (it.section ?? '').split('.').reduce<any>((o, k) => (o && k ? o[k] : o), this.settings) ?? null);
    }
    if (method === 'workspace/applyEdit') { this.onApplyEdit((params as { edit: unknown }).edit); result = { applied: true }; }
    this.send({ jsonrpc: '2.0', id, result });
  }
}

const CLANG_KNOWS = /\.(c|cc|cp|cpp|cxx|c\+\+|h|hh|hpp|hxx|h\+\+|m|mm|cu|cuh|cppm|ccm|cxxm|c\+\+m|ixx|i|ii)$/i;
const STDLIB = /[\\/]c\+\+[\\/](v\d+|\d+(\.\d+)*)[\\/]/;
const FRAGMENT = /\.(def|inc)$/i;

export interface HeaderCommand { workingDirectory: string; compilationCommand: string[] }

export function splitCommand(cmd: string): string[] {
  const out: string[] = [];
  let cur = '', q: string | null = null, any = false;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q) { if (c === q) q = null; else if (c === '\\' && q === '"' && i + 1 < cmd.length) cur += cmd[++i]; else cur += c; continue; }
    if (c === '"' || c === "'") { q = c; any = true; continue; }
    if (c === '\\' && i + 1 < cmd.length) { cur += cmd[++i]; any = true; continue; }
    if (/\s/.test(c)) { if (cur || any) out.push(cur); cur = ''; any = false; continue; }
    cur += c;
  }
  if (cur || any) out.push(cur);
  return out;
}

export function flagsOf(args: string[], input: string): string[] {
  const out: string[] = [];
  const takesValue = new Set(['-o', '-x', '-MF', '-MT', '-MQ', '-MJ']);
  const base = path.basename(input);
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (takesValue.has(a)) { i++; continue; }
    if (a === '-c' || a === '-MD' || a === '-MMD' || a === '--' || /^-o.+/.test(a) || /^-x.+/.test(a) || /^-M[FTQJ].+/.test(a)) continue;
    if (a === input || (!a.startsWith('-') && path.basename(a) === base)) continue;
    out.push(a);
  }
  return out;
}

const dbCache = new Map<string, { stamp: string; entries: { directory: string; file: string; arguments?: string[]; command?: string }[] }>();
function parsedDb(f: string) {
  const st = fs.statSync(f), stamp = `${st.size}:${st.mtimeMs}`, hit = dbCache.get(f);
  if (hit && hit.stamp === stamp) return hit.entries;
  const entries = JSON.parse(fs.readFileSync(f, 'utf8')) as { directory: string; file: string; arguments?: string[]; command?: string }[];
  if (dbCache.size > 8) dbCache.clear();
  dbCache.set(f, { stamp, entries });
  return entries;
}

export function headerCommand(file: string, root: string, ccDirInUse?: string | null): HeaderCommand | null {
  if (CLANG_KNOWS.test(file) || STDLIB.test(file) || FRAGMENT.test(file)) return null;
  let dir = root || path.dirname(file), flags: string[] = [], compiler = 'clang++';
  const ccDir = ccDirInUse ?? (root ? findCompileCommands(root) : null);
  if (ccDir) {
    try {
      const entries = parsedDb(path.join(ccDir, 'compile_commands.json'));
      const near = (e: { directory: string; file: string }) => { const f = path.resolve(e.directory, e.file); let n = 0; while (n < f.length && n < file.length && f[n] === file[n]) n++; return n; };
      const best = entries.filter((e) => /\.(c|cc|cpp|cxx|c\+\+|mm?)$/i.test(e.file)).sort((a, b) => near(b) - near(a))[0];
      if (best) {
        const args = best.arguments ?? splitCommand(best.command ?? '');
        compiler = args[0] ?? compiler; flags = flagsOf(args, path.resolve(best.directory, best.file)); dir = best.directory;
      }
    } catch {  }
  }
  if (!flags.length && root) {
    for (let d = path.dirname(file); d.startsWith(root); d = path.dirname(d)) {
      const f = path.join(d, 'compile_flags.txt');
      if (fs.existsSync(f)) { flags = fs.readFileSync(f, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean); dir = d; break; }
      if (d === path.dirname(d)) break;
    }
  }
  if (!flags.some((f) => /^-std=/.test(f))) flags.push('-std=c++20');
  return { workingDirectory: dir, compilationCommand: [compiler, ...flags, '-x', 'c++-header', file] };
}
