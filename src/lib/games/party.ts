import { roundTypeById } from "../game/roundTypes";
import { fail, notNow } from "../errors";
import { chance, findPlayer, type GameModule, pick } from "../game/module";
import { MEME_CAPTION_MS, TIMED_ANSWER_MS, type GameState } from "../game/types";
import { advanceQuizTurn, applyQuizAnswer, applyQuizDistribution, startQuizRound } from "../quiz/engine";
import { applyVote, resolveVote, startVoteRound } from "../vote/engine";
import { forceMemeCaptionEnd, forceMemeVoteEnd, startMemeRound, submitMemeCaption, submitMemeVote } from "../meme/engine";
import {
  advanceClueReveal,
  applyUndercoverVote,
  startUndercoverRound,
  submitClue,
  submitGuess,
} from "../undercover/engine";
import { CLUE_REVEAL_MS } from "../game/types";
import { BOT_MEME_CAPTIONS } from "../bots/captions";
import { botClueFor, randomWord } from "../undercover/words";

const GRACE_MS = 1500;

function others(g: GameState, slug: string) {
  return g.playersPublic.filter((p) => p.slug !== slug);
}

// Répartit `total` gorgées au hasard entre les autres joueurs.
export function randomDistribution(g: GameState, slug: string, total: number) {
  const pool = others(g, slug);
  const out = new Map<string, number>();
  for (let i = 0; i < total && pool.length; i++) {
    const t = pick(pool).slug;
    out.set(t, (out.get(t) ?? 0) + 1);
  }
  return [...out.entries()].map(([s, amount]) => ({ slug: s, amount }));
}

// Valide une liste {slug, amount} : cibles existantes, distinctes, pas soi-même,
// total exact.
export function parseTargets(g: GameState, slug: string, raw: unknown, total: number) {
  if (!Array.isArray(raw)) fail(400, "Cibles invalides.");
  const valid = new Set(g.playersPublic.map((p) => p.slug));
  const seen = new Set<string>();
  const out: { slug: string; amount: number }[] = [];
  for (const r of raw as { slug?: unknown; amount?: unknown }[]) {
    if (typeof r?.slug !== "string" || !Number.isInteger(r.amount) || (r.amount as number) <= 0)
      fail(400, "Cibles invalides.");
    if (r.slug === slug) fail(400, "Tu ne peux pas te faire boire toi-même.");
    if (!valid.has(r.slug) || seen.has(r.slug)) fail(400, "Cibles invalides.");
    seen.add(r.slug);
    out.push({ slug: r.slug, amount: r.amount as number });
  }
  if (out.reduce((s, t) => s + t.amount, 0) !== total) fail(400, `Il faut distribuer exactement ${total} gorgées.`);
  return out;
}

// ---------- Culture G ----------
export const quizModule: GameModule = {
  id: "quiz",
  minPlayers: roundTypeById("quiz").minPlayers,
  start: (g) => startQuizRound(g),
  act(g, slug, a, ctx) {
    const q = g.quiz;
    if (!q) notNow();
    const active = g.playersPublic[q.playerIdx].slug;
    if (a.type === "quizAnswer") {
      if (g.phase !== "quiz" || q.status !== "asking") notNow();
      if (slug !== active) fail(403, "Ce n'est pas ton tour.");
      applyQuizAnswer(g, typeof a.answer === "string" ? a.answer.slice(0, 80) : "");
    } else if (a.type === "quizDistribute") {
      if (g.phase !== "quiz" || q.status !== "distributing") notNow();
      if (slug !== active) fail(403, "Ce n'est pas ton tour.");
      applyQuizDistribution(g, parseTargets(g, slug, a.targets, 2));
    } else if (a.type === "quizNext") {
      if (g.phase !== "quiz" || q.status !== "result") notNow();
      if (slug !== ctx.hostSlug) fail(403, "Réservé à l'hôte.");
      if (advanceQuizTurn(g)) g.phase = "quizRecap";
    } else fail(400, "Action inconnue.");
  },
  pending(g) {
    const q = g.quiz;
    if (g.phase !== "quiz" || !q) return null;
    const active = g.playersPublic[q.playerIdx].slug;
    if (q.status === "asking")
      return { key: `quiz:${q.turnPointer}:ask`, actors: [active], timeoutMs: TIMED_ANSWER_MS + GRACE_MS };
    if (q.status === "distributing")
      return { key: `quiz:${q.turnPointer}:dist`, actors: [active], timeoutMs: 30000 };
    return null;
  },
  auto(g, slug, _ctx, { bot }) {
    const q = g.quiz!;
    if (q.status === "asking") {
      const p = [0, 0.8, 0.55, 0.3][q.question.difficulty] ?? 0.5;
      if (!bot) return { type: "quizAnswer", answer: "" };
      return { type: "quizAnswer", answer: chance(p) ? q.question.answer ?? "" : pick(["Aucune idée", "Euh…", "Passe"]) };
    }
    if (q.status === "distributing") return { type: "quizDistribute", targets: randomDistribution(g, slug, 2) };
    return null;
  },
  botDelay: (g) => (g.quiz?.status === "asking" ? [3000, 9000] : [1500, 3000]),
};

