import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseSanitizer, profileFromCov, projectSources, runWithChecks } from '../main/checks';
import { redact } from '../main/report';

const TSAN = `==================
WARNING: ThreadSanitizer: data race (pid=4242)
  Write of size 4 at 0x000104c8c000 by thread T2:
    #0 worker(int*) race.cpp:5:12 (race+0x100003a1c)
    #1 decltype(std::declval<void (*)(int*)>()) std::__1::__invoke thread:345:3 (race+0x100003c2c)

  Previous write of size 4 at 0x000104c8c000 by thread T1:
    #0 worker(int*) race.cpp:5:12 (race+0x100003a1c)

  Thread T2 (tid=1234, running) created by main thread at:
    #0 pthread_create <null> (libclang_rt.tsan_osx_dynamic.dylib:arm64e+0x2f0bc)
    #1 main race.cpp:11:17 (race+0x100003b3c)

SUMMARY: ThreadSanitizer: data race race.cpp:5:12 in worker(int*)
==================`;
const ASAN = `=================================================================
==9876==ERROR: AddressSanitizer: heap-use-after-free on address 0x602000000010 at pc 0x0001 bp 0x0002 sp 0x0003
READ of size 4 at 0x602000000010 thread T0
    #0 0x100003e2c in main /p/uaf.cpp:6:18
    #1 0x18e0b in start+0x9f4 (dyld:arm64e+0xfffffffffff4d0b0)

0x602000000010 is located 0 bytes inside of 4-byte region [0x602000000010,0x602000000014)
freed by thread T0 here:
    #0 0x1003 in operator delete(void*) (libclang_rt.asan_osx_dynamic.dylib:arm64e+0x5f9a0)
    #1 0x100003df0 in main /p/uaf.cpp:5:5
SUMMARY: AddressSanitizer: heap-use-after-free /p/uaf.cpp:6:18 in main`;
const UBSAN = `/p/ub.cpp:4:14: runtime error: signed integer overflow: 2147483647 + 1 cannot be represented in type 'int'
SUMMARY: UndefinedBehaviorSanitizer: undefined-behavior /p/ub.cpp:4:14`;

describe('sanitizer reports', () => {
  it('reads a data race with both accesses and where the thread started', () => {
    const [r] = parseSanitizer(TSAN);
    expect(r).toMatchObject({ tool: 'ThreadSanitizer', title: 'data race' });
    expect(r.sections.map((s) => s.title)).toEqual(['Write of size 4 by thread T2', 'Previous write of size 4 by thread T1', 'Thread T2 (tid=1234, running) created by main thread']);
    expect(r.sections[0].frames[0]).toEqual({ fn: 'worker(int*)', file: 'race.cpp', line: 5, col: 12 });
    expect(r.sections[2].frames[0]).toMatchObject({ fn: 'main', line: 11 });   // frames without a source line are left out
  });
  it('reads a use after free with where the memory was freed', () => {
    const [r] = parseSanitizer(ASAN);
    expect(r.title).toBe('heap-use-after-free');
    expect(r.sections[0].frames[0]).toEqual({ fn: 'main', file: '/p/uaf.cpp', line: 6, col: 18 });
    expect(r.sections.find((s) => s.title.startsWith('freed by'))!.frames.some((f) => f.line === 5)).toBe(true);
  });
  it('reads undefined behaviour at its line', () => {
    const [r] = parseSanitizer(UBSAN);
    expect(r).toMatchObject({ title: 'signed integer overflow', sections: [{ frames: [{ file: '/p/ub.cpp', line: 4, col: 14 }] }] });
  });
});

describe('profile', () => {
  it('turns llvm-cov segments into per-line counts and ranks functions', () => {
    const json = { data: [{ files: [{ filename: '/p/a.cpp', segments: [[3, 1, 1, true, true, false], [4, 5, 100, true, true, false], [4, 9, 7, true, false, false], [6, 1, 0, true, false, true]] }, { filename: '/usr/include/x.h', segments: [[1, 1, 9, true, true, false]] }],
      functions: [{ name: 'main', count: 1, filenames: ['/p/a.cpp'], regions: [[3, 1]] }, { name: 'a.cpp:hot', count: 100, filenames: ['/p/a.cpp'], regions: [[8, 1]] }] }] };
    const p = profileFromCov(json, (f) => f.startsWith('/p/'));
    expect(p.lines['/p/a.cpp']).toEqual([[3, 1], [4, 100]]);
    expect(p.lines['/usr/include/x.h']).toBeUndefined();
    expect(p.functions.map((f) => [f.name, f.count, f.line])).toEqual([['hot', 100, 7], ['main', 1, 2]]);
  });
});

describe('problem reports', () => {
  it('hides the home folder and the account name', () => {
    expect(redact('log /Users/jay/proj/a.cpp by jay; jaybird stays', '/Users/jay')).toBe('log ~/proj/a.cpp by <user>; jaybird stays');
  });
});

const clang = process.platform === 'darwin' && fs.existsSync('/usr/bin/clang++');
describe.skipIf(!clang)('a real run (system clang)', () => {
  const tools = { cxx: '/usr/bin/clang++', cc: '/usr/bin/clang', profdata: null as string | null, cov: null as string | null, env: { SDKROOT: clang ? execFileSync('xcrun', ['--show-sdk-path'], { encoding: 'utf8' }).trim() : '' } };
  try { tools.profdata = execFileSync('xcrun', ['--find', 'llvm-profdata'], { encoding: 'utf8' }).trim(); tools.cov = execFileSync('xcrun', ['--find', 'llvm-cov'], { encoding: 'utf8' }).trim(); (tools as any).cxxfilt = execFileSync('xcrun', ['--find', 'c++filt'], { encoding: 'utf8' }).trim(); } catch { /* no profile tools */ }
  const project = (src: string) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'litho-chk-')); fs.writeFileSync(path.join(d, 'main.cpp'), src); return d; };

  it('finds a use after free and points at the line', async () => {
    const root = project('#include <cstdio>\nint main() {\n  int* p = new int(4);\n  delete p;\n  std::printf("%d\\n", *p);\n}\n');
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'litho-chk-w-'));
    const r = await runWithChecks(root, 'memory', [], tools, work);
    expect(r.message ?? '').toBe('');
    expect(r.reports[0].title).toBe('heap-use-after-free');
    expect(r.reports[0].sections[0].frames[0]).toMatchObject({ file: path.join(root, 'main.cpp'), line: 5 });
    expect(fs.readdirSync(root)).toEqual(['main.cpp']);   // nothing was written into the project
  }, 120000);
  it.skipIf(!tools.cov)('counts how often each line ran', async () => {
    const root = project('int f(int x) { return x * 2; }\nint main() {\n  int s = 0;\n  for (int i = 0; i < 1000; i++) s += f(i);\n  return s == 0;\n}\n');
    const r = await runWithChecks(root, 'profile', [], tools, fs.mkdtempSync(path.join(os.tmpdir(), 'litho-chk-w-')));
    expect(r.message ?? '').toBe('');
    expect(r.profile!.functions.find((f) => f.name === 'f(int)')!.count).toBe(1000);
  }, 120000);
  it('refuses a folder with two programs', () => {
    const d = project('int main(){}');
    fs.mkdirSync(path.join(d, 'tools')); fs.writeFileSync(path.join(d, 'tools', 'gen.cpp'), 'int main(){}');
    expect(projectSources(d).mains).toHaveLength(2);
  });
});
