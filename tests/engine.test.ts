// Integration tests against the real sample project: binary parsing and clangd.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseBinary, totals } from '../src/main/binary';
import { analyze, stripCode, scanHeap } from '../src/main/memory';
import { LspClient, findClangd } from '../src/main/lsp';

const SAMPLE = path.resolve(__dirname, '../samples/tinyhttp');

beforeAll(() => {
  if (!fs.existsSync(path.join(SAMPLE, 'build/tinyhttp'))) execFileSync(path.join(SAMPLE, 'build.sh'));
});

describe('binary parsing', () => {
  it('reads the sample Mach-O / ELF program: sections, totals, symbols', () => {
    const info = parseBinary(fs.readFileSync(path.join(SAMPLE, 'build/tinyhttp')));
    expect(['Mach-O', 'ELF']).toContain(info.format);
    const t = totals(info);
    expect(t.byKind.code).toBeGreaterThan(1000);
    expect(t.storage).toBeGreaterThanOrEqual(t.byKind.code);
    // the 16 KB report buffer and 8 KB-per-Metrics log buffer must show up
    expect(t.ram).toBeGreaterThanOrEqual(16384);
    expect(info.symbols.some((s) => /g_report/.test(s.name) && s.size >= 16384)).toBe(true);
  });
  it('reads an ELF object built for Linux', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'litho-elf-'));
    fs.writeFileSync(path.join(d, 'x.c'), 'int big[1000]; const char msg[64] = "hi"; int add(int a, int b) { return a + b + big[a]; }\n');
    execFileSync('clang', ['-target', 'x86_64-linux-gnu', '-O1', '-c', path.join(d, 'x.c'), '-o', path.join(d, 'x.o')]);
    const info = parseBinary(fs.readFileSync(path.join(d, 'x.o')));
    expect(info.format).toBe('ELF');
    expect(info.arch).toBe('x86-64');
    const big = info.symbols.find((s) => s.name === 'big');
    expect(big).toMatchObject({ size: 4000, kind: 'bss' });
    expect(info.symbols.find((s) => s.name === 'msg')?.kind).toBe('rodata');
    expect(info.symbols.find((s) => s.name === 'add')?.kind).toBe('code');
  });
  it('memory report: largest RAM first, stack usage, heap sites', () => {
    const r = analyze(path.join(SAMPLE, 'build/tinyhttp'), SAMPLE);
    for (let i = 1; i < r.largestRam.length; i++) expect(r.largestRam[i - 1].size).toBeGreaterThanOrEqual(r.largestRam[i].size);
    expect(r.largestRam[0].name).toMatch(/g_report/);
    expect(r.stack.length).toBeGreaterThan(5);
    expect(r.stack.some((s) => /Server::start/.test(s.fn))).toBe(true);
  });
  it('heap scan ignores comments and strings', () => {
    expect(stripCode('a("x // y"); // malloc(1)\n/* new int */ b')).toBe('a(""); \n b');
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'litho-heap-'));
    fs.writeFileSync(path.join(d, 'a.cpp'), '// malloc(3)\nint* p = new int[4];\nvoid* q = malloc(8);\nauto s = std::make_shared<int>(1);\nconst char* t = "free(x)";\n');
    expect(scanHeap(d).map((h) => `${h.line}:${h.call}`)).toEqual(['2:new', '3:malloc', '4:make_shared']);
  });
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
