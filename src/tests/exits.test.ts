// "Errors only": every way out of each function, on real clangd output (samples/exits, recorded with
// src/tests/fixtures/record-flow.mjs) and on tinyhttp. Expected values worked out by hand from the sources.
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { loadFixture } from './flowrun.fixture';
import { exitsOf, type Run } from '../shared/flowrun';
import fs from 'node:fs';

const ROOT = path.join(__dirname, '../..');
const ways = (run: Run, infos: Map<string, { name: string }>) => {
  const out: Record<string, string[]> = {};
  for (const [k, ex] of Object.entries(run.exits ?? {})) out[infos.get(k)!.name] = ex.map((e) => `${e.line + 1} ${e.kind}${e.early ? '' : ' (end)'}${e.callee ? ` ${e.callee}` : ''} | ${e.text} | ${e.when.join(' / ')}`);
  return out;
};

describe('every way out (samples/exits)', () => {
  const { infos, run } = loadFixture(path.join(ROOT, 'src/tests/fixtures/exits-flow.json'), path.join(ROOT, 'samples/exits'));
  const r = run([...infos.keys()].find((k) => infos.get(k)!.name === 'main')!);
  const got = ways(r, infos);
  it('returns, throw, loop exits, goto, catch, and the normal end', () => {
    expect(got.main).toEqual(['54 return | return 9 | if (setjmp(restart))', '55 noreturn exit | std::exit(1) | if (argc > 5)', '59 return (end) | return v | ']);
    expect(got.parse).toEqual([
      '17 return | return -1 | if (!s)', `18 throw | throw std::runtime_error("bang") | if (*s == '!')`,
      `21 continue | continue | for (; *s; ++s) / if (*s == ' ')`, `22 break | break | for (; *s; ++s) / if (*s < '0' || *s > '9')`, '25 return (end) | return n | ']);
    expect(got.open_all).toEqual(['42 goto | goto cleanup | if (k > 3)', '47 return | return -2 | try · catch (const std::exception&)', '50 return (end) | return rc | ']);
  });
  it('calls that never return: by the compiler\'s type (exit, abort, longjmp) and the project\'s own [[noreturn]] or __attribute__((noreturn))', () => {
    expect(got.command).toEqual(['30 return | return 0 | switch (cmd) · case 0', '31 noreturn die | die("one") | switch (cmd) · case 1', '32 noreturn halt | halt() | switch (cmd) · case 2', '33 noreturn longjmp | std::longjmp(restart, 1) | switch (cmd) · case 3', '37 return (end) | return twice(cmd) | ']);
    expect(got.die).toEqual(['11 noreturn exit | std::exit(3) | ']);
    expect(got.halt).toEqual(['14 noreturn abort | std::abort() | ']);
    const marked = Object.entries(r.effects ?? {}).filter(([, e]) => e.noreturn).map(([k]) => infos.get(k)!.name).sort();
    expect(marked).toEqual(['die', 'halt']);
  });
  it('a lambda\'s returns are its own, and a case\'s closing break is not a way out', () => {
    expect(got.command.some((w) => /x \* 2|return 0 \| .*x < 0/.test(w))).toBe(false);
    expect(got.command.some((w) => / break /.test(w))).toBe(false);
  });
});

describe('every way out (tinyhttp)', () => {
  const { infos, run } = loadFixture(path.join(ROOT, 'src/tests/fixtures/tinyhttp-flow.json'), path.join(ROOT, 'samples/tinyhttp'));
  const r = run([...infos.keys()].find((k) => infos.get(k)!.name === 'main')!);
  it('handle returns 400 early when the headers are empty', () => {
    expect(ways(r, infos).handle?.[0]).toBe('27 return | return Response{400, "bad request"} | if (headers.empty())');
  });
});

describe('every way out (ThreadX\'s _tx_thread_create, recorded from clangd)', () => {
  // calls a macro writes are placed after the last statement (approx): its closing return is still its normal end
  it('the closing return(TX_SUCCESS) is the normal end, not an early way out', () => {
    const T = '/private/tmp/claude-501/-Users-jfalcon-Desktop-Lithograph-editor/c1841425-f45f-484d-b67c-7ad673cdcc99/scratchpad/ext/threadx';
    if (!fs.existsSync(T)) return;   // the ThreadX checkout used on this machine
    const { infos } = loadFixture(path.join(ROOT, 'src/tests/fixtures/txcreate-flow.json'), T);
    const f = [...infos.values()][0];
    expect(f.flow.body.at(-1)).toMatchObject({ t: 'call', approx: true });
    expect(exitsOf(f.flow.body).map((x) => `${x.line + 1} ${x.text} ${x.early ? 'early' : 'end'}`)).toEqual(['402 return(TX_SUCCESS) end']);
  });
});
