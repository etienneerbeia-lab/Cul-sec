export type SuitColor = "black" | "red";

export interface Suit {
  sym: string;
  color: SuitColor;
}

export interface Card {
  value: number; // 2-14, 14 = As
  suit: Suit;
}

export type RoundTypeId =
  | "high"
  | "holdem"
  | "duel"
  | "quiz"
  | "vote"
  | "meme"
  | "dice"
  | "undercover"
  | "blackjack";

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
  | "blackjack"
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
  // Gulps the sole loser named in diceLowest actually drinks — the base
  // 2, or double that per tie-break level it took to separate them (4,
  // 8, 16...). Absent only on very old saved games from before tie-break
  // existed, where diceLowest could still list more than one name.
  diceLowestAmount?: number;
  // Empty/absent if the round settled without a tie. One entry per
  // tie-break level that occurred, in order, for the recap to show the
  // whole chain rather than just the final result.
  diceTieBreaks?: DiceTieBreakRound[];
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
  // "blackjack"
  blackjackResults?: BlackjackResultEntry[];
  blackjackDealerCards?: Card[];
  blackjackDealerTotal?: number;
  blackjackDealerBust?: boolean;
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
  // Populated the instant each duelist reveals (not just once both have) —
  // that's the whole point of the button: publishing that one card to the
  // table. Null until its slot's `revealed` flips true, at which point
  // it's plain public data like anything else in this object.
  revealedCards: [Card | null, Card | null];
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

// A completed tie-break level, once every tied player has rolled again —
// either it settled (one sole lowest sum) or it's about to be superseded
// by the next level. Kept both as history (see DiceRoundState below) and
// as the shape LastResults.diceTieBreaks reuses for the final recap.
export interface DiceTieBreakRound {
  level: number; // 1 for the first departage, 2 for the next if it also ties, etc.
  amount: number; // gulps the sole loser of THIS level drinks — base*2^level
  tiedSum: number; // the sum that was tied, which triggered this level
  participantSlugs: string[]; // who's contesting, in the same relative order as the main round
  participantNames: string[];
  rolls: DiceRoll[];
}

// The currently in-progress tie-break level — same shape as a finished
// DiceTieBreakRound plus its own live turn pointer, since it's rolled
// through exactly like the main round (rollDice() just routes to this
// instead once it's set).
export interface DiceTieBreakState extends DiceTieBreakRound {
  turnOrder: number[]; // playersPublic indices, parallel to participantSlugs/Names
  turnPointer: number;
  playerIdx: number;
}

