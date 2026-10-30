// The flow analyser (src/shared/flowrun.ts) on real clangd output, recorded by src/tests/fixtures/record-flow.mjs:
// tinyhttp end to end, and one function per evaluation-order rule (src/tests/fixtures/rules/rules.cpp).
// Every expectation here was worked out by hand from the source, not copied from the analyser's output.
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { loadFixture, describeRun } from './flowrun.fixture';
import { forCount, matchParen, analyseFunction, fnExtent, functionNode } from '../shared/flowrun';

const FIX = path.join(__dirname, 'fixtures');

describe('tinyhttp, from main', () => {
  const { run } = loadFixture(path.join(FIX, 'tinyhttp-flow.json'), path.resolve(__dirname, '../../samples/tinyhttp'));
  const r = run('src/main.cpp#3');
  const rows = describeRun(r);
  const row = (name: string, nth = 0) => r.rows.filter((x) => x.name === name)[nth];
  const frames = (name: string, nth = 0) => row(name, nth).frames.map((i) => r.frames[i]);

  it('numbers every function in execution order, each opened once', () => {
    expect(r.rows.filter((x) => x.kind === 'step').map((x) => `${x.n} ${x.name}`)).toEqual([
      '1 main', '2 load_config', '3 read_env', '4 Server', '5 start', '6 listen', '7 run', '8 flush', '9 accept', '10 handle',
      '11 parse_headers', '12 split', '13 trim', '14 is_space', '15 route', '16 match_path', '17 send_response', '18 write_all',
      '19 record', '20 keep_alive', '21 to_lower', '22 close', '23 stop',
    ]);
    expect(r.missing).toEqual([]);
  });
  it('later calls are references to the first step', () => {
    expect(r.rows.filter((x) => x.kind === 'ref').map((x) => `${x.name}→${r.rows[x.ref!].n} in ${r.rows[x.caller!].name}`)).toEqual([
      'is_space→14 in trim', 'trim→13 in parse_headers', 'split→12 in match_path', 'split→12 in match_path', 'write_all→18 in send_response', 'close→22 in stop',
    ]);
  });
  it('a loop with literal bounds and no early exit has an exact count', () => {
    expect(frames('read_env')).toMatchObject([{ kind: 'loop', count: 4, text: 'for (int i = 0; i < 4; ++i)' }]);
  });
  it('the lambda handed to std::thread runs on a thread', () => {
    expect(row('run').thread).toBe(true);
    expect(row('flush').thread).toBe(true);
    expect(frames('flush').map((f) => f.kind)).toEqual(['thread', 'loop']);
    expect(row('accept').thread).toBe(false);
  });
  it('the right side of && runs only when the left is true', () => {
    expect(frames('accept').map((f) => [f.kind, f.label])).toEqual([['loop', 'while'], ['arm', '&& socket_.accept(req)']]);
    expect(frames('to_lower').at(-1)).toMatchObject({ kind: 'arm', label: '&& to_lower(it->second) == "keep-alive"', text: 'it != h.end()' });
    expect(frames('is_space').slice(-2).map((f) => f.kind)).toEqual(['loop', 'arm']);
  });
  it('a range-for reads its range once, before the loop', () => {
    expect(frames('split').map((f) => f.text)).toEqual(['while (running_ && socket_.accept(req))']);
    expect(frames('trim').map((f) => f.kind)).toEqual(['loop', 'loop', 'guard']);
  });
  it('after an early return or continue, the rest runs only when it was not taken', () => {
    expect(frames('trim')[2]).toMatchObject({ kind: 'guard', text: 'if (colon == sv::npos)', label: 'continue' });
    for (const n of ['route', 'send_response', 'record', 'keep_alive']) expect(frames(n).at(-1)).toMatchObject({ kind: 'guard', text: 'if (headers.empty())', label: 'return' });
    expect(frames('parse_headers').map((f) => f.kind)).toEqual(['loop']);
  });
  it('an if’s branch is conditional, its condition is not', () => {
    expect(frames('close').at(-1)).toMatchObject({ kind: 'arm', label: 'then', text: 'if (!keep_alive(headers))' });
    expect(frames('keep_alive').at(-1)?.kind).toBe('guard');
  });
  it('the two trim calls in one argument list are marked: their order is the compiler’s choice', () => {
    expect(row('trim').unsequenced).toBe(true);
    expect(r.rows.find((x) => x.kind === 'ref' && x.name === 'trim')?.unsequenced).toBe(true);
    expect(row('route').unsequenced).toBeFalsy();
  });
  it('a function named but not called is a value; a call through std::function is indirect', () => {
    expect(r.rows.filter((x) => x.kind === 'value').map((x) => `${x.name} in ${r.rows[x.caller!].name}`)).toEqual(['not_found in route']);
    expect(r.rows.filter((x) => x.kind === 'indirect').map((x) => `${x.via} ${x.text} in ${r.rows[x.caller!].name}`)).toEqual(['std::function handler in handle']);
  });
  it('code nothing reaches is not in the run', () => {
    expect(rows.join('\n')).not.toMatch(/cgi_main/);
  });
  it('every row points at its caller and the caller covers it', () => {
    for (const [i, x] of r.rows.entries()) {
      if (x.caller == null) { expect(i).toBe(0); continue; }
      expect(x.caller).toBeLessThan(i);
      expect(r.rows[x.caller].last).toBeGreaterThanOrEqual(i);
      expect(x.depth).toBe(r.rows[x.caller].depth + 1);
    }
    for (const f of r.frames) if (f.to >= f.from) for (let i = f.from; i <= f.to; i++) expect(r.rows[i].frames).toContain(r.frames.indexOf(f));
  });
});

