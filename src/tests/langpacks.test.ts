// Rust, Python, Go and reference packs: matching releases, arranging what is unpacked, and keeping caches inside the pack.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import http from 'node:http';
import crypto from 'node:crypto';
import { rustTarget, pythonTriple, goPlatform, pythonReleases, goReleases, mergeRustComponents, languageBins, languageEnv, serverFor, stepsFor, goEnv } from '../main/langpacks';
import { installRelease, listPacks, removePack, MANIFEST, Release } from '../main/packs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'litho-lang-'));
const put = (p: string, body = 'x', mode = 0o644) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body, { mode }); };
function tarEntry(name: string, body: string, mode = 0o644): Buffer {
  const data = Buffer.from(body), h = Buffer.alloc(512);
  h.write(name, 0); h.write(mode.toString(8).padStart(7, '0') + '\0', 100);
  h.write('0000000\0', 108); h.write('0000000\0', 116);
  h.write(data.length.toString(8).padStart(11, '0') + '\0', 124); h.write('00000000000\0', 136);
  h.write('        ', 148); h.write('0', 156); h.write('ustar\0', 257); h.write('00', 263);
  let sum = 0; for (const b of h) sum += b;
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  return Buffer.concat([h, data, Buffer.alloc((512 - (data.length % 512)) % 512)]);
}
const tgz = (...e: Buffer[]) => zlib.gzipSync(Buffer.concat([...e, Buffer.alloc(1024)]));
const fakeManifest = (dir: string, id: string, kind: string, version: string, bin = 'bin') =>
  put(path.join(dir, id, MANIFEST), JSON.stringify({ id, kind, name: kind, version, bin, source: 't', asset: 'a', sha256: '', bytes: 1, installedAt: '' }));

describe('this machine', () => {
  it('names targets the way each project does', () => {
    expect(rustTarget('darwin', 'arm64')).toBe('aarch64-apple-darwin');
    expect(rustTarget('win32', 'x64')).toBe('x86_64-pc-windows-gnu');
    expect(rustTarget('linux', 'ia32')).toBeNull();
    expect(pythonTriple('win32', 'x64')).toBe('x86_64-pc-windows-msvc');
    expect(goPlatform('linux', 'x64')).toEqual({ os: 'linux', arch: 'amd64' });
  });
});

describe('release lists', () => {
  it('keeps the newest Python of each version, and only builds with a checksum', () => {
    const d = 'sha256:' + 'a'.repeat(64);
    const list = pythonReleases([
      { name: 'cpython-3.13.8+20251010-aarch64-apple-darwin-install_only.tar.gz', size: 1, digest: d, browser_download_url: 'u1' },
      { name: 'cpython-3.13.9+20251014-aarch64-apple-darwin-install_only.tar.gz', size: 2, digest: d, browser_download_url: 'u2' },
      { name: 'cpython-3.12.12+20251014-aarch64-apple-darwin-install_only.tar.gz', size: 3, digest: d, browser_download_url: 'u3' },
      { name: 'cpython-3.11.14+20251014-aarch64-apple-darwin-install_only.tar.gz', size: 3, browser_download_url: 'u4' },   // no digest
      { name: 'cpython-3.13.9+20251014-aarch64-apple-darwin-install_only_stripped.tar.gz', size: 2, digest: d, browser_download_url: 'u5' },
      { name: 'cpython-3.13.9+20251014-x86_64-apple-darwin-install_only.tar.gz', size: 2, digest: d, browser_download_url: 'u6' },
    ], 'aarch64-apple-darwin');
    expect(list.map((r) => r.version)).toEqual(['3.13.9', '3.12.12']);
    expect(list[0].url).toBe('u2');
  });
  it('reads go.dev/dl, stable archives only', () => {
    const list = goReleases([
      { version: 'go1.26rc1', stable: false, files: [] },
      { version: 'go1.25.3', stable: true, files: [
        { filename: 'go1.25.3.darwin-arm64.pkg', os: 'darwin', arch: 'arm64', kind: 'installer', sha256: 'b'.repeat(64), size: 9 },
        { filename: 'go1.25.3.darwin-arm64.tar.gz', os: 'darwin', arch: 'arm64', kind: 'archive', sha256: 'c'.repeat(64), size: 70e6 },
      ] },
    ], { os: 'darwin', arch: 'arm64' });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'go-1.25.3', format: 'tar.gz', url: 'https://go.dev/dl/go1.25.3.darwin-arm64.tar.gz' });
  });
});

describe('Rust components', () => {
  it('merges each component\'s listed files and skips the docs', () => {
    const r = tmp();
    put(path.join(r, 'components'), 'rustc\ncargo\nrust-docs\n');
    put(path.join(r, 'rustc/manifest.in'), 'file:bin/rustc\ndir:lib/rustlib/x\nfile:../evil\n');
    put(path.join(r, 'rustc/bin/rustc'), 'rustc', 0o755);
    put(path.join(r, 'rustc/lib/rustlib/x/a.rlib'));
    put(path.join(r, 'cargo/manifest.in'), 'file:bin/cargo\n');
    put(path.join(r, 'cargo/bin/cargo'), 'cargo', 0o755);
    put(path.join(r, 'rust-docs/manifest.in'), 'dir:share/doc\n');
    put(path.join(r, 'rust-docs/share/doc/index.html'));
    put(path.join(r, 'install.sh'), '#!/bin/sh');
    expect(mergeRustComponents(r)).toEqual(['rustc', 'cargo']);
    expect(fs.readdirSync(r).sort()).toEqual(['bin', 'lib']);
    expect(fs.existsSync(path.join(r, 'lib/rustlib/x/a.rlib'))).toBe(true);
    expect(fs.statSync(path.join(r, 'bin/rustc')).mode & 0o111).toBeTruthy();
  });
});

