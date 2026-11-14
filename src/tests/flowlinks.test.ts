import { describe, it, expect } from 'vitest';
import type { Run, RunRow, RunFrame } from '../shared/flowrun';
import type { Effects } from '../shared/flowfacts';
import { buildSeq } from '../shared/flowseq';
import { stepLinks, passMode } from '../shared/gridlinks';
import { junctionsOf, junctionWords } from '../shared/junctions';
import { resultTarget } from '../shared/metrofacts';

const SERVER = [
  '#include "server.hpp"', '#include <thread>', '#include "http/headers.hpp"', '',
  'Server::Server(const Config& c) : config_(c) {', '    routes_.push_back({"/api/*", [](const Request& r, const Headers&) {', '        return Response{200, "ok " + r.path};', '    }});', '}', '',
  'void Server::start() {', '    socket_.listen(config_.port);', '    running_ = true;', '    std::thread flusher([this] { metrics_.run(running_); });', '    Request req;',
  '    while (running_ && socket_.accept(req)) {', '        handle(req);', '    }', '    running_ = false;', '    flusher.join();', '}', '', '',
  'Response Server::handle(const Request& req) {', '    auto headers = parse_headers(req.raw);', '    if (headers.empty())', '        return Response{400, "bad request"};',
  '    auto handler = route(req.path, routes_);', '    Response res = handler(req, headers);', '    send_response(socket_, res);', '    metrics_.record(req.path, res.status);',
  '    if (!keep_alive(headers))', '        socket_.close();', '    return res;', '}',
];
const lines = (f: string) => (f === 'server.cpp' ? SERVER : null);

const row = (o: Partial<RunRow> & Pick<RunRow, 'n' | 'key' | 'name' | 'file' | 'line' | 'caller' | 'depth' | 'last'>): RunRow =>
  ({ kind: 'step', start: o.line, at: null, frames: [0], thread: false, lines: 6, ...o });
const fx = (o: Partial<Effects>): Effects => ({ returnsValue: false, writes: [], reads: [], globalWrites: [], globalReads: [], locks: [], allocates: [], throws: [], dropped: [], ...o });

function tinyRun(): Run {
  const rows: RunRow[] = [
    row({ n: 1, key: 'start', name: 'Server::start', file: 'server.cpp', line: 10, lines: 11, caller: null, depth: 0, last: 6, frames: [] }),
    row({ n: 2, key: 'accept', name: 'Socket::accept', file: 'io.cpp', line: 8, caller: 0, at: { line: 15, character: 31 }, depth: 1, last: 1, args: ['req'] }),
    row({ n: 3, key: 'handle', name: 'Server::handle', file: 'server.cpp', line: 23, lines: 12, caller: 0, at: { line: 16, character: 8 }, depth: 1, last: 6, args: ['req'] }),
    row({ n: 4, key: 'parse_headers', name: 'parse_headers', file: 'headers.cpp', line: 3, caller: 2, at: { line: 24, character: 19 }, depth: 2, last: 3, args: ['req.raw'] }),
    row({ n: 5, key: 'route', name: 'route', file: 'router.cpp', line: 16, caller: 2, at: { line: 27, character: 19 }, depth: 2, last: 4, args: ['req.path', 'routes_'] }),
    row({ n: 6, key: 'keep_alive', name: 'keep_alive', file: 'headers.cpp', line: 14, caller: 2, at: { line: 31, character: 9 }, depth: 2, last: 5, args: ['headers'] }),
    row({ n: 7, key: 'close', name: 'Socket::close', file: 'io.cpp', line: 15, caller: 2, at: { line: 32, character: 16 }, depth: 2, last: 6, frames: [0, 1] }),
  ];
  const frames: RunFrame[] = [
    { kind: 'loop', text: 'while (running_ && socket_.accept(req))', label: '', count: null, owner: 0, line: 15, from: 1, to: 6, parent: null },
    { kind: 'arm', text: 'if (!keep_alive(headers))', label: 'then', count: null, owner: 2, line: 32, from: 6, to: 6, parent: 0 },
  ];
  const effects: Record<string, Effects> = {
    start: fx({ params: [] }),
    accept: fx({ returnsValue: true, params: [{ name: 'out', type: 'Request &' }], paramWrites: ['out'] }),
    handle: fx({ returnsValue: true, params: [{ name: 'req', type: 'const Request &' }] }),
    parse_headers: fx({ returnsValue: true, params: [{ name: 'raw', type: 'std::string_view' }] }),
    route: fx({ returnsValue: true, params: [{ name: 'path', type: 'std::string_view' }, { name: 'routes', type: 'const Routes &' }] }),
    keep_alive: fx({ returnsValue: true, params: [{ name: 'h', type: 'const Headers &' }] }),
    close: fx({}),
  };
  const exits = {
    handle: [
      { kind: 'return' as const, line: 26, text: 'return Response{400, "bad request"}', when: ['if (headers.empty())'], early: true },
      { kind: 'return' as const, line: 33, text: 'return res', when: [], early: false },
    ],
  };
  return { rows, frames, missing: [], effects, exits };
}