describe('evaluation-order rules', () => {
  const { run } = loadFixture(path.join(FIX, 'rules-flow.json'), path.join(FIX, 'rules'));
  const lines = (fn: number) => describeRun(run(`rules.cpp#${fn}`)).slice(1).map((l) => l.trim());

  it('arguments run before the call', () => expect(lines(13)).toEqual(['2 a', '3 d']));
  it('a for runs init once, then condition, body, increment on every pass', () => {
    const L = 'for (int i = a(); i < b(); i += c())';
    expect(lines(14)).toEqual(['2 a', `3 b   { ↻ ${L} }`, `4 d   { ↻ ${L} }`, `5 c   { ↻ ${L} }`]);
  });
  it('?: runs its condition, then one arm', () => expect(lines(15)).toEqual(['2 a', '3 b   { [then] a() }', '4 c   { [else] a() }']));
  it('|| runs its right side only when the left is false', () => expect(lines(16)).toEqual(['2 a', '3 b   { [|| b()] a() }', '4 c   { [then] if (a() || b()) }']));
  it('arguments with calls are unsequenced', () => expect(lines(17)).toEqual(['2 a (unsequenced)', '3 b (unsequenced)', '4 e']));
  it('the right side of an assignment runs first', () => expect(lines(18)).toEqual(['2 b', '3 a']));
  it('switch arms, with chained labels; an arm without break falls through', () => {
    expect(lines(19)).toEqual(['2 a   { [case 0] switch (k) }', '3 b   { [case 1 · case 2] switch (k) }', '4 c   { [default] switch (k) }']);
    const r = run('rules.cpp#19');
    expect(r.frames.filter((f) => f.kind === 'arm').map((f) => !!f.fallsThrough)).toEqual([false, true, false]);
  });
  it('try always starts; a catch is conditional', () => expect(lines(26)).toEqual(['2 a', '3 b   { [catch (...)] try }']));
  it('calls through a pointer or a member pointer are indirect, never dropped', () => {
    expect(lines(27)).toEqual(['⇢ pointer f']);
    expect(lines(28)).toEqual(['⇢ member pointer (s.*p)']);
  });
  it('a function handed to std::thread runs on a thread', () => expect(lines(29)).toEqual(['2 worker (thread)   { thread }']));
  it('a lambda’s body runs when it is called', () => expect(lines(30)).toEqual(['2 a   { lambda }']));
  it('a static local is initialized the first time only', () => expect(lines(31)).toEqual(['2 a   { once }']));
  it('do … while runs the body, then the condition', () => expect(lines(32)).toEqual(['2 a   { ↻ do … while (b()) }', '3 b   { ↻ do … while (b()) }']));
  it('after an early return, the rest is guarded', () => expect(lines(33)).toEqual(['2 a   { past if (k) → return }']));
  it('code after an unconditional return never runs', () => expect(lines(34)).toEqual([]));
  it('else-if chains nest', () => expect(lines(35)).toEqual(['2 a   { [then] if (k == 1) }', '3 b   { [else] if (k == 1) / [then] if (k == 2) }', '4 c   { [else] if (k == 1) / [else] if (k == 2) }']));
  it('a loop count is given only when certain', () => expect(lines(36)).toEqual(['2 a   { ↻×3 for (int i = 0; i < 3; ++i) }', '3 b   { ↻ for (int j = 0; j < 3; ++j) / past if (j) → break }']));
  it('a function stored in a std::function is a value; calling it is indirect', () => expect(lines(40)).toEqual(['value a', '⇢ std::function g']));
  it('built-in arithmetic calls nothing; an overloaded operator is a call', () => {
    expect(lines(44)).toEqual([]);
    expect(lines(45)).toEqual(['2 operator*']);
  });
  it('a call inside a template is dependent; code that does not compile is unresolved, never guessed', () => {
    expect(lines(46)).toEqual(['⇢ dependent t.go']);
    expect(lines(49)).toEqual(['2 get', '⇢ unresolved get()->go']);
  });
});

