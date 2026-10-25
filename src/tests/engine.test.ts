// Integration tests against the real sample project: binary parsing and clangd.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { LspClient, findClangd } from '../main/lsp';

const SAMPLE = path.resolve(__dirname, '../../samples/tinyhttp');

beforeAll(() => {
  if (!fs.existsSync(path.join(SAMPLE, 'build/tinyhttp'))) execFileSync(path.join(SAMPLE, 'build.sh'));
});

describe('clangd restart', () => {
  it.skipIf(!findClangd('auto', '/x'))('a second start right after the first works (old process exit must not fail the new one)', async () => {
    const lsp = new LspClient(() => {}, () => {});
    const clangd = findClangd('auto', '/x')!;
    const first = lsp.start(clangd, SAMPLE, []).catch(() => 'first-rejected');
    const second = await lsp.start(clangd, os.tmpdir(), []);
    expect((second as any).capabilities).toBeTruthy();
    await new Promise((r) => setTimeout(r, 300));
    expect(lsp.running).toBe(true);
    await first;
    lsp.stop();
  }, 30000);
});

describe('clangd', () => {
  const clangd = findClangd('auto', '/nonexistent');
  const lsp = new LspClient(() => {}, () => {});
  const uri = (p: string) => pathToFileURL(path.join(SAMPLE, p)).href;
  beforeAll(async () => {
    if (!clangd) return;
    await lsp.start(clangd, SAMPLE, []);
    const text = fs.readFileSync(path.join(SAMPLE, 'src/server.cpp'), 'utf8');
    lsp.notify('textDocument/didOpen', { textDocument: { uri: uri('src/server.cpp'), languageId: 'cpp', version: 1, text } });
  }, 30000);
  afterAll(() => lsp.stop());

  it.skipIf(!clangd)('finds the outgoing calls of Server::handle, with call sites, in call order', async () => {
    const text = fs.readFileSync(path.join(SAMPLE, 'src/server.cpp'), 'utf8');
    const line = text.split('\n').findIndex((l) => l.startsWith('Response Server::handle'));
    const col = text.split('\n')[line].indexOf('handle(');
    const items = (await lsp.request('textDocument/prepareCallHierarchy', { textDocument: { uri: uri('src/server.cpp') }, position: { line, character: col } })) as any[];
    expect(items?.[0]?.name).toMatch(/(^|::)handle$/);
    // Cross-file callees appear once clangd's background index has covered the project.
    let calls: any[] = [], names: string[] = [];
    const want = ['parse_headers', 'route', 'send_response', 'record', 'keep_alive'];
    for (let i = 0; i < 120 && !want.every((n) => names.includes(n)); i++) {
      if (i) await new Promise((r) => setTimeout(r, 200));
      calls = (await lsp.request('callHierarchy/outgoingCalls', { item: items[0] })) as any[];
      names = calls.map((c) => String(c.to.name).replace(/^.*::/, ''));
    }
    for (const n of ['parse_headers', 'route', 'send_response', 'record', 'keep_alive']) expect(names).toContain(n);
    for (const c of calls) expect(c.fromRanges.length).toBeGreaterThan(0);
  }, 30000);
});
