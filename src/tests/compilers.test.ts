// Reading the code as gcc or MSVC: finding the compilers, the commands written for them, which compilers clangd may
// ask, and (with the real clangd) that a cl.exe command really puts clang into its MSVC mode.
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isGcc, gccVersion, findGcc, msvcLayout, msvcFlag, commandFor, projectDrivers, Compiler } from '../main/compilers';
import { ensureCompileCommands, findCompileCommands, staleCompileCommands, LspClient, findClangd } from '../main/lsp';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'litho-cc-'));
const touch = (p: string, text = '') => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); return p; };
const made: string[] = [];
afterAll(() => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });

const HOMEBREW = 'g++-14 (Homebrew GCC 14.2.0_1) 14.2.0\nCopyright (C) 2024 Free Software Foundation, Inc.\n';
const UBUNTU = 'g++ (Ubuntu 13.2.0-23ubuntu4) 13.2.0\nCopyright (C) 2023 Free Software Foundation, Inc.\n';
const MINGW = 'g++.exe (Rev2, Built by MSYS2 project) 14.1.0\nCopyright (C) 2024 Free Software Foundation, Inc.\n';
const APPLE = 'Apple clang version 21.0.0 (clang-2100.1.1.101)\nTarget: arm64-apple-darwin27.0.0\nThread model: posix\n';

describe('finding gcc', () => {
  it('tells GCC from clang installed under the name g++', () => {
    expect(isGcc(HOMEBREW)).toBe(true);
    expect(isGcc(UBUNTU)).toBe(true);
    expect(isGcc(MINGW)).toBe(true);
    expect(isGcc(APPLE)).toBe(false);
    expect(gccVersion(HOMEBREW)).toBe('14.2.0');
    expect(gccVersion(UBUNTU)).toBe('13.2.0');
    expect(gccVersion(MINGW)).toBe('14.1.0');
  });
  it('skips a g++ that is Apple clang and takes the next real one, with its gcc beside it', () => {
    const d = tmp(); made.push(d);
    const apple = touch(path.join(d, 'usr/bin/g++')), brew = touch(path.join(d, 'brew/bin/g++-14')), gcc = touch(path.join(d, 'brew/bin/gcc-14'));
    const out = { [apple]: APPLE, [brew]: HOMEBREW } as Record<string, string>;
    const c = findGcc('', (exe) => out[exe] ?? '', [apple, path.join(d, 'missing/g++'), brew]);
    expect(c).toEqual({ kind: 'gcc', cxx: brew, cc: gcc, version: '14.2.0' });
    expect(findGcc('', (exe) => out[exe] ?? '', [apple])).toBeNull();
    expect(findGcc(apple, (exe) => out[exe] ?? '')).toBeNull();   // a path given is still checked
  });
});

describe('finding MSVC', () => {
  it('reads the default VC tools and the newest Windows SDK of a Visual Studio folder', () => {
    const d = tmp(); made.push(d);
    const vs = path.join(d, 'VS'), kits = path.join(d, 'Kits');
    touch(path.join(vs, 'VC/Auxiliary/Build/Microsoft.VCToolsVersion.default.txt'), '14.40.33807\r\n');
    const cl = touch(path.join(vs, 'VC/Tools/MSVC/14.40.33807/bin/Hostx64/x64/cl.exe'));
    fs.mkdirSync(path.join(vs, 'VC/Tools/MSVC/14.40.33807/include'), { recursive: true });
    for (const v of ['10.0.19041.0', '10.0.22621.0']) for (const s of ['ucrt', 'shared', 'um', 'winrt']) fs.mkdirSync(path.join(kits, 'Include', v, s), { recursive: true });
    const c = msvcLayout(vs, kits)!;
    expect(c.cxx).toBe(cl);
    expect(c.version).toBe('14.40.33807');
    expect(c.include).toEqual([path.join(vs, 'VC/Tools/MSVC/14.40.33807/include'), ...['ucrt', 'shared', 'um', 'winrt'].map((s) => path.join(kits, 'Include/10.0.22621.0', s))]);
    expect(msvcLayout(vs, kits, 'arm64')).toBeNull();   // no ARM64 tools in this install
  });
  it('writes gcc-style flags the way cl.exe spells them', () => {
    expect(msvcFlag('-I/src/include')).toBe('/I/src/include');
    expect(msvcFlag('-DNDEBUG=1')).toBe('/DNDEBUG=1');
    expect(msvcFlag('-UFOO')).toBe('/UFOO');
    expect(msvcFlag('-std=c++17')).toBe('/std:c++17');
    expect(msvcFlag('-std=gnu++20')).toBe('/std:c++20');
    expect(msvcFlag('-std=c++11')).toBe('/std:c++14');   // cl's oldest
    expect(msvcFlag('-std=c++2b')).toBe('/std:c++latest');
    expect(msvcFlag('-std=c17')).toBe('/std:c17');
    expect(msvcFlag('-Wall')).toBe('/clang:-Wall');
    expect(msvcFlag('/permissive-')).toBe('/permissive-');
  });
});