describe('using packs', () => {
  it('puts every language on PATH and keeps Cargo, Go and pip inside their packs', () => {
    const dir = tmp();
    fakeManifest(dir, 'rust-1.91.0', 'rust', '1.91.0');
    fakeManifest(dir, 'go-1.25.3', 'go', '1.25.3');
    fakeManifest(dir, 'python-3.13.9', 'python', '3.13.9', process.platform === 'win32' ? '.' : 'bin');
    fakeManifest(dir, 'python-3.12.12', 'python', '3.12.12');
    const bins = languageBins(dir);
    expect(bins).toContain(path.join(dir, 'rust-1.91.0', 'bin'));
    expect(bins.some((b) => b.includes('python-3.12'))).toBe(false);   // the newest of a kind only
    const env = languageEnv(dir);
    expect(env.CARGO_HOME).toBe(path.join(dir, 'rust-1.91.0', 'cargo-home'));
    expect(env.GOPATH.startsWith(path.join(dir, 'go-1.25.3'))).toBe(true);
    expect(env.GOMODCACHE.startsWith(path.join(dir, 'go-1.25.3'))).toBe(true);
    expect(env.PIP_CACHE_DIR.startsWith(path.join(dir, 'python-3.13.9'))).toBe(true);
    expect(goEnv('/p').GOTOOLCHAIN).toBe('local');   // never downloads another Go by itself
  });
  it('runs Pyright with SkyCodeX\'s own Node.js and tells it which Python to use', () => {
    const dir = tmp();
    fakeManifest(dir, 'pyright-1.1.414', 'pyright', '1.1.414', '.');
    fakeManifest(dir, 'python-3.13.9', 'python', '3.13.9');
    const s = serverFor('python', dir)!;
    expect(s.cmd).toBe(process.execPath);
    expect(s.env.ELECTRON_RUN_AS_NODE).toBe('1');
    expect(s.args[0]).toBe(path.join(dir, 'pyright-1.1.414', 'langserver.index.js'));
    expect((s.settings as any).python.pythonPath).toContain('python-3.13.9');
  });
});

describe('installing new formats (local server)', () => {
  let server: http.Server, url = '';
  const raw = Buffer.from('#!/bin/sh\necho rust-analyzer\n');
  const files: Record<string, Buffer> = {
    '/ra.gz': zlib.gzipSync(raw),
    '/pyright.tgz': tgz(tarEntry('package/langserver.index.js', 'console.log(1)'), tarEntry('package/package.json', '{}')),
  };
  beforeAll(async () => {
    server = http.createServer((req, res) => { const b = files[req.url!]; res.writeHead(b ? 200 : 404, { 'Content-Length': b?.length ?? 0 }); res.end(b); });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    url = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(() => server?.close());
  const sig = () => new AbortController().signal;

  it('a gzipped program becomes bin/<name>, executable', async () => {
    const dir = tmp(), b = files['/ra.gz'];
    const rel: Release = { kind: 'rust-analyzer', name: 'rust-analyzer', version: '2026-10-19', asset: 'ra.gz', url: `${url}/ra.gz`, size: b.length, sha256: crypto.createHash('sha256').update(b).digest('hex'), format: 'gz', source: 't', id: 'rust-analyzer-2026-10-19' };
    await installRelease(rel, dir, () => {}, sig(), stepsFor('rust-analyzer'));
    const exe = path.join(dir, 'rust-analyzer-2026-10-19', 'bin', process.platform === 'win32' ? 'rust-analyzer.exe' : 'rust-analyzer');
    expect(fs.readFileSync(exe)).toEqual(raw);
    if (process.platform !== 'win32') expect(fs.statSync(exe).mode & 0o111).toBeTruthy();
  });
  it('an npm tarball is checked against its SHA-512', async () => {
    const dir = tmp(), b = files['/pyright.tgz'];
    const good = crypto.createHash('sha512').update(b).digest('base64');
    const rel: Release = { kind: 'pyright', name: 'pyright', version: '1.1.414', asset: 'pyright.tgz', url: `${url}/pyright.tgz`, size: b.length, sha256: '', sha512: good, format: 'tar.gz', source: 't', id: 'pyright-1.1.414' };
    await expect(installRelease({ ...rel, id: 'pyright-bad', sha512: 'A' + good.slice(1) }, dir, () => {}, sig(), stepsFor('pyright'))).rejects.toThrow(/checksum mismatch/);
    const m = await installRelease(rel, dir, () => {}, sig(), stepsFor('pyright'));
    expect(m.bin).toBe('.');
    expect(fs.existsSync(path.join(dir, 'pyright-1.1.414', 'langserver.index.js'))).toBe(true);
    expect(listPacks(dir).map((p) => p.id)).toEqual(['pyright-1.1.414']);
  });
  it('removes a pack whose files were made read-only (Go\'s module cache)', () => {
    const dir = tmp();
    fakeManifest(dir, 'go-1.25.3', 'go', '1.25.3');
    const ro = path.join(dir, 'go-1.25.3', 'gopath', 'pkg', 'mod', 'x@v1');
    put(path.join(ro, 'a.go'));
    fs.chmodSync(ro, 0o555);
    removePack(dir, 'go-1.25.3');
    expect(fs.existsSync(path.join(dir, 'go-1.25.3'))).toBe(false);
  });
});
