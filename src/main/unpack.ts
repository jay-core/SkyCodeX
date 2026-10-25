// Unpacks .zip and .tar(.zst) archives in-process. Every entry must land inside the destination:
// absolute paths, ".." segments and links that point outside are refused, never written.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export interface UnpackStats { files: number; dirs: number; links: number; refused: string[] }
export type UnpackProgress = (files: number) => void;

/** The absolute path for an archive entry inside dest, or null when it would escape. */
export function safeJoin(dest: string, name: string): string | null {
  const clean = name.replace(/\\/g, '/').replace(/^(\.\/)+/, '');
  if (!clean || clean.startsWith('/') || /^[A-Za-z]:/.test(clean)) return null;
  if (clean.split('/').some((s) => s === '..')) return null;
  const out = path.resolve(dest, clean);
  const root = path.resolve(dest);
  return out === root || out.startsWith(root + path.sep) ? out : null;
}

/** A link is kept only when what it points at is inside dest too. */
function linkInside(dest: string, at: string, target: string): boolean {
  if (path.isAbsolute(target) || /^[A-Za-z]:/.test(target)) return false;
  const to = path.resolve(path.dirname(at), target), root = path.resolve(dest);
  return to === root || to.startsWith(root + path.sep);
}

function writeLink(dest: string, at: string, target: string, stats: UnpackStats, name: string) {
  if (!linkInside(dest, at, target)) { stats.refused.push(`${name} → ${target}`); return; }
  fs.mkdirSync(path.dirname(at), { recursive: true });
  try { fs.rmSync(at, { force: true }); fs.symlinkSync(target, at); stats.links++; }
  catch { stats.refused.push(`${name} (links not allowed here)`); }
}

const fileMode = (mode: number) => ((mode & 0o777) || 0o644) | 0o600;   // the owner can always read and write

// ---------- zip ----------
interface ZipEntry { name: string; method: number; csize: number; usize: number; offset: number; mode: number; unix: boolean }

