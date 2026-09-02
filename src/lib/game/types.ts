export type SuitColor = "black" | "red";

export interface Suit {
  sym: string;
  color: SuitColor;
}

export interface Card {
  value: number; // 2-14, 14 = As
  suit: Suit;
}

export type RoundTypeId = "high" | "holdem" | "duel" | "quiz" | "vote" | "meme" | "dice" | "undercover";

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
  | "dice"
  | "undercoverClue"
  | "undercoverVote"
  | "undercoverGuess"
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
  // "dice" (Dés qui tremblent)
  diceRolls?: DiceRoll[];
  diceLowest?: string[];
  // "undercover"
  undercoverWord?: string;
  undercoverImpostorWord?: string;
  undercoverIsMisterWhite?: boolean;
  undercoverImpostorName?: string;
  undercoverOutcome?: UndercoverOutcome;
  undercoverGuessText?: string;
  undercoverClues?: UndercoverClueEntry[];
  undercoverEliminationOrder?: string[];
  undercoverTieBreakByLottery?: boolean;
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

// Dés qui tremblent — turn-based like Culture G (one player acts at a
// time, in table order), but every roll is public the instant it happens
// (there's nothing to hide — no redaction needed anywhere for this one).
export interface DiceRoll {
  slug: string;
  name: string;
  d1: number;
  d2: number;
  sum: number;
}

export interface DiceRoundState {
  turnOrder: number[];
  turnPointer: number;
  playerIdx: number;
  // Completed rolls so far, in the order they happened — doubles as the
  // live "who's rolled what" table every client renders while it fills up.
  rolls: DiceRoll[];
}

// Undercover: everyone gets the same secret word except one impostor —
// tirée au sort — who either gets a close-but-different word ("Undercover",
// under 5 players) or no word at all ("Mister White", 5+ players). Players
// give one spoken+typed clue each in table order, then vote in secret for
// who they think the impostor is; a clean majority resolves the round,
// wrongly-accused innocents get eliminated and the table goes again with
// whoever's left, and a tie triggers one scoped revote before falling back
// to a random pick so the round always terminates.
export type UndercoverOutcome =
  | "caught_correct_guess" // Mister White caught, guessed the word right — nobody drinks
  | "caught_wrong_guess" // Mister White caught, guessed wrong — impostor drinks
  | "caught_direct" // Undercover variant caught — no guess, impostor drinks directly
  | "survived"; // impostor evaded detection down to the last 2 — everyone else drinks

export interface UndercoverClueEntry {
  slug: string;
  name: string;
  text: string;
  cycle: number;
}

export interface UndercoverRoundState {
  // Present in server-side state at all times, but the state API strips
  // all three from every response — the round's whole tension depends on
  // nobody but the impostor themself knowing they're the impostor (or
  // what the "close" word is) until it resolves into lastResults.
  secretWord?: string;
  impostorSlug?: string;
  impostorWord?: string;
  isMisterWhite: boolean;
  remainingSlugs: string[];
  eliminatedSlugs: string[];
  cycle: number;
  clueOrder: string[];
  cluePointer: number;
  // Full transcript across every cycle this manche — public as it happens,
  // there's nothing to hide about a spoken-aloud clue.
  clues: UndercoverClueEntry[];
  // voter slug -> accused slug, current cycle/attempt only. Stripped from
  // the state API while the vote is live, same idea as the vote and meme
  // mini-games — only `voteResponded` (who's acted, not who they picked)
  // stays public.
  votes: Record<string, string>;
  voteResponded: string[];
  // Set only during a scoped revote after a tie — when present, a vote's
  // target must be one of these instead of any remaining player.
  tieBreakCandidates?: string[];
  // Whether the round's most recent (decisive) vote had to be broken by a
  // random pick after two ties in a row — carried into lastResults as
  // flavor text, reset back to false whenever a cycle resolves normally.
  tieBreakByLottery?: boolean;
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
  dice?: DiceRoundState;
  undercover?: UndercoverRoundState;
}

export interface Player {
  name: string;
  slug: string;
}
