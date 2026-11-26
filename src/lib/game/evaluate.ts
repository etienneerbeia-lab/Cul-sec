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

// ---- Ajouts partagés avec le Poker casino (les fonctions ci-dessus,
// utilisées par le poker Soirée, restent inchangées) ----

export interface BestHand {
  eval: HandEval;
  // Les 5 cartes qui composent la main (moins si moins de 5 cartes).
  cards: Card[];
}

// Meilleure main de 5 cartes parmi 5 à 7 (ou la main brute s'il y en a
// moins de 5, avant le flop), avec les cartes qui la composent.
export function bestHand(cards: Card[]): BestHand {
  if (cards.length <= 5) return { eval: evaluate5(cards), cards: cards.slice() };
  let best: BestHand | null = null;
  for (const combo of combinations(cards, 5)) {
    const e = evaluate5(combo);
    if (!best || compareHand(e, best.eval) < 0) best = { eval: e, cards: combo };
  }
  return best!;
}

const RANK_NAMES: Record<number, [string, string]> = {
  // [singulier, pluriel]
  2: ["2", "2"],
  3: ["3", "3"],
  4: ["4", "4"],
  5: ["5", "5"],
  6: ["6", "6"],
  7: ["7", "7"],
  8: ["8", "8"],
  9: ["9", "9"],
  10: ["10", "10"],
  11: ["Valet", "Valets"],
  12: ["Dame", "Dames"],
  13: ["Roi", "Rois"],
  14: ["As", "As"],
};

// « de Rois », « d'As », « de 8 ».
const de = (v: number) => (v === 14 ? "d'As" : `de ${RANK_NAMES[v][1]}`);
// « à l'As », « au Roi », « à la Dame », « au Valet », « au 9 ».
function a(v: number): string {
  if (v === 14) return "à l'As";
  if (v === 12) return "à la Dame";
  return `au ${RANK_NAMES[v][0]}`;
}
// « aux Rois », « aux As », « aux 8 ».
const aux = (v: number) => `aux ${RANK_NAMES[v][1]}`;
// « par les 4 », « par les As ».
const par = (v: number) => `par les ${RANK_NAMES[v][1]}`;

// Nom complet d'une main, en français : « Couleur à l'As », « Paire de
// Rois », « Full aux Dames par les 4 », « Quinte au 5 »...
export function describeHand(e: HandEval): string {
  const [t0, t1] = e.tie;
  switch (e.rank) {
    case 8:
      return t0 === 14 ? "Quinte flush royale" : `Quinte flush ${a(t0)}`;
    case 7:
      return `Carré ${de(t0)}`;
    case 6:
      return `Full ${aux(t0)} ${par(t1)}`;
    case 5:
      return `Couleur ${a(t0)}`;
    case 4:
      return `Quinte ${a(t0)}`;
    case 3:
      return `Brelan ${de(t0)}`;
    case 2:
      return `Double paire ${RANK_NAMES[t0][1]} et ${RANK_NAMES[t1][1]}`;
    case 1:
      return `Paire ${de(t0)}`;
    default:
      return `Hauteur ${t0 === 14 ? "As" : RANK_NAMES[t0][0]}`;
  }
}
