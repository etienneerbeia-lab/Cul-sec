import type { ChipLedger } from "../chips/ledger";
import type { PokerState } from "../poker/types";
import type { BjtState } from "../bjtable/types";
import type { CasinoGameId, CasinoOptions, CasinoRankEntry, Universe } from "../casino/types";

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
  | "blackjack"
  | "archery"
  | "reflex";

export interface RoundType {
  id: RoundTypeId;
  label: string;
  // Phrase d'accroche de l'écran d'intro (10 mots max) ; les règles
  // détaillées sont dans lib/game/rules.ts (menu pendant la partie).
  tagline: string;
  icon: string;
  cards: number;
  // Minimum de joueurs à table (humains + bots) pour que le jeu soit tiré.
  minPlayers: number;
}

// The host must keep at least this many mini-games active in the lobby's
// selector — below that, alternation (never repeating back-to-back) breaks
// down and a 1-game "pool" would just replay the same thing every round.
export const MIN_ENABLED_ROUND_TYPES = 2;

export interface PlayerPublic {
  name: string;
  slug: string;
  bot?: boolean;
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
  | "vote"
  | "memeCaption"
  | "memeVote"
  | "undercoverClue"
  | "undercoverVote"
  | "undercoverGuess"
  | "blackjack"
  | "archery"
  | "highlow"
  | "duel"
  | "qcm"
  | "dice421"
  | "reflex"
  | "poker"
  | "bjtable"
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
  voteMode?: "tp" | "qui";
  votePrompt?: string;
  voteTally?: { slug: string; name: string; votes: number }[];
  // "meme" (Légende de mème)
  memeUrl?: string;
  memeTallies?: MemeVoteTally[];
  memeLeastFunny?: string[];
  memeNoCaptioners?: string[];
  // "dice" (Dés qui tremblent)
  diceLowest?: string[];
  // Gulps the sole loser named in diceLowest actually drinks — the base
  // 2, or double that per tie-break level it took to separate them (4,
  // 8, 16...). Absent only on very old saved games from before tie-break
  // existed, where diceLowest could still list more than one name.
  diceLowestAmount?: number;
  // Empty/absent if the round settled without a tie. One entry per
  // tie-break level that occurred, in order, for the recap to show the
  // whole chain rather than just the final result.
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
  // "archery" (Tir à l'arc) — full leaderboard (everyone ranked, ties
  // share a rank), keyed on total points across 3 arrows, sorted
  // descending (higher score wins).
  archeryRanking?: ArcheryRankingEntry[];
  handLabels?: Record<string, string>;
}



export type VoteChoice = "A" | "B";

export interface VoteQuestionState {
  id: string;
  promptA: string;
  promptB: string;
}

export interface VoteRoundState {
  // "tp" = Tu préfères (A/B) ; "qui" = Qui de nous (vote pour un joueur).
  mode?: "tp" | "qui";
  // Question tirée du pool 18+.
  spicy?: boolean;
  // Question écrite par un joueur de la table.
  custom?: boolean;
  question: VoteQuestionState;
  prompt?: string;
  askedAt: number;
  // slug -> choix (A/B ou slug visé). Caché aux clients jusqu'au résultat.
  votes: Record<string, string>;
  responded: string[];
}

// Legends of Memes — same 60s-to-write, private-until-resolved shape as
// the other timed mini-games, just a longer clock since writing a caption
// takes more than picking A or B.
export const MEME_CAPTION_MS = 45000;
export const MEME_VOTE_MS = 25000;

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
  // Mode 18+ : thème imposé pour la légende.
  theme?: string;
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
  // "dealer-reveal" : la banque retourne sa carte cachée (début de son tour),
  // avant ses "dealer-hit" éventuels.
  target: "player" | "dealer-up" | "dealer-hidden" | "dealer-reveal" | "dealer-hit";
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

// Tir à l'arc — turn-based, single pass around the table (nobody gets a
// second turn), but each turn is 3 arrows shot back to back rather than
// one action: the active player fires, watches it land, then immediately
// fires again (fresh wind each time) until their 3rd arrow, at which point
// the turn moves to the next player. Scoring is by points (10 center down
// to 0 off the target), summed across a player's 3 arrows.
export const ARCHERY_ARROWS_PER_TURN = 3;

export interface ArcheryPoint {
  x: number;
  y: number;
}

export type ArcheryWindDirection = "N" | "S" | "E" | "W" | "NE" | "NW" | "SE" | "SW";

export interface ArcheryWind {
  direction: ArcheryWindDirection;
  intensity: number; // 0..1, always > 0 — see randomWind in lib/archery/physics.ts
}

