import { describe, it, expect } from 'vitest';
import { candidatesFor, verdict, isCast, includeSpot, lineStarts, applyEdit, reason, RDiag } from '../shared/repair';

const at = (line: number, character: number) => ({ line, character });
const diag = (message: string, line: number, character: number, more: Partial<RDiag> = {}): RDiag => ({ range: { start: at(line, character), end: at(line, character + 1) }, severity: 1, message, ...more });
const texts = (text: string, d: RDiag, lang: 'c' | 'cpp' = 'cpp') => candidatesFor(text, d, lang).map((c) => applyEdit(text, c.edit));

describe('repair: never a cast', () => {
  it('knows C++ and C-style casts', () => {
    for (const s of ['static_cast<int>(', 'reinterpret_cast<char *>(', '(int)', '(const char *)', '(unsigned long)', '(struct node *)']) expect(isCast(s)).toBe(true);
    for (const s of [')', 'std::', '*', '&', '(', '#include <vector>\n', 'route', '(rout(r))']) expect(isCast(s)).toBe(false);
  });
  it('drops a clang fix-it that casts', () => {
    const text = 'int f(long v) { int *p = v; }';
    const d = diag("cannot initialize a variable of type 'int *' with an lvalue of type 'long'", 0, 25, {
      codeActions: [{ title: 'insert cast', edit: { changes: { 'file:///a.cpp': [{ range: { start: at(0, 25), end: at(0, 25) }, newText: '(int *)' }] } } }],
    });
    expect(candidatesFor(text, d, 'cpp').some((c) => /\(int \*\)/.test(c.edit.insert))).toBe(false);
  });
});

describe('repair: candidates', () => {
  it('closes a ( that is never closed, naming where it opened', () => {
    const text = 'void h(int r) {\n  if (v(r) && c(r) {\n  }\n}\n';
    const d = diag("expected ')'", 1, 19, { relatedInformation: [{ location: { uri: 'file:///a.cpp', range: { start: at(1, 5), end: at(1, 6) } }, message: "to match this '('" }] });
    const cs = candidatesFor(text, d, 'cpp');
    expect(cs.map((c) => applyEdit(text, c.edit))).toContain('void h(int r) {\n  if (v(r) && c(r)) {\n  }\n}\n');
    expect(cs[0].src).toBe('closes the ( opened at column 6');
  });
  it('reads messages as clangd writes them, capitalised', () => {
    const text = 'int f(const int *v) { int h = v; }';
    expect(texts(text, diag("Cannot initialize a variable of type 'int' with an lvalue of type 'const int *'", 0, 30))).toContain('int f(const int *v) { int h = *v; }');
  });
  it('finds the unclosed ( itself when clangd sends no note, past strings and comments', () => {
    const text = 'void h() {\n  if (v(")") /* ( */ && c(r) {\n  }\n}\n';
    const cs = candidatesFor(text, diag("Expected ')'", 1, 29), 'cpp');
    expect(cs[0].src).toBe('closes the ( opened at column 6');
    const noted = candidatesFor(text, diag("Expected ')'", 1, 29, { relatedInformation: [{ location: { uri: 'file:///a.cpp', range: { start: at(1, 5), end: at(1, 6) } }, message: "To match this '('" }] }), 'cpp');
    expect(noted[0].src).toBe('closes the ( opened at column 6');
  });
  it('removes a stray ) that clang reads as a missing ;', () => {
    expect(texts('int f() { return h); }', diag("Expected ';' after return statement (fix available)", 0, 18))).toContain('int f() { return h; }');
  });
  it('puts * on the value when clang points at the variable', () => {
    expect(texts('int f(const int *v) { int h = v; }', diag("Cannot initialize a variable of type 'int' with an lvalue of type 'const int *'", 0, 26))).toContain('int f(const int *v) { int h = *v; }');
  });
  it('removes a stray closing brace', () => {
    const text = 'int a() { return 1; } }\n';
    expect(texts(text, diag("extraneous closing brace ('}')", 0, 22))).toContain('int a() { return 1; } \n');
  });
  it('adds std:: to a standard name whose header is included', () => {
    const text = '#include <string>\nstruct R { string p; };\n';
    const cs = candidatesFor(text, diag("unknown type name 'string'", 1, 11), 'cpp');
    expect(cs.map((c) => applyEdit(text, c.edit))).toEqual(['#include <string>\nstruct R { std::string p; };\n']);
    expect(cs[0].why).toMatch(/<string> is already included/);
  });
  it('adds the #include a std:: name needs, after the last one', () => {
    const text = '// top\n#include <vector>\n\nint main() { std::sort(a, b); }\n';
    expect(texts(text, diag("no member named 'sort' in namespace 'std'", 3, 18))).toEqual(['// top\n#include <vector>\n#include <algorithm>\n\nint main() { std::sort(a, b); }\n']);
  });
  it('adds a C header for an undeclared library function, with no std::', () => {
    const text = '#include <string.h>\nint main(void) { printf("x"); }\n';
    expect(texts(text, diag("call to undeclared library function 'printf' with type 'int (const char *, ...)'; ISO C99 and later do not support implicit function declarations", 1, 17), 'c'))
      .toEqual(['#include <string.h>\n#include <stdio.h>\nint main(void) { printf("x"); }\n']);
  });
  it('reads through a pointer with *, or passes an address with &', () => {
    const text = 'int f(const int *v) { int h = v; }';
    expect(texts(text, diag("cannot initialize a variable of type 'int' with an lvalue of type 'const int *'", 0, 30))).toContain('int f(const int *v) { int h = *v; }');
    const t2 = 'void g(int *o, int v) { o = v; }';
    expect(texts(t2, diag("assigning to 'int *' from incompatible type 'int'", 0, 28))).toContain('void g(int *o, int v) { o = &v; }');
  });
  it("takes clang's own fix-it, and a bracket pair as one edit", () => {
    const text = 'int x = rout(r);';
    const fix = { title: "change 'rout' to 'route'", edit: { changes: { 'file:///a.cpp': [{ range: { start: at(0, 8), end: at(0, 12) }, newText: 'route' }] } } };
    const cs = candidatesFor(text, diag("use of undeclared identifier 'rout'; did you mean 'route'?", 0, 8, { codeActions: [fix] }), 'cpp');
    expect(cs[0]).toMatchObject({ clang: true, src: 'clang · did you mean route' });
    expect(applyEdit(text, cs[0].edit)).toBe('int x = route(r);');
    const pair = { title: 'add parentheses', edit: { changes: { 'file:///a.cpp': [{ range: { start: at(0, 8), end: at(0, 8) }, newText: '(' }, { range: { start: at(0, 15), end: at(0, 15) }, newText: ')' }] } } };
    expect(applyEdit(text, candidatesFor(text, diag('x', 0, 8, { codeActions: [pair] }), 'cpp')[0].edit)).toBe('int x = (rout(r));');
    const two = { title: 'two places', edit: { changes: { 'file:///a.cpp': [{ range: { start: at(0, 0), end: at(0, 3) }, newText: 'long' }, { range: { start: at(0, 8), end: at(0, 12) }, newText: 'route' }] } } };
    expect(candidatesFor(text, diag('x', 0, 8, { codeActions: [two] }), 'cpp')).toEqual([]);
  });
});

