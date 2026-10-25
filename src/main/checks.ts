// Run with checks and profile: builds the program apart from the project (in Lithograph's state folder),
// runs it once, and turns what the sanitizers or the coverage counters report into something linked to the source.
import fs from 'node:fs';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';

export type CheckKind = 'memory' | 'threads' | 'undefined' | 'profile';
export interface Frame { fn: string; file: string; line: number; col: number }
export interface Report { tool: string; title: string; detail: string; sections: { title: string; frames: Frame[] }[] }
export interface RunResult {
  ok: boolean; stage: 'build' | 'run' | 'done'; message?: string;
  command: string; buildLog: string; output: string; exitCode: number | null; ms: number;
  reports: Report[]; profile?: Profile;
}
export interface Profile { functions: { name: string; count: number; file: string; line: number }[]; lines: Record<string, [number, number][]>; total: number }

const FLAGS: Record<CheckKind, string[]> = {
  memory: ['-fsanitize=address,undefined', '-fno-omit-frame-pointer'],
  threads: ['-fsanitize=thread', '-fno-omit-frame-pointer'],
  undefined: ['-fsanitize=undefined', '-fno-sanitize-recover=undefined'],
  profile: ['-fprofile-instr-generate', '-fcoverage-mapping'],
};
export const flagsFor = (k: CheckKind) => ['-g', '-O1', ...FLAGS[k]];

// ---------- reading sanitizer output ----------
// frames: "#0 0x1045 in fn file.cpp:12:5" (AddressSanitizer) or "#0 fn file.cpp:12:5 (app+0x10)" (ThreadSanitizer)
const FRAME = /^\s*#\d+\s+(?:0x[0-9a-f]+\s+in\s+)?(.+?)\s+((?:[A-Za-z]:)?[^\s:()]+):(\d+)(?::(\d+))?/;
const HEAD = /^(?:==\d+==)?(?:WARNING|ERROR): (AddressSanitizer|ThreadSanitizer|LeakSanitizer|UndefinedBehaviorSanitizer|MemorySanitizer): (.+?)(?: \(pid=\d+\))?$/;
const UB = /^((?:[A-Za-z]:)?[^\s:]+):(\d+):(\d+): runtime error: (.+)$/;

export function parseSanitizer(text: string): Report[] {
  const out: Report[] = [];
  let cur: Report | null = null, sec: { title: string; frames: Frame[] } | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.replace(/\x1b\[[0-9;]*m/g, '');
    const h = l.match(HEAD), u = l.match(UB);
    if (h) {
      cur = { tool: h[1], title: h[2].replace(/ on address 0x[0-9a-f]+.*$/, '').trim(), detail: h[2], sections: [] };
      sec = { title: '', frames: [] }; cur.sections.push(sec); out.push(cur);
      continue;
    }
    if (u) {
      cur = { tool: 'UndefinedBehaviorSanitizer', title: u[4].replace(/:.*$/, ''), detail: u[4], sections: [] };
      sec = { title: 'at', frames: [{ fn: '', file: u[1], line: +u[2], col: +u[3] }] };
      cur.sections.push(sec); out.push(cur);
      continue;
    }
    if (!cur) continue;
    if (/^SUMMARY: /.test(l)) { cur = null; sec = null; continue; }
    const f = l.match(FRAME);
    if (f && sec) { sec.frames.push({ fn: f[1].replace(/\s+\(.*$/, ''), file: f[2], line: +f[3], col: +(f[4] ?? 0) }); continue; }
    // "  Write of size 4 at 0x… by thread T1:", "  Previous read …", "Thread T1 … created by main thread at:", "freed by thread T0 here:"
    const t = l.trim();
    if (t.endsWith(':') && t.length < 160 && !/^==\d+==/.test(t)) { sec = { title: t.slice(0, -1).replace(/ at 0x[0-9a-f]+/, '').replace(/ (at|here)$/, '').replace(/\s*\(mutexes: [^)]*\)/, ''), frames: [] }; cur.sections.push(sec); }
  }
  for (const r of out) r.sections = r.sections.filter((s) => s.frames.length);
  return out;
}

