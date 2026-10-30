// A minimal LSP client for clangd, for the feasibility probe.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

export const uri = (f) => pathToFileURL(f).href;
export const file = (u) => fileURLToPath(u);

export function startClangd(clangd, root, ccDir) {
  const args = ['--background-index', '--log=error', '--pch-storage=memory', '-j=8'];
  if (ccDir) args.push(`--compile-commands-dir=${ccDir}`);
  const p = spawn(clangd, args, { cwd: root, stdio: ['pipe', 'pipe', 'ignore'] });
  let buf = Buffer.alloc(0), id = 0;
  const pending = new Map(), handlers = new Map();
  p.stdout.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    for (;;) {
      const h = buf.indexOf('\r\n\r\n');
      if (h < 0) return;
      const len = Number(/Content-Length: (\d+)/i.exec(buf.slice(0, h).toString())[1]);
      if (buf.length < h + 4 + len) return;
      const msg = JSON.parse(buf.slice(h + 4, h + 4 + len).toString());
      buf = buf.slice(h + 4 + len);
      if (msg.id !== undefined && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); }
      else if (msg.method) {
        handlers.get(msg.method)?.(msg.params);
        if (msg.id !== undefined) send({ jsonrpc: '2.0', id: msg.id, result: null });
      }
    }
  });
  const send = (m) => { const s = JSON.stringify(m); p.stdin.write(`Content-Length: ${Buffer.byteLength(s)}\r\n\r\n${s}`); };
  const req = (method, params) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); send({ jsonrpc: '2.0', id: i, method, params }); });
  const notify = (method, params) => send({ jsonrpc: '2.0', method, params });
  const opened = new Set();
  const open = (f) => { if (opened.has(f)) return; opened.add(f); notify('textDocument/didOpen', { textDocument: { uri: uri(f), languageId: /\.c$/.test(f) ? 'c' : 'cpp', version: 1, text: fs.readFileSync(f, 'utf8') } }); };
  return {
    req, notify, open, on: (m, f) => handlers.set(m, f), proc: p,
    async init() {
      await req('initialize', { processId: process.pid, rootUri: uri(root), capabilities: { textDocument: { callHierarchy: {}, documentSymbol: { hierarchicalDocumentSymbolSupport: true } }, window: { workDoneProgress: true } } });
      notify('initialized', {});
    },
    stop() { try { p.kill(); } catch {} },
  };
}