describe('the commands written for each compiler', () => {
  const msvc: Compiler = { kind: 'msvc', cxx: 'C:\\VS\\cl.exe', cc: 'C:\\VS\\cl.exe', version: '14.40', include: ['C:\\VS\\include', 'C:\\Kits\\ucrt'] };
  const gcc: Compiler = { kind: 'gcc', cxx: '/opt/gcc/bin/g++-14', cc: '/opt/gcc/bin/gcc-14', version: '14.2.0' };
  it('names the compiler, in its own flag style', () => {
    expect(commandFor(null, '/p/a.cpp', ['-I/p'])).toEqual(['clang++', '-I/p', '-c', '/p/a.cpp']);
    expect(commandFor(null, '/p/a.c', ['-I/p'])).toEqual(['clang', '-I/p', '-c', '/p/a.c']);
    expect(commandFor(gcc, '/p/a.cpp', ['-I/p'])).toEqual(['/opt/gcc/bin/g++-14', '-I/p', '-c', '/p/a.cpp']);
    expect(commandFor(gcc, '/p/a.c', ['-I/p'])).toEqual(['/opt/gcc/bin/gcc-14', '-I/p', '-c', '/p/a.c']);
    expect(commandFor(msvc, 'C:\\p\\a.cpp', ['-IC:\\p', '-std=c++17'])).toEqual(['C:\\VS\\cl.exe', '/nologo', '/TP', '/EHsc', '/IC:\\p', '/std:c++17', '/imsvcC:\\VS\\include', '/imsvcC:\\Kits\\ucrt', '/c', 'C:\\p\\a.cpp']);
    expect(commandFor(msvc, 'C:\\p\\a.c', [])).toEqual(['C:\\VS\\cl.exe', '/nologo', '/TC', '/imsvcC:\\VS\\include', '/imsvcC:\\Kits\\ucrt', '/c', 'C:\\p\\a.c']);
  });
  it('a folder without its own database gets one naming that compiler', () => {
    const d = tmp(); made.push(d);
    const proj = path.join(d, 'proj');
    touch(path.join(proj, 'src/main.cpp'), 'int main() {}\n'); touch(path.join(proj, 'src/util.c'), 'int f(void) { return 0; }\n'); touch(path.join(proj, 'include/u.h'));
    const db = (c: Compiler | null) => JSON.parse(fs.readFileSync(path.join(ensureCompileCommands(proj, path.join(d, 'state'), c)!, 'compile_commands.json'), 'utf8')) as { file: string; arguments: string[] }[];
    const g = db(gcc);
    expect(g.find((e) => e.file.endsWith('main.cpp'))!.arguments[0]).toBe(gcc.cxx);
    expect(g.find((e) => e.file.endsWith('util.c'))!.arguments[0]).toBe(gcc.cc);
    const m = db(msvc).find((e) => e.file.endsWith('main.cpp'))!.arguments;
    expect(m.slice(0, 4)).toEqual([msvc.cxx, '/nologo', '/TP', '/EHsc']);
    expect(m).toContain(`/I${path.join(proj, 'include')}`);
    expect(db(null).find((e) => e.file.endsWith('main.cpp'))!.arguments[0]).toBe('clang++');
  });
});