describe('the index against the syntax tree', () => {
  // thorvg's atan2: `a * a` on floats, which clangd's index reports as a call to the project's operator*(Point, …)
  const text = 'float f(float a) {\n    auto s = a * a;\n    return s;\n}\n';
  const R = (l: number, a: number, b: number) => ({ start: { line: l, character: a }, end: { line: l, character: b } });
  const ref = (l: number, a: number, b: number) => ({ kind: 'DeclRef', role: 'expression', detail: 'a', range: R(l, a, b) });
  const ast = { kind: 'Function', role: 'declaration', detail: 'f', range: { start: { line: 0, character: 0 }, end: { line: 3, character: 1 } }, children: [
    { kind: 'Compound', role: 'statement', range: { start: { line: 0, character: 17 }, end: { line: 3, character: 1 } }, children: [
      { kind: 'Decl', role: 'statement', range: R(1, 4, 19), children: [{ kind: 'Var', role: 'declaration', detail: 's', range: R(1, 4, 18), children: [
        { kind: 'BinaryOperator', role: 'expression', detail: '*', range: R(1, 13, 18), children: [
          { kind: 'ImplicitCast', role: 'expression', detail: 'LValueToRValue', range: R(1, 13, 14), children: [ref(1, 13, 14)] },
          { kind: 'ImplicitCast', role: 'expression', detail: 'LValueToRValue', range: R(1, 17, 18), children: [ref(1, 17, 18)] }] }] }] },
      { kind: 'Return', role: 'statement', range: R(2, 4, 12), children: [] }] }] };
  const op = { key: 'tvgMath.h#215', name: 'operator*', project: true, ctor: false, container: '' };
  it('drops a call the index reports where the compiler used a built-in operator, and says so', () => {
    const flow = analyseFunction(ast, text, [{ to: op, fromRanges: [R(1, 15, 16)] }]);
    expect(JSON.stringify(flow.body)).not.toMatch(/"t":"call"/);
    expect(flow.dropped).toEqual([{ name: 'operator*', at: { line: 1, character: 15 } }]);
  });
});

