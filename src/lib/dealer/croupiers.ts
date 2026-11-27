import type { GameState } from "../game/types";

// Les trois croupières du blackjack (Chill et Soirée). Une partie en tire
// une au hasard : le tirage est déduit du code du salon et de la partie,
// donc identique pour tous les joueurs, sans rien stocker.

export type CroupierLook = "brune" | "blonde" | "metisse";

export interface Croupier {
  look: CroupierLook;
  name: string;
  // Petites touches de caractère ajoutées à certaines réponses.
  flair: string[];
}

export const CROUPIERS: Croupier[] = [
  { look: "brune", name: "Carmen", flair: ["¡Suerte!", "Olé !", "Vamos !"] },
  { look: "blonde", name: "Lola", flair: ["✨", "😄", "On s'amuse !"] },
  { look: "metisse", name: "Maya", flair: ["😌", "Tranquille.", "Respire, tout va bien."] },
];

// Identifiant de la partie de blackjack en cours (null hors blackjack) :
// Chill = une partie de Blackjack Table ; Soirée = une manche de blackjack.
export function blackjackGameKey(g: GameState, roomCode: string): string | null {
  if (g.universe === "casino") return g.casinoGameId === "bjtable" && g.casinoStartedAt ? `${roomCode}:c:${g.casinoStartedAt}` : null;
  return g.roundTypeId === "blackjack" && g.blackjack ? `${roomCode}:s:${g.round}` : null;
}

// FNV-1a : répartit bien des clés très proches (même salon, parties qui se
// suivent).
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function croupierFor(key: string): Croupier {
  return CROUPIERS[hash(key) % CROUPIERS.length];
}
