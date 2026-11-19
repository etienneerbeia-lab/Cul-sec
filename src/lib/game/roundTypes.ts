import type { RoundType, Street } from "./types";

export const ROUND_TYPES: RoundType[] = [
  {
    id: "high",
    minPlayers: 1,
    label: "Plus ou Moins",
    tagline: "Plus haut ou plus bas ? Une erreur, tu bois.",
    icon: "🃏",
    cards: 1,
  },
  {
    id: "holdem",
    minPlayers: 2,
    label: "Poker",
    tagline: "Se coucher, c'est boire le pot.",
    icon: "♠️",
    cards: 2,
  },
  {
    id: "duel",
    minPlayers: 2,
    label: "Bataille",
    tagline: "Une carte chacun. La plus forte gagne.",
    icon: "⚔️",
    cards: 1,
  },
  {
    id: "quiz",
    minPlayers: 1,
    label: "Culture G",
    tagline: "5 questions, 12 secondes, zéro pitié.",
    icon: "🧠",
    cards: 0,
  },
  {
    id: "vote",
    minPlayers: 3,
    label: "Tu préfères / Qui de nous",
    tagline: "Vote en secret. La minorité trinque.",
    icon: "🗳️",
    cards: 0,
  },
  {
    id: "meme",
    minPlayers: 3,
    label: "Mèmes",
    tagline: "Ta meilleure légende. La moins drôle boit.",
    icon: "😂",
    cards: 0,
  },
  {
    id: "dice",
    minPlayers: 2,
    label: "421",
    tagline: "Trois dés, trois lancers. Le plus petit boit.",
    icon: "🎲",
    cards: 0,
  },
  {
    id: "undercover",
    minPlayers: 4,
    label: "Undercover",
    tagline: "Un imposteur parmi vous. Démasquez-le.",
    icon: "🕵️",
    cards: 0,
  },
  {
    id: "blackjack",
    minPlayers: 1,
    label: "Blackjack",
    tagline: "Approche-toi de 21 sans jamais sauter.",
    icon: "🎰",
    cards: 0,
  },
  {
    id: "archery",
    minPlayers: 1,
    label: "Tir à l'arc",
    tagline: "Trois flèches, du vent. Vise le centre.",
    icon: "🏹",
    cards: 0,
  },
  {
    id: "reflex",
    minPlayers: 2,
    label: "Réflexe",
    tagline: "Attends le vert. Tape. Le plus lent boit.",
    icon: "⚡",
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
