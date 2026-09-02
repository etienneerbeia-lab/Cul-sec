import type { Card } from "./types";

export interface HandEval {
  rank: number;
  tie: number[];
}

export function evaluate5(cards: Card[]): HandEval {
  const values = cards.map((c) => c.value).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit.sym);
  const isFlush = suits.every((s) => s === suits[0]);
  const uniq = [...new Set(values)];
  let isStraight = false;
  let straightHigh: number | null = null;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) {
      isStraight = true;
      straightHigh = uniq[0];
    } else if (
      uniq[0] === 14 &&
      uniq[1] === 5 &&
      uniq[2] === 4 &&
      uniq[3] === 3 &&
      uniq[4] === 2
    ) {
      isStraight = true;
      straightHigh = 5;
    }
  }
  const countMap: Record<number, number> = {};
  values.forEach((v) => (countMap[v] = (countMap[v] || 0) + 1));
  const groups = Object.keys(countMap)
    .map((v) => ({ v: Number(v), c: countMap[Number(v)] }))
    .sort((a, b) => b.c - a.c || b.v - a.v);
  const tie = groups.map((g) => g.v);

  if (isStraight && isFlush) return { rank: 8, tie: [straightHigh as number] };
  if (groups[0].c === 4) return { rank: 7, tie };
  if (groups[0].c === 3 && groups[1] && groups[1].c === 2) return { rank: 6, tie };
  if (isFlush) return { rank: 5, tie: values };
  if (isStraight) return { rank: 4, tie: [straightHigh as number] };
  if (groups[0].c === 3) return { rank: 3, tie };
  if (groups[0].c === 2 && groups[1] && groups[1].c === 2) return { rank: 2, tie };
  if (groups[0].c === 2) return { rank: 1, tie };
  return { rank: 0, tie: values };
}

export function compareHand(a: HandEval, b: HandEval): number {
  if (a.rank !== b.rank) return b.rank - a.rank;
  for (let i = 0; i < Math.max(a.tie.length, b.tie.length); i++) {
    const av = a.tie[i] || 0;
    const bv = b.tie[i] || 0;
    if (av !== bv) return bv - av;
  }
  return 0;
}

export function combinations<T>(arr: T[], k: number): T[][] {
  const res: T[][] = [];
  function rec(start: number, combo: T[]) {
    if (combo.length === k) {
      res.push(combo.slice());
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      rec(i + 1, combo);
      combo.pop();
    }
  }
  rec(0, []);
  return res;
}

export function bestOf7(cards7: Card[]): HandEval {
  const combos = combinations(cards7, 5);
  let best: HandEval | null = null;
  for (const c of combos) {
    const e = evaluate5(c);
    if (!best || compareHand(e, best) < 0) best = e;
  }
  return best as HandEval;
}

export function handLabel5(e: HandEval): string {
  return [
    "Carte haute",
    "Paire",
    "Double paire",
    "Brelan",
    "Suite",
    "Couleur",
    "Full",
    "Carré",
    "Quinte flush",
  ][e.rank];
}