export interface DiceRoundState {
  turnOrder: number[];
  turnPointer: number;
  playerIdx: number;
  // Completed rolls so far, in the order they happened — doubles as the
  // live "who's rolled what" table every client renders while it fills up.
  rolls: DiceRoll[];
  // Set the moment the main round (or a previous tie-break level) ends
  // in a tie for lowest sum — only the tied players re-roll here. Stays
  // within phase "dice" the whole time, same as the main round; nothing
  // moves to "showdown" until a level finally produces a sole loser.
  tieBreak?: DiceTieBreakState;
  // Every tie-break level once it's been resolved (superseded by the
  // next level, or the one that finally decided the round) — lets the
  // live "Lancers" table and the final recap show the whole chain.
  tieBreakHistory?: DiceTieBreakRound[];
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

// How long a just-given clue stays pinned on screen for everyone before
// the turn (or the phase, on the cycle's last clue) advances — long enough
// to actually read it. Any player can also skip the wait early.
export const CLUE_REVEAL_MS = 4000;

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
  // Set the instant a clue is submitted; cluePointer/phase only move once
  // undercover-clue-advance is called (auto-fired by every client's own
  // timer once this passes, or early via any player's "Continuer") — keeps
  // the clue just given pinned on everyone's screen instead of jumping
  // straight to the next speaker or to voting.
  revealUntil?: number;
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

// Blackjack: the house (an automatic dealer, never a player) against
// everyone at the table. Unlike every other card mini-game, hands are
// public in full — the state API only ever redacts the dealer's hole card
// (and the undealt deck, which nobody has a reason to see) until the
// dealer's own turn.
export type BlackjackHandStatus = "playing" | "stand" | "bust" | "blackjack";

export interface BlackjackHand {
  // Stable for this hand's whole life, unlike its position in the
  // player's `hands` array — a re-split inserts a new hand right after
  // the one being split, which shifts the array index of any later hand
  // that already exists (from an earlier split). `dealLog` entries key on
  // this instead of array position so they never point at the wrong hand
  // after such a shift.
  id: number;
  cards: Card[];
  bet: number;
  status: BlackjackHandStatus;
  doubled: boolean;
  // A hand split from a pair of Aces: classic rule, gets exactly one more
  // card and no further action (no hit/double/re-split) — the engine
  // enforces this by auto-standing it immediately after the split.
  isSplitAces: boolean;
  fromSplit: boolean;
}

export interface BlackjackPlayerState {
  slug: string;
  name: string;
  // A second (or third...) entry appears here the instant this player
  // splits — they're then played one after another via `activeHandIdx`
  // before the turn moves to the next player.
  hands: BlackjackHand[];
  activeHandIdx: number;
}

export interface BlackjackDealerState {
  cards: Card[];
  // Non-null only until the dealer's own turn — the state API strips it
  // from every response before then, same idea as quiz/undercover's
  // hidden fields.
  hiddenCard: Card | null;
}

// One entry per card actually placed on the table, in dealing order —
// never mutated once appended, only ever grows for the whole round. The
// client replays this list one entry at a time (same idea as dice's
// roll-by-roll replay queue) instead of ever jumping straight to whatever
// the server has already fully dealt, which is what makes every viewer
// watch the deal (and every later hit/double/split) happen card by card
// instead of all at once. Never carries the actual card value — the card
// itself is already sitting in the right hand's `cards` array (fully
// public data, see BlackjackRoundState's own comment), this just says
// "reveal the next one for this target now".
export interface BlackjackDealEvent {
  target: "player" | "dealer-up" | "dealer-hidden" | "dealer-hit";
  slug?: string; // only for "player"
  handId?: number; // only for "player" — BlackjackHand.id, not an array index
}

export interface BlackjackPendingDistribution {
  slug: string;
  name: string;
  handIdx: number;
  amount: number;
}

export interface BlackjackResultEntry {
  slug: string;
  name: string;
  handIdx: number;
  cards: Card[];
  total: number;
  bet: number;
  outcome: "win" | "lose" | "push" | "blackjack";
  amount: number;
  distributedTo?: { slug: string; name: string; amount: number }[];
}

export interface BlackjackRoundState {
  stage: "betting" | "playerTurns" | "dealerTurn" | "distributing" | "result";
  bets: Record<string, number>;
  betResponded: string[];
  // Table order, one entry per player, fixed for the whole round.
  players: BlackjackPlayerState[];
  turnPointer: number;
  dealer: BlackjackDealerState;
  // Remaining undealt cards — always stripped from the state API, there's
  // no reason a client ever needs to see future draws.
  deck: Card[];
  dealLog: BlackjackDealEvent[];
  // Winning hands waiting to distribute their gorgées, in resolution
  // order; the front entry is whoever's turn it is to distribute right now.
  distributionQueue: BlackjackPendingDistribution[];
  results?: BlackjackResultEntry[];
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
  // Snapshot of `pot` from just before the bet/raise currently on the
  // table was added to it — foldCost "pot" charges 1 + this, never the
  // live pot, so folding never counts the very wager you're declining to
  // match. Reset at the start of each betting street, updated again on
  // every new bet/raise; a call never touches it.
  foldReferencePot?: number;
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
  blackjack?: BlackjackRoundState;
}

export interface Player {
  name: string;
  slug: string;
}
