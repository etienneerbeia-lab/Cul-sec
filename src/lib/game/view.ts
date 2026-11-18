import type { Card, GameState } from "./types";

export interface PlayerView {
  game: GameState;
  myHand: Card[] | null;
  myVoteChoice: string | null;
  myUndercoverWord: string | null;
}

// Ce qu'un joueur a le droit de voir de la partie : on retire tout ce qui
// est secret (mains des autres, cartes à venir, réponses, votes en cours,
// identité de l'imposteur, sabot du blackjack, planning des bots).
export function viewFor(game: GameState, slug: string | null): PlayerView {
  let g: GameState = { ...game, hands: undefined, botPlan: undefined };
  let myHand: Card[] | null = null;
  let myVoteChoice: string | null = null;
  let myUndercoverWord: string | null = null;

  if (slug && game.hands?.[slug] && ["betting", "showdown"].includes(game.phase) && game.roundTypeId !== "duel") {
    myHand = game.hands[slug];
  }

  // Cartes communes : seulement celles déjà retournées.
  if (g.community) g = { ...g, community: g.community.slice(0, g.communityRevealed ?? 0) };

  if (g.quiz && g.quiz.status === "asking") {
    g = { ...g, quiz: { ...g.quiz, question: { ...g.quiz.question, answer: undefined, acceptableAnswers: undefined } } };
  }

  if (g.vote) {
    if (slug) myVoteChoice = g.vote.votes[slug] ?? null;
    g = { ...g, vote: { ...g.vote, votes: {} } };
  }

  if (g.meme && g.phase === "memeCaption") g = { ...g, meme: { ...g.meme, captions: {} } };
  if (g.meme && g.phase === "memeVote") g = { ...g, meme: { ...g.meme, votes: {} } };

  if (g.undercover) {
    const u = g.undercover;
    if (slug) {
      myUndercoverWord =
        slug === u.impostorSlug ? (u.isMisterWhite ? null : (u.impostorWord ?? null)) : (u.secretWord ?? null);
    }
    g = { ...g, undercover: { ...u, secretWord: undefined, impostorSlug: undefined, impostorWord: undefined, votes: {} } };
  }

  if (g.highlow) g = { ...g, highlow: { ...g.highlow, deck: [] } };
  if (g.duel) g = { ...g, duel: { ...g.duel, deck: [] } };
  if (g.qcm && g.qcm.stage === "ask") {
    const q = g.qcm;
    // Pendant la question : ni la bonne réponse, ni ce qu'ont choisi les
    // autres (seulement qui a déjà répondu).
    const answers: Record<string, null> = {};
    Object.keys(q.answers).forEach((s) => (answers[s] = null));
    g = {
      ...g,
      qcm: {
        ...q,
        questions: q.questions.map((qq, i) => (i >= q.index ? { ...qq, answerIdx: undefined } : qq)),
        answers: slug && q.answers[slug] ? { ...answers, [slug]: q.answers[slug] } : answers,
      },
    };
  } else if (g.qcm) {
    g = { ...g, qcm: { ...g.qcm, questions: g.qcm.questions.map((qq, i) => (i > g.qcm!.index ? { ...qq, answerIdx: undefined } : qq)) } };
  }

  if (g.blackjack) {
    g = { ...g, blackjack: { ...g.blackjack, deck: [], dealer: { ...g.blackjack.dealer, hiddenCard: null } } };
  }

  return { game: g, myHand, myVoteChoice, myUndercoverWord };
}
