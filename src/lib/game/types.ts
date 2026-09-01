export type SuitColor = "black" | "red";

export interface Suit {
  sym: string;
  color: SuitColor;
}

export interface Card {
  value: number; // 2-14, 14 = As
  suit: Suit;
}

export type RoundTypeId = "high" | "low" | "teenpatti" | "holdem" | "duel";

export interface RoundType {
  id: RoundTypeId;
  label: string;
  tagline: string;
  icon: string;
  cards: number;
}

export interface PlayerPublic {
  name: string;
  slug: string;
  gulpsTotal: number;
  folded: boolean;
  bet: number;
  foldCost: number | null;
}

export type GamePhase =
  | "lobby"
  | "roundIntro"
  | "betting"
  | "communityReveal"
  | "showdown"
  | "final";

export type Street = "single" | "preflop" | "flop" | "turn" | "river";

export type BettingMode = "check-or-bet" | "always-bet";
export type FoldCostMode = "pot" | "flat";

export interface BettingOpts {
  mode: BettingMode;
  foldCost: FoldCostMode;
}

export interface LastResults {
  type: RoundTypeId;
  soleSurvivor?: boolean;
  winners?: string[];
  losers?: string[];
  betAmount?: number;
  hands?: Record<string, Card[]>;
  potAtEnd?: number;
  share?: number;
  tie?: boolean;
  winner?: string;
  loser?: string;
  names?: string[];
  cards?: Record<string, Card>;
}

export interface GameState {
  phase: GamePhase;
  round: number;
  startIndex: number;
  lastRoundTypeId: RoundTypeId | null;
  playersPublic: PlayerPublic[];
  roundTypeId?: RoundTypeId;
  duelists?: [number, number] | null;
  dealTargets?: number[];
  community?: Card[];
  communityRevealed?: number;
  pot?: number;
  street?: Street;
  bettingOpts?: BettingOpts;
  currentBet?: number;
  turnOrder?: number[];
  turnPointer?: number;
  needsToAct?: number[];
  turnIdx?: number;
  lastResults?: LastResults;
}

export interface Player {
  name: string;
  slug: string;
}
