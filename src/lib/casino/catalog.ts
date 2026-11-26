import type { CasinoGameId, CasinoGameMeta } from "./types";

// Métadonnées affichables côté client (salon, menu, en-tête). La logique
// des jeux est dans lib/casino/registry.ts (côté serveur).
export const CASINO_GAMES: CasinoGameMeta[] = [
  {
    id: "poker",
    label: "Poker",
    icon: "♠️",
    tagline: "Texas Hold'em No Limit, tournoi express.",
    minPlayers: 2,
    unit: "chips",
    ready: true,
    rules: [
      "1 000 jetons chacun, blindes 10/20 qui doublent toutes les 2 minutes.",
      "2 cartes privées, 5 cartes communes : la meilleure main de 5 cartes gagne.",
      "No limit : relance minimum = la dernière relance, tapis quand tu veux.",
      "15 s pour jouer : check si possible, sinon on se couche pour toi.",
      "Plus de jetons = éliminé. Le dernier en jeu gagne le tournoi.",
    ],
  },
  {
    id: "bjtable",
    label: "Blackjack Table",
    icon: "🎰",
    tagline: "Toute la table contre le croupier.",
    minPlayers: 1,
    unit: "euro",
    ready: true,
    rules: [
      "500 € chacun. Mise de 5 € minimum, jusqu'à ton solde, en 15 s (sinon tu passes la manche).",
      "Blackjack payé 3:2. Le croupier reste sur 17 (même soft).",
      "Doubler sur 2 cartes (aussi après un split), séparer jusqu'à 4 mains, As séparés : 1 carte chacun.",
      "Assurance (moitié de la mise) quand le croupier montre un As : payée 2:1. Avec un As ou un 10 visible, il vérifie son blackjack.",
      "15 s pour jouer, sinon tu restes. Sous 5 €, tu regardes la fin de la partie.",
    ],
  },
];

export function casinoGameById(id: CasinoGameId): CasinoGameMeta {
  return CASINO_GAMES.find((g) => g.id === id)!;
}

export function isCasinoGameId(v: unknown): v is CasinoGameId {
  return typeof v === "string" && CASINO_GAMES.some((g) => g.id === v);
}
