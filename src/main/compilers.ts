import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export type ReadAs = 'clang' | 'gcc' | 'msvc';
export interface Compiler {
  kind: ReadAs;
  cxx: string;
  cc: string;
  version: string;
  include?: string[];
}
type Run = (exe: string, args: string[]) => string;
const run: Run = (exe, args) => { try { return execFileSync(exe, args, { encoding: 'utf8', timeout: 5000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { return String((e as { stdout?: string; stderr?: string }).stdout || (e as { stderr?: string }).stderr || ''); } };

export function isGcc(versionText: string): boolean {
  const first = versionText.split(/\r?\n/)[0] ?? '';
  return !/clang/i.test(versionText) && (/Free Software Foundation/i.test(versionText) || /\b(GCC|g\+\+|gcc)\b/.test(first));
}
export function gccVersion(versionText: string): string {
  const first = versionText.split(/\r?\n/)[0] ?? '';
  return first.match(/(\d+\.\d+(?:\.\d+)?)\s*$/)?.[1] ?? first.match(/\d+\.\d+(?:\.\d+)?/)?.[0] ?? '';
}
export function gccCandidates(env: NodeJS.ProcessEnv = process.env, platform = process.platform): string[] {
  const names = ['g++', ...Array.from({ length: 7 }, (_, k) => `g++-${15 - k}`)];
  const dirs = (env.PATH ?? env.Path ?? '').split(platform === 'win32' ? ';' : ':').filter(Boolean);
  dirs.push(...(platform === 'win32' ? ['C:\\msys64\\ucrt64\\bin', 'C:\\msys64\\mingw64\\bin', 'C:\\mingw64\\bin'] : ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin']));
  const out: string[] = [];
  for (const n of names) for (const d of dirs) { const p = path.join(d, n + (platform === 'win32' ? '.exe' : '')); if (!out.includes(p)) out.push(p); }
  return out;
}
export function findGcc(explicit = '', exec: Run = run, candidates = gccCandidates()): Compiler | null {
  for (const p of explicit ? [explicit] : candidates) {
    if (!fs.existsSync(p)) continue;
    const text = exec(p, ['--version']);
    if (!isGcc(text)) continue;
    const gcc = path.join(path.dirname(p), path.basename(p).replace(/g\+\+/, 'gcc'));
    return { kind: 'gcc', cxx: p, cc: fs.existsSync(gcc) ? gcc : p, version: gccVersion(text) };
  }
  return null;
}

const newest = (dir: string, re = /^\d+(\.\d+)+$/) => { try { return fs.readdirSync(dir).filter((x) => re.test(x)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0] ?? null; } catch { return null; } };
export function msvcLayout(install: string, kitsRoot: string, host: 'x64' | 'arm64' = 'x64'): Compiler | null {
  let ver: string | null = null;
  try { ver = fs.readFileSync(path.join(install, 'VC', 'Auxiliary', 'Build', 'Microsoft.VCToolsVersion.default.txt'), 'utf8').trim(); } catch { ver = newest(path.join(install, 'VC', 'Tools', 'MSVC')); }
  if (!ver) return null;
  return msvcFromCl(path.join(install, 'VC', 'Tools', 'MSVC', ver, 'bin', host === 'arm64' ? 'HostARM64' : 'Hostx64', host, 'cl.exe'), kitsRoot);
}
export function msvcFromCl(cl: string, kitsRoot: string): Compiler | null {
  if (!fs.existsSync(cl)) return null;
  const tools = path.resolve(path.dirname(cl), '..', '..', '..');
  const include = [path.join(tools, 'include')];
  const sdk = newest(path.join(kitsRoot, 'Include'), /^10\.\d+\.\d+\.\d+$/);
  if (sdk) for (const sub of ['ucrt', 'shared', 'um', 'winrt']) { const d = path.join(kitsRoot, 'Include', sdk, sub); if (fs.existsSync(d)) include.push(d); }
  return { kind: 'msvc', cxx: cl, cc: cl, version: path.basename(tools), include };
}
export function findMsvc(explicit = '', env: NodeJS.ProcessEnv = process.env, exec: Run = run, platform = process.platform): Compiler | null {
  if (platform !== 'win32') return null;
  const inc = (env.INCLUDE ?? '').split(';').filter(Boolean);
  const onPath = explicit || (env.PATH ?? env.Path ?? '').split(';').map((d) => path.join(d, 'cl.exe')).find((p) => fs.existsSync(p));
  if (onPath && fs.existsSync(onPath) && inc.length) {
    const ver = (exec(onPath, []).match(/Version (\d+\.\d+\.\d+)/) ?? [])[1] ?? '';
    return { kind: 'msvc', cxx: onPath, cc: onPath, version: ver, include: inc };
  }
  const pf86 = env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
  const vswhere = path.join(pf86, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const kits = path.join(pf86, 'Windows Kits', '10');
  const host = process.arch === 'arm64' ? 'arm64' : 'x64';
  if (explicit) return msvcFromCl(explicit, kits);
  if (!fs.existsSync(vswhere)) return null;
  const installs = exec(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath']).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  for (const i of installs) { const c = msvcLayout(i, kits, host); if (c) return c; }
  return null;
}

export function msvcFlag(f: string): string {
  let m: RegExpMatchArray | null;
  if ((m = f.match(/^-I(.+)$/))) return `/I${m[1]}`;
  if ((m = f.match(/^-D(.+)$/))) return `/D${m[1]}`;
  if ((m = f.match(/^-U(.+)$/))) return `/U${m[1]}`;
  if ((m = f.match(/^-std=(?:c|gnu)\+\+(\w+)$/))) return `/std:c++${{ '98': '14', '03': '14', '11': '14', '1z': '17', '2a': '20', '2b': 'latest', '23': 'latest', '26': 'latest' }[m[1]] ?? m[1]}`;
  if ((m = f.match(/^-std=(?:c|gnu)(\d+)$/))) return `/std:c${m[1] === '99' || m[1] === '89' || m[1] === '90' ? '11' : m[1]}`;
  if (f.startsWith('/')) return f;
  return `/clang:${f}`;
}
export function commandFor(c: Pick<Compiler, 'kind' | 'cxx' | 'cc' | 'include'> | null, file: string, flags: string[]): string[] {
  const isC = /\.(c|m)$/i.test(file);
  if (c?.kind === 'msvc') return [c.cxx, '/nologo', isC ? '/TC' : '/TP', ...(isC ? [] : ['/EHsc']), ...flags.map(msvcFlag), ...(c.include ?? []).map((d) => `/imsvc${d}`), '/c', file];
  if (c) return [isC ? c.cc : c.cxx, ...flags, '-c', file];
  return [isC ? 'clang' : 'clang++', ...flags, '-c', file];
}

const DRIVER = /^(.*-)?(g\+\+|gcc|c\+\+|cc|clang\+\+|clang)(-\d+(\.\d+)*)?(\.exe)?$/i;
export function projectDrivers(ccDir: string, root: string, env: NodeJS.ProcessEnv = process.env, platform = process.platform): string[] {
  let entries: { arguments?: string[]; command?: string }[] = [];
  try { entries = JSON.parse(fs.readFileSync(path.join(ccDir, 'compile_commands.json'), 'utf8')); } catch { return []; }
  if (!Array.isArray(entries)) return [];
  const sep = platform === 'win32' ? ';' : ':';
  const dirs = (env.PATH ?? env.Path ?? '').split(sep).filter(Boolean).map((d) => path.resolve(d));
  const prefixes = platform === 'win32' ? ['C:\\msys64', 'C:\\mingw64', 'C:\\Program Files', 'C:\\Program Files (x86)'] : ['/usr/', '/opt/', '/Library/Developer/', '/Applications/Xcode'];
  const seen = new Set<string>(), out: string[] = [];
  for (const e of entries.slice(0, 5000)) {
    const exe = e.arguments?.[0] ?? e.command?.match(/^\s*("([^"]+)"|\S+)/)?.[2] ?? e.command?.match(/^\s*(\S+)/)?.[1];
    if (!exe || seen.has(exe)) continue;
    seen.add(exe);
    if (!DRIVER.test(path.basename(exe))) continue;
    const full = path.isAbsolute(exe) ? exe : dirs.map((d) => path.join(d, exe + (platform === 'win32' && !/\.exe$/i.test(exe) ? '.exe' : ''))).find((p) => fs.existsSync(p));
    if (!full || !fs.existsSync(full)) continue;
    const real = path.resolve(full), rootAbs = path.resolve(root) + path.sep;
    if (real.startsWith(rootAbs)) continue;
    if (!dirs.includes(path.dirname(real)) && !prefixes.some((p) => real.startsWith(p))) continue;
    if (!out.includes(real)) out.push(real);
    if (exe !== real && !out.includes(exe)) out.push(exe);
    if (out.length >= 24) break;
  }
  return out;
}

export function describe(c: Compiler | null): string {
  if (!c || c.kind === 'clang') return 'clang';
  return c.kind === 'gcc' ? `g++ ${c.version}` : `MSVC ${c.version}`;
}
