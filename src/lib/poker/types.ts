import type { CardCode } from "../casino/cards";

export type PokerStage = "preflop" | "flop" | "turn" | "river" | "runout" | "handEnd";
export type PokerMove = "fold" | "check" | "call" | "raise";

// Historique de la main en cours (affiché en mini-journal).
// k : type d'événement ; s : joueur ; n : montant (total de la mise pour
// bet/raise/allin, montant ajouté pour call/blind) ; st : rue.
export interface PokerLogEntry {
  k: "sb" | "bb" | "fold" | "check" | "call" | "bet" | "raise" | "allin" | "street" | "return" | "win";
  s?: string;
  n?: number;
  st?: PokerStage;
}

export interface PokerPotResult {
  amount: number;
  eligible: string[];
  winners: string[];
  shares: Record<string, number>;
}

export interface PokerHandResult {
  // Gagné sans abattage (tout le monde s'est couché).
  uncontested: boolean;
  pots: PokerPotResult[];
  // Mains révélées à l'abattage : nom de la main et les 5 cartes qui la
  // composent (à mettre en avant).
  labels: Record<string, string>;
  best: Record<string, CardCode[]>;
  // Gain net de chaque joueur sur la main.
  net: Record<string, number>;
  // Joueurs éliminés sur cette main.
  busted: string[];
}

export interface PokerState {
  // Ordre fixe de la table (slugs), pour tout le tournoi.
  seats: string[];
  handNo: number;
  // Index dans `seats`.
  button: number;
  sbSlug: string | null;
  bbSlug: string;
  level: number;
  blinds: [number, number];
  // Structure du tournoi (pour l'affichage du prochain niveau).
  levelMs: number;
  levels: [number, number][];
  stage: PokerStage;
  // Secret : jamais envoyé aux clients (voir redact).
  deck: string;
  // Secret : chacun ne reçoit que les siennes (+ celles retournées).
  hole: Record<string, CardCode[]>;
  // Cartes retournées : tapis avant la fin des enchères, ou abattage.
  exposed: string[];
  board: CardCode[];
  inHand: string[];
  folded: string[];
  allIn: string[];
  // Mise de chacun sur la rue en cours.
  streetBet: Record<string, number>;
  currentBet: number;
  // Taille minimum d'une relance (dernière relance complète, ou la BB).
  minRaise: number;
  // Joueurs qui doivent encore parler sur cette rue, dans l'ordre.
  needAction: string[];
  // Ont parlé depuis la dernière relance complète : face à une relance
  // incomplète (tapis), ils peuvent seulement suivre ou se coucher.
  acted: string[];
  toAct: string | null;
  // Incrémenté à chaque coup (clé du chrono d'action).
  actSeq: number;
  // Tapis au début de la main (départage des éliminés simultanés).
  startStacks: Record<string, number>;
  log: PokerLogEntry[];
  result?: PokerHandResult;
  // Dernière main jouée : le classement final s'affiche ensuite.
  over?: boolean;
}

export interface PokerLegal {
  canCheck: boolean;
  // Montant à ajouter pour suivre (plafonné au tapis).
  callAmount: number;
  canRaise: boolean;
  // Bornes de la relance, en montant TOTAL de la mise sur la rue.
  minRaiseTo: number;
  maxRaiseTo: number;
}
