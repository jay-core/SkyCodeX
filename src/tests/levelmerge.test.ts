import { describe, it, expect } from 'vitest';
import { mergeLevel, keepsDeeper } from '../shared/levelmerge';

type C = { key: string; text: string };
type L = { caller: { id: string }; cards: C[]; focus: number };
const same = (a: { id: string }, b: { id: string }) => a.id === b.id;
const card = (key: string, text = key) => ({ key, text });

describe('preview level merge', () => {
  it('keeps the focused card when clangd adds a card in front of it', () => {
    const a = card('a'), b = card('b');
    const old: L = { caller: { id: 'f' }, cards: [a, b], focus: 1 };
    const fresh: L = { caller: { id: 'f' }, cards: [card('z'), card('a'), card('b')], focus: -1 };
    const m = mergeLevel(old, fresh, same);
    expect(m.focus).toBe(2);
    expect(m.cards[1]).toBe(a);          // unchanged cards stay the same objects
    expect(m.cards[2]).toBe(b);
    expect(m.caller).toBe(old.caller);   // so effects keyed on the caller don't reset pins
    expect(keepsDeeper(old, m)).toBe(true);
  });

  it('drops the focus when the focused card is gone, and replaces a card whose text changed', () => {
    const old: L = { caller: { id: 'f' }, cards: [card('a'), card('b')], focus: 1 };
    const fresh: L = { caller: { id: 'f' }, cards: [card('a', 'changed')], focus: -1 };
    const m = mergeLevel(old, fresh, same);
    expect(m.focus).toBe(-1);
    expect(m.cards[0]).not.toBe(old.cards[0]);
    expect(keepsDeeper(old, m)).toBe(false);
  });

  it('takes the fresh level as it is for another caller', () => {
    const old: L = { caller: { id: 'f' }, cards: [card('a')], focus: 0 };
    const fresh: L = { caller: { id: 'g' }, cards: [card('a')], focus: -1 };
    expect(mergeLevel(old, fresh, same)).toBe(fresh);
  });
});
