import type { QuizQuestionState } from "../game/types";

const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
const LEADING_FILLERS = /^(le |la |les |l['’]|d['’]|du |de |des |en |l['’]an(?:nee)? )+/;

function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .trim()
    .replace(LEADING_FILLERS, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function extractYear(s: string): string | null {
  const m = s.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  return m ? m[0] : null;
}

export function checkAnswer(
  question: Pick<QuizQuestionState, "answerKind" | "answer" | "acceptableAnswers">,
  rawAnswer: string
): boolean {
  const answer = question.answer ?? "";
  if (question.answerKind === "year") {
    const given = extractYear(rawAnswer);
    const expected = extractYear(answer);
    return given !== null && expected !== null && given === expected;
  }

  const candidates = [answer, ...(question.acceptableAnswers ?? [])].map(normalizeText);
  const given = normalizeText(rawAnswer);
  return given.length > 0 && candidates.includes(given);
}
