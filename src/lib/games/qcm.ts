import { roundTypeById } from "../game/roundTypes";
import { shuffleArr } from "../game/cards";
import { fail, notNow } from "../errors";
import { chance, drink, type GameModule, nameOf, pick, rand } from "../game/module";
import type { GameState, QcmQuestion } from "../game/types";
import { QUIZ_QUESTIONS } from "../quiz/questions";
import { GENERAL_QUESTIONS } from "../quiz/general";

// Culture G en QCM : 5 questions, tout le monde répond en même temps
// (4 choix, 12 s). Mauvaise réponse ou pas de réponse : 1 gorgée. À la
// fin, le meilleur (bonnes réponses, puis rapidité) distribue 3 gorgées.
export const QCM_QUESTIONS_PER_ROUND = 5;
export const QCM_ASK_MS = 12000;
export const QCM_REVEAL_MS = 4000;
export const QCM_CHAMPION_GULPS = 3;

const CATEGORY = { capital: "Capitales", flag: "Drapeaux", date: "Histoire" } as const;

function weightedDifficulty(): number {
  const r = Math.random();
  return r < 0.6 ? 1 : r < 0.92 ? 2 : 3;
}

function distinct(pool: string[], exclude: string[], n: number): string[] {
  const out: string[] = [];
  const copy = pool.filter((x) => !exclude.some((e) => e.toLowerCase() === x.toLowerCase()));
  shuffleArr(copy);
  for (const x of copy) {
    if (out.length >= n) break;
    if (!out.includes(x)) out.push(x);
  }
  return out;
}

// Leurres pour une date : même jour/mois, autres années plausibles.
function dateDistractors(answer: string): string[] {
  const m = answer.match(/(1[0-9]{3}|20[0-9]{2})/);
  if (!m) return ["1900", "1950", "2000"];
  const year = Number(m[0]);
  const offsets = [-40, -25, -15, -10, -7, -4, -3, -2, 2, 3, 5, 8, 12, 20, 30];
  shuffleArr(offsets);
  const years: number[] = [];
  for (const o of offsets) {
    const y = year + o;
    if (y > new Date().getFullYear() || years.includes(y)) continue;
    years.push(y);
    if (years.length === 3) break;
  }
  return years.map((y) => answer.replace(m[0], String(y)));
}

function buildQuestion(g: GameState, used: Set<string>): QcmQuestion {
  const difficulty = weightedDifficulty();
  // Une chance sur deux : culture générale ; sinon capitales/drapeaux/dates.
  if (chance(0.5)) {
    let pool = GENERAL_QUESTIONS.filter((q) => q.difficulty === difficulty && !used.has(q.id));
    if (!pool.length) pool = GENERAL_QUESTIONS.filter((q) => !used.has(q.id));
    if (pool.length) {
      const q = pick(pool);
      used.add(q.id);
      const choices = [q.answer, ...q.wrong];
      shuffleArr(choices);
      return { id: q.id, category: q.category, prompt: q.prompt, choices, answerIdx: choices.indexOf(q.answer), difficulty: q.difficulty };
    }
  }
  const type = pick(["capital", "flag", "date"] as const);
  let pool = QUIZ_QUESTIONS.filter((q) => q.type === type && q.difficulty === difficulty && !used.has(q.id));
  if (!pool.length) pool = QUIZ_QUESTIONS.filter((q) => q.type === type && !used.has(q.id));
  if (!pool.length) pool = QUIZ_QUESTIONS.filter((q) => q.type === type);
  const q = pick(pool);
  used.add(q.id);
  const wrong =
    type === "date"
      ? dateDistractors(q.answer)
      : distinct(
          QUIZ_QUESTIONS.filter((x) => x.type === type && Math.abs(x.difficulty - q.difficulty) <= 1).map((x) => x.answer),
          [q.answer, ...q.acceptableAnswers],
          3
        );
  const choices = [q.answer, ...wrong];
  shuffleArr(choices);
  return {
    id: q.id,
    category: CATEGORY[type],
    prompt: q.prompt,
    flagEmoji: q.flagEmoji,
    choices,
    answerIdx: choices.indexOf(q.answer),
    difficulty: q.difficulty,
  };
}

function startQcm(g: GameState, now: number): void {
  const used = new Set(g.usedQuestionIds ?? []);
  const questions: QcmQuestion[] = [];
  for (let i = 0; i < QCM_QUESTIONS_PER_ROUND; i++) questions.push(buildQuestion(g, used));
  g.usedQuestionIds = [...used];
  const scores: Record<string, { correct: number; ms: number }> = {};
  g.playersPublic.forEach((p) => (scores[p.slug] = { correct: 0, ms: 0 }));
  g.qcm = { questions, index: 0, stage: "ask", askedAt: now, answers: {}, history: [], scores };
  g.phase = "qcm";
}

