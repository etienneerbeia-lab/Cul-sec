import type { RoundType, Street } from "./types";

export const ROUND_TYPES: RoundType[] = [
  {
    id: "high",
    label: "Carte la plus haute",
    tagline: "Une carte chacun, cachée. La plus forte l'emporte.",
    icon: "🂡",
    cards: 1,
  },
  {
    id: "holdem",
    label: "Texas express",
    tagline: "Deux cartes, flop, turn, river. Qui se couche boit le pot.",
    icon: "♠️",
    cards: 2,
  },
  {
    id: "duel",
    label: "Duel éclair",
    tagline: "Deux joueurs tirés au sort s'affrontent en une carte, sans mise.",
    icon: "⚔️",
    cards: 1,
  },
  {
    id: "quiz",
    label: "Culture G",
    tagline: "Chacun son tour : capitales, drapeaux, dates. Bonne réponse, tu fais boire ; mauvaise, tu bois.",
    icon: "🧠",
    cards: 0,
  },
];

export function roundTypeById(id: string): RoundType {
  const rt = ROUND_TYPES.find((t) => t.id === id);
  if (!rt) throw new Error(`Unknown round type: ${id}`);
  return rt;
}

export function streetLabel(s: Street | undefined): string {
  if (!s) return "";
  return (
    {
      single: "",
      preflop: "Avant le flop",
      flop: "Après le flop",
      turn: "Après le turn",
      river: "Après la river",
    } as Record<Street, string>
  )[s] || "";
}
