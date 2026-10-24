// Memory view data: sizes from the built binary, stack frames from -fstack-usage, heap sites from the source.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseBinary, totals, Kind, BinaryInfo } from './binary';
import { listSources } from './files';

export interface MemoryReport {
  binary: string;
  format: string;
  arch: string;
  note?: string;
  storage: number;
  ram: number;
  byKind: Record<Kind, number>;
  largestRam: { name: string; size: number; kind: Kind }[];
  largestStorage: { name: string; size: number; kind: Kind }[];
  symbolSizesExact: boolean;
  stack: { fn: string; file: string; bytes: number; qualifier: string }[];
  stackNote: string;
  heap: { file: string; line: number; call: string }[];
}

const MAGIC = [0x7f454c46, 0xcffaedfe, 0xcefaedfe, 0xcafebabe];

/** Linked programs anywhere under root (ELF, Mach-O, PE), newest first. Object files and libraries are left out. */
export function findBinaries(root: string, maxDirs = 3000): string[] {
  const out: { p: string; t: number }[] = [];
  let dirs = 0;
  const skip = new Set(['.git', 'node_modules', '.cache', 'CMakeFiles', '.idea', '.vscode', '__pycache__']);
  const walk = (d: string, depth: number) => {
    if (depth > 8 || ++dirs > maxDirs) return;
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!skip.has(e.name) && !e.name.startsWith('.')) walk(p, depth + 1); continue; }
      if (!e.isFile() || /\.(o|obj|a|lib|so|dylib|dll|d|su|json|txt|c|cc|cpp|h|hpp|md)$/i.test(e.name)) continue;
      try {
        const st = fs.statSync(p);
        if (st.size < 64) continue;
        const named = /\.(elf|axf|out|exe)$/i.test(e.name);
        if (!named && !(st.mode & 0o111)) continue;
        const fd = fs.openSync(p, 'r'); const head = Buffer.alloc(4); fs.readSync(fd, head, 0, 4, 0); fs.closeSync(fd);
        if (MAGIC.includes(head.readUInt32BE(0)) || head.toString('latin1', 0, 2) === 'MZ') out.push({ p, t: st.mtimeMs });
      } catch { /* unreadable entries are skipped */ }
    }
  };
  walk(root, 0);
  return out.sort((a, b) => b.t - a.t).map((x) => x.p);
}

function demangle(names: string[]): string[] {
  const mangled = names.map((n) => (n.startsWith('_Z') || n.startsWith('__Z') ? n : ''));
  if (!mangled.some(Boolean)) return names;
  const tool = process.platform === 'darwin' ? 'c++filt' : 'c++filt';
  const r = spawnSync(tool, [], { input: names.join('\n'), encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0 || !r.stdout) return names;
  const out = r.stdout.split('\n');
  return names.map((n, i) => out[i] || n);
}

/** Reads GCC/Clang -fstack-usage output (*.su) anywhere under the build folders. */
export function readStackUsage(root: string): MemoryReport['stack'] {
  const out: MemoryReport['stack'] = [];
  const walk = (d: string, depth: number) => {
    if (depth > 8) return;
    for (const e of (() => { try { return fs.readdirSync(d, { withFileTypes: true }); } catch { return []; } })()) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!e.name.startsWith('.') && e.name !== 'node_modules') walk(p, depth + 1); }
      else if (e.name.endsWith('.su')) {
        for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
          // GCC:   "src/server.cpp:30:6:void Server::start()<TAB>48<TAB>static"
          // Clang: "src/server.cpp:30:_ZN6Server5startEv<TAB>48<TAB>static"
          const m = line.match(/^(.*?):(\d+):(?:(\d+):)?(.*?)\t(\d+)\t(\S+)/);
          if (!m) continue;
          const file = m[1];
          if (path.isAbsolute(file) && !file.startsWith(root)) continue;   // system and SDK headers
          out.push({ file: `${path.isAbsolute(file) ? path.relative(root, file) : file}:${m[2]}`, fn: m[4], bytes: Number(m[5]), qualifier: m[6] });
        }
      }
    }
  };
  for (const e of fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }) : [])
    if (e.isDirectory() && /^(build|out|cmake-build-)/i.test(e.name)) walk(path.join(root, e.name), 0);
  const names = demangle(out.map((s) => s.fn));
  const seen = new Set<string>();
  return out.map((s, i) => ({ ...s, fn: names[i] }))
    .filter((s) => { const k = `${s.file} ${s.fn}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => b.bytes - a.bytes);
}

/** Removes comments and string/char literals, keeping line breaks so line numbers stay right. */
export function stripCode(src: string): string {
  let out = '', i = 0;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') out += '\n'; i++; } i += 2; continue; }
    if (c === '"' || c === "'") {
      const q = c; i++;
      while (i < src.length && src[i] !== q && src[i] !== '\n') { if (src[i] === '\\') i++; i++; }
      i++; out += q + q; continue;
    }
    out += c; i++;
  }
  return out;
}

const HEAP_RE = /\b(malloc|calloc|realloc|aligned_alloc|strdup|free|make_shared|make_unique|allocate_shared)\s*(<[^;()]*>)?\s*\(|\bnew\s+(?!\()[A-Za-z_:][\w:<>, ]*\s*[\[({;]|\bnew\s*\(/g;

/** Allocation sites found by scanning source text (syntactic: macros and templates can hide or add hits). */
export function scanHeap(root: string, cap = 2000): MemoryReport['heap'] {
  const out: MemoryReport['heap'] = [];
  for (const f of listSources(root)) {
    const code = stripCode(fs.readFileSync(f, 'utf8'));
    const lines = code.split('\n');
    lines.forEach((l, i) => {
      if (/^\s*#/.test(l)) return;
      for (const m of l.matchAll(HEAP_RE)) {
        const call = m[1] ?? 'new';
        if (call === 'new' && /operator\s+new/.test(l)) continue;
        out.push({ file: path.relative(root, f), line: i + 1, call });
        if (out.length >= cap) return;
      }
    });
    if (out.length >= cap) break;
  }
  return out;
}

export function analyze(binPath: string, root: string): MemoryReport {
  const info: BinaryInfo = parseBinary(fs.readFileSync(binPath));
  const t = totals(info);
  const names = demangle(info.symbols.map((s) => s.name));
  const syms = info.symbols.map((s, i) => ({ name: names[i], size: s.size, kind: s.kind }));
  const ram = syms.filter((s) => s.kind === 'data' || s.kind === 'bss').sort((a, b) => b.size - a.size).slice(0, 200);
  const storage = syms.filter((s) => s.kind !== 'bss').sort((a, b) => b.size - a.size).slice(0, 200);
  const stack = readStackUsage(root);
  return {
    binary: binPath, format: info.format, arch: info.arch, note: info.note,
    storage: t.storage, ram: t.ram, byKind: t.byKind,
    largestRam: ram, largestStorage: storage, symbolSizesExact: info.symbolSizesExact,
    stack: stack.slice(0, 200),
    stackNote: stack.length ? '' : 'No stack data yet. Build with -fstack-usage (GCC or Clang) to see per-function frame sizes.',
    heap: scanHeap(root),
  };
}