function closeQuestion(g: GameState): void {
  const q = g.qcm!;
  const question = q.questions[q.index];
  const correct: Record<string, boolean> = {};
  let fastest: { slug: string; ms: number } | undefined;
  g.playersPublic.forEach((p) => {
    const a = q.answers[p.slug];
    const ok = !!a && a.choice === question.answerIdx;
    correct[p.slug] = ok;
    if (ok) {
      q.scores[p.slug].correct += 1;
      q.scores[p.slug].ms += a!.ms;
      if (!fastest || a!.ms < fastest.ms) fastest = { slug: p.slug, ms: a!.ms };
    } else drink(g, p.slug, 1, a ? "Mauvaise réponse" : "Pas de réponse");
  });
  q.history = [...q.history, { correct, fastest: fastest?.slug }];
  q.stage = "reveal";
}

function nextQuestion(g: GameState, now: number): void {
  const q = g.qcm!;
  if (q.index + 1 < q.questions.length) {
    q.index += 1;
    q.stage = "ask";
    q.askedAt = now;
    q.answers = {};
    return;
  }
  // Fin : le champion distribue (s'il y a quelqu'un à qui distribuer).
  const ranked = [...g.playersPublic].sort(
    (a, b) => q.scores[b.slug].correct - q.scores[a.slug].correct || q.scores[a.slug].ms - q.scores[b.slug].ms
  );
  const champ = ranked[0];
  if (g.playersPublic.length > 1 && q.scores[champ.slug].correct > 0) {
    q.champion = champ.slug;
    q.stage = "champion";
  } else finish(g);
}

function finish(g: GameState): void {
  g.qcm!.stage = "done";
  g.lastResults = { type: "quiz" };
  g.phase = "showdown";
}

export const qcmModule: GameModule = {
  id: "quiz",
  minPlayers: roundTypeById("quiz").minPlayers,
  start: (g, ctx) => startQcm(g, ctx.now),
  act(g, slug, a, ctx) {
    const q = g.qcm;
    if (g.phase !== "qcm" || !q) notNow();
    if (a.type === "qcmAnswer") {
      if (q.stage !== "ask") notNow();
      if (q.answers[slug]) fail(409, "Tu as déjà répondu.");
      const choice = a.choice;
      if (!Number.isInteger(choice) || (choice as number) < 0 || (choice as number) > 3) fail(400, "Choix invalide.");
      q.answers[slug] = { choice: choice as number, ms: Math.max(0, ctx.now - q.askedAt) };
      if (g.playersPublic.every((p) => q.answers[p.slug] !== undefined)) closeQuestion(g);
    } else if (a.type === "qcmGive") {
      if (q.stage !== "champion" || slug !== q.champion) notNow();
      const target = a.targetSlug;
      if (typeof target !== "string" || target === slug || !g.playersPublic.some((p) => p.slug === target))
        fail(400, "Cible invalide.");
      q.championTarget = target;
      drink(g, target, QCM_CHAMPION_GULPS, `Offert par ${nameOf(g, slug)}`);
      finish(g);
    } else fail(400, "Action inconnue.");
  },
  pending(g) {
    const q = g.qcm;
    if (g.phase !== "qcm" || !q) return null;
    if (q.stage === "ask") {
      const actors = g.playersPublic.filter((p) => q.answers[p.slug] === undefined).map((p) => p.slug);
      return { key: `qcm:${q.index}:ask`, actors, timeoutMs: QCM_ASK_MS + 800 };
    }
    if (q.stage === "reveal") return { key: `qcm:${q.index}:reveal`, actors: [], timeoutMs: QCM_REVEAL_MS };
    if (q.stage === "champion") return { key: "qcm:champion", actors: [q.champion!], timeoutMs: 20000 };
    return null;
  },
  onDeadline(g, ctx) {
    const q = g.qcm!;
    if (q.stage === "ask") {
      // Temps écoulé : les retardataires n'ont pas répondu.
      g.playersPublic.forEach((p) => {
        if (q.answers[p.slug] === undefined) q.answers[p.slug] = null;
      });
      closeQuestion(g);
    } else if (q.stage === "reveal") nextQuestion(g, ctx.now);
    else if (q.stage === "champion") {
      const target = pick(g.playersPublic.filter((p) => p.slug !== q.champion));
      qcmModule.act(g, q.champion!, { type: "qcmGive", targetSlug: target.slug }, ctx);
    }
  },
  auto(g, slug, _ctx, { bot }) {
    const q = g.qcm!;
    if (q.stage === "ask") {
      // Un humain absent ne répond pas (il boira à la fin du chrono).
      if (!bot) return null;
      const question = q.questions[q.index];
      const p = [0, 0.85, 0.6, 0.35][question.difficulty] ?? 0.5;
      const right = question.answerIdx!;
      const choice = chance(p) ? right : pick([0, 1, 2, 3].filter((i) => i !== right));
      return { type: "qcmAnswer", choice };
    }
    if (q.stage === "champion") {
      return { type: "qcmGive", targetSlug: pick(g.playersPublic.filter((p) => p.slug !== slug)).slug };
    }
    return null;
  },
  botDelay: (g) => (g.qcm?.stage === "ask" ? [Math.round(rand(2000, 3000)), 9500] : [2000, 4000]),
};
