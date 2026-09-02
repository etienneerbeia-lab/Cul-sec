import type { GameState, PlayerPublic, VoteChoice } from "../game/types";
import { VOTE_QUESTIONS } from "./questions";

export function startVoteRound(g: GameState): void {
  const chosen = VOTE_QUESTIONS[Math.floor(Math.random() * VOTE_QUESTIONS.length)];
  g.vote = {
    question: { id: chosen.id, promptA: chosen.promptA, promptB: chosen.promptB },
    askedAt: Date.now(),
    votes: {},
    responded: [],
  };
  g.phase = "vote";
}

// Called once per player as they cast their vote, or as their own client
// auto-submits `choice: null` once their local countdown hits zero (a
// timeout still closes out their turn, it just never joins either camp).
// Resolves the round as soon as every player has been accounted for —
// same "last action closes it out" pattern as the duel's revealDuelCard.
export function applyVote(g: GameState, slug: string, choice: VoteChoice | null): void {
  const v = g.vote!;
  if (choice) v.votes[slug] = choice;
  if (!v.responded.includes(slug)) v.responded.push(slug);
  if (v.responded.length >= g.playersPublic.length) resolveVote(g);
}

// Host-only escape hatch for when the 15s deadline has passed but some
// player's device never checked in (screen locked, app backgrounded) — lets
// the table move on instead of getting stuck waiting on a vote that will
// never arrive. Whoever hasn't voted yet simply doesn't count either way.
export function resolveVote(g: GameState): void {
  const v = g.vote!;
  const byslug = new Map<string, PlayerPublic>(g.playersPublic.map((p) => [p.slug, p]));
  const entries: { name: string; choice: VoteChoice }[] = [];
  let countA = 0;
  let countB = 0;
  Object.entries(v.votes).forEach(([slug, choice]) => {
    const p = byslug.get(slug);
    if (!p) return;
    entries.push({ name: p.name, choice });
    if (choice === "A") countA++;
    else countB++;
  });
  const nonVoters = g.playersPublic.filter((p) => !(p.slug in v.votes)).map((p) => p.name);

  const tie = countA === countB;
  if (!tie) {
    const minorityChoice: VoteChoice = countA < countB ? "A" : "B";
    Object.entries(v.votes).forEach(([slug, choice]) => {
      if (choice === minorityChoice) byslug.get(slug)!.gulpsTotal += 2;
    });
  }

  g.lastResults = {
    type: "vote",
    promptA: v.question.promptA,
    promptB: v.question.promptB,
    countA,
    countB,
    voteEntries: entries,
    voteNonVoters: nonVoters,
    voteTie: tie,
  };
  g.phase = "showdown";
}
