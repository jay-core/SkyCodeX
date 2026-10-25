// Language packs beyond C/C++: Rust, Python and Go, their language servers, and the offline C++ reference.
// Each comes from the project's own official release, with a published checksum, into language_packs/<id>.
// Anything a pack writes later (Cargo's registry, Go's module cache, pip's cache) is pointed inside the pack too.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { availableReleases, compareVersions, listPacks, InstallSteps, PackKind, PackManifest, Release, Progress } from './packs';

const UA = { 'User-Agent': 'SkyCodeX' };
const win = process.platform === 'win32';
const exe = (n: string) => (win ? `${n}.exe` : n);

export const KIND_INFO: Record<PackKind, { title: string; language: string; what: string }> = {
  toolchain: { title: 'clang', language: 'C and C++', what: 'compiler toolchain' },
  clangd: { title: 'clangd', language: 'C and C++', what: 'language engine' },
  rust: { title: 'Rust', language: 'Rust', what: 'compiler, Cargo, rustfmt and Clippy' },
  'rust-analyzer': { title: 'rust-analyzer', language: 'Rust', what: 'language engine' },
  python: { title: 'Python', language: 'Python', what: 'interpreter and pip' },
  pyright: { title: 'Pyright', language: 'Python', what: 'language engine' },
  go: { title: 'Go', language: 'Go', what: 'compiler and tools, with the gopls language engine' },
};

const cache = new Map<string, { at: number; list: Release[] }>();
async function cached(key: string, f: () => Promise<Release[]>): Promise<Release[]> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 600_000) return hit.list;
  const list = await f();
  cache.set(key, { at: Date.now(), list });
  return list;
}
async function json(url: string, headers: Record<string, string> = {}): Promise<any> {
  const r = await fetch(url, { headers: { ...UA, ...headers } });
  if (!r.ok) throw new Error(r.status === 403 ? 'the server is limiting requests right now — try again in a while' : `${new URL(url).host} answered ${r.status}`);
  return r.json();
}
async function text(url: string): Promise<string> {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${new URL(url).host} answered ${r.status}`);
  return r.text();
}
async function headSize(url: string): Promise<number> {
  const r = await fetch(url, { method: 'HEAD', headers: UA });
  return r.ok ? Number(r.headers.get('content-length') ?? 0) : 0;
}

// ---------- where each one comes from, for this OS and processor ----------
/** Rust's name for this machine. Windows on x64 uses the GNU target, which links without Visual Studio. */
export function rustTarget(platform: NodeJS.Platform, arch: string): string | null {
  const cpu = arch === 'arm64' ? 'aarch64' : arch === 'x64' ? 'x86_64' : null;
  if (!cpu) return null;
  if (platform === 'darwin') return `${cpu}-apple-darwin`;
  if (platform === 'linux') return `${cpu}-unknown-linux-gnu`;
  if (platform === 'win32') return cpu === 'x86_64' ? 'x86_64-pc-windows-gnu' : 'aarch64-pc-windows-msvc';
  return null;
}
/** python-build-standalone's name for this machine. */
export function pythonTriple(platform: NodeJS.Platform, arch: string): string | null {
  const cpu = arch === 'arm64' ? 'aarch64' : arch === 'x64' ? 'x86_64' : null;
  if (!cpu) return null;
  return platform === 'darwin' ? `${cpu}-apple-darwin` : platform === 'linux' ? `${cpu}-unknown-linux-gnu` : platform === 'win32' ? `${cpu}-pc-windows-msvc` : null;
}
export function goPlatform(platform: NodeJS.Platform, arch: string): { os: string; arch: string } | null {
  const os = platform === 'darwin' ? 'darwin' : platform === 'linux' ? 'linux' : platform === 'win32' ? 'windows' : null;
  const a = arch === 'arm64' ? 'arm64' : arch === 'x64' ? 'amd64' : null;
  return os && a ? { os, arch: a } : null;
}

/** The newest python-build-standalone build of each Python version, from one GitHub release's assets. */
export function pythonReleases(assets: { name: string; size: number; digest?: string; browser_download_url: string }[], triple: string): Release[] {
  const re = new RegExp(`^cpython-(\\d+\\.\\d+\\.\\d+)\\+(\\d{8})-${triple.replace(/[-.]/g, '\\$&')}-install_only\\.tar\\.gz$`);
  const best = new Map<string, Release>();
  for (const a of assets) {
    const m = a.name.match(re);
    if (!m || !/^sha256:[0-9a-f]{64}$/.test(a.digest ?? '')) continue;
    const minor = m[1].split('.').slice(0, 2).join('.');
    const r: Release = { kind: 'python', name: 'python', version: m[1], asset: a.name, url: a.browser_download_url, size: a.size, sha256: a.digest!.slice(7), format: 'tar.gz', source: 'github.com/astral-sh/python-build-standalone', id: `python-${m[1]}` };
    const old = best.get(minor);
    if (!old || compareVersions(r.version, old.version) > 0) best.set(minor, r);
  }
  return [...best.values()].sort((a, b) => compareVersions(b.version, a.version));
}

/** Go's own download list (go.dev/dl), which publishes a SHA-256 for every file. */
export function goReleases(list: any[], plat: { os: string; arch: string }): Release[] {
  const out: Release[] = [];
  for (const rel of list) {
    if (!rel.stable) continue;
    const f = (rel.files ?? []).find((x: any) => x.os === plat.os && x.arch === plat.arch && x.kind === 'archive' && /\.(tar\.gz|zip)$/.test(x.filename));
    if (!f || !/^[0-9a-f]{64}$/.test(f.sha256 ?? '')) continue;
    const version = String(rel.version).replace(/^go/, '');
    out.push({ kind: 'go', name: 'go', version, asset: f.filename, url: `https://go.dev/dl/${f.filename}`, size: f.size, sha256: f.sha256, format: f.filename.endsWith('.zip') ? 'zip' : 'tar.gz', source: 'go.dev/dl', id: `go-${version}`, note: 'gopls is then built from proxy.golang.org, checked against Go\'s checksum database' });
  }
  return out;
}

