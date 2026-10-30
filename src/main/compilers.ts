// Reading C/C++ the way gcc or MSVC would. clangd (clang's front end) analyses the code in every case; what changes is
// the compiler it is told the code is built with. For gcc, clangd asks that g++ for its system headers, predefined
// macros (__GNUC__ …) and target (--query-driver). For MSVC, a cl.exe command puts clang into its MSVC-compatible mode
// (clang-cl: /I, /D, /std:, _MSC_VER, Microsoft extensions) with the Visual Studio and Windows SDK headers.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export type ReadAs = 'clang' | 'gcc' | 'msvc';
export interface Compiler {
  kind: ReadAs;
  cxx: string;              // the C++ compiler the commands name
  cc: string;               // the C compiler (the same as cxx for cl.exe)
  version: string;
  include?: string[];       // MSVC: the system include folders (VC tools, then the Windows SDK)
}
type Run = (exe: string, args: string[]) => string;
const run: Run = (exe, args) => { try { return execFileSync(exe, args, { encoding: 'utf8', timeout: 5000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { return String((e as { stdout?: string; stderr?: string }).stdout || (e as { stderr?: string }).stderr || ''); } };

// ---------- gcc ----------
/** `g++ --version` says GCC (on macOS /usr/bin/g++ is Apple clang under that name). */
export function isGcc(versionText: string): boolean {
  const first = versionText.split(/\r?\n/)[0] ?? '';
  return !/clang/i.test(versionText) && (/Free Software Foundation/i.test(versionText) || /\b(GCC|g\+\+|gcc)\b/.test(first));
}
export function gccVersion(versionText: string): string {
  const first = versionText.split(/\r?\n/)[0] ?? '';
  return first.match(/(\d+\.\d+(?:\.\d+)?)\s*$/)?.[1] ?? first.match(/\d+\.\d+(?:\.\d+)?/)?.[0] ?? '';
}
/** Where g++ is looked for, in order: the PATH (g++, then g++-15 … g++-9), then the usual install folders. */
export function gccCandidates(env: NodeJS.ProcessEnv = process.env, platform = process.platform): string[] {
  const names = ['g++', ...Array.from({ length: 7 }, (_, k) => `g++-${15 - k}`)];
  const dirs = (env.PATH ?? env.Path ?? '').split(platform === 'win32' ? ';' : ':').filter(Boolean);
  dirs.push(...(platform === 'win32' ? ['C:\\msys64\\ucrt64\\bin', 'C:\\msys64\\mingw64\\bin', 'C:\\mingw64\\bin'] : ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin']));
  const out: string[] = [];
  for (const n of names) for (const d of dirs) { const p = path.join(d, n + (platform === 'win32' ? '.exe' : '')); if (!out.includes(p)) out.push(p); }
  return out;
}
/** The first g++ that is really GCC: the one given, or one found as gccCandidates lists. */
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

// ---------- MSVC ----------
const newest = (dir: string, re = /^\d+(\.\d+)+$/) => { try { return fs.readdirSync(dir).filter((x) => re.test(x)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0] ?? null; } catch { return null; } };
/**
 * A Visual Studio (or Build Tools) folder: its default VC tools' cl.exe and include folder, and the newest Windows 10/11
 * SDK's ucrt, shared, um and winrt headers. host: 'x64' or 'arm64'.
 */
export function msvcLayout(install: string, kitsRoot: string, host: 'x64' | 'arm64' = 'x64'): Compiler | null {
  let ver: string | null = null;
  try { ver = fs.readFileSync(path.join(install, 'VC', 'Auxiliary', 'Build', 'Microsoft.VCToolsVersion.default.txt'), 'utf8').trim(); } catch { ver = newest(path.join(install, 'VC', 'Tools', 'MSVC')); }
  if (!ver) return null;
  return msvcFromCl(path.join(install, 'VC', 'Tools', 'MSVC', ver, 'bin', host === 'arm64' ? 'HostARM64' : 'Hostx64', host, 'cl.exe'), kitsRoot);
}
/** cl.exe at VC\Tools\MSVC\<version>\bin\Host<x>\<y>: that version's include folder, then the newest SDK's. */
export function msvcFromCl(cl: string, kitsRoot: string): Compiler | null {
  if (!fs.existsSync(cl)) return null;
  const tools = path.resolve(path.dirname(cl), '..', '..', '..');
  const include = [path.join(tools, 'include')];
  const sdk = newest(path.join(kitsRoot, 'Include'), /^10\.\d+\.\d+\.\d+$/);
  if (sdk) for (const sub of ['ucrt', 'shared', 'um', 'winrt']) { const d = path.join(kitsRoot, 'Include', sdk, sub); if (fs.existsSync(d)) include.push(d); }
  return { kind: 'msvc', cxx: cl, cc: cl, version: path.basename(tools), include };
}
/** cl.exe from a developer prompt (on the PATH, with INCLUDE set), else the newest Visual Studio vswhere knows of. */
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

// ---------- compile commands in each compiler's own style ----------
/** A gcc/clang-style flag as cl.exe writes it; anything cl has no spelling for goes to clang as /clang:<flag>. */
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
/** The command for one file, as the given compiler would be run (null: clang, or a toolchain pack's clang++). */
export function commandFor(c: Pick<Compiler, 'kind' | 'cxx' | 'cc' | 'include'> | null, file: string, flags: string[]): string[] {
  const isC = /\.(c|m)$/i.test(file);
  if (c?.kind === 'msvc') return [c.cxx, '/nologo', isC ? '/TC' : '/TP', ...(isC ? [] : ['/EHsc']), ...flags.map(msvcFlag), ...(c.include ?? []).map((d) => `/imsvc${d}`), '/c', file];
  if (c) return [isC ? c.cc : c.cxx, ...flags, '-c', file];
  return [isC ? 'clang' : 'clang++', ...flags, '-c', file];
}

// ---------- which compilers clangd may ask ----------
const DRIVER = /^(.*-)?(g\+\+|gcc|c\+\+|cc|clang\+\+|clang)(-\d+(\.\d+)*)?(\.exe)?$/i;
/**
 * The compilers named in a project's own compile_commands.json that clangd may run to learn their headers and macros
 * (--query-driver). Running a program the project names is only safe for an installed compiler, so a driver counts
 * only when it is a compiler by name, exists, and lives in a PATH folder or an install folder — never in the project.
 */
export function projectDrivers(ccDir: string, root: string, env: NodeJS.ProcessEnv = process.env, platform = process.platform): string[] {
  let entries: { arguments?: string[]; command?: string }[] = [];
  try { entries = JSON.parse(fs.readFileSync(path.join(ccDir, 'compile_commands.json'), 'utf8')); } catch { return []; }
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

/** What the compiler window says about the compiler the code is read as. */
export function describe(c: Compiler | null): string {
  if (!c || c.kind === 'clang') return 'clang';
  return c.kind === 'gcc' ? `g++ ${c.version}` : `MSVC ${c.version}`;
}
