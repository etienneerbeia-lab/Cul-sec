export type QuestionType = "capital" | "flag" | "date";
export type AnswerKind = "year" | "text";

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  difficulty: 1 | 2 | 3 | 4 | 5;
  prompt: string;
  flagEmoji?: string; // only for type "flag"
  answerKind: AnswerKind; // "year" for date questions expecting just a year, "text" otherwise
  answer: string; // canonical, displayable correct answer
  acceptableAnswers: string[]; // extra accepted variants (accents/case are handled separately, put spelling/phrasing variants here)
}