export async function releasesFor(kind: PackKind, platform = process.platform, arch = process.arch): Promise<Release[]> {
  if (kind === 'toolchain' || kind === 'clangd') return availableReleases(kind, platform, arch);
  if (kind === 'rust-analyzer') return cached(kind, async () => {
    const t = rustTarget(platform, arch);
    if (!t) return [];
    const target = platform === 'win32' ? t.replace(/-gnu$/, '-msvc') : t;
    const want = platform === 'win32' ? `rust-analyzer-${target}.zip` : `rust-analyzer-${target}.gz`;
    const rels = await json('https://api.github.com/repos/rust-lang/rust-analyzer/releases?per_page=8', { Accept: 'application/vnd.github+json' });
    const out: Release[] = [];
    for (const r of rels) {
      if (r.prerelease || r.draft || !/^\d{4}-\d{2}-\d{2}$/.test(r.tag_name)) continue;
      const a = (r.assets ?? []).find((x: any) => x.name === want);
      if (!a || !/^sha256:[0-9a-f]{64}$/.test(a.digest ?? '')) continue;
      out.push({ kind, name: 'rust-analyzer', version: r.tag_name, asset: a.name, url: a.browser_download_url, size: a.size, sha256: a.digest.slice(7), format: platform === 'win32' ? 'zip' : 'gz', source: 'github.com/rust-lang/rust-analyzer', id: `rust-analyzer-${r.tag_name}` });
    }
    return out;
  });
  if (kind === 'rust') return cached(kind, async () => {
    const t = rustTarget(platform, arch);
    if (!t) return [];
    // versions from GitHub's release list; the archive and its checksum file from static.rust-lang.org
    const rels = await json('https://api.github.com/repos/rust-lang/rust/releases?per_page=5', { Accept: 'application/vnd.github+json' });
    const out: Release[] = [];
    for (const r of rels) {
      if (r.prerelease || r.draft || !/^\d+\.\d+\.\d+$/.test(r.tag_name)) continue;
      const asset = `rust-${r.tag_name}-${t}.tar.gz`, url = `https://static.rust-lang.org/dist/${asset}`;
      const sum = (await text(`${url}.sha256`).catch(() => '')).trim().split(/\s+/)[0];
      if (!/^[0-9a-f]{64}$/.test(sum)) continue;
      out.push({ kind, name: 'rust', version: r.tag_name, asset, url, size: await headSize(url), sha256: sum, format: 'tar.gz', source: 'static.rust-lang.org', id: `rust-${r.tag_name}` });
    }
    return out;
  });
  if (kind === 'python') return cached(kind, async () => {
    const triple = pythonTriple(platform, arch);
    if (!triple) return [];
    const r = await json('https://api.github.com/repos/astral-sh/python-build-standalone/releases/latest', { Accept: 'application/vnd.github+json' });
    return pythonReleases(r.assets ?? [], triple);
  });
  if (kind === 'pyright') return cached(kind, async () => {
    const m = await json('https://registry.npmjs.org/pyright/latest');
    const integrity = String(m.dist?.integrity ?? '');
    if (!integrity.startsWith('sha512-')) return [];
    const url = String(m.dist.tarball);
    return [{ kind, name: 'pyright', version: m.version, asset: path.basename(new URL(url).pathname), url, size: await headSize(url), sha256: '', sha512: integrity.slice(7), format: 'tar.gz', source: 'registry.npmjs.org', id: `pyright-${m.version}`, note: 'runs with the Node.js inside SkyCodeX' }];
  });
  if (kind === 'go') return cached(kind, async () => {
    const plat = goPlatform(platform, arch);
    return plat ? goReleases(await json('https://go.dev/dl/?mode=json'), plat) : [];
  });
  return [];
}