function zipEntries(fd: number, size: number): ZipEntry[] {
  // end of central directory: last 22 bytes + up to 64 KB of comment
  const tail = Math.min(size, 22 + 65535), buf = Buffer.alloc(tail);
  fs.readSync(fd, buf, 0, tail, size - tail);
  let e = -1;
  for (let i = tail - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('not a zip archive');
  let count = buf.readUInt16LE(e + 10), cdSize = buf.readUInt32LE(e + 12), cdOff = buf.readUInt32LE(e + 16);
  if (cdOff === 0xffffffff || count === 0xffff) {   // zip64
    const loc = e - 20;
    if (loc < 0 || buf.readUInt32LE(loc) !== 0x07064b50) throw new Error('zip64 archive without its locator');
    const z64 = Number(buf.readBigUInt64LE(loc + 8)), rec = Buffer.alloc(56);
    fs.readSync(fd, rec, 0, 56, z64);
    count = Number(rec.readBigUInt64LE(32)); cdSize = Number(rec.readBigUInt64LE(40)); cdOff = Number(rec.readBigUInt64LE(48));
  }
  const cd = Buffer.alloc(cdSize);
  fs.readSync(fd, cd, 0, cdSize, cdOff);
  const out: ZipEntry[] = [];
  for (let p = 0, i = 0; i < count; i++) {
    if (cd.readUInt32LE(p) !== 0x02014b50) throw new Error('damaged zip directory');
    const madeBy = cd.readUInt16LE(p + 4) >> 8, method = cd.readUInt16LE(p + 10);
    let csize = cd.readUInt32LE(p + 20), usize = cd.readUInt32LE(p + 24);
    const nlen = cd.readUInt16LE(p + 28), xlen = cd.readUInt16LE(p + 30), clen = cd.readUInt16LE(p + 32);
    const attrs = cd.readUInt32LE(p + 38);
    let offset = cd.readUInt32LE(p + 42);
    const name = cd.toString('utf8', p + 46, p + 46 + nlen);
    // zip64 sizes and offset live in extra field 0x0001, in this order, only for the fields that overflowed
    for (let x = p + 46 + nlen; x < p + 46 + nlen + xlen;) {
      const id = cd.readUInt16LE(x), len = cd.readUInt16LE(x + 2);
      if (id === 1) {
        let q = x + 4;
        if (usize === 0xffffffff) { usize = Number(cd.readBigUInt64LE(q)); q += 8; }
        if (csize === 0xffffffff) { csize = Number(cd.readBigUInt64LE(q)); q += 8; }
        if (offset === 0xffffffff) { offset = Number(cd.readBigUInt64LE(q)); }
      }
      x += 4 + len;
    }
    out.push({ name, method, csize, usize, offset, mode: attrs >>> 16, unix: madeBy === 3 });
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

export async function extractZip(file: string, dest: string, onProgress?: UnpackProgress, signal?: AbortSignal): Promise<UnpackStats> {
  const stats: UnpackStats = { files: 0, dirs: 0, links: 0, refused: [] };
  const fd = fs.openSync(file, 'r');
  try {
    const entries = zipEntries(fd, fs.fstatSync(fd).size);
    for (const en of entries) {
      if (signal?.aborted) throw new Error('cancelled');
      const at = safeJoin(dest, en.name);
      if (!at) { stats.refused.push(en.name); continue; }
      const hdr = Buffer.alloc(30);
      fs.readSync(fd, hdr, 0, 30, en.offset);
      if (hdr.readUInt32LE(0) !== 0x04034b50) throw new Error(`damaged entry: ${en.name}`);
      const start = en.offset + 30 + hdr.readUInt16LE(26) + hdr.readUInt16LE(28);
      const kind = en.unix ? en.mode & 0o170000 : 0;
      if (en.name.endsWith('/') || kind === 0o040000) { fs.mkdirSync(at, { recursive: true }); stats.dirs++; continue; }
      if (en.method !== 0 && en.method !== 8) throw new Error(`unsupported compression in ${en.name}`);
      const raw = () => {
        const s = fs.createReadStream('', { fd, start, end: start + en.csize - 1, autoClose: false });
        return en.method === 8 ? s.pipe(zlib.createInflateRaw()) : s;
      };
      if (kind === 0o120000) {   // a symbolic link: its content is the target
        const chunks: Buffer[] = [];
        for await (const c of en.csize ? raw() : Readable.from([])) chunks.push(c as Buffer);
        writeLink(dest, at, Buffer.concat(chunks).toString('utf8'), stats, en.name);
        continue;
      }
      fs.mkdirSync(path.dirname(at), { recursive: true });
      if (en.csize) await pipeline(raw(), fs.createWriteStream(at, { mode: fileMode(en.unix ? en.mode : 0o644) }), { signal });
      else fs.writeFileSync(at, '');
      if (en.unix) fs.chmodSync(at, fileMode(en.mode));
      stats.files++; onProgress?.(stats.files);
    }
  } finally { fs.closeSync(fd); }
  return stats;
}

// ---------- tar ----------
const octal = (b: Buffer, a: number, n: number) => {
  if (b[a] & 0x80) {   // base-256 for very large sizes
    let v = 0;
    for (let i = a + 1; i < a + n; i++) v = v * 256 + b[i];
    return v;
  }
  const s = b.toString('ascii', a, a + n).replace(/\0.*$/, '').trim();
  return s ? parseInt(s, 8) : 0;
};
const cstr = (b: Buffer, a: number, n: number) => b.toString('utf8', a, a + n).replace(/\0.*$/s, '');

function paxPath(data: Buffer): { path?: string; linkpath?: string; size?: number } {
  const out: { path?: string; linkpath?: string; size?: number } = {};
  let p = 0;
  while (p < data.length) {
    const sp = data.indexOf(0x20, p);
    if (sp < 0) break;
    const len = parseInt(data.toString('ascii', p, sp), 10);
    if (!len) break;
    const rec = data.toString('utf8', sp + 1, p + len - 1), eq = rec.indexOf('=');
    const k = rec.slice(0, eq), v = rec.slice(eq + 1);
    if (k === 'path') out.path = v; else if (k === 'linkpath') out.linkpath = v; else if (k === 'size') out.size = Number(v);
    p += len;
  }
  return out;
}

/** Streams a tar archive (already decompressed) into dest. */
export async function extractTar(input: Readable, dest: string, onProgress?: UnpackProgress, signal?: AbortSignal): Promise<UnpackStats> {
  const stats: UnpackStats = { files: 0, dirs: 0, links: 0, refused: [] };
  let buf: Buffer = Buffer.alloc(0), ended = false;
  const it = input[Symbol.asyncIterator]();
  const need = async (n: number) => {
    while (buf.length < n && !ended) {
      if (signal?.aborted) throw new Error('cancelled');
      const r = await it.next();
      if (r.done) ended = true; else buf = buf.length ? Buffer.concat([buf, r.value as Buffer]) : (r.value as Buffer);
    }
    return buf.length >= n;
  };
  const take = (n: number) => { const out = buf.subarray(0, n); buf = buf.subarray(n); return out; };
  /** Moves `size` bytes (plus padding to 512) to a sink, chunk by chunk. */
  const body = async (size: number, sink?: (c: Buffer) => void | Promise<void>) => {
    let left = size;
    while (left > 0) {
      if (!(await need(1))) throw new Error('archive ends in the middle of a file');
      const c = take(Math.min(left, buf.length));
      left -= c.length;
      if (sink) await sink(c);
    }
    const pad = (512 - (size % 512)) % 512;
    if (pad) { if (!(await need(pad))) throw new Error('archive is cut short'); take(pad); }
  };
  let longName: string | undefined, longLink: string | undefined, pax: ReturnType<typeof paxPath> = {};
  while (await need(512)) {
    const h = take(512);
    if (h.every((x) => x === 0)) break;   // end of archive
    const type = String.fromCharCode(h[156] || 48);
    let size = octal(h, 124, 12);
    const ustar = h.toString('ascii', 257, 262) === 'ustar';
    let name = cstr(h, 0, 100);
    if (ustar && h[345]) name = `${cstr(h, 345, 155)}/${name}`;
    let link = cstr(h, 157, 100);
    if (type === 'L' || type === 'K' || type === 'x' || type === 'g') {
      const parts: Buffer[] = [];
      await body(size, (c) => { parts.push(Buffer.from(c)); });
      const data = Buffer.concat(parts);
      if (type === 'L') longName = data.toString('utf8').replace(/\0.*$/s, '');
      else if (type === 'K') longLink = data.toString('utf8').replace(/\0.*$/s, '');
      else if (type === 'x') pax = paxPath(data);
      continue;
    }
    name = pax.path ?? longName ?? name;
    link = pax.linkpath ?? longLink ?? link;
    if (pax.size !== undefined) size = pax.size;
    longName = longLink = undefined; pax = {};
    const at = safeJoin(dest, name);
    if (!at) { stats.refused.push(name); await body(size); continue; }
    if (type === '5') { fs.mkdirSync(at, { recursive: true }); stats.dirs++; await body(size); continue; }
    if (type === '2') { writeLink(dest, at, link, stats, name); await body(size); continue; }
    if (type === '1') {   // hard link: a copy of a file already unpacked
      const from = safeJoin(dest, link);
      if (from && fs.existsSync(from)) { fs.mkdirSync(path.dirname(at), { recursive: true }); fs.copyFileSync(from, at); stats.files++; }
      else stats.refused.push(`${name} ⇒ ${link}`);
      await body(size); continue;
    }
    if (type !== '0' && type !== '7') { await body(size); continue; }   // devices, fifos: never needed
    fs.mkdirSync(path.dirname(at), { recursive: true });
    const out = fs.createWriteStream(at, { mode: fileMode(octal(h, 100, 8)) });
    await body(size, (c) => new Promise<void>((res, rej) => { out.write(c, (e) => (e ? rej(e) : res())); }));
    await new Promise<void>((res, rej) => out.end((e?: Error | null) => (e ? rej(e) : res())));
    fs.chmodSync(at, fileMode(octal(h, 100, 8)));
    stats.files++; onProgress?.(stats.files);
  }
  return stats;
}

/** .tar.zst through Node's own zstd decoder. */
export function extractTarZst(file: string, dest: string, onProgress?: UnpackProgress, signal?: AbortSignal) {
  const z = (zlib as unknown as { createZstdDecompress?: () => Transform }).createZstdDecompress;
  if (!z) throw new Error('this build cannot read .zst archives');
  return extractTar(fs.createReadStream(file).pipe(z()), dest, onProgress, signal);
}

/** .tar.gz / .tgz through Node's gzip decoder. */
export function extractTarGz(file: string, dest: string, onProgress?: UnpackProgress, signal?: AbortSignal) {
  return extractTar(fs.createReadStream(file).pipe(zlib.createGunzip()), dest, onProgress, signal);
}

/** A single gzipped program (rust-analyzer ships this way): written to dest/bin/<name>, executable. */
export async function extractGzProgram(file: string, dest: string, name: string, signal?: AbortSignal): Promise<UnpackStats> {
  const out = path.join(dest, 'bin', name);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const src = fs.createReadStream(file), w = fs.createWriteStream(out, { mode: 0o755 });
    const stop = () => { src.destroy(new Error('cancelled')); };
    signal?.addEventListener('abort', stop, { once: true });
    src.pipe(zlib.createGunzip()).on('error', reject).pipe(w).on('error', reject).on('finish', () => { signal?.removeEventListener('abort', stop); resolve(); });
  });
  return { files: 1, dirs: 1, links: 0, refused: [] };
}
