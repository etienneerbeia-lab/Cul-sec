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
    label: "Poker",
    tagline: "Deux cartes, flop, turn, river. Qui se couche boit le pot.",
    icon: "♠️",
    cards: 2,
  },
  {
    id: "duel",
    label: "Bataille",
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
  {
    id: "vote",
    label: "Tu préfères",
    tagline: "Un dilemme, deux camps. Vote en secret : le camp minoritaire boit.",
    icon: "🗳️",
    cards: 0,
  },
  {
    id: "meme",
    label: "Make It Meme",
    tagline: "Une image, une minute, ta meilleure légende. Le moins drôle boit.",
    icon: "😂",
    cards: 0,
  },
  {
    id: "dice",
    label: "Lancé de dés",
    tagline: "Lance tes dés à ton tour. Le plus petit score boit.",
    icon: "🎲",
    cards: 0,
  },
  {
    id: "undercover",
    label: "Undercover",
    tagline: "Même mot pour tous sauf un imposteur. Décrivez-le à voix haute, démasquez-le au vote.",
    icon: "🕵️",
    cards: 0,
  },
  {
    id: "blackjack",
    label: "Blackjack",
    tagline: "Mise ta gorgée, affronte la banque. Bats le croupier ou bois ta mise.",
    icon: "🎰",
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
