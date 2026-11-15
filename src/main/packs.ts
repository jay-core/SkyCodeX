import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { extractZip, extractTarZst, extractTarGz, extractGzProgram, UnpackStats } from './unpack';

export type PackKind = 'toolchain' | 'clangd' | 'rust' | 'rust-analyzer' | 'python' | 'pyright' | 'go';
export interface PackManifest {
  id: string; kind: PackKind; name: string; version: string; bin: string;
  source: string; asset: string; sha256: string; bytes: number; installedAt: string; note?: string;
}
export interface Release { kind: PackKind; name: string; version: string; asset: string; url: string; size: number; sha256: string; sha512?: string; format: 'zip' | 'tar.zst' | 'tar.gz' | 'gz'; source: string; id: string; note?: string }
export interface InstallSteps { check?: (root: string) => boolean; prepare?: (root: string, onProgress: (p: Progress) => void, signal: AbortSignal) => Promise<string | void>; bin?: string; program?: string }
export type Progress = { phase: 'download' | 'verify' | 'unpack' | 'done' | 'failed' | 'cancelled'; done: number; total: number; note?: string };

export const MANIFEST = 'skycodex-pack.json';

export function resolvePacksDir(besideApp: string, dataDir: string): { dir: string; note?: string } {
  const want = path.join(besideApp, 'language_packs');
  try {
    fs.mkdirSync(want, { recursive: true });
    fs.accessSync(want, fs.constants.W_OK);
    return { dir: want };
  } catch {
    const alt = path.join(dataDir, 'language_packs');
    fs.mkdirSync(alt, { recursive: true });
    return { dir: alt, note: `${want} can't be written, so packs go to ${alt}` };
  }
}

export const unreadablePacks: string[] = [];
export function listPacks(dir: string): PackManifest[] {
  const out: PackManifest[] = [];
  unreadablePacks.length = 0;
  for (const d of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (d.startsWith('.')) continue;
    const file = [MANIFEST, 'lithograph-pack.json'].map((m) => path.join(dir, d, m)).find((f) => fs.existsSync(f));
    try {
      const m = file ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
      if (m && typeof m.id === 'string' && typeof m.kind === 'string' && typeof m.version === 'string' && typeof m.name === 'string') out.push({ bin: 'bin', ...m });
      else if (file) unreadablePacks.push(d);
    } catch { unreadablePacks.push(d); }
  }
  return out.sort((a, b) => a.kind.localeCompare(b.kind) || compareVersions(b.version, a.version));
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.\-]/).map((x) => parseInt(x, 10) || 0), pb = b.split(/[.\-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

export interface Source { repo: string; name: string; match: (asset: string) => { version: string; format: Release['format'] } | null }

export function sourceFor(kind: PackKind, platform: NodeJS.Platform, arch: string): Source | null {
  if (kind === 'clangd') {
    const os = platform === 'darwin' ? 'mac' : platform === 'win32' ? 'windows' : platform === 'linux' && arch === 'x64' ? 'linux' : null;
    if (!os) return null;
    const re = new RegExp(`^clangd-${os}-(\\d+\\.\\d+\\.\\d+)\\.zip$`);
    return { repo: 'clangd/clangd', name: 'clangd', match: (a) => { const m = a.match(re); return m ? { version: m[1], format: 'zip' } : null; } };
  }
  if (platform === 'win32') {
    const cpu = arch === 'arm64' ? 'aarch64' : 'x86_64';
    const re = new RegExp(`^llvm-mingw-(\\d{8})-ucrt-${cpu}\\.zip$`);
    return { repo: 'mstorsjo/llvm-mingw', name: 'llvm-mingw', match: (a) => { const m = a.match(re); return m ? { version: m[1], format: 'zip' } : null; } };
  }
  const os = platform === 'darwin' ? 'macOS' : platform === 'linux' ? 'Linux' : null;
  const cpu = arch === 'arm64' ? 'ARM64' : arch === 'x64' ? 'X64' : null;
  if (!os || !cpu) return null;
  const re = new RegExp(`^LLVM-(\\d+\\.\\d+\\.\\d+)-${os}-${cpu}\\.tar\\.zst$`);
  return { repo: 'llvm/llvm-project', name: 'clang', match: (a) => { const m = a.match(re); return m ? { version: m[1], format: 'tar.zst' } : null; } };
}

const cache = new Map<string, { at: number; list: Release[] }>();
export async function availableReleases(kind: PackKind, platform = process.platform, arch = process.arch): Promise<Release[]> {
  const src = sourceFor(kind, platform, arch);
  if (!src) return [];
  const hit = cache.get(src.repo);
  if (hit && Date.now() - hit.at < 600_000) return hit.list;
  const res = await fetch(`https://api.github.com/repos/${src.repo}/releases?per_page=100`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'SkyCodeX' } });
  if (!res.ok) throw new Error(res.status === 403 ? 'GitHub is limiting requests right now — try again in a while' : `GitHub answered ${res.status}`);
  const list: Release[] = [];
  for (const r of (await res.json()) as any[]) {
    if (r.prerelease || r.draft) continue;
    for (const a of r.assets ?? []) {
      const m = src.match(a.name);
      if (!m || !/^sha256:[0-9a-f]{64}$/.test(a.digest ?? '')) continue;
      list.push({ kind, name: src.name, version: m.version, asset: a.name, url: a.browser_download_url, size: a.size, sha256: a.digest.slice(7), format: m.format, source: `github.com/${src.repo}`, id: `${src.name}-${m.version}` });
    }
  }
  list.sort((a, b) => compareVersions(b.version, a.version));
  cache.set(src.repo, { at: Date.now(), list });
  return list;
}

