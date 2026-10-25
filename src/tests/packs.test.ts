// Language packs: safe unpacking, release matching, terminal PATH, and a full offline install.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import http from 'node:http';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { safeJoin, extractTar, extractZip, extractTarZst } from '../main/unpack';
import { sourceFor, compareVersions, installRelease, listPacks, removePack, Release } from '../main/packs';
import { launchWithPacks } from '../main/shellinit';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'litho-packs-'));

// ---- tiny archive writers, so the tests can build hostile archives ----
function tarEntry(name: string, body: string | Buffer, type = '0', link = '', mode = 0o644): Buffer {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const h = Buffer.alloc(512);
  h.write(name.slice(0, 100), 0);
  h.write(mode.toString(8).padStart(7, '0') + '\0', 100);
  h.write('0000000\0', 108); h.write('0000000\0', 116);
  h.write(data.length.toString(8).padStart(11, '0') + '\0', 124);
  h.write('00000000000\0', 136);
  h.write('        ', 148);
  h.write(type, 156);
  h.write(link, 157);
  h.write('ustar\0', 257); h.write('00', 263);
  let sum = 0; for (const b of h) sum += b;
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  const pad = Buffer.alloc((512 - (data.length % 512)) % 512);
  return Buffer.concat([h, data, pad]);
}
const pax = (key: string, value: string) => { const rec = ` ${key}=${value}\n`; let len = rec.length; len += String(len + String(len).length).length; return tarEntry('PaxHeader', `${len}${rec}`, 'x'); };
const tarOf = (...parts: Buffer[]) => Buffer.concat([...parts, Buffer.alloc(1024)]);

function zipOf(entries: { name: string; body?: string; mode?: number }[]): Buffer {
  const locals: Buffer[] = [], central: Buffer[] = [];
  let off = 0;
  for (const e of entries) {
    const data = Buffer.from(e.body ?? ''), name = Buffer.from(e.name), crc = zlib.crc32(data);
    const l = Buffer.alloc(30);
    l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(20, 4); l.writeUInt32LE(crc, 14); l.writeUInt32LE(data.length, 18); l.writeUInt32LE(data.length, 22); l.writeUInt16LE(name.length, 26);
    locals.push(l, name, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE((3 << 8) | 20, 4); c.writeUInt16LE(20, 6); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(name.length, 28); c.writeUInt32LE(((e.mode ?? 0o100644) << 16) >>> 0, 38); c.writeUInt32LE(off, 42);
    central.push(c, name);
    off += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, end]);
}

