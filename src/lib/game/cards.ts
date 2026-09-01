import type { Card, Suit } from "./types";

export const SUITS: Suit[] = [
  { sym: "♠", color: "black" },
  { sym: "♥", color: "red" },
  { sym: "♦", color: "red" },
  { sym: "♣", color: "black" },
];

export function valueLabel(v: number): string {
  if (v === 14) return "A";
  if (v === 13) return "R";
  if (v === 12) return "D";
  if (v === 11) return "V";
  return String(v);
}

export function shuffleArr<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function makeShuffledDeck(): Card[] {
  const deck: Card[] = [];
  SUITS.forEach((s) => {
    for (let v = 2; v <= 14; v++) deck.push({ value: v, suit: s });
  });
  shuffleArr(deck);
  return deck;
}