export const expectedBytes = (r: Pick<Release, 'size' | 'format'>) => r.size * (r.format === 'zip' ? 3 : 6);

export function freeBytes(dir: string): number {
  try { const s = fs.statfsSync(dir); return s.bavail * s.bsize; } catch { return Infinity; }
}

const insideDir = (dir: string, p: string) => { const r = path.resolve(p), d = path.resolve(dir); return r.startsWith(d + path.sep); };

async function download(url: string, to: string, total: number, onProgress: (p: Progress) => void, signal: AbortSignal, algo: 'sha256' | 'sha512' = 'sha256'): Promise<string> {
  const res = await fetch(url, { signal, headers: { 'User-Agent': 'SkyCodeX' } });
  if (!res.ok || !res.body) throw new Error(`download failed (${res.status})`);
  const hash = crypto.createHash(algo), out = fs.createWriteStream(to);
  let failed: Error | null = null;
  out.on('error', (e) => { failed = e; out.emit('drain'); });
  let done = 0, last = 0;
  try {
    for await (const chunk of Readable.fromWeb(res.body as any)) {
      if (failed) throw failed;
      hash.update(chunk as Buffer);
      if (!out.write(chunk)) await new Promise<void>((r) => out.once('drain', () => r()));
      if (failed) throw failed;
      done += (chunk as Buffer).length;
      if (done - last > 1 << 20 || done === total) { last = done; onProgress({ phase: 'download', done, total }); }
    }
  } finally { if (!failed) await new Promise<void>((r) => out.end(() => r())); else out.destroy(); }
  if (failed) throw failed;
  return hash.digest(algo === 'sha512' ? 'base64' : 'hex');
}

async function hashFile(file: string, onProgress: (p: Progress) => void): Promise<string> {
  const h = crypto.createHash('sha256'), total = fs.statSync(file).size;
  let done = 0;
  for await (const c of fs.createReadStream(file)) { h.update(c as Buffer); done += (c as Buffer).length; onProgress({ phase: 'download', done, total, note: 'reading the file' }); }
  return h.digest('hex');
}

function duSync(dir: string): number {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) n += duSync(p); else if (e.isFile()) n += fs.statSync(p).size;
  }
  return n;
}

