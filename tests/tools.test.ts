import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findTodos, applyEdits, refMatches, parseStyle, writeStyle, proseWords } from '../src/renderer/lib/tools';
import { createProject, TEMPLATES } from '../src/main/templates';

describe('to-do list', () => {
  it('finds notes in every comment style, with the text after the word', () => {
    const src = 'int x; // TODO: tidy this\n/* FIXME(jay) leaks */\n# TODO python too\n * XXX inside a block\nTODO not a comment\nint todo_count;';
    expect(findTodos(src, ['TODO', 'FIXME', 'XXX']).map((n) => [n.line, n.word, n.note])).toEqual([
      [0, 'TODO', 'tidy this'], [1, 'FIXME', 'jay) leaks'.replace(/^jay\) /, 'jay) ')], [2, 'TODO', 'python too'], [3, 'XXX', 'inside a block'],
    ]);
  });
});

describe('formatting', () => {
  it('applies edits from the end, so positions stay right', () => {
    const text = 'int  a;\nint b ;\n';
    expect(applyEdits(text, [
      { range: { start: { line: 0, character: 3 }, end: { line: 0, character: 5 } }, newText: ' ' },
      { range: { start: { line: 1, character: 5 }, end: { line: 1, character: 6 } }, newText: '' },
    ])).toBe('int a;\nint b;\n');
  });
});

describe('reference search', () => {
  const names = ['std::vector', 'std::vector::push_back', 'std::deque::push_back', 'std::sort', 'std::ranges::sort', 'std::sort_heap'];
  it('ranks the exact name, then std::, then members', () => {
    expect(refMatches(names, 'sort')[0]).toBe('std::sort');
    expect(refMatches(names, 'std::vector')[0]).toBe('std::vector');
    expect(refMatches(names, 'push_back').slice(0, 2).sort()).toEqual(['std::deque::push_back', 'std::vector::push_back']);
    expect(refMatches(names, 'nothing')).toEqual([]);
  });
});

describe('code style file', () => {
  it('rewrites chosen keys in place and keeps everything else', () => {
    const src = '---\n# house style\nBasedOnStyle: Google\nIndentWidth: 2\nIncludeCategories:\n  - Regex: "^<"\n    Priority: 1\nColumnLimit: 100\n';
    const p = parseStyle(src);
    expect(p.values).toMatchObject({ BasedOnStyle: 'Google', IndentWidth: '2', ColumnLimit: '100' });
    const out = writeStyle(p.lines, { BasedOnStyle: 'LLVM', IndentWidth: '4', PointerAlignment: 'Left' });
    expect(out).toBe('---\n# house style\nBasedOnStyle: LLVM\nIndentWidth: 4\nIncludeCategories:\n  - Regex: "^<"\n    Priority: 1\nPointerAlignment: Left\n');
  });
  it('a new file starts with its base style', () => {
    expect(writeStyle([], { IndentWidth: '3', BasedOnStyle: 'Mozilla' })).toBe('BasedOnStyle: Mozilla\nIndentWidth: 3\n');
  });
});

describe('spelling', () => {
  it('checks plain words only, not names, acronyms, numbers or links', () => {
    const w = proseWords(' Compute the totl for each fooBar and HTTP_OK, see https://x.org/abc v2beta file.cpp it\'s fine').map((x) => x.word);
    expect(w).toEqual(['Compute', 'the', 'totl', 'for', 'each', 'and', 'see', 'fine']);
  });
});

describe('project templates', () => {
  it('creates a template\'s files and never overwrites', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'litho-tpl-'));
    const r = createProject(parent, 'demo', 'cmake');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(fs.readFileSync(path.join(r.dir, 'CMakeLists.txt'), 'utf8')).toContain('CMAKE_EXPORT_COMPILE_COMMANDS ON');
    expect(r.open).toBe(path.join(r.dir, 'src', 'main.cpp'));
    expect(createProject(parent, 'demo', 'cmake')).toMatchObject({ ok: false });
    expect(createProject(parent, '../escape', 'cmake')).toMatchObject({ ok: false });
    for (const t of TEMPLATES) expect(createProject(parent, `t-${t.id}`, t.id).ok).toBe(true);
  });
});
