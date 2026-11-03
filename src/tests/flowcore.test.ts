import { describe, it, expect } from 'vitest';
import { parseCpp, loopsAt, functionDefs, definedNames, addressTaken, offsetOf, lineOf, THREAD_RE } from '../shared/flowcore';
import { THREAD_START } from '../shared/flowrun';
import { rankEntries } from '../shared/entries';

const SRC = `void Server::start() {
    for (int i = 0; i < 16; ++i) f(i);
    for (size_t k = 0; k <= 3; k++) g(k);
    for (auto& r : routes_) h(r);
    while (running_ && socket_.accept(req)) {
        handle(req);
    }
    do { x(); } while (y);
    for (int j = 0; j < n; ++j) z(j);
}
static int helper(int a) { return a; }
Server::~Server() {}
`;

describe('flow core', () => {
  const tree = parseCpp(SRC);
  const at = (needle: string) => SRC.indexOf(needle);
  const labels = (needle: string) => loopsAt(tree, SRC, at(needle), 'f').map((l) => l.label);

  it('labels loops honestly: exact counts only for literal bounds', () => {
    expect(labels('f(i)')).toEqual(['×16']);
    expect(labels('g(k)')).toEqual(['×4']);
    expect(labels('h(r)')).toEqual(['×n · routes_']);
    expect(labels('handle(req)')).toEqual(['while running_ && socket_.accept(req)']);
    expect(labels('x()')).toEqual(['do … while (y);']);
    expect(labels('z(j)')).toEqual(['while j < n']);
  });
  it('a call outside any loop has none', () => {
    expect(loopsAt(tree, SRC, at('return a'), 'f')).toEqual([]);
  });
  it('lists function definitions with the line of their name', () => {
    expect(functionDefs(tree, SRC).map((d) => [d.name, d.line, d.endLine])).toEqual([['Server::start', 0, 9], ['helper', 10, 10], ['Server::~Server', 11, 11]]);
  });
  it('offsets and lines agree', () => {
    expect(lineOf(SRC, offsetOf(SRC, 4, 4))).toBe(4);
    expect(SRC.slice(offsetOf(SRC, 4, 4), offsetOf(SRC, 4, 9))).toBe('while');
  });
  it('recognises thread spawns', () => {
    expect(THREAD_RE.test('std::thread flusher([this] {')).toBe(true);
    expect(THREAD_RE.test('pthread_create(&t, 0, run, 0)')).toBe(true);
    expect(THREAD_RE.test('threading_model()')).toBe(false);
  });
  it('names a file may define, from the left margin: definitions and prototypes, not calls, macros or comments', () => {
    const text = [
      'UINT  _tx_thread_create(TX_THREAD *t,', '    CHAR *name)', '{', '    _tx_thread_system_resume(t);', '}',
      'VOID', '_tx_initialize_kernel_enter(VOID)', '{ }',
      'void Paint::update(int k) {}', 'static int helper(void);',
      '#define TX_DISABLE() x()', '/* not(this) */', ' * nor(this)', 'int x = f(2);',
    ].join('\n');
    expect([...definedNames(text)].sort()).toEqual(['_tx_initialize_kernel_enter', '_tx_thread_create', 'helper', 'update']);
  });
  it('functions whose address is taken: tables, callbacks, stored pointers — not calls, comments or strings', () => {
    const names = new Set(['on_get', 'on_post', 'worker', 'helper', 'unused', 'fmt']);
    const text = 'static Handler table[] = { on_get, on_post };\nregister_cb(&worker);\nint x = helper(2);\n// unused, here\nputs("fmt;");\nauto p = Ns::worker;';
    expect([...addressTaken(text, names)].sort()).toEqual(['on_get', 'on_post', 'worker']);
  });
  it('threads and RTOS tasks start with the function they are given, wrappers included', () => {
    for (const n of ['std::thread', 'pthread_create', '_txe_thread_create', '_tx_thread_create', 'xTaskCreateStatic', 'osThreadNew', 'OSTaskCreateExt', 'k_thread_create']) expect(THREAD_START.test(n)).toBe(true);
    expect(THREAD_START.test('thread_create_helper')).toBe(false);
  });
  it('interrupt handlers come after programs', () => {
    expect(rankEntries([{ rel: 'src/irq.c', kind: 'interrupt' }, { rel: 'tests/main.c', kind: 'main' }]).map((e) => e.rel)).toEqual(['tests/main.c', 'src/irq.c']);
  });
});

describe('Windows line endings', () => {
  it('finds the same functions, at the same lines and offsets, in a file saved with \\r\\n', () => {
    const lf = '#include <cstdio>\n#include "server.h"\n\nstatic int helper(int x) { return x + 1; }\n\nint main(int argc, char **argv) {\n  return helper(argc);\n}\n';
    const crlf = lf.replace(/\n/g, '\r\n');
    const a = functionDefs(parseCpp(lf), lf), b = functionDefs(parseCpp(crlf), crlf);
    expect(b.map((d) => [d.name, d.line, d.endLine])).toEqual(a.map((d) => [d.name, d.line, d.endLine]));
    expect(b.map((d) => d.name)).toEqual(['helper', 'main']);
    for (const d of b) expect(crlf.slice(d.from, d.to).replace(/\r/g, '')).toBe(lf.slice(a.find((x) => x.name === d.name)!.from, a.find((x) => x.name === d.name)!.to));
  });
});
