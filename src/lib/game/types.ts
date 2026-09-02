export type SuitColor = "black" | "red";

export interface Suit {
  sym: string;
  color: SuitColor;
}

export interface Card {
  value: number; // 2-14, 14 = As
  suit: Suit;
}

export type RoundTypeId = "high" | "holdem" | "duel" | "quiz" | "vote" | "meme";

export interface RoundType {
  id: RoundTypeId;
  label: string;
  tagline: string;
  icon: string;
  cards: number;
}

// The host must keep at least this many mini-games active in the lobby's
// selector — below that, alternation (never repeating back-to-back) breaks
// down and a 1-game "pool" would just replay the same thing every round.
export const MIN_ENABLED_ROUND_TYPES = 2;

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
  | "quizRecap"
  | "duelReveal"
  | "vote"
  | "memeCaption"
  | "memeVote"
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
  // "vote" (Tu préfères)
  promptA?: string;
  promptB?: string;
  countA?: number;
  countB?: number;
  voteEntries?: { name: string; choice: VoteChoice }[];
  voteNonVoters?: string[];
  voteTie?: boolean;
  // "meme" (Légende de mème)
  memeUrl?: string;
  memeTallies?: MemeVoteTally[];
  memeLeastFunny?: string[];
  memeNoCaptioners?: string[];
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

export interface QuizHistoryEntry {
  playerName: string;
  type: QuizQuestionType;
  prompt: string;
  givenAnswer: string;
  correct: boolean;
  correctAnswer: string;
}

export interface QuizRoundState {
  turnOrder: number[];
  turnPointer: number;
  playerIdx: number;
  status: QuizTurnStatus;
  question: QuizQuestionState;
  askedAt: number;
  lastAnswerGiven?: string;
  correct?: boolean;
  distribution?: QuizDistributionEntry[];
  history?: QuizHistoryEntry[];
}

// Shared 15s-to-answer countdown, reused as-is by every timed mini-game
// (Culture G and Tu préfères) so their pace feels consistent.
export const TIMED_ANSWER_MS = 15000;

export interface DuelRevealState {
  revealed: [boolean, boolean];
}

export type VoteChoice = "A" | "B";

export interface VoteQuestionState {
  id: string;
  promptA: string;
  promptB: string;
}

export interface VoteRoundState {
  question: VoteQuestionState;
  askedAt: number;
  // slug -> choice, real votes only (a timeout never adds an entry here).
  // Kept private server-side while the round is live — the state API
  // strips this to a bare count so no one can see who's voted for what
  // before the reveal. Once resolved, the round moves straight to phase
  // "showdown" with the full breakdown in lastResults, same as every
  // other mini-game's result.
  votes: Record<string, VoteChoice>;
  // Every slug that has been accounted for so far, whether they voted or
  // timed out — separate from `votes` because a timeout must still close
  // out that player's turn without counting toward either camp.
  responded: string[];
}

// Legends of Memes — same 60s-to-write, private-until-resolved shape as
// the other timed mini-games, just a longer clock since writing a caption
// takes more than picking A or B.
export const MEME_CAPTION_MS = 60000;

export interface MemeTemplateRef {
  id: string;
  url: string;
  width: number;
  height: number;
}

export interface MemeVoteTally {
  slug: string;
  name: string;
  caption: string;
  votes: number;
}

export interface MemeRoundState {
  template: MemeTemplateRef;
  askedAt: number;
  // slug -> caption text. Stripped entirely from the state API while
  // phase is "memeCaption" (nobody, not even the author, needs the
  // server to echo their own draft back) and sent as-is once voting
  // starts, since the captions themselves are exactly what's being
  // voted on — only the slug->author mapping stays implicit in the UI
  // until the round resolves into lastResults.
  captions: Record<string, string>;
  captionResponded: string[];
  // Shuffled once when voting starts so the option order stays stable
  // across polls instead of reshuffling every 1.5s.
  voteOrder: string[];
  // voter slug -> author slug they voted for.
  votes: Record<string, string>;
  voteResponded: string[];
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
  // Which mini-games the host opted into at launch — setupRoundType only
  // ever draws from this list. Optional only for defensiveness against an
  // older/malformed saved state; every game launched through the lobby
  // sets it explicitly.
  enabledRoundTypeIds?: RoundTypeId[];
  culSecRule?: CulSecRule;
  culSecTargetSlug?: string;
  duelReveal?: DuelRevealState;
  vote?: VoteRoundState;
  meme?: MemeRoundState;
}

export interface Player {
  name: string;
  slug: string;
}
