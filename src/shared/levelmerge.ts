// Rebuilding a preview level must not disturb what the reader is looking at. A level rebuilt while clangd settles
// is merged into the one on screen: the same caller object, unchanged cards kept as the same objects (so their
// editors are not remounted), and the focused card found again by its key.

export interface MergeCard { key: string; text: string }
export interface MergeLevel<C extends MergeCard, K> { caller: K; cards: C[]; focus: number }

/** The fresh level, merged into the old one when both are for the same caller (`same` decides). */
export function mergeLevel<C extends MergeCard, K, L extends MergeLevel<C, K>>(old: L | undefined, fresh: L, same: (a: K, b: K) => boolean): L {
  if (!old || !same(old.caller, fresh.caller)) return fresh;
  const focusKey = old.focus >= 0 ? old.cards[old.focus]?.key : undefined;
  const cards = fresh.cards.map((c) => old.cards.find((o) => o.key === c.key && o.text === c.text) ?? c);
  return { ...fresh, caller: old.caller, cards, focus: focusKey ? cards.findIndex((c) => c.key === focusKey) : -1 };
}

/** Whether the levels below a merged one still belong to it: its focused card is the very card they were built from. */
export function keepsDeeper<C extends MergeCard, K, L extends MergeLevel<C, K>>(old: L | undefined, merged: L): boolean {
  return !!old && old.focus >= 0 && merged.focus >= 0 && old.cards[old.focus] === merged.cards[merged.focus];
}
