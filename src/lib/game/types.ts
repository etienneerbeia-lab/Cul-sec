export type SuitColor = "black" | "red";

export interface Suit {
  sym: string;
  color: SuitColor;
}

export interface Card {
  value: number; // 2-14, 14 = As
  suit: Suit;
}

export type RoundTypeId = "high" | "low" | "teenpatti" | "holdem" | "duel" | "quiz";

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
  | "quiz"
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

export type QuizQuestionType = "capital" | "flag" | "date";
export type QuizAnswerKind = "year" | "text";
export type QuizTurnStatus = "asking" | "distributing" | "result";

export interface QuizQuestionState {
  id: string;
  type: QuizQuestionType;
  difficulty: number;
  prompt: string;
  flagEmoji?: string;
  answerKind: QuizAnswerKind;
  // Present in server-side state at all times, but the API route strips
  // these two fields from the response while status === "asking" so no
  // client ever receives the answer before it's actually resolved.
  answer?: string;
  acceptableAnswers?: string[];
}

export interface QuizDistributionEntry {
  slug: string;
  name: string;
  amount: number;
}

export interface QuizRoundState {
  turnOrder: number[];
  turnPointer: number;
  playerIdx: number;
  status: QuizTurnStatus;
  question: QuizQuestionState;
  lastAnswerGiven?: string;
  correct?: boolean;
  distribution?: QuizDistributionEntry[];
}

export type CulSecRule = "last" | "first";

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
  quiz?: QuizRoundState;
  usedQuestionIds?: string[];
  totalRounds?: number;
  culSecRule?: CulSecRule;
  culSecTargetSlug?: string;
}

export interface Player {
  name: string;
  slug: string;
}
