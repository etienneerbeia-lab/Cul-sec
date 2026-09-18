export type QuestionType = "capital" | "flag" | "date";
export type AnswerKind = "year" | "text";

// 1 = facile (connu de la plupart des gens), 2 = moyen (demande un peu de
// culture générale), 3 = difficile (pointu, à garder rare). Target draw
// weights are 72/24/4 — see DIFFICULTY_WEIGHTS in src/lib/quiz/engine.ts.
export type Difficulty = 1 | 2 | 3;

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  difficulty: Difficulty;
  prompt: string;
  flagEmoji?: string; // only for type "flag"
  answerKind: AnswerKind; // "year" for date questions expecting just a year, "text" otherwise
  answer: string; // canonical, displayable correct answer
  acceptableAnswers: string[]; // extra accepted variants (accents/case are handled separately, put spelling/phrasing variants here)
}
