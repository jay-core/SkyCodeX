import { describe, it, expect } from 'vitest';
import { langOf, looksLikeCpp, noteText, markCpp } from '../renderer/lib/langs';

describe('which files are C/C++', () => {
  it('knows the usual and the less usual header extensions', () => {
    for (const f of ['a.h', 'a.hpp', 'a.hxx', 'a.h++', 'a.ipp', 'a.inl', 'a.tpp', 'a.tcc', 'a.txx', 'a.ixx', 'a.cppm', 'a.cu', 'a.cuh'])
      expect(langOf(`/p/${f}`), f).toBe('cpp');
    expect(langOf('/p/notes.txt')).toBe('text');
    expect(langOf('/p/data.json')).toBe('json');
  });
  it('standard headers without an extension', () => {
    expect(langOf('/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/c++/v1/ostream')).toBe('cpp');
    expect(langOf('/usr/include/c++/13/ios')).toBe('cpp');
    expect(langOf('C:\\llvm-mingw\\include\\c++\\v1\\thread')).toBe('cpp');
  });
  it('reads the first lines of an unknown file', () => {
    expect(looksLikeCpp('// Copyright\n// licence\n#pragma once\nstruct A {};')).toBe(true);
    expect(looksLikeCpp('/* big\n licence\n block */\n\n#ifndef QT_STRING_H\n#define QT_STRING_H')).toBe(true);
    expect(looksLikeCpp('// -*- C++ -*-\n')).toBe(true);
    expect(looksLikeCpp('X(alpha, 1)\nX(beta, 2)\n')).toBe(false);   // an .inc/.def table has nothing to read; clangd marks those
    expect(looksLikeCpp('Hello, this is a README.\n# Heading')).toBe(false);
  });
  it('remembers files that read as C/C++ or that clangd pointed to', () => {
    noteText('/vendor/lib/Config', '#ifndef CONFIG\n#define CONFIG\n#endif\n');
    expect(langOf('/vendor/lib/Config')).toBe('cpp');
    noteText('/p/README', 'Read me first.');
    expect(langOf('/p/README')).toBe('text');
    markCpp('/p/opcodes.def');
    expect(langOf('/p/opcodes.def')).toBe('cpp');
  });
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { headerCommand, splitCommand, flagsOf } from '../main/lsp';

describe('a command for headers clang cannot recognise', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'litho-hdr-'));
  it('leaves known extensions, standard library headers and include fragments to clangd', () => {
    expect(headerCommand(path.join(root, 'a.hpp'), root)).toBeNull();
    expect(headerCommand('/usr/include/c++/13/ostream', root)).toBeNull();
    expect(headerCommand('/sdk/usr/include/c++/v1/ios', root)).toBeNull();
    expect(headerCommand(path.join(root, 'ops.def'), root)).toBeNull();
  });
  it('uses compile_flags.txt, marked as a C++ header', () => {
    fs.writeFileSync(path.join(root, 'compile_flags.txt'), '-std=c++17\n-Iinclude\n');
    const c = headerCommand(path.join(root, 'vendor', 'Config'), root)!;
    expect(c.compilationCommand).toEqual(['clang++', '-std=c++17', '-Iinclude', '-x', 'c++-header', path.join(root, 'vendor', 'Config')]);
    expect(c.workingDirectory).toBe(root);
    expect(headerCommand(path.join(root, 'impl.tcc'), root)!.compilationCommand).toContain('c++-header');
  });
  it('borrows the nearest compile_commands.json entry, without its input, output and dependency files', () => {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'litho-hdr-'));
    fs.mkdirSync(path.join(r, 'build'));
    fs.writeFileSync(path.join(r, 'build', 'compile_commands.json'), JSON.stringify([
      { directory: path.join(r, 'build'), file: path.join(r, 'other', 'x.cpp'), command: '/usr/bin/c++ -DFAR -c ../other/x.cpp -o x.o' },
      { directory: path.join(r, 'build'), file: path.join(r, 'lib', 'y.cpp'), arguments: ['/usr/bin/c++', '-DNEAR', '-I/opt/inc', '-MD', '-MF', 'y.d', '-std=gnu++20', '-o', 'y.o', '-c', path.join(r, 'lib', 'y.cpp')] },
    ]));
    const c = headerCommand(path.join(r, 'lib', 'Widget'), r)!;
    expect(c.compilationCommand).toEqual(['/usr/bin/c++', '-DNEAR', '-I/opt/inc', '-std=gnu++20', '-x', 'c++-header', path.join(r, 'lib', 'Widget')]);
    expect(c.workingDirectory).toBe(path.join(r, 'build'));
  });
  it('splits shell commands with quotes', () => {
    expect(splitCommand(`c++ -DNAME="a b" '-I/x y' -c f.cpp`)).toEqual(['c++', '-DNAME=a b', '-I/x y', '-c', 'f.cpp']);
    expect(flagsOf(['cc', '-xc++', '-o', 'a.o', '-c', 'a.cpp', '-O2'], 'a.cpp')).toEqual(['-O2']);
  });
});
