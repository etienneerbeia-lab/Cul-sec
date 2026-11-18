import type { RoundType, Street } from "./types";

export const ROUND_TYPES: RoundType[] = [
  {
    id: "high",
    minPlayers: 1,
    label: "Plus ou Moins",
    tagline: "La prochaine carte sera-t-elle plus haute ou plus basse ? Une erreur, et tu bois toute la série.",
    icon: "🃏",
    cards: 1,
  },
  {
    id: "holdem",
    minPlayers: 2,
    label: "Poker",
    tagline: "Texas Hold\'em : flop, turn, river. Se coucher, c\'est boire le pot.",
    icon: "♠️",
    cards: 2,
  },
  {
    id: "duel",
    minPlayers: 2,
    label: "Bataille",
    tagline: "Deux joueurs tirés au sort, une carte chacun. Égalité ? Bataille ! Les autres parient.",
    icon: "⚔️",
    cards: 1,
  },
  {
    id: "quiz",
    minPlayers: 1,
    label: "Culture G",
    tagline: "Chacun son tour : capitales, drapeaux, dates. Bonne réponse, tu fais boire ; mauvaise, tu bois.",
    icon: "🧠",
    cards: 0,
  },
  {
    id: "vote",
    minPlayers: 3,
    label: "Tu préfères",
    tagline: "Un dilemme, deux camps. Vote en secret : le camp minoritaire boit.",
    icon: "🗳️",
    cards: 0,
  },
  {
    id: "meme",
    minPlayers: 3,
    label: "Make It Meme",
    tagline: "Une image, une minute, ta meilleure légende. Le moins drôle boit.",
    icon: "😂",
    cards: 0,
  },
  {
    id: "dice",
    minPlayers: 2,
    label: "Lancé de dés",
    tagline: "Lance tes dés à ton tour. Le plus petit score boit.",
    icon: "🎲",
    cards: 0,
  },
  {
    id: "undercover",
    minPlayers: 4,
    label: "Undercover",
    tagline: "Même mot pour tous sauf un imposteur. Décrivez-le à voix haute, démasquez-le au vote.",
    icon: "🕵️",
    cards: 0,
  },
  {
    id: "blackjack",
    minPlayers: 1,
    label: "Blackjack",
    tagline: "Mise ta gorgée, affronte la banque. Bats le croupier ou bois ta mise.",
    icon: "🎰",
    cards: 0,
  },
  {
    id: "golf",
    minPlayers: 1,
    label: "Mini-golf",
    tagline: "Vise, tire, rentre ta balle. Classement au nombre de coups : le mieux classé ne boit pas.",
    icon: "⛳",
    cards: 0,
  },
  {
    id: "archery",
    minPlayers: 1,
    label: "Tir à l'arc",
    tagline: "Trois flèches chacun, le vent change à chaque tir. Le plus petit score boit le plus.",
    icon: "🏹",
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
