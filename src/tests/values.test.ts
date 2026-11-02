// Values settled per call (src/shared/flowvalues.ts), on real clangd output for samples/values (recorded with
// src/tests/fixtures/record-flow.mjs). Each function in the sample says what its call settles; worked out by hand.
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { loadFixture } from './flowrun.fixture';
import { truthOf, valuesOf, settledValue, Expr, Vals } from '../shared/flowvalues';

const ROOT = path.join(__dirname, '../..');
const { infos, run } = loadFixture(path.join(ROOT, 'src/tests/fixtures/values-flow.json'), path.join(ROOT, 'samples/values'));
const r = run([...infos.keys()].find((k) => infos.get(k)!.name === 'main')!);
const dead = r.frames.filter((f) => f.dead).map((f) => `${r.rows[f.owner].name}: ${f.kind} ${f.label} | ${f.dead}`);

describe('values settled per call (samples/values)', () => {
  it('fades exactly the arms each call rules out, and says why', () => {
    expect(dead).toEqual([
      'draw: arm else | clear is true here — passed by draw(true)',
      'paint: arm then | clear is false here — passed by paint(clear), from frame(false)',
      'pick: arm case 0 | mode is 1 here — passed by pick(1)',
      'pick: arm default | mode is 1 here — passed by pick(1)',
      'early: guard return | quick is true here — passed by early(true)',
      'both: arm && ready() | on is false here — passed by both(false)',
      'both: arm then | on is false here — passed by both(false)',
      'greet: arm then | name is not null here — passed by greet("hi")',
      'big: arm else | n is -1 converted to unsigned int here — passed by big(-1)',
      'spin: loop while | go is false here — passed by spin(false)',
      'outer: arm then | go is false here — passed by outer(false)',
      'tern: arm else | t is true here — passed by tern(true)',
      "ch: arm then | k is 65 here — passed by ch('A')",
    ]);
  });
  it('settles nothing where the value may change, the condition is constant, a goto may jump in, or the language or platform decides', () => {
    for (const f of ['reset', 'poke', 'fixed', 'jumpy', 'over', 'wide', 'hue', 'inner', 'frame', 'main']) expect(dead.filter((d) => d.startsWith(`${f}:`)), f).toEqual([]);
  });
  it('a step whose only call cannot happen is inside the faded arm', () => {
    const inner = r.rows.find((x) => x.kind === 'step' && x.name === 'inner')!;
    expect(inner.frames.some((f) => r.frames[f].dead)).toBe(true);
  });
  it('only parameters read for their value hold what was passed', () => {
    const fx = (n: string) => [...infos.values()].find((i) => i.name === n)!.effects!;
    expect(fx('draw').paramValues).toEqual({ clear: 'bool' });
    expect(fx('greet').paramValues).toEqual({ name: 'const char *' });
    expect(fx('reset').paramValues).toBeUndefined();
    expect(fx('poke').paramValues).toBeUndefined();
  });
});

// The evaluator on its own: C and C++ rules, across the platforms (int 16 or 32 bits, long 32 or 64, char signed or not).
const lit = (v: number, ty = 'int'): Expr => ({ k: 'int', v: String(v), ty });
const p = (name: string, ty: string): Expr => ({ k: 'cast', how: 'LValueToRValue', ty, a: { k: 'param', name } });
const bin = (op: string, a: Expr, b: Expr, ty = 'int'): Expr => ({ k: 'bin', op, ty, a, b });
const passed = (x: Expr): Vals => valuesOf(x, () => undefined);
const at = (vals: Record<string, Vals>) => (n: string) => vals[n];

describe('the evaluator', () => {
  it('signed overflow, shifting a negative and dividing by zero are left open', () => {
    const k = { k: passed(lit(32767)) };
    expect(truthOf(bin('>', bin('+', p('k', 'int'), lit(1)), p('k', 'int'), 'bool'), at(k))).toBeNull();   // 16-bit int overflows
    expect(truthOf(bin('<<', lit(-1), lit(1)), () => undefined)).toBeNull();
    expect(truthOf(bin('/', lit(1), lit(0)), () => undefined)).toBeNull();
    expect(truthOf(bin('>>', lit(-8), lit(1)), () => undefined)).toBeNull();
  });
  it('unsigned arithmetic wraps, and a comparison settles only when every platform agrees', () => {
    const neg = passed({ k: 'cast', how: 'IntegralCast', ty: 'unsigned int', a: { k: 'un', op: '-', ty: 'int', a: lit(1) } });
    expect(settledValue(neg)!.same).toBe(false);   // 65535 or 4294967295
    expect(truthOf(bin('>', p('n', 'unsigned int'), { k: 'cast', how: 'IntegralCast', ty: 'unsigned int', a: lit(10) }, 'bool'), at({ n: neg }))).toBe(true);
    expect(truthOf(bin('>', p('n', 'unsigned int'), { k: 'cast', how: 'IntegralCast', ty: 'unsigned int', a: lit(65535, 'long') }, 'bool'), at({ n: neg }))).toBeNull();   // 65535 > 65535 is false, 4294967295 > 65535 true
  });
  it('a literal too large for a platform rules that platform out, not the answer', () => {
    expect(truthOf(bin('>', lit(40000), lit(1)), () => undefined)).toBe(true);   // 40000 as int: int is not 16 bits here
  });
  it('&& and || settle from either side that decides, the right side only when the left does not', () => {
    const q: Expr = { k: '?' };
    expect(truthOf(bin('&&', lit(0), q), () => undefined)).toBe(false);
    expect(truthOf(bin('&&', q, lit(0)), () => undefined)).toBe(false);
    expect(truthOf(bin('||', q, lit(1)), () => undefined)).toBe(true);
    expect(truthOf(bin('&&', q, lit(1)), () => undefined)).toBeNull();
  });
  it('pointers: equal only when null is known on one side', () => {
    const nn = (ty = 'const char *'): Expr => ({ k: 'cast', how: 'NullToPointer', ty, a: { k: 'null' } });
    const s: Expr = { k: 'cast', how: 'ArrayToPointerDecay', ty: 'const char *', a: { k: 'str' } };
    expect(truthOf(bin('==', s, nn(), 'bool'), () => undefined)).toBe(false);
    expect(truthOf(bin('==', nn(), nn(), 'bool'), () => undefined)).toBe(true);
    expect(truthOf(bin('==', s, s, 'bool'), () => undefined)).toBeNull();
  });
  it('char: settled only where signed and unsigned char agree', () => {
    const ch = (v: number): Vals => passed({ k: 'cast', how: 'IntegralCast', ty: 'char', a: lit(v) });
    expect(truthOf(bin('<', { k: 'cast', how: 'IntegralCast', ty: 'int', a: p('c', 'char') }, lit(0), 'bool'), at({ c: ch(65) }))).toBe(false);
    expect(settledValue(ch(200))).toBeNull();   // 200 into a signed char is the platform's choice
  });
});