// ---------- unpacking steps for each kind ----------
const has = (...p: string[]) => fs.existsSync(path.join(...p));

/**
 * Rust's standalone installer holds one folder per component, each listing its files in manifest.in.
 * Those files are merged into the pack's own bin/, lib/ and share/; install.sh is never run.
 */
export function mergeRustComponents(root: string, skip = new Set(['rust-docs', 'rust-docs-json'])): string[] {
  const comps = fs.readFileSync(path.join(root, 'components'), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const merged: string[] = [];
  for (const c of comps) {
    const dir = path.join(root, c);
    if (skip.has(c) || !fs.existsSync(path.join(dir, 'manifest.in'))) { fs.rmSync(dir, { recursive: true, force: true }); continue; }
    for (const line of fs.readFileSync(path.join(dir, 'manifest.in'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^(file|dir):(.+)$/);
      if (!m) continue;
      const rel = m[2].trim();
      if (rel.split(/[\\/]/).includes('..') || path.isAbsolute(rel)) continue;
      const from = path.join(dir, rel), to = path.join(root, rel);
      if (!fs.existsSync(from)) continue;
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.cpSync(from, to, { recursive: true, force: true, verbatimSymlinks: true });
    }
    fs.rmSync(dir, { recursive: true, force: true });
    merged.push(c);
  }
  for (const f of ['install.sh', 'components', 'rust-installer-version', 'version', 'git-commit-hash', 'git-commit-info']) fs.rmSync(path.join(root, f), { force: true });
  return merged;
}

/** Environment for anything run from Go: caches, modules and settings stay in the pack. */
export function goEnv(pack: string): Record<string, string> {
  return {
    GOROOT: pack, GOPATH: path.join(pack, 'gopath'), GOMODCACHE: path.join(pack, 'gopath', 'pkg', 'mod'), GOCACHE: path.join(pack, 'cache', 'build'),
    GOENV: path.join(pack, 'cache', 'env'), GOTOOLCHAIN: 'local', GOFLAGS: '-modcacherw', GOTELEMETRY: 'off',
  };
}
/** HOME and the config folders, moved into the pack for programs SkyCodeX itself runs (gopls's build and the server). */
const homeInside = (pack: string): Record<string, string> => {
  const h = path.join(pack, 'cache', 'home');
  fs.mkdirSync(h, { recursive: true });
  return win ? { USERPROFILE: h, APPDATA: path.join(h, 'AppData'), LOCALAPPDATA: path.join(h, 'AppData', 'Local') } : { HOME: h, XDG_CONFIG_HOME: path.join(h, '.config'), XDG_CACHE_HOME: path.join(h, '.cache') };
};

function run(cmd: string, args: string[], env: Record<string, string>, cwd: string, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = execFile(cmd, args, { cwd, env: { ...process.env, ...env }, signal, maxBuffer: 16 << 20, timeout: 20 * 60_000 }, (e, out, err) => (e ? reject(new Error(String(err || e.message).trim().split('\n').slice(-3).join(' '))) : resolve(String(out))));
    p.stdin?.end();
  });
}

export function stepsFor(kind: PackKind): InstallSteps {
  if (kind === 'rust') return {
    check: (root) => has(root, 'components'),
    prepare: async (root, onProgress) => {
      onProgress({ phase: 'unpack', done: 0, total: 0, note: 'arranging components' });
      const merged = mergeRustComponents(root);
      if (!has(root, 'bin', exe('rustc')) || !has(root, 'bin', exe('cargo'))) throw new Error('the archive does not contain rustc and cargo');
      fs.mkdirSync(path.join(root, 'cargo-home'), { recursive: true });
      return `components: ${merged.join(', ')}`;
    },
  };
  if (kind === 'rust-analyzer') return {
    program: 'rust-analyzer',
    check: (root) => has(root, 'bin', exe('rust-analyzer')) || has(root, exe('rust-analyzer')),
    prepare: async (root) => {   // the Windows zip holds the program at its top
      if (!has(root, 'bin', exe('rust-analyzer'))) { fs.mkdirSync(path.join(root, 'bin'), { recursive: true }); fs.renameSync(path.join(root, exe('rust-analyzer')), path.join(root, 'bin', exe('rust-analyzer'))); }
    },
  };
  if (kind === 'python') return {
    bin: win ? '.' : 'bin',
    check: (root) => (win ? has(root, 'python.exe') : has(root, 'bin', 'python3')),
    prepare: async (root) => { fs.mkdirSync(path.join(root, 'cache', 'pip'), { recursive: true }); },
  };
  if (kind === 'pyright') return { bin: '.', check: (root) => has(root, 'langserver.index.js') };
  if (kind === 'go') return {
    check: (root) => has(root, 'bin', exe('go')),
    prepare: async (root, onProgress, signal) => {
      onProgress({ phase: 'unpack', done: 0, total: 0, note: 'building gopls' });
      // GOBIN is the pack's own bin; CGO off so the build needs no C compiler
      const env = { ...goEnv(root), ...homeInside(root), GOBIN: path.join(root, 'bin'), CGO_ENABLED: '0', GOPROXY: 'https://proxy.golang.org', GOSUMDB: 'sum.golang.org' };
      try {
        await run(path.join(root, 'bin', exe('go')), ['install', 'golang.org/x/tools/gopls@latest'], env, root, signal);
        return 'gopls built';
      } catch (e) {
        if (signal.aborted) throw e;
        return `Go works; gopls could not be built (${(e as Error).message}) — reinstall to try again`;
      }
    },
  };
  return {};
}

