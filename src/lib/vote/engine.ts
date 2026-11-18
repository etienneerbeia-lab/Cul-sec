import { chance, drink, nameOf, pickFresh } from "../game/module";
import type { GameState } from "../game/types";
import { VOTE_QUESTIONS } from "./questions";
import { WHO_OF_US } from "./whoOfUs";

export const VOTE_MS = 20000;

// Une manche de vote : « Tu préfères » (camp minoritaire boit) ou « Qui de
// nous » (on boit une gorgée par voix reçue), tirés une fois sur deux.
export function startVoteRound(g: GameState, now: number): void {
  if (chance(0.5)) {
    const q = pickFresh(g, WHO_OF_US);
    g.vote = { mode: "qui", question: { id: q.id, promptA: "", promptB: "" }, prompt: q.prompt, askedAt: now, votes: {}, responded: [] };
  } else {
    const q = pickFresh(g, VOTE_QUESTIONS);
    g.vote = { mode: "tp", question: { id: q.id, promptA: q.promptA, promptB: q.promptB }, askedAt: now, votes: {}, responded: [] };
  }
  g.phase = "vote";
}

export function applyVote(g: GameState, slug: string, choice: string | null): void {
  const v = g.vote!;
  if (choice) v.votes[slug] = choice;
  if (!v.responded.includes(slug)) v.responded.push(slug);
  if (v.responded.length >= g.playersPublic.length) resolveVote(g);
}

export function resolveVote(g: GameState): void {
  const v = g.vote!;
  const nonVoters = g.playersPublic.filter((p) => !(p.slug in v.votes));
  nonVoters.forEach((p) => drink(g, p.slug, 2, "N'a pas voté"));
  const entries = Object.entries(v.votes).map(([slug, choice]) => ({ name: nameOf(g, slug), choice: choice as "A" | "B" }));

  if (v.mode === "qui") {
    const tally = g.playersPublic.map((p) => ({
      slug: p.slug,
      name: p.name,
      votes: Object.values(v.votes).filter((t) => t === p.slug).length,
    }));
    tally.forEach((t) => drink(g, t.slug, Math.min(5, t.votes), `${t.votes} voix contre lui`));
    g.lastResults = { type: "vote", voteMode: "qui", votePrompt: v.prompt, voteTally: tally.sort((a, b) => b.votes - a.votes), voteNonVoters: nonVoters.map((p) => p.name) };
  } else {
    const countA = Object.values(v.votes).filter((c) => c === "A").length;
    const countB = Object.values(v.votes).filter((c) => c === "B").length;
    const tie = countA === countB;
    Object.entries(v.votes).forEach(([slug, choice]) => {
      if (tie) drink(g, slug, 1, "Égalité, tout le monde trinque");
      else if (choice === (countA < countB ? "A" : "B")) drink(g, slug, 2, "Camp minoritaire");
    });
    g.lastResults = {
      type: "vote",
      voteMode: "tp",
      promptA: v.question.promptA,
      promptB: v.question.promptB,
      countA,
      countB,
      voteEntries: entries,
      voteNonVoters: nonVoters.map((p) => p.name),
      voteTie: tie,
    };
  }
  g.phase = "showdown";
}
