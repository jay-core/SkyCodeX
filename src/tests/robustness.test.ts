import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { LspClient } from '../main/lsp';
import { extractTar } from '../main/unpack';
import { walkRun, MAX_RUN_DEPTH, FnInfo, FlowNode } from '../shared/flowrun';

function tarEntry(name: string, type: '0' | '2', body = '', link = ''): Buffer {
  const h = Buffer.alloc(512), data = Buffer.from(body);
  h.write(name, 0, 100, 'utf8');
  h.write('0000644\0', 100, 8, 'ascii');
  h.write(`${data.length.toString(8).padStart(11, '0')}\0`, 124, 12, 'ascii');
  h.write(type, 156, 1, 'ascii');
  h.write(link, 157, 100, 'utf8');
  h.write('ustar\0', 257, 6, 'ascii');
  const pad = Buffer.alloc((512 - (data.length % 512)) % 512);
  return Buffer.concat([h, data, pad]);
}

describe('unpacking an archive', () => {
  it('never writes outside its folder through a chain of links (p → ., then p/q → ../z)', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'skycodex-unpack-')), dest = path.join(base, 'dest');
    fs.mkdirSync(dest);
    try {
      const tar = Buffer.concat([tarEntry('p', '2', '', '.'), tarEntry('p/q', '2', '', '../z'), tarEntry('p/q/evil', '0', 'x'), Buffer.alloc(1024)]);
      const stats = await extractTar(Readable.from([tar]), dest);
      expect(stats.refused).toContain('p/q → ../z');
      expect(fs.existsSync(path.join(base, 'z'))).toBe(false);
      expect(fs.readFileSync(path.join(fs.realpathSync(dest), 'q', 'evil'), 'utf8')).toBe('x');
    } finally { fs.rmSync(base, { recursive: true, force: true }); }
  });

  it('keeps the links toolchains use (clang++ → clang, ../lib/x)', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'skycodex-unpack-')), dest = path.join(base, 'dest');
    fs.mkdirSync(dest);
    try {
      const tar = Buffer.concat([tarEntry('t/bin/clang', '0', 'c'), tarEntry('t/bin/clang++', '2', '', 'clang'), tarEntry('t/lib/x', '0', 'l'), tarEntry('t/bin/x', '2', '', '../lib/x'), Buffer.alloc(1024)]);
      const stats = await extractTar(Readable.from([tar]), dest);
      expect(stats.refused).toEqual([]);
      expect(fs.readFileSync(path.join(dest, 't/bin/clang++'), 'utf8')).toBe('c');
      expect(fs.readFileSync(path.join(dest, 't/bin/x'), 'utf8')).toBe('l');
    } finally { fs.rmSync(base, { recursive: true, force: true }); }
  });
});

describe('a language server that cannot start', () => {
  it('fails at once with the reason, instead of waiting for an answer that never comes', async () => {
    const logs: string[] = [];
    const c = new LspClient(() => {}, (l) => logs.push(l));
    const t0 = Date.now();
    await expect(c.startServer('/nonexistent/skycodex-test/clangd', [], process.cwd())).rejects.toThrow(/failed to start|not running/);
    expect(Date.now() - t0).toBeLessThan(5000);
    await new Promise((r) => setTimeout(r, 100));
    expect(c.running).toBe(false);
    expect(logs.some((l) => /failed to start/.test(l))).toBe(true);
  });
});

describe('the run of a very deep call chain', () => {
  it(`stops ${MAX_RUN_DEPTH} calls down, names what it did not follow, and does not overflow the stack`, () => {
    const N = MAX_RUN_DEPTH + 50;
    const fn = (i: number): FnInfo => ({
      name: `f${i}`, file: 'deep.c', line: i, lines: 3,
      flow: { body: i < N ? [{ t: 'call', to: { key: `k${i + 1}`, name: `f${i + 1}`, project: true, ctor: false, container: '' }, at: { line: i, character: 2 } } as FlowNode] : [], dropped: [] },
    });
    const run = walkRun('k0', (k) => fn(Number(k.slice(1))));
    expect(run.rows.length).toBe(MAX_RUN_DEPTH + 1);
    expect(run.rows[run.rows.length - 1].depth).toBe(MAX_RUN_DEPTH);
    expect(run.deep).toEqual([`f${MAX_RUN_DEPTH + 1}`]);
  });

  it('leaves an ordinary run unchanged (no "deep" field)', () => {
    const fn = (i: number): FnInfo => ({
      name: `f${i}`, file: 'a.c', line: i, lines: 3,
      flow: { body: i < 3 ? [{ t: 'call', to: { key: `k${i + 1}`, name: `f${i + 1}`, project: true, ctor: false, container: '' }, at: { line: i, character: 2 } } as FlowNode] : [], dropped: [] },
    });
    const run = walkRun('k0', (k) => fn(Number(k.slice(1))));
    expect(run.rows.map((r) => r.name)).toEqual(['f0', 'f1', 'f2', 'f3']);
    expect(run.deep).toBeUndefined();
  });
});