describe('helpers', () => {
  it('a function’s extent comes from its syntax tree, not from a call item’s first-line range', () => {
    const one = { start: { line: 7, character: 0 }, end: { line: 7, character: 40 } };
    expect(fnExtent({ kind: 'Function', range: { start: { line: 7, character: 0 }, end: { line: 16, character: 1 } } }, one)).toEqual({ start: 7, lines: 10 });
    expect(fnExtent({ kind: 'Compound', range: { start: { line: 8, character: 0 }, end: { line: 9, character: 1 } } }, one)).toEqual({ start: 7, lines: 1 });
    expect(fnExtent(null, one)).toEqual({ start: 7, lines: 1 });
  });
  it('loop counts: literal bounds only, and only without early exits or writes to the counter', () => {
    expect(forCount('for (int i = 0; i < 4; ++i)', '{ f(i); }')).toBe(4);
    expect(forCount('for (size_t k = 1; k <= 3; k++)', 'g(k);')).toBe(3);
    expect(forCount('for (int i = 0; i != 8; i += 1)', 'h();')).toBe(8);
    expect(forCount('for (int i = 0; i < n; ++i)', 'f();')).toBeNull();
    expect(forCount('for (int i = 0; i < 4; ++i)', '{ if (x) break; }')).toBeNull();
    expect(forCount('for (int i = 0; i < 4; ++i)', '{ i += 2; }')).toBeNull();
    expect(forCount('for (int i = 0; i < 4; ++i)', '{ p = &i; }')).toBeNull();
    expect(forCount('for (int i = 0; i < 4; ++i)', '{ if (i == 0) f(); puts("break"); }')).toBe(4);
    expect(forCount('for (int i = 0; i < 4; i += 2)', '{}')).toBeNull();
  });
  it('a statement written by a macro (no range in the tree) still gives its calls, and nothing throws', () => {
    // void f() {\n  GUARD(g());\n}  — clangd gives the macro's if no range; the call inside it keeps one
    const text = 'void f() {\n  GUARD(g());\n}\n';
    const R = (l1: number, c1: number, l2: number, c2: number) => ({ start: { line: l1, character: c1 }, end: { line: l2, character: c2 } });
    const g = { key: 'g', name: 'g', project: true, ctor: false, container: '' };
    const ast = { kind: 'Function', range: R(0, 0, 2, 1), children: [{ kind: 'Compound', role: 'statement', range: R(0, 9, 2, 1), children: [
      { kind: 'If', role: 'statement', children: [{ kind: 'Call', role: 'expression', range: R(1, 8, 1, 11), children: [{ kind: 'DeclRef', role: 'expression', range: R(1, 8, 1, 9) }] }, { kind: 'Compound', role: 'statement' }] },
    ] }] };
    const f = analyseFunction(ast, text, [{ to: g, fromRanges: [R(1, 8, 1, 9)] }]);
    expect(JSON.stringify(f.body)).toContain('"key":"g"');
    // a tree the analyser cannot follow at all: the calls in source order, marked approximate
    const bad = analyseFunction({ kind: 'Function', range: R(0, 0, 2, 1), children: [{ kind: 'Compound', role: 'statement', range: R(0, 9, 2, 1), children: [{ kind: 'Return', role: 'statement', range: undefined as never, children: [null as never] }] }] }, text, [{ to: g, fromRanges: [R(1, 8, 1, 9)] }]);
    expect(bad.body).toEqual([{ t: 'call', to: g, at: { line: 1, character: 8 }, approx: true }]);
  });
  it('a function inside extern "C" is found inside its wrapper', () => {
    const fn = { kind: 'Function', range: { start: { line: 1, character: 11 }, end: { line: 1, character: 40 } } };
    expect(functionNode({ kind: 'LinkageSpec', children: [fn] })).toBe(fn);
    expect(functionNode(fn)).toBe(fn);
    expect(functionNode(null)).toBeNull();
  });
  it('matching parentheses skips strings, characters, raw strings and comments', () => {
    expect(matchParen('f(a, ")", \')\') x', 1)).toBe(13);
    expect(matchParen('f(/* ) */ a // )\n)', 1)).toBe(17);
    expect(matchParen('f(R"x()")x")', 1)).toBe(11);
  });
});
