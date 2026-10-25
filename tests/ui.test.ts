import { describe, it, expect } from 'vitest';
import { KEYS, LISTS } from '../src/renderer/lib/i18n-tables';
import { HELP, searchHelp, parseHelp, inline } from '../src/renderer/lib/help';

describe('translations', () => {
  it('every language lists one entry per key, in order', () => {
    for (const [lang, list] of Object.entries(LISTS)) expect(list.length, lang).toBe(KEYS.length);
  });
  it('keeps {placeholders} and key names intact', () => {
    for (const list of Object.values(LISTS)) KEYS.forEach((k, i) => {
      for (const ph of k.match(/\{\w+\}|F1|⌘\/Ctrl|settings\.toml|static_assert/g) ?? []) expect(list[i], k).toContain(ph);
    });
  });
});

describe('help', () => {
  it('finds topics by words and ranks titles first', () => {
    expect(searchHelp('pin box')[0].id).toBe('flow');
    expect(searchHelp('install pack').map((t) => t.id)).toContain('compiler');
    expect(searchHelp('')).toHaveLength(HELP.length);
  });
  it('parses headings, lists, rows and inline marks', () => {
    const b = parseHelp('# head\n- item `x`\n|`a`|b\npara **bold**');
    expect(b.map((x) => x.k)).toEqual(['h', 'li', 'row', 'p']);
    expect(inline('press `⌃ {bq}` or **this**')).toEqual([{ k: 't', s: 'press ' }, { k: 'code', s: '⌃ `' }, { k: 't', s: ' or ' }, { k: 'b', s: 'this' }]);
  });
});
