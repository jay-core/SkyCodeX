// Language packs: toolchains and clangd versions installed into one folder beside the app.
// Installing downloads an official release, checks GitHub's published SHA-256, unpacks it in-process
// and renames it into place. Nothing runs from the archive and nothing outside the folder changes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { extractZip, extractTarZst, UnpackStats } from './unpack';

export type PackKind = 'toolchain' | 'clangd';
export interface PackManifest {
  id: string; kind: PackKind; name: string; version: string; bin: string;
  source: string; asset: string; sha256: string; bytes: number; installedAt: string;
}
export interface Release { kind: PackKind; name: string; version: string; asset: string; url: string; size: number; sha256: string; format: 'zip' | 'tar.zst'; source: string; id: string }
export type Progress = { phase: 'download' | 'verify' | 'unpack' | 'done' | 'failed' | 'cancelled'; done: number; total: number; note?: string };

export const MANIFEST = 'lithograph-pack.json';

/** language_packs beside the app (or the project in development); the portable data folder when that is read-only. */
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

export function listPacks(dir: string): PackManifest[] {
  const out: PackManifest[] = [];
  for (const d of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (d.startsWith('.')) continue;
    try { out.push(JSON.parse(fs.readFileSync(path.join(dir, d, MANIFEST), 'utf8'))); } catch { /* not a pack */ }
  }
  return out.sort((a, b) => a.kind.localeCompare(b.kind) || compareVersions(b.version, a.version));
}