// Computed entirely server-side from (aim, wind, power) — see
// applyArcheryShot's own comment for why this one isn't trusted from the
// client on purpose.
export interface ArcheryShotRecord {
  slug: string;
  name: string;
  arrowNumber: number; // 1..ARCHERY_ARROWS_PER_TURN, this player's Nth arrow this turn
  wind: ArcheryWind; // whatever was blowing for this specific arrow
  aim: ArcheryPoint; // where the player placed their reticle at release
  power: number; // 0..1, how long the draw was held
  impact: ArcheryPoint; // where the arrow actually landed, after the draw and wind deviation
  path: ArcheryPoint[]; // sampled flight path, for the replay animation
  points: number; // 0-10, this arrow's score
}

export interface ArcheryRoundState {
  turnOrder: number[]; // playersPublic indices, table order
  turnPointer: number; // index into turnOrder — ever-increasing, never wraps (one pass only)
  playerIdx: number;
  arrowNumber: number; // 1..ARCHERY_ARROWS_PER_TURN — which arrow the active player is about to shoot
  wind: ArcheryWind; // current wind, regenerated before every single arrow
  shots: ArcheryShotRecord[]; // in the order they happened — drives the "replay one at a time" UI, same as dice
}

export interface ArcheryRankingEntry {
  slug: string;
  name: string;
  totalScore: number; // sum of this player's ARCHERY_ARROWS_PER_TURN arrows' points
  // Dense rank (1 = best/highest score); exact totalScore ties share a
  // rank, the next distinct value takes the very next rank — no gaps.
  rank: number;
  gulps: number; // rank - 1, so a sole 1st place drinks nothing
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
  usedQuestionIds?: string[];
  totalRounds?: number;
  // Which mini-games the host opted into at launch — setupRoundType only
  // ever draws from this list. Optional only for defensiveness against an
  // older/malformed saved state; every game launched through the lobby
  // sets it explicitly.
  enabledRoundTypeIds?: RoundTypeId[];
  culSecRule?: CulSecRule;
  // Mode 18+ activé par l'hôte (avec confirmation) : « Tu préfères » et
  // « Qui de nous » piochent surtout dans les pools adultes.
  adultMode?: boolean;
  // Questions de la table, copiées du salon au lancement. Jamais envoyées
  // aux clients (voir view.ts) : la surprise fait tout.
  customQuestions?: CustomQuestion[];
  culSecTargetSlug?: string;
  vote?: VoteRoundState;
  meme?: MemeRoundState;
  undercover?: UndercoverRoundState;
  blackjack?: BlackjackRoundState;
  archery?: ArcheryRoundState;
  // ---- v2 ----
  // Mains privées (cartes) de la manche — jamais envoyées telles quelles,
  // chaque joueur ne reçoit que la sienne (voir lib/game/view.ts).
  hands?: Record<string, Card[]>;
  timer?: WaitTimer;
  botPlan?: BotPlan;
  // Gorgées données pendant la manche en cours (affichées en fin de manche).
  drinks?: DrinkEntry[];
  highlow?: HighLowState;
  duel?: DuelState;
  qcm?: QcmState;
  reflex?: ReflexState;
  dice421?: Dice421State;
  // Incrémenté à chaque action acceptée : sert de clé d'attente aux jeux
  // tour par tour (chaque coup ouvre une nouvelle attente).
  seq?: number;
  // ---- Univers « Chill / Casino » ----
  // Absent = « party » (Soirée) : les salons existants ne changent pas.
  // Gardé au retour au salon pour que l'hôte retrouve son choix.
  universe?: Universe;
  casinoGameId?: CasinoGameId;
  casinoOptions?: CasinoOptions;
  // Heure serveur du lancement (horloge des blindes, durée de partie).
  casinoStartedAt?: number;
  casinoEndedAt?: number;
  // Soldes des joueurs assis (voir lib/chips).
  chips?: ChipLedger;
  // Classement final, figé à la fin de la partie.
  casinoRanking?: CasinoRankEntry[];
  // Poker casino (Texas Hold'em No Limit, tournoi express).
  poker?: PokerState;
  // Blackjack Table casino (toute la table contre le croupier).
  bjt?: BjtState;
  // Chat avec la croupière (blackjack Chill et Soirée), partagé par la
  // table ; remis à zéro à chaque nouvelle partie de blackjack.
  dealerChat?: DealerChatState;
}

export interface DealerChatMessage {
  id: number;
  from: "player" | "dealer";
  slug?: string;
  name: string;
  text: string;
  // Heure serveur d'affichage : la réponse de la croupière arrive après un
  // court « … écrit » (les clients la masquent jusque-là).
  at: number;
}

