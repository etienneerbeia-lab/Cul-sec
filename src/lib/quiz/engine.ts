import type {
  GameState,
  PlayerPublic,
  QuizDistributionEntry,
  QuizQuestionState,
} from "../game/types";
import type { Difficulty } from "./types";
import { checkAnswer } from "./match";
import { QUIZ_QUESTIONS } from "./questions";

const TYPES = ["capital", "flag", "date"] as const;

// 50% facile / 35% moyen / 15% difficile — keeps the quiz approachable for
// a normal group instead of drawing uniformly across difficulty.
const DIFFICULTY_WEIGHTS: [Difficulty, number][] = [
  [1, 0.5],
  [2, 0.35],
  [3, 0.15],
];

function pickWeightedDifficulty(): Difficulty {
  const r = Math.random();
  let cumulative = 0;
  for (const [level, weight] of DIFFICULTY_WEIGHTS) {
    cumulative += weight;
    if (r <= cumulative) return level;
  }
  return 3;
}

function pickQuestion(g: GameState): QuizQuestionState {
  const used = new Set(g.usedQuestionIds ?? []);
  const type = TYPES[Math.floor(Math.random() * TYPES.length)];
  const difficulty = pickWeightedDifficulty();

  let pool = QUIZ_QUESTIONS.filter(
    (q) => q.type === type && q.difficulty === difficulty && !used.has(q.id)
  );
  if (pool.length === 0) {
    // That exact (type, difficulty) bucket is exhausted for the night —
    // fall back to any unused question of the same type.
    pool = QUIZ_QUESTIONS.filter((q) => q.type === type && !used.has(q.id));
  }
  if (pool.length === 0) {
    // Exhausted this type's whole bank for the night — allow repeats again.
    pool = QUIZ_QUESTIONS.filter((q) => q.type === type);
  }
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  g.usedQuestionIds = [...used, chosen.id];

  return {
    id: chosen.id,
    type: chosen.type,
    difficulty: chosen.difficulty,
    prompt: chosen.prompt,
    flagEmoji: chosen.flagEmoji,
    answerKind: chosen.answerKind,
    answer: chosen.answer,
    acceptableAnswers: chosen.acceptableAnswers,
  };
}

function orderAllPlayers(g: GameState): number[] {
  const n = g.playersPublic.length;
  const order: number[] = [];
  for (let i = 0; i < n; i++) order.push((g.startIndex + i) % n);
  return order;
}

export function startQuizRound(g: GameState): void {
  const order = orderAllPlayers(g);
  g.quiz = {
    turnOrder: order,
    turnPointer: 0,
    playerIdx: order[0],
    status: "asking",
    question: pickQuestion(g),
  };
  g.phase = "quiz";
}

export function applyQuizAnswer(g: GameState, rawAnswer: string): void {
  const q = g.quiz!;
  const player = g.playersPublic[q.playerIdx];
  const correct = checkAnswer(q.question, rawAnswer);
  q.lastAnswerGiven = rawAnswer;
  q.correct = correct;

  if (correct) {
    q.status = "distributing";
  } else {
    player.gulpsTotal += 2;
    q.status = "result";
  }
}

export function applyQuizDistribution(
  g: GameState,
  targets: { slug: string; amount: number }[]
): void {
  const q = g.quiz!;
  const byslug = new Map<string, PlayerPublic>(g.playersPublic.map((p) => [p.slug, p]));
  const entries: QuizDistributionEntry[] = [];
  targets.forEach(({ slug, amount }) => {
    const p = byslug.get(slug);
    if (!p || amount <= 0) return;
    p.gulpsTotal += amount;
    entries.push({ slug, name: p.name, amount });
  });
  q.distribution = entries;
  q.status = "result";
}

// Returns true if the quiz round (full table) is now over.
export function advanceQuizTurn(g: GameState): boolean {
  const q = g.quiz!;
  if (q.turnPointer + 1 >= q.turnOrder.length) {
    return true;
  }
  q.turnPointer += 1;
  q.playerIdx = q.turnOrder[q.turnPointer];
  q.status = "asking";
  q.question = pickQuestion(g);
  q.lastAnswerGiven = undefined;
  q.correct = undefined;
  q.distribution = undefined;
  return false;
}