describe('repair: verdict', () => {
  const text = '#include <string>\nstruct R { string p; };\nint main() { return 0 }\n';
  const target = diag("unknown type name 'string'", 1, 11);
  const semi = diag("expected ';' after return statement", 2, 21);
  const edit = { from: text.indexOf('string p'), to: text.indexOf('string p') + 6, insert: 'std::string' };
  it('keeps a fix that removes its error and adds nothing', () => {
    expect(verdict([target, semi], [semi], target, edit, text)).toEqual({ cleared: 1, revealed: [] });
  });
  it('rejects a fix that brings a new error or warning', () => {
    expect(verdict([target, semi], [semi, { ...diag('unused variable', 2, 0), severity: 2 }], target, edit, text).cleared).toBe(0);
    expect(verdict([target, semi], [target, semi], target, edit, text).cleared).toBe(0);
  });
  it('knows an error the edit only moved down a line', () => {
    const inc = { from: includeSpot(text), to: includeSpot(text), insert: '#include <vector>\n' };
    expect(verdict([target, semi], [{ ...semi, range: { start: at(3, 21), end: at(3, 22) } }], target, inc, text).cleared).toBe(1);
  });
  it('counts the errors a fix clears, and says so', () => {
    expect(verdict([target, semi, diag("expected ';'", 2, 5)], [semi], target, edit, text).cleared).toBe(2);
    expect(reason({ edit, src: '', why: 'Why.' }, { cleared: 2, revealed: [] })).toBe('Why. With it, this error and 1 more are gone and clangd finds no new one in the file.');
  });
  it("lets a syntax fix reveal errors clang skipped on later lines, and names them; never on its own line", () => {
    const t = 'void h() {\n  if (v(r) {\n    rout(r);\n  }\n}\n';
    const paren = diag("Expected ')'", 1, 11), fix = { from: 10 + 1 + 10, to: 10 + 1 + 10, insert: ')' };
    const rout = diag("Use of undeclared identifier 'rout'; did you mean 'route'? (fix available)", 2, 4);
    const v = verdict([paren], [rout], paren, fix, t);
    expect(v).toEqual({ cleared: 1, revealed: [rout] });
    expect(reason({ edit: fix, src: '', why: 'Why.' }, v)).toBe("Why. With it, this error is gone. clangd then reads the code it had skipped, and finds 1 more problem there, not made by this fix: use of undeclared identifier 'rout' (line 3).");
    expect(verdict([paren], [diag('Invalid operands', 1, 4)], paren, fix, t).cleared).toBe(0);
    expect(verdict([target], [rout], target, fix, t).cleared).toBe(0);   // not after the fix of another kind of error
  });
});

describe('repair: where an #include goes', () => {
  it('after the last include, after a guard, or after the opening comments', () => {
    expect(includeSpot('#include <a>\n#include <b>\nint x;\n')).toBe(26);
    expect(includeSpot('#ifndef A_H\n#define A_H\nint x;\n#endif\n')).toBe(24);
    expect(includeSpot('// c\n// d\nint x;\n')).toBe(10);
    expect(includeSpot('int x;\n')).toBe(0);
    expect(includeSpot('/* licence\n * text\n */\nint x;\n')).toBe(23);
    expect(lineStarts('a\nb\n')).toEqual([0, 2, 4]);
  });
});
