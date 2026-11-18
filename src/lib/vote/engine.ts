import { pickFresh } from "../game/module";
import type { GameState, PlayerPublic, VoteChoice } from "../game/types";
import { VOTE_QUESTIONS } from "./questions";

export function startVoteRound(g: GameState): void {
  const chosen = pickFresh(g, VOTE_QUESTIONS);
  g.vote = {
    question: { id: chosen.id, promptA: chosen.promptA, promptB: chosen.promptB },
    askedAt: Date.now(),
    votes: {},
    responded: [],
  };
  g.phase = "vote";
}

// Called once per player as they cast their vote, or as their own client
// auto-submits `choice: null` once their local countdown hits zero. A
// timeout still closes out their turn without joining either camp's
// tally, but — unlike a real vote — it's never a neutral outcome: whoever
// times out always drinks (see resolveVote). Resolves the round as soon
// as every player has been accounted for — same "last action closes it
// out" pattern as the duel's revealDuelCard.
export function applyVote(g: GameState, slug: string, choice: VoteChoice | null): void {
  const v = g.vote!;
  if (choice) v.votes[slug] = choice;
  if (!v.responded.includes(slug)) v.responded.push(slug);
  if (v.responded.length >= g.playersPublic.length) resolveVote(g);
}

// Host-only escape hatch for when the 15s deadline has passed but some
// player's device never checked in (screen locked, app backgrounded) — lets
// the table move on instead of getting stuck waiting on a vote that will
// never arrive.
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
  const nonVoters = g.playersPublic.filter((p) => !(p.slug in v.votes));

  const tie = countA === countB;
  if (!tie) {
    const minorityChoice: VoteChoice = countA < countB ? "A" : "B";
    Object.entries(v.votes).forEach(([slug, choice]) => {
      if (choice === minorityChoice) byslug.get(slug)!.gulpsTotal += 2;
    });
  }
  // A timeout is never a neutral result — whoever didn't vote in time
  // always drinks 2, independent of how the real votes split (even a
  // perfect tie between real voters doesn't spare a non-voter).
  nonVoters.forEach((p) => {
    p.gulpsTotal += 2;
  });

  g.lastResults = {
    type: "vote",
    promptA: v.question.promptA,
    promptB: v.question.promptB,
    countA,
    countB,
    voteEntries: entries,
    voteNonVoters: nonVoters.map((p) => p.name),
    voteTie: tie,
  };
  g.phase = "showdown";
}