// ---------- using installed packs ----------
const newest = (packs: PackManifest[], kind: PackKind) => packs.filter((m) => m.kind === kind).sort((a, b) => compareVersions(b.version, a.version))[0] ?? null;

/** bin folders of every installed language pack except C/C++ toolchains (those follow compiler.toolchain). */
export function languageBins(dir: string): string[] {
  const packs = listPacks(dir), out: string[] = [];
  for (const k of ['rust', 'rust-analyzer', 'python', 'go'] as PackKind[]) {
    const m = newest(packs, k);
    if (m) out.push(path.join(dir, m.id, m.bin));
  }
  const py = newest(packs, 'python');
  if (py && win) out.push(path.join(dir, py.id, 'Scripts'));
  return out;
}

/** Variables for SkyCodeX's terminals that keep Cargo, Go and pip writing inside their packs. */
export function languageEnv(dir: string): Record<string, string> {
  const packs = listPacks(dir), env: Record<string, string> = {};
  const rust = newest(packs, 'rust'), go = newest(packs, 'go'), py = newest(packs, 'python');
  if (rust) env.CARGO_HOME = path.join(dir, rust.id, 'cargo-home');
  if (go) Object.assign(env, goEnv(path.join(dir, go.id)));
  if (py) { env.PIP_CACHE_DIR = path.join(dir, py.id, 'cache', 'pip'); env.PYTHONNOUSERSITE = '1'; }
  return env;
}

export type Lang = 'rust' | 'python' | 'go';
export interface ServerCmd { cmd: string; args: string[]; env: Record<string, string>; settings?: Record<string, unknown>; name: string }
const onPath = (prog: string) => {
  for (const d of (process.env.PATH ?? '').split(path.delimiter)) { const p = path.join(d, exe(prog)); if (d && fs.existsSync(p)) return p; }
  return null;
};

/** The language server for a language: an installed pack first, then one already on the system. */
export function serverFor(lang: Lang, dir: string): ServerCmd | null {
  const packs = listPacks(dir);
  const binOf = (k: PackKind, prog: string) => { const m = newest(packs, k); const p = m ? path.join(dir, m.id, m.bin, exe(prog)) : ''; return p && fs.existsSync(p) ? p : null; };
  const pathEnv = (bins: string[]) => ({ PATH: [...bins, process.env.PATH ?? ''].join(path.delimiter) });
  if (lang === 'rust') {
    const ra = binOf('rust-analyzer', 'rust-analyzer') ?? binOf('rust', 'rust-analyzer') ?? onPath('rust-analyzer');
    if (!ra) return null;
    return { name: 'rust-analyzer', cmd: ra, args: [], env: { ...pathEnv(languageBins(dir)), ...languageEnv(dir) } };
  }
  if (lang === 'go') {
    const gp = binOf('go', 'gopls') ?? onPath('gopls');
    if (!gp) return null;
    const go = newest(packs, 'go');
    return { name: 'gopls', cmd: gp, args: [], env: { ...pathEnv(languageBins(dir)), ...languageEnv(dir), ...(go ? homeInside(path.join(dir, go.id)) : {}) } };
  }
  const pr = newest(packs, 'pyright');
  const py = newest(packs, 'python');
  const pyExe = py ? path.join(dir, py.id, py.bin, win ? 'python.exe' : 'python3') : null;
  const settings = pyExe ? { python: { pythonPath: pyExe } } : undefined;
  if (pr) return { name: 'pyright', cmd: process.execPath, args: [path.join(dir, pr.id, 'langserver.index.js'), '--stdio'], env: { ELECTRON_RUN_AS_NODE: '1', ...languageEnv(dir) }, settings };
  const sys = onPath('pyright-langserver');
  return sys ? { name: 'pyright', cmd: sys, args: ['--stdio'], env: {}, settings } : null;
}

export type { Progress };