// ---------- Tu préfères ----------
export const voteModule: GameModule = {
  id: "vote",
  minPlayers: roundTypeById("vote").minPlayers,
  start: (g) => startVoteRound(g),
  act(g, slug, a, ctx) {
    if (g.phase !== "vote" || !g.vote) notNow();
    if (a.type === "vote") {
      if (!findPlayer(g, slug)) fail(403, "Tu ne participes pas à cette manche.");
      if (g.vote.responded.includes(slug)) fail(409, "Tu as déjà voté.");
      applyVote(g, slug, a.choice === "A" || a.choice === "B" ? a.choice : null);
    } else if (a.type === "voteReveal") {
      if (slug !== ctx.hostSlug) fail(403, "Réservé à l'hôte.");
      if (ctx.now - g.vote.askedAt < TIMED_ANSWER_MS) fail(409, "Le temps n'est pas encore écoulé.");
      resolveVote(g);
    } else fail(400, "Action inconnue.");
  },
  pending(g) {
    if (g.phase !== "vote" || !g.vote) return null;
    const actors = g.playersPublic.filter((p) => !g.vote!.responded.includes(p.slug)).map((p) => p.slug);
    return { key: `vote:${g.round}`, actors, timeoutMs: TIMED_ANSWER_MS + GRACE_MS };
  },
  auto: (_g, _slug, _ctx, { bot }) => ({ type: "vote", choice: bot ? pick(["A", "B"]) : null }),
  botDelay: () => [2000, 9000],
};

// ---------- Make It Meme ----------
export const memeModule: GameModule = {
  id: "meme",
  minPlayers: roundTypeById("meme").minPlayers,
  start: (g) => startMemeRound(g),
  act(g, slug, a, ctx) {
    const m = g.meme;
    if (!m) notNow();
    if (!findPlayer(g, slug)) fail(403, "Tu ne participes pas à cette manche.");
    if (a.type === "memeCaption") {
      if (g.phase !== "memeCaption") notNow();
      if (m.captionResponded.includes(slug)) fail(409, "Tu as déjà validé ta légende.");
      submitMemeCaption(g, slug, typeof a.caption === "string" ? a.caption : "");
    } else if (a.type === "memeVote") {
      if (g.phase !== "memeVote") notNow();
      if (m.voteResponded.includes(slug)) fail(409, "Tu as déjà voté.");
      if (a.authorSlug === slug) fail(400, "Tu ne peux pas voter pour ta propre légende.");
      submitMemeVote(g, slug, typeof a.authorSlug === "string" ? a.authorSlug : null);
    } else if (a.type === "memeCaptionReveal") {
      if (g.phase !== "memeCaption" || slug !== ctx.hostSlug) notNow();
      if (ctx.now - m.askedAt < MEME_CAPTION_MS) fail(409, "Le temps n'est pas encore écoulé.");
      forceMemeCaptionEnd(g);
    } else if (a.type === "memeVoteReveal") {
      if (g.phase !== "memeVote" || slug !== ctx.hostSlug) notNow();
      forceMemeVoteEnd(g);
    } else fail(400, "Action inconnue.");
  },
  pending(g) {
    const m = g.meme;
    if (!m) return null;
    if (g.phase === "memeCaption") {
      const actors = g.playersPublic.filter((p) => !m.captionResponded.includes(p.slug)).map((p) => p.slug);
      return { key: `meme:cap:${g.round}`, actors, timeoutMs: MEME_CAPTION_MS + GRACE_MS };
    }
    if (g.phase === "memeVote") {
      const actors = g.playersPublic.filter((p) => !m.voteResponded.includes(p.slug)).map((p) => p.slug);
      return { key: `meme:vote:${g.round}`, actors, timeoutMs: 30000 };
    }
    return null;
  },
  auto(g, slug, _ctx, { bot }) {
    const m = g.meme!;
    if (g.phase === "memeCaption") return { type: "memeCaption", caption: bot ? pick(BOT_MEME_CAPTIONS) : "" };
    const options = m.voteOrder.filter((s) => s !== slug);
    return { type: "memeVote", authorSlug: bot && options.length ? pick(options) : null };
  },
  botDelay: (g) => (g.phase === "memeCaption" ? [8000, 30000] : [3000, 9000]),
};