describe('a compile database written for another place', () => {
  it('is passed over when its folder no longer exists, so SkyCodeX writes its own', () => {
    const d = tmp(); made.push(d);
    const proj = path.join(d, 'proj'), cpp = touch(path.join(proj, 'src', 'a.cpp'), 'int main() {}\n');
    const write = (dir: string, where: string) => touch(path.join(dir, 'compile_commands.json'), JSON.stringify([{ directory: where, file: 'src/a.cpp', arguments: ['clang++', '-c', 'src/a.cpp'] }]));
    // built here: used as it is
    write(proj, proj);
    expect(staleCompileCommands(proj)).toBe(false);
    expect(findCompileCommands(proj)).toBe(proj);
    expect(ensureCompileCommands(proj, path.join(d, 'state'))).toBeNull();
    // built before the folder was moved (the old folder is gone): treated as none
    write(proj, path.join(d, 'old place', 'proj'));
    expect(staleCompileCommands(proj)).toBe(true);
    expect(findCompileCommands(proj)).toBeNull();
    const own = ensureCompileCommands(proj, path.join(d, 'state'))!;
    expect(JSON.parse(fs.readFileSync(path.join(own, 'compile_commands.json'), 'utf8')).map((e: { file: string }) => e.file)).toEqual([cpp]);
    // a build folder's database is checked the same way; a relative folder is never called stale
    fs.rmSync(path.join(proj, 'compile_commands.json'));
    write(path.join(proj, 'build'), path.join(d, 'gone'));
    expect(findCompileCommands(proj)).toBeNull();
    write(path.join(proj, 'build'), '..');
    expect(findCompileCommands(proj)).toBe(path.join(proj, 'build'));
  });
});

describe('the compilers clangd may ask (--query-driver)', () => {
  it('only installed compilers a project names: never a program inside the project, never one not named like a compiler', () => {
    const d = tmp(); made.push(d);
    const proj = path.join(d, 'proj'), bin = path.join(d, 'tools/bin');
    const gpp = touch(path.join(bin, 'g++-13')), cross = touch(path.join(bin, 'arm-none-eabi-gcc'));
    touch(path.join(bin, 'evil')); touch(path.join(proj, 'tools/g++'));
    touch(path.join(proj, 'build/compile_commands.json'), JSON.stringify([
      { directory: proj, file: 'a.cpp', arguments: [gpp, '-c', 'a.cpp'] },
      { directory: proj, file: 'b.c', command: `${cross} -c b.c` },
      { directory: proj, file: 'c.cpp', arguments: ['g++-13', '-c', 'c.cpp'] },               // found on the PATH
      { directory: proj, file: 'd.cpp', arguments: [path.join(proj, 'tools/g++'), '-c', 'd.cpp'] },   // inside the project
      { directory: proj, file: 'e.cpp', arguments: [path.join(bin, 'evil'), '-c', 'e.cpp'] },        // not a compiler by name
      { directory: proj, file: 'f.cpp', arguments: [path.join(bin, 'g++-99'), '-c', 'f.cpp'] },      // not installed
    ]));
    expect(projectDrivers(path.join(proj, 'build'), proj, { PATH: bin }, 'darwin')).toEqual([gpp, cross, 'g++-13']);
    expect(projectDrivers(path.join(proj, 'nothing'), proj, { PATH: bin }, 'darwin')).toEqual([]);
  });
});

describe('MSVC mode in the real clangd', () => {
  const clangd = findClangd('auto', '/nonexistent');
  it.skipIf(!clangd)('a cl.exe command reads the code as MSVC: _MSC_VER is defined and __GNUC__ is not', async () => {
    const d = tmp(); made.push(d);
    const proj = path.join(d, 'proj'), file = touch(path.join(proj, 'main.cpp'), '#ifdef _MSC_VER\nint read_as_msvc();\n#endif\n#ifdef __GNUC__\nint read_as_gnu();\n#endif\nint main() { return 0; }\n');
    const names = async (c: Compiler | null) => {
      const lsp = new LspClient(() => {}, () => {});
      await lsp.start(clangd!, proj, [], path.join(d, 'state'), c);
      lsp.notify('textDocument/didOpen', { textDocument: { uri: pathToFileURL(file).href, languageId: 'cpp', version: 1, text: fs.readFileSync(file, 'utf8') } });
      const syms = (await lsp.request('textDocument/documentSymbol', { textDocument: { uri: pathToFileURL(file).href } })) as { name: string }[];
      lsp.stop();
      return syms.map((x) => x.name).sort();
    };
    expect(await names({ kind: 'msvc', cxx: '/opt/msvc/bin/cl.exe', cc: '/opt/msvc/bin/cl.exe', version: '', include: [] })).toEqual(['main', 'read_as_msvc']);
    expect(await names(null)).toEqual(['main', 'read_as_gnu']);
  }, 30000);
});
