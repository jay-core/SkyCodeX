// The entry point the flow page opens on, among many mains: ranked from paths alone.
import { describe, it, expect } from 'vitest';
import { rankEntries, entryScore } from '../shared/entries';

describe('which main first', () => {
  it('ThreadX: the sample, not a module utility, a port example or a test', () => {
    const rel = ['common_modules/module_manager/utilities/module_binary_to_c_array.c', 'ports/cortex_m4/gnu/example_build/sample_threadx.c',
      'test/tx/regression/testcontrol.c', 'utility/benchmarks/thread_metric/threadx_example/threadx_tm_basic_test_example.c', 'samples/demo_threadx.c'];
    expect(rankEntries(rel.map((r) => ({ rel: r })))[0].rel).toBe('samples/demo_threadx.c');
  });
  it('a project main beats its tests and tools; ties keep path order', () => {
    const r = rankEntries(['tools/gen/main.cpp', 'test/main.cpp', 'src/main.cpp', 'examples/b.cpp', 'examples/a.cpp'].map((x) => ({ rel: x }))).map((x) => x.rel);
    expect(r[0]).toBe('src/main.cpp');
    expect(r.indexOf('examples/a.cpp')).toBeLessThan(r.indexOf('examples/b.cpp'));
    expect(r.slice(-2)).toEqual(['tools/gen/main.cpp', 'test/main.cpp']);
    expect(entryScore('main.c')).toBeGreaterThan(entryScore('test/main.c'));
  });
  it('Windows paths too', () => {
    expect(entryScore('samples\\demo_threadx.c')).toBe(entryScore('samples/demo_threadx.c'));
  });
});
