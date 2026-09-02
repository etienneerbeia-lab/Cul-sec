import { checkAnswer } from "../quiz/match";
import type { GameState, UndercoverOutcome } from "../game/types";
import { WORD_PAIRS } from "./words";

const MAX_CLUE_LEN = 60;
const MAX_GUESS_LEN = 60;

function tableOrder(g: GameState, slugs: string[]): string[] {
  const n = g.playersPublic.length;
  const order: string[] = [];
  for (let i = 0; i < n; i++) {
    const slug = g.playersPublic[(g.startIndex + i) % n].slug;
    if (slugs.includes(slug)) order.push(slug);
  }
  return order;
}

export function startUndercoverRound(g: GameState): void {
  const pair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
  const impostorSlug = g.playersPublic[Math.floor(Math.random() * g.playersPublic.length)].slug;
  const isMisterWhite = g.playersPublic.length >= 5;
  const remainingSlugs = g.playersPublic.map((p) => p.slug);

  g.undercover = {
    secretWord: pair.word,
    impostorSlug,
    impostorWord: isMisterWhite ? undefined : pair.closeWord,
    isMisterWhite,
    remainingSlugs,
    eliminatedSlugs: [],
    cycle: 0,
    clueOrder: tableOrder(g, remainingSlugs),
    cluePointer: 0,
    clues: [],
    votes: {},
    voteResponded: [],
  };
  g.phase = "undercoverClue";
}

// Called once per player as their turn to clue comes up — advances
// immediately to the next player (or to voting once the table's been all
// the way around), no host action needed between speakers.
export function submitClue(g: GameState, slug: string, text: string): void {
  const u = g.undercover!;
  const player = g.playersPublic.find((p) => p.slug === slug)!;
  u.clues.push({ slug, name: player.name, text: text.trim().slice(0, MAX_CLUE_LEN), cycle: u.cycle });
  u.cluePointer += 1;
  if (u.cluePointer >= u.clueOrder.length) {
    u.votes = {};
    u.voteResponded = [];
    u.tieBreakCandidates = undefined;
    g.phase = "undercoverVote";
  }
}

// Called once per remaining player as they cast their vote. Self-votes and
// votes for eliminated/out-of-scope players are rejected by the route
// layer before this is ever called.
export function applyUndercoverVote(g: GameState, voterSlug: string, targetSlug: string): void {
  const u = g.undercover!;
  u.votes[voterSlug] = targetSlug;
  if (!u.voteResponded.includes(voterSlug)) u.voteResponded.push(voterSlug);
  if (u.voteResponded.length >= u.remainingSlugs.length) resolveUndercoverVote(g);
}

// Tallies the current vote and either resolves the round (clean leader),
// opens a scoped revote among just the tied leaders (first tie), or breaks
// a second consecutive tie at random so the round always terminates.
// Also the host's force-reveal entry point — callable with any number of
// votes cast, including zero.
export function resolveUndercoverVote(g: GameState): void {
  const u = g.undercover!;
  const tally = new Map<string, number>();
  u.remainingSlugs.forEach((s) => tally.set(s, 0));
  Object.values(u.votes).forEach((target) => {
    if (tally.has(target)) tally.set(target, tally.get(target)! + 1);
  });
  const maxCount = Math.max(...tally.values());
  const leaders = [...tally.entries()].filter(([, c]) => c === maxCount).map(([s]) => s);

  if (leaders.length === 1) {
    applyOutcomeFor(g, leaders[0], false);
    return;
  }

  if (u.tieBreakCandidates) {
    const pick = leaders[Math.floor(Math.random() * leaders.length)];
    applyOutcomeFor(g, pick, true);
    return;
  }

  u.tieBreakCandidates = leaders;
  u.votes = {};
  u.voteResponded = [];
}

function applyOutcomeFor(g: GameState, targetSlug: string, byLottery: boolean): void {
  const u = g.undercover!;
  u.tieBreakByLottery = byLottery;

  if (targetSlug === u.impostorSlug) {
    if (u.isMisterWhite) {
      g.phase = "undercoverGuess";
    } else {
      resolveUndercoverFinal(g, "caught_direct");
    }
    return;
  }

  u.remainingSlugs = u.remainingSlugs.filter((s) => s !== targetSlug);
  u.eliminatedSlugs.push(targetSlug);
  if (u.remainingSlugs.length === 2) {
    resolveUndercoverFinal(g, "survived");
    return;
  }

  u.cycle += 1;
  u.clueOrder = tableOrder(g, u.remainingSlugs);
  u.cluePointer = 0;
  u.votes = {};
  u.voteResponded = [];
  u.tieBreakCandidates = undefined;
  // Only the round's *decisive* vote should get lottery flavor text.
  u.tieBreakByLottery = false;
  g.phase = "undercoverClue";
}

// Mister White's one shot at the secret word once caught. Route layer
// checks the caller is actually the impostor and the phase is right.
export function submitGuess(g: GameState, guessText: string): void {
  const u = g.undercover!;
  const correct = checkAnswer({ answerKind: "text", answer: u.secretWord, acceptableAnswers: [] }, guessText);
  resolveUndercoverFinal(
    g,
    correct ? "caught_correct_guess" : "caught_wrong_guess",
    guessText.trim().slice(0, MAX_GUESS_LEN)
  );
}

function resolveUndercoverFinal(g: GameState, outcome: UndercoverOutcome, guessText?: string): void {
  const u = g.undercover!;
  const impostor = g.playersPublic.find((p) => p.slug === u.impostorSlug)!;

  if (outcome === "caught_wrong_guess" || outcome === "caught_direct") {
    impostor.gulpsTotal += 2;
  } else if (outcome === "survived") {
    g.playersPublic.forEach((p) => {
      if (p.slug !== u.impostorSlug) p.gulpsTotal += 2;
    });
  }
  // "caught_correct_guess": nobody drinks — the table caught him, he
  // wriggled out of it, close enough to a wash.

  g.lastResults = {
    type: "undercover",
    undercoverWord: u.secretWord,
    undercoverImpostorWord: u.isMisterWhite ? undefined : u.impostorWord,
    undercoverIsMisterWhite: u.isMisterWhite,
    undercoverImpostorName: impostor.name,
    undercoverOutcome: outcome,
    undercoverGuessText: guessText,
    undercoverClues: u.clues,
    undercoverEliminationOrder: u.eliminatedSlugs.map(
      (s) => g.playersPublic.find((p) => p.slug === s)!.name
    ),
    undercoverTieBreakByLottery: u.tieBreakByLottery,
  };
  g.phase = "showdown";
}
