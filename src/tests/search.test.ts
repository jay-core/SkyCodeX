import { describe, it, expect } from 'vitest';
import { matcher, matchesIn, hitsIn } from '../shared/search';

describe('case-free search', () => {
  it('matches in any case, with exact offsets, and treats the query as text', () => {
    expect(matchesIn('_tx_thread_create(TX_THREAD *t)', 'Thread_Cre')).toEqual([[4, 14]]);
    expect(matchesIn('a.b a*b', 'A*B')).toEqual([[4, 7]]);
    expect(matchesIn('ÉCOLE école', 'école')).toEqual([[0, 5], [6, 11]]);
    expect(matcher('')).toBeNull();
  });
  it('lists a file’s matching lines with where the match is', () => {
    const h = hitsIn('f.c', 'int x;\r\n  TX_Thread_Create(a);\nnone\n', 'tx_thread_create');
    expect(h).toEqual([{ file: 'f.c', line: 1, col: 2, len: 16, text: '  TX_Thread_Create(a);' }]);
  });
});
