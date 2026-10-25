// File access for the editor: atomic saves, directory listing, hot-exit buffers.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** Writes via a temporary file in the same folder, then renames it over the target. */
export function atomicWrite(file: string, text: string): void {
  const dir = path.dirname(file);
  const tmp = path.join(dir, `.${path.basename(file)}.skycodex-${process.pid}-${Date.now()}.tmp`);
  let mode: number | undefined;
  try { mode = fs.statSync(file).mode; } catch { /* new file */ }
  const fd = fs.openSync(tmp, 'w', mode ?? 0o644);
  try {
    fs.writeFileSync(fd, text, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(tmp, file);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
}

export interface DirEntry {
  name: string;
  path: string;
  dir: boolean;
}

const HIDDEN = new Set(['.git', 'node_modules', '.cache', '.DS_Store', '.idea', '.vscode']);

export function listDir(dir: string): DirEntry[] {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries
    .filter((e) => !HIDDEN.has(e.name) && !e.name.endsWith('.skycodex.tmp'))
    .map((e) => ({ name: e.name, path: path.join(dir, e.name), dir: e.isDirectory() }))
    .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
}

const SOURCE_EXT = new Set(['.rs', '.py', '.pyi', '.go', '.c', '.cc', '.cpp', '.cxx', '.c++', '.h', '.hh', '.hpp', '.hxx', '.ipp', '.inl']);
export const isSource = (p: string) => SOURCE_EXT.has(path.extname(p).toLowerCase());

/** All C/C++ files under root, skipping build output and hidden folders. Capped for huge trees. */
export function listSources(root: string, cap = 20000): string[] {
  const out: string[] = [];
  const skip = /^(build|out|cmake-build-.*|\.git|node_modules|third_party|external|vendor)$/i;
  const walk = (d: string) => {
    if (out.length >= cap) return;
    for (const e of listDir(d)) {
      if (e.dir) { if (!skip.test(e.name) && !e.name.startsWith('.')) walk(e.path); }
      else if (isSource(e.path)) out.push(e.path);
    }
  };
  walk(root);
  return out;
}

// ---- hot exit: unsaved buffers survive crashes and restarts ----

const bufferName = (file: string) => crypto.createHash('sha1').update(file).digest('hex').slice(0, 16) + '.json';

export function saveBuffer(bufDir: string, file: string, text: string): void {
  atomicWrite(path.join(bufDir, bufferName(file)), JSON.stringify({ file, text, savedAt: Date.now() }));
}

export function dropBuffer(bufDir: string, file: string): void {
  fs.rmSync(path.join(bufDir, bufferName(file)), { force: true });
}

export function loadBuffers(bufDir: string): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  for (const name of fs.existsSync(bufDir) ? fs.readdirSync(bufDir) : []) {
    if (!name.endsWith('.json')) continue;
    try {
      const b = JSON.parse(fs.readFileSync(path.join(bufDir, name), 'utf8'));
      if (typeof b.file === 'string' && typeof b.text === 'string') out.push({ file: b.file, text: b.text });
    } catch { /* a damaged buffer is skipped, never fatal */ }
  }
  return out;
}
