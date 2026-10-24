import { describe, it, expect } from 'vitest';
import { parseCpp, loopsAt, functionDefs, offsetOf, lineOf, THREAD_RE } from '../src/shared/flowcore';

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
});
