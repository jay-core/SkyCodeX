import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { atomicWrite, listDir, listFiles } from '../main/files';
import { BUILD_DIR } from '../main/lsp';
import { entryScore } from '../shared/entries';
import { effects } from '../shared/flowfacts';
import type { AstNode, Run, RunRow } from '../shared/flowrun';
import { buildSeq, decodeWalk, encodeWalk, startState } from '../shared/flowseq';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'skycodex-sweep-'));
const posix = process.platform !== 'win32';

describe('saving and listing through links', () => {
  it.runIf(posix)('a save through a link changes the file it points to and keeps the link', () => {
    const d = tmp(), real = path.join(d, 'real.txt'), link = path.join(d, 'link.txt');
    fs.writeFileSync(real, 'old');
    fs.symlinkSync(real, link);
    atomicWrite(link, 'new');
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
    expect(fs.readFileSync(real, 'utf8')).toBe('new');
  });

  it.runIf(posix)('a linked folder is listed as a folder and is not walked into', () => {
    const d = tmp();
    fs.mkdirSync(path.join(d, 'src'));
    fs.writeFileSync(path.join(d, 'src', 'a.c'), '');
    fs.symlinkSync(d, path.join(d, 'src', 'loop'));
    const loop = listDir(path.join(d, 'src')).find((e) => e.name === 'loop');
    expect(loop).toMatchObject({ dir: true, link: true });
    expect(listFiles(d).map((f) => path.basename(f))).toEqual(['a.c']);
  });
});

describe('folders a build writes into', () => {
  it('are named build or out, with or without a suffix, or cmake-build-*', () => {
    for (const n of ['build', 'Build', 'build-debug', 'build_arm', 'out', 'out.x64', 'cmake-build-release']) expect(BUILD_DIR.test(n)).toBe(true);
    for (const n of ['builder', 'output', 'outline', 'rebuild', 'src']) expect(BUILD_DIR.test(n)).toBe(false);
  });
});

describe('entry ranking names no one project', () => {
  it('a folder called example_build counts like any other folder', () => {
    expect(entryScore('ports/m4/example_build/a.c')).toBe(entryScore('ports/m4/anything/a.c'));
  });
});

describe('a member called lock', () => {
  const fn = (type: string): AstNode => {
    const obj = { kind: 'DeclRef', role: 'expression', detail: 'x', arcana: `DeclRefExpr <col:3> '${type}' lvalue ParmVar 0x1 'x' '${type}'` } as AstNode;
    const call: AstNode = { kind: 'CXXMemberCall', role: 'expression', children: [{ kind: 'Member', role: 'expression', detail: 'lock', children: [obj] }] };
    return { kind: 'Function', arcana: "FunctionDecl <line:1:1> f 'void ()'", children: [{ kind: 'Compound', role: 'statement', children: [call] }] } as AstNode;
  };
  it('takes a lock on a mutex', () => {
    expect(effects(fn('std::mutex'), '').locks).toHaveLength(1);
    expect(effects(fn('std::unique_lock<std::mutex>'), '').locks).toHaveLength(1);
  });
  it('takes none on a weak_ptr', () => {
    expect(effects(fn('std::weak_ptr<Session>'), '').locks).toEqual([]);
  });
});

describe('a shared walk that is not well formed', () => {
  const row: RunRow = { kind: 'step', n: 1, key: 'k', name: 'main', file: 'a.c', line: 0, start: 0, caller: null, at: null, depth: 0, frames: [], thread: false, last: 0, lines: 5 };
  const run: Run = { rows: [row], frames: [], missing: [] };
  const s = buildSeq(run);
  it('is refused, not thrown', () => {
    expect(decodeWalk(s, 'skycodex:walk?entry=%E0%A4%A&at=0')).toBeNull();
    expect(decodeWalk(s, 'skycodex:walk?entry=k&at=0&notes=%E0%A4%A')).toBeNull();
  });
  it('and a well formed one still reads back', () => {
    const w = decodeWalk(s, encodeWalk('k', [startState(s)], 40, { 0: 'a: note, with 100%' }));
    expect(w?.entry).toBe('k');
    expect(w?.notes[0]).toBe('a: note, with 100%');
  });
});
