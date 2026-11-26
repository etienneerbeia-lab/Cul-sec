import { SUITS, shuffleArr } from "../game/cards";
import type { Card } from "../game/types";

// Cartes compactes pour les jeux casino : 2 caractères par carte (« As »,
// « Td », « 9c »...). Un sabot de 6 jeux tient en 624 caractères au lieu
// d'environ 14 Ko en JSON « { value, suit: { sym, color } } » : chaque
// client relit le salon toutes les 1,2 s, la taille du document compte.
export type CardCode = string;

const RANKS = "23456789TJQKA";
// Même ordre que SUITS (♠ ♥ ♦ ♣).
const SUIT_CODES = "shdc";

export function toCode(c: Card): CardCode {
  const s = SUITS.findIndex((x) => x.sym === c.suit.sym);
  if (c.value < 2 || c.value > 14 || s < 0) throw new Error(`Carte invalide : ${JSON.stringify(c)}`);
  return RANKS[c.value - 2] + SUIT_CODES[s];
}

export function fromCode(code: CardCode): Card {
  const v = RANKS.indexOf(code[0]);
  const s = SUIT_CODES.indexOf(code[1]);
  if (code.length !== 2 || v < 0 || s < 0) throw new Error(`Code de carte invalide : ${code}`);
  return { value: v + 2, suit: SUITS[s] };
}

export function cardValue(code: CardCode): number {
  return RANKS.indexOf(code[0]) + 2;
}

export function fromCodes(codes: CardCode[]): Card[] {
  return codes.map(fromCode);
}

// Sabot mélangé de `decks` jeux, sous forme de chaîne (2 caractères/carte).
export function shuffledShoe(decks = 1): string {
  const cards: CardCode[] = [];
  for (let d = 0; d < decks; d++) for (const r of RANKS) for (const s of SUIT_CODES) cards.push(r + s);
  shuffleArr(cards);
  return cards.join("");
}

export function shoeSize(shoe: string): number {
  return shoe.length / 2;
}

// Tire la première carte : [carte, reste du sabot].
export function draw(shoe: string): [CardCode, string] {
  if (shoe.length < 2) throw new Error("Sabot vide.");
  return [shoe.slice(0, 2), shoe.slice(2)];
}