// ---------- coverage counts → a profile ----------
/** llvm-cov export JSON: line counts from each file's segments, call counts per function. */
export function profileFromCov(json: any, inProject: (f: string) => boolean): Profile {
  const d = json?.data?.[0] ?? {};
  const lines: Record<string, [number, number][]> = {};
  for (const f of d.files ?? []) {
    if (!inProject(f.filename)) continue;
    const by = new Map<number, number>();
    for (const s of f.segments ?? []) {   // [line, col, count, hasCount, isRegionEntry, isGapRegion]
      if (!s[3] || s[5]) continue;
      by.set(s[0], Math.max(by.get(s[0]) ?? 0, s[2]));
    }
    lines[f.filename] = [...by].sort((a, b) => a[0] - b[0]);
  }
  const functions = (d.functions ?? [])
    .filter((f: any) => f.filenames?.[0] && inProject(f.filenames[0]))
    .map((f: any) => ({ name: demangleName(f.name), count: f.count, file: f.filenames[0], line: (f.regions?.[0]?.[0] ?? 1) - 1 }))
    .sort((a: any, b: any) => b.count - a.count);
  return { functions, lines, total: functions.reduce((n: number, f: any) => n + f.count, 0) };
}
/** llvm-cov names static functions "file.cpp:fn"; keep the function. */
const demangleName = (n: string) => n.replace(/^.*\.(c|cc|cpp|cxx):/, '');

// ---------- building and running ----------
const CXX = /\.(cc|cpp|cxx|c\+\+)$/i, C = /\.c$/i;
const SKIP_DIR = /^(build|out|cmake-build-.*|\.git|node_modules|tests?|third_party|external|vendor|examples?|bench(marks?)?)$/i;
/** The sources of a simple project: every C/C++ file outside tests and build folders. Exactly one may define main. */
export function projectSources(root: string): { files: string[]; mains: string[] } {
  const files: string[] = [];
  const walk = (d: string, depth: number) => {
    if (depth > 6) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!SKIP_DIR.test(e.name)) walk(p, depth + 1); }
      else if (CXX.test(e.name) || C.test(e.name)) files.push(p);
    }
  };
  walk(root, 0);
  const mains = files.filter((f) => /^[ \t]*(?:(?:static|extern|inline)\s+)*int\s+main\s*\(/m.test(fs.readFileSync(f, 'utf8')));
  return { files, mains };
}

function exec(cmd: string, args: string[], opts: { cwd: string; env?: Record<string, string>; timeout?: number }): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd: opts.cwd, env: { ...process.env, ...opts.env }, timeout: opts.timeout ?? 180_000, maxBuffer: 8 << 20 }, (e, so, se) => {
      resolve({ code: e ? ((e as any).code === 'ENOENT' ? -1 : typeof (e as any).code === 'number' ? (e as any).code : 1) : 0, out: `${so ?? ''}${se ?? ''}` });
    });
  });
}

export interface Tools { cxx: string; cc: string; profdata: string | null; cov: string | null; cxxfilt?: string | null; env: Record<string, string> }