// ---------- Undercover ----------
export const undercoverModule: GameModule = {
  id: "undercover",
  minPlayers: roundTypeById("undercover").minPlayers,
  start: (g) => startUndercoverRound(g),
  act(g, slug, a) {
    const u = g.undercover;
    if (!u) notNow();
    if (a.type === "ucClue") {
      if (g.phase !== "undercoverClue") notNow();
      if (u.revealUntil !== undefined) fail(409, "L'indice précédent est encore affiché.");
      if (u.clueOrder[u.cluePointer] !== slug) fail(403, "Ce n'est pas ton tour.");
      const text = typeof a.text === "string" ? a.text.trim() : "";
      if (!text) fail(400, "Écris un indice.");
      submitClue(g, slug, text);
    } else if (a.type === "ucAdvance") {
      if (g.phase !== "undercoverClue" || u.revealUntil === undefined) fail(409, "Rien à passer pour l'instant.");
      advanceClueReveal(g);
    } else if (a.type === "ucVote") {
      if (g.phase !== "undercoverVote") notNow();
      if (!u.remainingSlugs.includes(slug)) fail(403, "Tu ne participes plus à cette manche.");
      if (u.voteResponded.includes(slug)) fail(409, "Tu as déjà voté.");
      const target = typeof a.targetSlug === "string" ? a.targetSlug : null;
      if (target === slug) fail(400, "Tu ne peux pas voter pour toi-même.");
      if (target && !(u.tieBreakCandidates ?? u.remainingSlugs).includes(target)) fail(400, "Cible de vote invalide.");
      applyUndercoverVote(g, slug, target);
    } else if (a.type === "ucGuess") {
      if (g.phase !== "undercoverGuess") notNow();
      if (slug !== u.impostorSlug) fail(403, "Ce n'est pas à toi de deviner.");
      submitGuess(g, typeof a.guess === "string" ? a.guess : "");
    } else fail(400, "Action inconnue.");
  },
  pending(g) {
    const u = g.undercover;
    if (!u) return null;
    if (g.phase === "undercoverClue") {
      if (u.revealUntil !== undefined)
        return { key: `uc:reveal:${u.clues.length}`, actors: [], timeoutMs: CLUE_REVEAL_MS };
      return { key: `uc:clue:${u.clues.length}`, actors: [u.clueOrder[u.cluePointer]], timeoutMs: 60000 };
    }
    if (g.phase === "undercoverVote") {
      const actors = u.remainingSlugs.filter((s) => !u.voteResponded.includes(s));
      return { key: `uc:vote:${u.cycle}:${u.tieBreakCandidates ? 1 : 0}`, actors, timeoutMs: 45000 };
    }
    if (g.phase === "undercoverGuess")
      return { key: "uc:guess", actors: [u.impostorSlug!], timeoutMs: 30000 };
    return null;
  },
  onDeadline(g, ctx) {
    const u = g.undercover!;
    if (g.phase === "undercoverClue" && u.revealUntil !== undefined) {
      advanceClueReveal(g);
      return;
    }
    const p = undercoverModule.pending(g);
    p?.actors.forEach((s) => {
      const a = undercoverModule.auto(g, s, ctx, { bot: false });
      if (a && undercoverModule.pending(g)?.key === p.key) undercoverModule.act(g, s, a, ctx);
    });
  },
  auto(g, slug, _ctx, { bot }) {
    const u = g.undercover!;
    if (g.phase === "undercoverClue") {
      const word = slug === u.impostorSlug ? (u.isMisterWhite ? null : u.impostorWord!) : u.secretWord!;
      const used = u.clues.map((c) => c.text.toLowerCase());
      return { type: "ucClue", text: bot ? botClueFor(word, used) : "(pas d'indice)" };
    }
    if (g.phase === "undercoverVote") {
      if (!bot) return { type: "ucVote", targetSlug: null };
      const pool = (u.tieBreakCandidates ?? u.remainingSlugs).filter((s) => s !== slug);
      return { type: "ucVote", targetSlug: pool.length ? pick(pool) : null };
    }
    if (g.phase === "undercoverGuess")
      return { type: "ucGuess", guess: bot && chance(0.35) ? u.secretWord! : bot ? randomWord() : "" };
    return null;
  },
  botDelay: (g) => (g.phase === "undercoverClue" ? [3000, 7000] : [3000, 10000]),
};