describe('unpacking stays inside its folder', () => {
  it('safeJoin refuses absolute paths, drive letters and ".."', () => {
    const d = '/tmp/x';
    expect(safeJoin(d, 'a/b.txt')).toBe(path.resolve('/tmp/x/a/b.txt'));
    expect(safeJoin(d, './a')).toBe(path.resolve('/tmp/x/a'));
    for (const bad of ['../evil', 'a/../../evil', '/etc/passwd', 'C:\\Windows\\x', '..\\evil', 'a/..']) expect(safeJoin(d, bad), bad).toBeNull();
  });

  it('tar: files, folders, modes and inside links are written; escapes are refused and never written', async () => {
    const d = tmp(), outside = path.join(path.dirname(d), `outside-${path.basename(d)}`);
    const long = `pack/${'deep/'.repeat(30)}file.txt`;
    const archive = tarOf(
      tarEntry('pack/', '', '5', '', 0o755),
      tarEntry('pack/bin/clang', '#!/bin/sh\necho hi\n', '0', '', 0o755),
      tarEntry('pack/bin/clang++', '', '2', 'clang'),
      tarEntry('pack/lib/escape', '', '2', '../../../etc/passwd'),
      tarEntry('pack/abs', '', '2', '/etc/passwd'),
      tarEntry('../outside.txt', 'nope'),
      tarEntry(`../${path.basename(outside)}/x`, 'nope'),
      tarEntry('/tmp/abs.txt', 'nope'),
      pax('path', long), tarEntry('placeholder', 'long name kept'),
      tarEntry('pack/hard', '', '1', 'pack/bin/clang'),
    );
    const s = await extractTar(Readable.from([archive]), d);
    expect(fs.readFileSync(path.join(d, 'pack/bin/clang'), 'utf8')).toContain('echo hi');
    expect(fs.statSync(path.join(d, 'pack/bin/clang')).mode & 0o111).not.toBe(0);
    expect(fs.readlinkSync(path.join(d, 'pack/bin/clang++'))).toBe('clang');
    expect(fs.readFileSync(path.join(d, long), 'utf8')).toBe('long name kept');
    expect(fs.readFileSync(path.join(d, 'pack/hard'), 'utf8')).toContain('echo hi');
    expect(fs.existsSync(path.join(d, 'pack/lib/escape'))).toBe(false);
    expect(fs.existsSync(path.join(d, 'pack/abs'))).toBe(false);
    expect(fs.existsSync(path.join(path.dirname(d), 'outside.txt'))).toBe(false);
    expect(fs.existsSync(outside)).toBe(false);
    expect(s.refused.length).toBe(5);
  });

  it('tar.zst decodes through Node\'s zstd', async () => {
    const d = tmp(), f = path.join(d, 'a.tar.zst');
    fs.writeFileSync(f, zlib.zstdCompressSync(tarOf(tarEntry('top/bin/clangd', 'x', '0', '', 0o755))));
    const s = await extractTarZst(f, path.join(d, 'out'));
    expect(s.files).toBe(1);
    expect(fs.existsSync(path.join(d, 'out/top/bin/clangd'))).toBe(true);
  });

  it('zip: unix modes and inside symlinks kept, escaping entries and links refused', async () => {
    const d = tmp(), f = path.join(d, 'a.zip'), out = path.join(d, 'out');
    fs.writeFileSync(f, zipOf([
      { name: 'top/', mode: 0o40755 },
      { name: 'top/bin/clangd', body: 'bin', mode: 0o100755 },
      { name: 'top/bin/link', body: 'clangd', mode: 0o120777 },
      { name: 'top/bin/evil-link', body: '../../../../etc', mode: 0o120777 },
      { name: '../zip-escape.txt', body: 'no' },
      { name: '/abs.txt', body: 'no' },
    ]));
    const s = await extractZip(f, out);
    expect(fs.readFileSync(path.join(out, 'top/bin/clangd'), 'utf8')).toBe('bin');
    expect(fs.statSync(path.join(out, 'top/bin/clangd')).mode & 0o111).not.toBe(0);
    expect(fs.readlinkSync(path.join(out, 'top/bin/link'))).toBe('clangd');
    expect(fs.existsSync(path.join(out, 'top/bin/evil-link'))).toBe(false);
    expect(fs.existsSync(path.join(d, 'zip-escape.txt'))).toBe(false);
    expect(s.refused.length).toBe(3);
  });
});

describe('release matching', () => {
  const m = (kind: 'toolchain' | 'clangd', p: NodeJS.Platform, a: string, asset: string) => sourceFor(kind, p, a)?.match(asset) ?? null;
  it('picks only this OS and processor, and only formats unpacked in-process', () => {
    expect(m('toolchain', 'darwin', 'arm64', 'LLVM-23.1.4-macOS-ARM64.tar.zst')).toEqual({ version: '23.1.4', format: 'tar.zst' });
    expect(m('toolchain', 'darwin', 'arm64', 'LLVM-23.1.4-macOS-ARM64.tar.xz')).toBeNull();
    expect(m('toolchain', 'darwin', 'arm64', 'LLVM-23.1.4-macOS-X64.tar.zst')).toBeNull();
    expect(m('toolchain', 'linux', 'x64', 'LLVM-23.1.4-Linux-X64.tar.zst')?.version).toBe('23.1.4');
    expect(m('toolchain', 'linux', 'arm64', 'LLVM-23.1.4-Linux-X64.tar.zst')).toBeNull();
    expect(m('toolchain', 'win32', 'x64', 'llvm-mingw-20261020-ucrt-x86_64.zip')?.version).toBe('20261020');
    expect(m('toolchain', 'win32', 'x64', 'llvm-mingw-20261020-msvcrt-x86_64.zip')).toBeNull();
    expect(m('toolchain', 'win32', 'x64', 'clang+llvm-23.1.4-x86_64-pc-windows-msvc.tar.zst')).toBeNull();
    expect(m('clangd', 'darwin', 'arm64', 'clangd-mac-23.1.0.zip')?.version).toBe('23.1.0');
    expect(m('clangd', 'darwin', 'arm64', 'clangd_indexing_tools-mac-23.1.0.zip')).toBeNull();
    expect(m('clangd', 'win32', 'x64', 'clangd-windows-23.1.0.zip')?.version).toBe('23.1.0');
    expect(sourceFor('clangd', 'linux', 'arm64')).toBeNull();   // no official build
  });
  it('compares versions part by part', () => {
    expect(compareVersions('23.1.10', '23.1.4')).toBeGreaterThan(0);
    expect(compareVersions('9.0.0', '10.0.0')).toBeLessThan(0);
    expect(compareVersions('20261020', '20260901')).toBeGreaterThan(0);
  });
});