/** Builds and runs the project once with the chosen checks. Everything it writes goes to workDir. */
export async function runWithChecks(root: string, kind: CheckKind, args: string[], tools: Tools, workDir: string): Promise<RunResult> {
  const t0 = Date.now();
  const res: RunResult = { ok: false, stage: 'build', command: '', buildLog: '', output: '', exitCode: null, ms: 0, reports: [] };
  const { files, mains } = projectSources(root);
  if (!files.length) return { ...res, message: 'no C or C++ files in this folder' };
  if (mains.length !== 1) return { ...res, message: mains.length ? `this folder has ${mains.length} main functions (${mains.map((m) => path.relative(root, m)).join(', ')}) — checks build simple projects with one program; for others, add the flags below to your own build` : 'no main function found' };
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });
  const exe = path.join(workDir, process.platform === 'win32' ? 'program.exe' : 'program');
  const anyCxx = files.some((f) => CXX.test(f));
  // C files are compiled as C, then everything is linked by the C++ driver
  const objs: string[] = [];
  const flags = flagsFor(kind);
  const extra = fs.existsSync(path.join(root, 'compile_flags.txt')) ? fs.readFileSync(path.join(root, 'compile_flags.txt'), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#')) : [];
  for (const [i, f] of files.entries()) {
    const o = path.join(workDir, `${i}-${path.basename(f)}.o`);
    const isC = C.test(f);
    const a = [...(isC ? extra.filter((x) => !x.startsWith('-std=c++')) : extra.filter((x) => !/^-std=(c|gnu)\d/.test(x))), ...(isC ? [] : extra.some((x) => x.startsWith('-std=')) ? [] : ['-std=c++20']), ...flags, '-I', root, '-I', path.join(root, 'include'), '-c', f, '-o', o];
    const r = await exec(isC ? tools.cc : tools.cxx, a, { cwd: root, env: tools.env });
    res.buildLog += r.out;
    if (r.code !== 0) { res.command = `${isC ? tools.cc : tools.cxx} ${a.join(' ')}`; res.ms = Date.now() - t0; return { ...res, message: r.code === -1 ? `no compiler found (${tools.cxx}) — install a toolchain from the compiler window` : `building ${path.relative(root, f)} failed` }; }
    objs.push(o);
  }
  const link = [...flags, ...objs, '-o', exe, ...(anyCxx ? [] : ['-lm'])];
  const lr = await exec(tools.cxx, link, { cwd: root, env: tools.env });
  res.buildLog += lr.out;
  res.command = `${tools.cxx} ${[...flags, '<sources>', '-o', 'program'].join(' ')}`;
  if (lr.code !== 0) { res.ms = Date.now() - t0; return { ...res, message: 'linking failed' }; }

  // ---- run once ----
  res.stage = 'run';
  const profraw = path.join(workDir, 'run.profraw');
  const env: Record<string, string> = {
    ...tools.env,
    ASAN_OPTIONS: 'detect_leaks=1:halt_on_error=0:color=never', TSAN_OPTIONS: 'halt_on_error=0:second_deadlock_stack=1:color=never',
    UBSAN_OPTIONS: 'print_stacktrace=1:color=never', LLVM_PROFILE_FILE: profraw,
  };
  if (process.platform === 'darwin') env.ASAN_OPTIONS = 'halt_on_error=0:color=never';   // leak checking isn't supported on macOS
  const run = await new Promise<{ code: number | null; out: string }>((resolve) => {
    let out = '';
    const p = spawn(exe, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    const add = (d: Buffer) => { if (out.length < 4 << 20) out += d.toString(); };
    p.stdout.on('data', add); p.stderr.on('data', add);
    const timer = setTimeout(() => { out += '\n[Lithograph stopped the program after 60 seconds]\n'; p.kill('SIGKILL'); }, 60_000);
    p.on('close', (code) => { clearTimeout(timer); resolve({ code, out }); });
    p.on('error', (e) => { clearTimeout(timer); resolve({ code: null, out: String(e) }); });
  });
  res.output = run.out;
  res.exitCode = run.code;
  res.reports = parseSanitizer(run.out);
  // the symbolizer may print a bare or relative file name: make it the project's file
  const real = files.map((f) => fs.realpathSync(f));
  for (const r of res.reports) for (const sec of r.sections) for (const f of sec.frames) {
    if (path.isAbsolute(f.file)) continue;
    const p = path.join(root, f.file);
    f.file = fs.existsSync(p) ? p : files.find((x, i) => x.endsWith(path.sep + f.file) || real[i].endsWith(path.sep + f.file)) ?? f.file;
  }

  if (kind === 'profile') {
    if (!tools.profdata || !tools.cov) { res.ms = Date.now() - t0; return { ...res, ok: true, stage: 'done', message: 'the program ran, but llvm-profdata and llvm-cov were not found — install a toolchain from the compiler window' }; }
    const data = path.join(workDir, 'run.profdata');
    const m = await exec(tools.profdata, ['merge', '-sparse', profraw, '-o', data], { cwd: workDir, env: tools.env });
    if (m.code !== 0) { res.ms = Date.now() - t0; return { ...res, stage: 'done', message: `reading the counts failed: ${m.out.trim().split('\n').pop()}` }; }
    const cov = await exec(tools.cov, ['export', '-format=text', '-skip-expansions', `-instr-profile=${data}`, exe], { cwd: workDir, env: tools.env });
    try { res.profile = profileFromCov(JSON.parse(cov.out.slice(cov.out.indexOf('{'))), (f) => path.resolve(f).startsWith(path.resolve(root) + path.sep)); }
    catch { res.ms = Date.now() - t0; return { ...res, stage: 'done', message: 'llvm-cov gave no readable counts' }; }
    // C++ names come mangled (_Z5twicei); llvm-cxxfilt turns them back into twice(int)
    const mangled = res.profile.functions.filter((f) => f.name.startsWith('_Z')).map((f) => f.name);
    if (tools.cxxfilt && mangled.length) {
      const d = await exec(tools.cxxfilt, mangled, { cwd: workDir, env: tools.env });
      const names = d.out.split(/\r?\n/);
      if (d.code === 0) mangled.forEach((m, i) => { const f = res.profile!.functions.find((x) => x.name === m); if (f && names[i]) f.name = names[i]; });
    }
  }
  res.ms = Date.now() - t0;
  return { ...res, ok: true, stage: 'done' };
}