describe('one parser for where a result goes', () => {
  it('keeps the metro words and also names the variable', () => {
    expect(resultTarget('    auto headers = ', ';')).toEqual({ text: '→ headers', tone: '', name: 'headers' });
    expect(resultTarget('    for (auto line : ', ') {')).toEqual({ text: '→ each item', tone: '', name: 'line' });
    expect(resultTarget('    if (!', ')')).toEqual({ text: '→ the condition', tone: '', name: '' });
  });
});

describe('grid links from the selected step', () => {
  it('names how a value is passed from the parameter type', () => {
    expect(passMode('const Request &')).toBe('by reference');
    expect(passMode('std::string_view')).toBe('a view');
    expect(passMode('const char *')).toBe('by pointer');
    expect(passMode('int')).toBe('a copy');
  });

  it('traces parse_headers(req.raw): where req comes from, who reads headers, the decision on it', () => {
    const s = buildSeq(tinyRun(), { fold: false });
    const l = stepLinks(s, 3, lines);
    expect(l.links.filter((x) => x.kind === 'in')).toEqual([
      { kind: 'in', from: 2, to: 3, label: 'req.raw · a view' },
      { kind: 'in', from: 1, to: 2, label: '2 · accept writes req · by reference' },
    ]);
    expect(l.links.filter((x) => x.kind === 'out')).toEqual([{ kind: 'out', from: 3, to: 5, label: '6 · reads headers · by reference' }]);
    expect(l.decisions).toEqual([{ text: 'if (headers.empty())', file: 'server.cpp', line: 25 }]);
    expect(l.takes).toEqual([{ arg: 'req.raw', param: 'raw', how: 'a view', from: 'req: parameter of handle' }]);
    expect(l.gives).toEqual({ what: 'headers', to: ['step 6 keep_alive · by reference'] });
    expect(l.calls).toBe('');
  });

  it('lists what a step calls', () => {
    const s = buildSeq(tinyRun(), { fold: false });
    const l = stepLinks(s, 2, lines);
    expect(l.links.filter((x) => x.kind === 'call').map((x) => x.to)).toEqual([3, 4, 5, 6]);
    expect(l.calls).toBe('calls parse_headers ×1 · route ×1 · keep_alive ×1 · close ×1');
  });
});

describe('metro junctions', () => {
  it('finds the early return and the if-arm in handle, placed where the code decides', () => {
    const s = buildSeq(tinyRun(), { fold: false });
    const j = junctionsOf(s, lines);
    expect(j.map((x) => ({ kind: x.kind, after: x.after, line: x.line, cond: x.cond, then: x.then, steps: x.steps, ends: x.ends }))).toEqual([
      { kind: 'exit', after: 3, line: 25, cond: 'if (headers.empty())', then: 'return Response{400, "bad request"}', steps: 3, ends: true },
      { kind: 'arm', after: 5, line: 31, cond: 'if (!keep_alive(headers))', then: 'socket_.close()', steps: 1, ends: false },
    ]);
    expect(j.map((x) => x.inFn)).toEqual([2, 2]);
    expect(junctionWords(s, j[0])).toEqual({ then: '⊣ return Response{400, "bad request"} · handle ends', else: '↓ 3 steps' });
    expect(junctionWords(s, j[1])).toEqual({ then: '↘ socket_.close()', else: 'straight on' });
  });
});
