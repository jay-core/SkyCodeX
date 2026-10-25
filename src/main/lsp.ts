// A small Language Server Protocol client, running in the main process: clangd, and the servers of other language packs.
import { spawn, execFileSync, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; method: string };

const EXE = process.platform === 'win32' ? 'clangd.exe' : 'clangd';
/** The clangd that ships inside Lithograph (tools/clangd/bin), if this build has one. */
export function inbuiltClangd(toolsDir: string): string | null {
  for (const p of [path.join(toolsDir, 'clangd', 'bin', EXE), path.join(toolsDir, 'clangd', EXE)]) if (fs.existsSync(p)) return p;
  return null;
}

/**
 * clangd.path: "auto" (inbuilt, else the system's), "inbuilt", "system", "pack:<id>" (an installed language pack)
 * or a path to any clangd.
 */
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

/** The clangd installed on the system (Xcode on macOS, PATH elsewhere). */
export function systemClangd(): string | null {
  try {
    if (process.platform === 'darwin') return execFileSync('xcrun', ['--find', 'clangd'], { encoding: 'utf8' }).trim() || null;
    const which = process.platform === 'win32' ? 'where' : 'which';
    return execFileSync(which, ['clangd'], { encoding: 'utf8' }).split(/\r?\n/)[0].trim() || null;
  } catch {
    return null;
  }
}

/** compile_commands.json in the root or a build folder one level down. */
export function findCompileCommands(root: string): string | null {
  if (fs.existsSync(path.join(root, 'compile_commands.json'))) return root;
  for (const e of fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }) : []) {
    if (e.isDirectory() && /^(build|out|cmake-build-)/i.test(e.name) && fs.existsSync(path.join(root, e.name, 'compile_commands.json')))
      return path.join(root, e.name);
  }
  return null;
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
  /** Edits clangd asks the client to apply (e.g. from a refactoring); forwarded to the interface. */
  onApplyEdit: (edit: unknown) => void = () => {};

  name = 'clangd';
  /** Answers workspace/configuration (pyright reads its Python from it). */
  settings: Record<string, unknown> = {};

  start(clangd: string, root: string, extraArgs: string[]): Promise<unknown> {
    const args = ['--background-index', '--background-index-priority=low', '--header-insertion=never', '--log=error', '--pch-storage=memory'];
    const cc = findCompileCommands(root);
    if (cc) args.push(`--compile-commands-dir=${cc}`);
    args.push(...extraArgs);
    return this.startServer(clangd, args, root, { initializationOptions: { clangdFileStatus: true } });
  }

  startServer(cmd: string, args: string[], root: string, opts: { env?: Record<string, string>; name?: string; initializationOptions?: unknown; settings?: Record<string, unknown> } = {}): Promise<unknown> {
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
      for (const q of this.pending.values()) q.reject(new Error(`${this.name} exited (${code})`));
      this.pending.clear();
      this.proc = null;
      this.onNotify('$/exit', { code });
    });
    p.on('error', (e) => { this.onLog(`${this.name} failed to start: ${e.message}`); });
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
          publishDiagnostics: { relatedInformation: true },
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
    try { this.notify('exit', null); } catch { /* already gone */ }
    // Detach the old process first: its late exit must not fail requests sent to the next one.
    p.removeAllListeners('exit');
    p.stdout?.removeAllListeners('data');
    p.stderr?.removeAllListeners('data');
    p.kill();
    this.proc = null;
    for (const q of this.pending.values()) q.reject(new Error(`${this.name} restarted`));
    this.pending.clear();
    this.buf = Buffer.alloc(0);
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
      this.pending.set(id, { resolve, reject, method });
      try { this.send({ jsonrpc: '2.0', id, method, params }); }
      catch (e) { this.pending.delete(id); reject(e as Error); }
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
        this.pending.delete(msg.id);
        if (msg.error) q.reject(new Error(`${q.method}: ${msg.error.message}`));
        else q.resolve(msg.result ?? null);
      }
    }
  }

  // servers ask a few things of the client; reply minimally so they never wait on us.
  private answerServerRequest(id: number, method: string, params?: unknown): void {
    let result: unknown = null;
    if (method === 'workspace/configuration') {
      // each item names a section such as "python" or "python.analysis"
      result = ((params as { items?: { section?: string }[] })?.items ?? []).map((it) => (it.section ?? '').split('.').reduce<any>((o, k) => (o && k ? o[k] : o), this.settings) ?? null);
    }
    if (method === 'workspace/applyEdit') { this.onApplyEdit((params as { edit: unknown }).edit); result = { applied: true }; }
    this.send({ jsonrpc: '2.0', id, result });
  }
}
