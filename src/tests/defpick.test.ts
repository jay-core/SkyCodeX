import { describe, it, expect } from 'vitest';
import { inBuild, stablePick } from '../shared/defpick';

const R = '/w/threadx';
const id = (f: string) => f;
const at = (f: string) => ({ file: `${R}/${f}` });
const COMMON = 'common/src/tx_thread_create.c', SMP = 'common_smp/src/tx_thread_create.c', MOD = 'common_modules/module_lib/src/txm_thread_create.c';

function before<T extends { file: string }>(hits: T[], own: T | null, caller: string, clangd: string): T | null {
  const dirs = (f: string) => f.split(/[\\/]/).slice(0, -1), c = dirs(caller);
  const shared = (f: string) => { const a = dirs(f); let i = 0; while (i < a.length && i < c.length && a[i] === c[i]) i++; return i; };
  const best = own ?? hits.sort((a, b) => shared(b.file) - shared(a.file) || a.file.localeCompare(b.file))[0];
  return best.file === clangd ? null : best;
}

describe('choosing among several definitions of one function', () => {
  const sets = [[COMMON, SMP, MOD], [SMP, COMMON], ['a/x.c', 'a/b/x.c', 'c/x.c'], ['p/q.c', 'p/r.c']];
  const callers = [`${R}/samples/demo_threadx.c`, `${R}/common_smp/src/tx_initialize_high_level.c`, `${R}/a/b/main.c`, `${R}/p/main.c`];

  it('without a compile database of the project, picks exactly as before', () => {
    for (const set of sets) for (const caller of callers) for (const clangd of [...set.map((f) => `${R}/${f}`), `${R}/elsewhere.c`]) for (const ownAt of [-1, 0, 1]) {
      const a = set.map(at), b = set.map(at);
      const got = stablePick(a, ownAt >= 0 ? a[ownAt] ?? null : null, caller, clangd, null, id);
      const want = before(b, ownAt >= 0 ? b[ownAt] ?? null : null, caller, clangd);
      expect(got?.file ?? null).toBe(want?.file ?? null);
    }
  });

  it('keeps clangd’s definition when its file is in the build', () => {
    const caller = `${R}/common_smp/src/tx_initialize_high_level.c`, clangd = `${R}/${COMMON}`;
    expect(before([SMP, COMMON, MOD].map(at), null, caller, clangd)?.file).toBe(`${R}/${SMP}`);
    expect(stablePick([SMP, COMMON, MOD].map(at), null, caller, clangd, new Set([clangd, `${R}/samples/demo_threadx.c`]), id)).toBeNull();
  });

  it('replaces a definition outside the build with the one the build compiles', () => {
    const caller = `${R}/common_smp/src/tx_initialize_high_level.c`, clangd = `${R}/${SMP}`;
    expect(stablePick([SMP, COMMON, MOD].map(at), null, caller, clangd, new Set([`${R}/${COMMON}`]), id)?.file).toBe(`${R}/${COMMON}`);
  });

  it('with several copies in the build, picks by the stable rule whatever clangd chose', () => {
    const hits = ['x/f.c', 'y/f.c'].map(at), b = new Set([`${R}/x/f.c`, `${R}/y/f.c`, `${R}/x/main.c`]);
    expect(stablePick(hits.slice(), null, `${R}/x/main.c`, `${R}/y/f.c`, b, id)?.file).toBe(`${R}/x/f.c`);
    expect(stablePick(hits.slice(), null, `${R}/x/main.c`, `${R}/x/f.c`, b, id)).toBeNull();
  });

  it('keeps a static definition clangd chose in the build', () => {
    const hits = ['a/h.c', 'b/h.c'].map(at), b = new Set([`${R}/c/h.c`, `${R}/a/h.c`, `${R}/b/h.c`]);
    expect(stablePick(hits, null, `${R}/c/main.c`, `${R}/c/h.c`, b, id)).toBeNull();
  });

  it('still prefers the program’s own definition', () => {
    const own = at('samples/demo_threadx.c'), hits = [own, at(COMMON)];
    expect(stablePick(hits, own, `${R}/samples/demo_threadx.c`, `${R}/${COMMON}`, new Set([`${R}/${COMMON}`]), id)?.file).toBe(own.file);
  });

  it('when the build has no copy, picks exactly as before', () => {
    const caller = `${R}/common_smp/src/x.c`, clangd = `${R}/${SMP}`, b = new Set([`${R}/samples/demo_threadx.c`]);
    expect(stablePick([SMP, COMMON, MOD].map(at), null, caller, clangd, b, id)?.file ?? null).toBe(before([SMP, COMMON, MOD].map(at), null, caller, clangd)?.file ?? null);
  });

  it('filters to build files through the path normaliser, and keeps all when none is in the build', () => {
    const up = (f: string) => f.toUpperCase();
    const hits = [at(COMMON), at(SMP)];
    expect(inBuild(hits, new Set([up(`${R}/${COMMON}`)]), up).map((h) => h.file)).toEqual([`${R}/${COMMON}`]);
    expect(inBuild(hits, new Set([`${R}/other.c`]), id)).toBe(hits);
    expect(inBuild(hits, null, id)).toBe(hits);
  });
});
