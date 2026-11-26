import type { CardCode } from "../casino/cards";

export type BjtStage = "betting" | "insurance" | "playerTurns" | "roundEnd";

export type BjtOutcome = "win" | "lose" | "push" | "blackjack";

export interface BjtHand {
  // Identifiant stable (le split insère des mains au milieu du tableau).
  id: number;
  cards: CardCode[];
  bet: number;
  doubled: boolean;
  fromSplit: boolean;
  splitAces: boolean;
  status: "playing" | "stand" | "bust" | "blackjack";
  outcome?: BjtOutcome;
  // Gain net de cette main (mise déduite) : +50, -25, 0, +38...
  net?: number;
}

export interface BjtSeat {
  slug: string;
  hands: BjtHand[];
  active: number;
  // Assurance prise (montant), 0 = refusée ; undefined = pas encore décidé.
  insurance?: number;
  insuranceNet?: number;
  // Résultat net de la manche (mains + assurance).
  net?: number;
}

// Événement de distribution, rejoué côté client carte par carte :
// t = "p" (joueur), "du" (croupier, carte visible), "dh" (croupier, carte
// cachée posée face cachée), "dr" (croupier retourne sa carte cachée),
// "dd" (croupier tire) ; n = nombre de cartes visibles de cette main après
// l'événement (un split fait passer une main de 2 à 1 carte).
export interface BjtDealEvent {
  t: "p" | "du" | "dh" | "dr" | "dd";
  s?: string;
  h?: number;
  n: number;
}

export interface BjtState {
  round: number;
  // 0 = mode « dernier survivant ».
  totalRounds: number;
  stage: BjtStage;
  // Secret : jamais envoyé aux clients.
  shoe: string;
  shoeCards: number;
  // Le sabot vient d'être remélangé (affiché en début de manche).
  reshuffled: boolean;
  // Joueurs assis, ordre de la table (éliminés compris).
  order: string[];
  // Mises de la manche (0 = ne joue pas cette manche).
  bets: Record<string, number>;
  betDone: string[];
  // Joueurs de la manche, dans l'ordre de la table.
  seats: BjtSeat[];
  turn: number;
  dealer: {
    cards: CardCode[];
    // Secret jusqu'à la révélation.
    hole: CardCode | null;
    // Carte cachée posée (dos visible).
    holeDealt: boolean;
    blackjack: boolean;
  };
  log: BjtDealEvent[];
  // Index du journal à partir duquel les cartes sont encore en train
  // d'apparaître côté client (pour allonger le chrono d'autant).
  replayFrom: number;
  actSeq: number;
  // Solde de chacun avant la manche (départage des éliminés simultanés).
  startStacks?: Record<string, number>;
  // Personne n'a misé : manche passée.
  noBets?: boolean;
  over?: boolean;
}