/** Numeric, part by part: "23.1.4" > "23.1.10" is false. Dates (llvm-mingw) compare the same way. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.\-]/).map((x) => parseInt(x, 10) || 0), pb = b.split(/[.\-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

// ---------- where each pack comes from ----------
export interface Source { repo: string; name: string; match: (asset: string) => { version: string; format: Release['format'] } | null }

/** The official release assets that fit this OS and processor. Only formats unpacked in-process (.zip, .tar.zst). */
export function sourceFor(kind: PackKind, platform: NodeJS.Platform, arch: string): Source | null {
  if (kind === 'clangd') {
    const os = platform === 'darwin' ? 'mac' : platform === 'win32' ? 'windows' : platform === 'linux' && arch === 'x64' ? 'linux' : null;
    if (!os) return null;
    const re = new RegExp(`^clangd-${os}-(\\d+\\.\\d+\\.\\d+)\\.zip$`);
    return { repo: 'clangd/clangd', name: 'clangd', match: (a) => { const m = a.match(re); return m ? { version: m[1], format: 'zip' } : null; } };
  }
  if (platform === 'win32') {   // LLVM's own Windows build needs Visual Studio's libraries; llvm-mingw carries its own
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
/** Releases for this machine, newest first (the GitHub API, cached for ten minutes). */
export async function availableReleases(kind: PackKind, platform = process.platform, arch = process.arch): Promise<Release[]> {
  const src = sourceFor(kind, platform, arch);
  if (!src) return [];
  const hit = cache.get(src.repo);
  if (hit && Date.now() - hit.at < 600_000) return hit.list;
  const res = await fetch(`https://api.github.com/repos/${src.repo}/releases?per_page=40`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Lithograph' } });
  if (!res.ok) throw new Error(res.status === 403 ? 'GitHub is limiting requests right now — try again in a while' : `GitHub answered ${res.status}`);
  const list: Release[] = [];
  for (const r of (await res.json()) as any[]) {
    if (r.prerelease || r.draft) continue;
    for (const a of r.assets ?? []) {
      const m = src.match(a.name);
      if (!m || !/^sha256:[0-9a-f]{64}$/.test(a.digest ?? '')) continue;   // never offer a file without a published checksum
      list.push({ kind, name: src.name, version: m.version, asset: a.name, url: a.browser_download_url, size: a.size, sha256: a.digest.slice(7), format: m.format, source: `github.com/${src.repo}`, id: `${src.name}-${m.version}` });
    }
  }
  list.sort((a, b) => compareVersions(b.version, a.version));
  cache.set(src.repo, { at: Date.now(), list });
  return list;
}

/** Room the unpacked pack is expected to need, from the download size. */
export const expectedBytes = (r: Pick<Release, 'size' | 'format'>) => r.size * (r.format === 'zip' ? 3 : 6);

export function freeBytes(dir: string): number {
  try { const s = fs.statfsSync(dir); return s.bavail * s.bsize; } catch { return Infinity; }
}

// ---------- install ----------
const insideDir = (dir: string, p: string) => { const r = path.resolve(p), d = path.resolve(dir); return r.startsWith(d + path.sep); };

async function download(url: string, to: string, total: number, onProgress: (p: Progress) => void, signal: AbortSignal): Promise<string> {
  const res = await fetch(url, { signal, headers: { 'User-Agent': 'Lithograph' } });
  if (!res.ok || !res.body) throw new Error(`download failed (${res.status})`);
  const hash = crypto.createHash('sha256'), out = fs.createWriteStream(to);
  let done = 0, last = 0;
  try {
    for await (const chunk of Readable.fromWeb(res.body as any)) {
      hash.update(chunk as Buffer);
      if (!out.write(chunk)) await new Promise<void>((r) => out.once('drain', () => r()));
      done += (chunk as Buffer).length;
      if (done - last > 1 << 20 || done === total) { last = done; onProgress({ phase: 'download', done, total }); }
    }
  } finally { await new Promise<void>((r) => out.end(() => r())); }
  return hash.digest('hex');
}

function duSync(dir: string): number {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) n += duSync(p); else if (e.isFile()) n += fs.statSync(p).size;
  }
  return n;
}

/** Downloads, verifies and unpacks a release into dir/<id>. A failure or cancel leaves nothing behind. */
export async function installRelease(rel: Release, dir: string, onProgress: (p: Progress) => void, signal: AbortSignal): Promise<PackManifest> {
  const final = path.join(dir, rel.id);
  if (!insideDir(dir, final)) throw new Error('bad pack name');
  if (fs.existsSync(path.join(final, MANIFEST))) throw new Error(`${rel.id} is already installed`);
  const need = rel.size + expectedBytes(rel);
  if (freeBytes(dir) < need) throw new Error(`not enough free space: about ${Math.ceil(need / 1e9)} GB is needed`);
  const dl = path.join(dir, '.downloading'), tmp = path.join(dir, '.unpacking', rel.id), file = path.join(dl, rel.asset);
  fs.mkdirSync(dl, { recursive: true });
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  try {
    const sha = await download(rel.url, file, rel.size, onProgress, signal);
    onProgress({ phase: 'verify', done: 0, total: 1 });
    if (sha !== rel.sha256) throw new Error(`checksum mismatch — the download was damaged or altered, so it was deleted (expected ${rel.sha256.slice(0, 12)}…, got ${sha.slice(0, 12)}…)`);
    const tick = (files: number) => onProgress({ phase: 'unpack', done: files, total: 0 });
    const stats: UnpackStats = rel.format === 'zip' ? await extractZip(file, tmp, tick, signal) : await extractTarZst(file, tmp, tick, signal);
    // archives hold one top folder; that folder becomes the pack
    const tops = fs.readdirSync(tmp).filter((n) => !n.startsWith('.'));
    const root = tops.length === 1 && fs.statSync(path.join(tmp, tops[0])).isDirectory() ? path.join(tmp, tops[0]) : tmp;
    const exe = (n: string) => path.join(root, 'bin', process.platform === 'win32' ? `${n}.exe` : n);
    if (!fs.existsSync(exe(rel.kind === 'clangd' ? 'clangd' : 'clang'))) throw new Error('the archive does not contain the expected programs');
    const manifest: PackManifest = {
      id: rel.id, kind: rel.kind, name: rel.name, version: rel.version, bin: 'bin', source: rel.source, asset: rel.asset,
      sha256: rel.sha256, bytes: duSync(root), installedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(root, MANIFEST), JSON.stringify(manifest, null, 1));
    fs.rmSync(final, { recursive: true, force: true });
    fs.renameSync(root, final);
    onProgress({ phase: 'done', done: 1, total: 1, note: stats.refused.length ? `${stats.refused.length} unsafe entries were skipped` : undefined });
    return manifest;
  } finally {
    fs.rmSync(file, { force: true });
    fs.rmSync(path.join(dir, '.unpacking'), { recursive: true, force: true });
  }
}

export function removePack(dir: string, id: string) {
  const p = path.join(dir, id);
  if (!insideDir(dir, p) || !fs.existsSync(path.join(p, MANIFEST))) throw new Error(`${id} is not an installed pack`);
  fs.rmSync(p, { recursive: true, force: true });
}

/** bin folders of a pack, if it has the program. */
export const packExe = (dir: string, m: PackManifest, prog: string) => {
  const p = path.join(dir, m.id, m.bin, process.platform === 'win32' ? `${prog}.exe` : prog);
  return fs.existsSync(p) ? p : null;
};