export async function installRelease(rel: Release, dir: string, onProgress: (p: Progress) => void, signal: AbortSignal, steps: InstallSteps = {}): Promise<PackManifest> {
  const final = path.join(dir, rel.id);
  if (!insideDir(dir, final)) throw new Error('bad pack name');
  if (fs.existsSync(path.join(final, MANIFEST))) throw new Error(`${rel.id} is already installed`);
  const need = rel.size + expectedBytes(rel);
  if (freeBytes(dir) < need) throw new Error(`not enough free space: about ${need >= 1e9 ? `${(need / 1e9).toFixed(1)} GB` : `${Math.ceil(need / 1e6)} MB`} is needed`);
  const local = rel.url.startsWith('file:');
  const dl = path.join(dir, '.downloading'), tmp = path.join(dir, '.unpacking', rel.id), file = local ? fileURLToPath(rel.url) : path.join(dl, rel.asset);
  fs.mkdirSync(dl, { recursive: true });
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  try {
    const sha = local ? await hashFile(file, onProgress) : await download(rel.url, file, rel.size, onProgress, signal, rel.sha512 ? 'sha512' : 'sha256');
    const want = local ? sha : rel.sha512 ?? rel.sha256;
    onProgress({ phase: 'verify', done: 0, total: 1 });
    if (sha !== want) throw new Error(`checksum mismatch — the download was damaged or altered, so it was deleted (expected ${want.slice(0, 12)}…, got ${sha.slice(0, 12)}…)`);
    const tick = (files: number) => onProgress({ phase: 'unpack', done: files, total: 0 });
    const stats: UnpackStats = rel.format === 'zip' ? await extractZip(file, tmp, tick, signal)
      : rel.format === 'tar.gz' ? await extractTarGz(file, tmp, tick, signal)
      : rel.format === 'gz' ? await extractGzProgram(file, path.join(tmp, rel.id), (steps.program ?? rel.name) + (process.platform === 'win32' ? '.exe' : ''), signal)
      : await extractTarZst(file, tmp, tick, signal);
    const tops = fs.readdirSync(tmp).filter((n) => !n.startsWith('.'));
    const root = tops.length === 1 && fs.statSync(path.join(tmp, tops[0])).isDirectory() ? path.join(tmp, tops[0]) : tmp;
    const exe = (n: string) => path.join(root, 'bin', process.platform === 'win32' ? `${n}.exe` : n);
    const ok = steps.check ? steps.check(root) : fs.existsSync(exe(rel.kind === 'clangd' ? 'clangd' : 'clang'));
    if (!ok) throw new Error('the archive does not contain the expected programs');
    const note = (await steps.prepare?.(root, onProgress, signal)) || undefined;
    const manifest: PackManifest = {
      id: rel.id, kind: rel.kind, name: rel.name, version: rel.version, bin: steps.bin ?? 'bin', source: rel.source, asset: rel.asset,
      sha256: want, bytes: duSync(root), installedAt: new Date().toISOString(), note,
    };
    fs.writeFileSync(path.join(root, MANIFEST), JSON.stringify(manifest, null, 1));
    fs.rmSync(final, { recursive: true, force: true });
    fs.renameSync(root, final);
    onProgress({ phase: 'done', done: 1, total: 1, note: [stats.refused.length ? `${stats.refused.length} unsafe entries were skipped` : '', note ?? ''].filter(Boolean).join(' · ') || undefined });
    return manifest;
  } finally {
    if (!local) fs.rmSync(file, { force: true });
    fs.rmSync(path.join(dir, '.unpacking'), { recursive: true, force: true });
  }
}

export function removePack(dir: string, id: string) {
  const p = path.join(dir, id);
  if (!insideDir(dir, p) || ![MANIFEST, 'lithograph-pack.json'].some((m) => fs.existsSync(path.join(p, m)))) throw new Error(`${id} is not an installed pack`);
  makeWritable(p);
  fs.rmSync(p, { recursive: true, force: true });
}

function makeWritable(dir: string) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    try { if (e.isDirectory()) { fs.chmodSync(p, 0o755); makeWritable(p); } } catch {  }
  }
}

export const packExe = (dir: string, m: PackManifest, prog: string) => {
  const p = path.join(dir, m.id, m.bin, process.platform === 'win32' ? `${prog}.exe` : prog);
  return fs.existsSync(p) ? p : null;
};