describe.skipIf(process.platform === 'win32')('packs come first on PATH in Lithograph\'s terminal only', () => {
  const bin = (d: string) => { const b = path.join(d, 'pack dir with spaces', 'bin'); fs.mkdirSync(b, { recursive: true }); fs.writeFileSync(path.join(b, 'clang'), '#!/bin/sh\necho pack-clang\n', { mode: 0o755 }); return b; };
  for (const sh of ['/bin/zsh', '/bin/bash']) {
    it.skipIf(!fs.existsSync(sh))(`${path.basename(sh)} login start-up (path_helper included) still finds the pack's clang first`, () => {
      const d = tmp(), home = path.join(d, 'home'), b = bin(d);
      fs.mkdirSync(home);
      const go = launchWithPacks(sh, sh.endsWith('zsh') ? ['-l'] : ['-l'], [b], path.join(d, 'state'));
      const args = sh.endsWith('zsh') ? [...go.args, '-i', '-c', 'clang; print -r -- $PATH'] : [...go.args, '-c', 'clang; echo "$PATH"'];
      const out = execFileSync(go.file, args, { env: { PATH: '/usr/bin:/bin', HOME: home, ...go.env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 });
      expect(out).toContain('pack-clang');
      expect(out.trim().split('\n').pop()!.startsWith(b)).toBe(true);
      // the user's own environment is untouched: nothing was written outside the state folder
      expect(fs.readdirSync(home)).toEqual([]);
    });
  }
  it('with no packs the shell starts exactly as configured', () => {
    expect(launchWithPacks('/bin/zsh', ['-l'], [], tmp())).toEqual({ file: '/bin/zsh', args: ['-l'], env: {} });
  });
});

// a real install, offline: a clangd release zip on disk (LITHO_TEST_CLANGD_ZIP), served from localhost
const ZIP = process.env.LITHO_TEST_CLANGD_ZIP ?? '';
const zipHere = process.platform === 'darwin' && fs.existsSync(ZIP);
describe.skipIf(!zipHere)('installing a pack end to end (local server)', () => {
  let server: http.Server, url = '', sha = '', size = 0;
  beforeAll(async () => {
    const data = fs.readFileSync(ZIP); size = data.length;
    sha = crypto.createHash('sha256').update(data).digest('hex');
    server = http.createServer((req, res) => {
      if (req.url === '/ok.zip') { res.writeHead(200, { 'Content-Length': size }); res.end(data); }
      else { res.writeHead(200); res.end(Buffer.alloc(1000, 1)); }
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    url = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(() => server?.close());
  const rel = (over: Partial<Release> = {}): Release => ({ kind: 'clangd', name: 'clangd', version: '23.1.0', asset: 'clangd-mac-23.1.0.zip', url: `${url}/ok.zip`, size, sha256: sha, format: 'zip', source: 'test', id: 'clangd-23.1.0', ...over });

  it('downloads, verifies, unpacks and renames into place; the clangd inside runs', async () => {
    const dir = tmp(), phases = new Set<string>();
    const m = await installRelease(rel(), dir, (p) => phases.add(p.phase), new AbortController().signal);
    expect([...phases]).toEqual(['download', 'verify', 'unpack', 'done']);
    expect(fs.readdirSync(dir).sort()).toEqual(['.downloading', 'clangd-23.1.0']);
    expect(fs.readdirSync(path.join(dir, '.downloading'))).toEqual([]);
    expect(listPacks(dir).map((p) => p.id)).toEqual(['clangd-23.1.0']);
    expect(m.bytes).toBeGreaterThan(100e6);
    expect(execFileSync(path.join(dir, 'clangd-23.1.0/bin/clangd'), ['--version'], { encoding: 'utf8' })).toContain('clangd version 23.1.0');
    removePack(dir, 'clangd-23.1.0');
    expect(listPacks(dir)).toEqual([]);
  }, 120000);

  it('a checksum mismatch deletes the download and installs nothing', async () => {
    const dir = tmp();
    await expect(installRelease(rel({ url: `${url}/bad.zip`, size: 1000, id: 'clangd-bad' }), dir, () => {}, new AbortController().signal)).rejects.toThrow(/checksum mismatch/);
    expect(fs.readdirSync(dir)).toEqual(['.downloading']);
    expect(fs.readdirSync(path.join(dir, '.downloading'))).toEqual([]);
  });

  it('cancelling leaves nothing behind', async () => {
    const dir = tmp(), ctrl = new AbortController();
    const p = installRelease(rel({ id: 'clangd-cancel' }), dir, (pr) => { if (pr.phase === 'download' && pr.done > 5e6) ctrl.abort(); }, ctrl.signal);
    await expect(p).rejects.toThrow();
    expect(fs.readdirSync(dir).filter((n) => n !== '.downloading')).toEqual([]);
  }, 60000);
});
