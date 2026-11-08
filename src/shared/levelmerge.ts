export interface MergeCard { key: string; text: string }
export interface MergeLevel<C extends MergeCard, K> { caller: K; cards: C[]; focus: number }

export function mergeLevel<C extends MergeCard, K, L extends MergeLevel<C, K>>(old: L | undefined, fresh: L, same: (a: K, b: K) => boolean): L {
  if (!old || !same(old.caller, fresh.caller)) return fresh;
  const focusKey = old.focus >= 0 ? old.cards[old.focus]?.key : undefined;
  const cards = fresh.cards.map((c) => old.cards.find((o) => o.key === c.key && o.text === c.text) ?? c);
  return { ...fresh, caller: old.caller, cards, focus: focusKey ? cards.findIndex((c) => c.key === focusKey) : -1 };
}

export function keepsDeeper<C extends MergeCard, K, L extends MergeLevel<C, K>>(old: L | undefined, merged: L): boolean {
  return !!old && old.focus >= 0 && merged.focus >= 0 && old.cards[old.focus] === merged.cards[merged.focus];
}