export interface DealerChatState {
  // Partie de blackjack à laquelle appartient la discussion.
  key: string;
  next: number;
  messages: DealerChatMessage[];
  // Dernier message de chaque joueur (anti-spam).
  last: Record<string, number>;
}

// Question écrite par un joueur dans le salon (« Questions de la table »),
// mélangée aux pools de « Tu préfères » / « Qui de nous ». Anonyme à
// l'affichage.
export interface CustomQuestion {
  id: string;
  authorSlug: string;
  mode: "tp" | "qui";
  promptA?: string;
  promptB?: string;
  // « Qui de nous » : la suite de la phrase, sans « Qui de nous ».
  prompt?: string;
}

export const MAX_CUSTOM_QUESTIONS_PER_PLAYER = 2;

export interface Player {
  name: string;
  slug: string;
  // Joueur virtuel géré par le serveur (mode solo / table incomplète).
  bot?: boolean;
  // A quitté la partie : ses tours sont joués automatiquement.
  left?: boolean;
}

// Timer générique d'une attente (tour d'un joueur, vote simultané...) —
// posé par le serveur (lib/game/tick.ts) dès que l'attente commence.
export interface WaitTimer {
  key: string;
  deadlineAt: number | null;
}

// Heures (serveur) auxquelles chaque bot concerné jouera son coup pour
// l'attente identifiée par `key`.
export interface BotPlan {
  key: string;
  at: Record<string, number>;
}

// ---------- v2 : journal des gorgées ----------
export interface DrinkEntry {
  slug: string;
  name: string;
  n: number;
  why: string;
}

// ---------- Plus ou Moins ----------
export type HighLowGuess = "plus" | "moins";
export interface HighLowTurn {
  slug: string;
  name: string;
  guess: HighLowGuess;
  from: Card;
  card: Card;
  correct: boolean;
  drank: number;
}
export interface HighLowState {
  deck: Card[]; // secret
  current: Card;
  pile: number; // cartes accumulées depuis la dernière erreur
  order: string[]; // slugs, un tour par entrée
  pointer: number;
  turns: HighLowTurn[];
}

// ---------- Bataille ----------
export interface DuelFlip {
  a: Card;
  b: Card;
}
export interface DuelState {
  a: string;
  b: string;
  stage: "bets" | "flip" | "done";
  bets: Record<string, "a" | "b">;
  betResponded: string[];
  revealed: [boolean, boolean];
  flips: DuelFlip[]; // retournements terminés (égalités puis le décisif)
  pendingA?: Card; // carte retournée par A en attendant B
  pendingB?: Card;
  deck: Card[]; // secret
  winner?: "a" | "b";
}

// ---------- Culture G (QCM) ----------
export interface QcmQuestion {
  id: string;
  category: string;
  prompt: string;
  flagEmoji?: string;
  choices: string[];
  answerIdx?: number; // caché pendant la question
  difficulty: number;
}
export interface QcmAnswer {
  choice: number;
  ms: number; // temps de réponse
}
export interface QcmState {
  questions: QcmQuestion[];
  index: number;
  stage: "ask" | "reveal" | "champion" | "done";
  askedAt: number;
  answers: Record<string, QcmAnswer | null>; // réponses à la question en cours
  history: { correct: Record<string, boolean>; fastest?: string }[];
  scores: Record<string, { correct: number; ms: number }>;
  champion?: string;
  championTarget?: string;
}

// ---------- 421 ----------
export interface Dice421Roll {
  slug: string;
  name: string;
  dice: number[]; // 3 dés
  throws: number; // nombre de lancers utilisés (1-3)
  held?: boolean[];
}
export interface Dice421State {
  order: string[];
  pointer: number;
  current: Dice421Roll | null; // lancer du joueur actif
  finished: Dice421Roll[];
}

// Réflexe : l'écran passe au vert à un instant aléatoire (heure serveur
// goAt), chacun tape le plus vite possible. Le temps de réaction est
// mesuré sur le téléphone (pas de latence réseau), en ms. "early" = tapé
// avant le vert ; null = pas tapé dans le temps imparti.
export type ReflexTap = number | "early" | null;

export interface ReflexCoup {
  taps: Record<string, ReflexTap>;
  slowest: string[];
  early: string[];
  fastest?: string;
}

export interface ReflexState {
  coup: number; // 0-based
  coups: number;
  stage: "wait" | "reveal";
  goAt: number;
  // Délai entre le début du coup et le vert (pour les chronos du serveur).
  delayMs: number;
  taps: Record<string, ReflexTap>;
  history: ReflexCoup[];
}
