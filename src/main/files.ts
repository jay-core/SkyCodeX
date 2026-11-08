import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function atomicWrite(file: string, text: string | Buffer): void {
  const dir = path.dirname(file);
  const tmp = path.join(dir, `.${path.basename(file)}.skycodex-${process.pid}-${Date.now()}.tmp`);
  let mode: number | undefined;
  try { mode = fs.statSync(file).mode; } catch {  }
  const fd = fs.openSync(tmp, 'w', mode ?? 0o644);
  try {
    if (typeof text === 'string') fs.writeFileSync(fd, text, 'utf8'); else fs.writeFileSync(fd, text);
    fs.fsyncSync(fd);
  } catch (e) {
    try { fs.closeSync(fd); } catch {  }
    fs.rmSync(tmp, { force: true });
    throw e;
  }
  fs.closeSync(fd);
  try {
    fs.renameSync(tmp, file);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
}

export function slashPath(p: string, platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? p.replace(/\\/g, '/').replace(/^([a-z]):/, (_m, d: string) => `${d.toUpperCase()}:`) : p;
}

export interface DirEntry {
  name: string;
  path: string;
  dir: boolean;
}

const HIDDEN = new Set(['.git', 'node_modules', '.cache', '.DS_Store', '.idea', '.vscode']);

function shapeDir(dir: string, entries: fs.Dirent[]): DirEntry[] {
  return entries
    .filter((e) => !HIDDEN.has(e.name) && !e.name.endsWith('.skycodex.tmp') && !/\.skycodex-\d+-\d+\.tmp$/.test(e.name))
    .map((e) => ({ name: e.name, path: slashPath(path.join(dir, e.name)), dir: e.isDirectory() }))
    .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
}

export function listDir(dir: string): DirEntry[] {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return shapeDir(dir, entries);
}

const SOURCE_EXT = new Set(['.rs', '.py', '.pyi', '.go', '.c', '.cc', '.cpp', '.cxx', '.c++', '.h', '.hh', '.hpp', '.hxx', '.ipp', '.inl']);
export const isSource = (p: string) => SOURCE_EXT.has(path.extname(p).toLowerCase());

export function listSources(root: string, cap = 20000): string[] {
  return listFiles(root, cap, isSource);
}

const SKIP_DIRS = /^(build|out|cmake-build-.*|\.git|node_modules|third_party|external|vendor)$/i;

export function listFiles(root: string, cap = 50000, keep: (p: string) => boolean = () => true): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    if (out.length >= cap) return;
    for (const e of listDir(d)) {
      if (e.dir) { if (!SKIP_DIRS.test(e.name) && !e.name.startsWith('.')) walk(e.path); }
      else if (keep(e.path) && out.length < cap) out.push(e.path);
    }
  };
  walk(root);
  return out;
}

export async function listSourcesAsync(root: string, cap = 20000): Promise<string[]> {
  const out: string[] = [];
  const walk = async (d: string) => {
    if (out.length >= cap) return;
    let entries: fs.Dirent[];
    try { entries = await fs.promises.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of shapeDir(d, entries)) {
      if (e.dir) { if (!SKIP_DIRS.test(e.name) && !e.name.startsWith('.')) await walk(e.path); }
      else if (isSource(e.path) && out.length < cap) out.push(e.path);
    }
  };
  await walk(root);
  return out;
}

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
    } catch {  }
  }
  return out;
}
