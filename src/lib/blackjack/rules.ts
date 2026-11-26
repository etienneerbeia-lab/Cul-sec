import type { Card } from "../game/types";

// Règles pures du blackjack, partagées par le Blackjack Soirée
// (lib/blackjack/engine.ts) et le Blackjack Table casino (lib/bjtable).
// Aucun état, aucun hasard : tout ce qui dépend de la partie reste dans
// chaque moteur.

// Points d'une carte : 2-10 = valeur, figures = 10, As = 11 (réduit à 1 si
// besoin dans handValue).
export function cardPoints(c: Card): number {
  return c.value === 14 ? 11 : Math.min(10, c.value);
}

// card.value runs 2-14 (11=Valet, 12=Dame, 13=Roi, 14=As) — 10/J/Q/K all
// count 10, an Ace counts 11 unless that would bust the hand, in which case
// it drops to 1 (repeated for a second Ace if the hand somehow still needs
// it, e.g. two Aces plus a ten-value card).
export function handValue(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.value === 14) {
      total += 11;
      aces++;
    } else if (c.value >= 11) {
      total += 10;
    } else {
      total += c.value;
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

// Main « soft » : un As compte encore 11 sans dépasser 21.
export function isSoft(cards: Card[]): boolean {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardPoints(c);
    if (c.value === 14) aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return aces > 0;
}

export function isNatural(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards) === 21;
}

// Le croupier tire tant qu'il a moins de 17 ; avec `hitsSoft17`, il tire
// aussi sur un soft 17 (H17). Par défaut il reste sur tous les 17 (S17).
export function dealerShouldHit(cards: Card[], hitsSoft17 = false): boolean {
  const v = handValue(cards);
  return v < 17 || (hitsSoft17 && v === 17 && isSoft(cards));
}

export type BasicMove = "hit" | "stand" | "double" | "split";

// Stratégie de base simplifiée (ce que ferait un joueur correct), utilisée
// par les bots. Le moteur appelant vérifie si le coup est permis.
export function basicStrategyMove(cards: Card[], dealerUp: Card): BasicMove {
  const up = cardPoints(dealerUp);
  const total = handValue(cards);
  const two = cards.length === 2;
  if (two && cards[0].value === cards[1].value) {
    const v = cards[0].value;
    if (v === 14 || v === 8) return "split";
    if ([2, 3, 6, 7, 9].includes(v) && up <= 6) return "split";
  }
  if (two && (total === 11 || (total === 10 && up <= 9))) return "double";
  if (isSoft(cards)) return total >= 19 || (total === 18 && up <= 8) ? "stand" : "hit";
  if (total >= 17) return "stand";
  if (total >= 13 && up <= 6) return "stand";
  if (total === 12 && up >= 4 && up <= 6) return "stand";
  return "hit";
}
