import { QUIZ_QUESTIONS } from "../src/lib/quiz/questions.ts";

const regionNames = new Intl.DisplayNames(["fr"], { type: "region" });

function emojiToCode(emoji) {
  const chars = [...emoji];
  if (chars.length !== 2) return null;
  return chars.map((c) => String.fromCharCode(c.codePointAt(0) - 0x1f1e6 + 65)).join("");
}

function normalize(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

let issues = 0;
const byType = { capital: 0, flag: 0, date: 0 };
const byDiff = {};
const ids = new Set();

for (const q of QUIZ_QUESTIONS) {
  byType[q.type] = (byType[q.type] || 0) + 1;
  byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1;
  if (ids.has(q.id)) {
    console.log("DUPLICATE ID:", q.id);
    issues++;
  }
  ids.add(q.id);

  if (q.type === "flag") {
    const code = emojiToCode(q.flagEmoji || "");
    if (!code) {
      console.log("BAD FLAG EMOJI:", q.id, q.flagEmoji);
      issues++;
      continue;
    }
    let expected;
    try {
      expected = regionNames.of(code);
    } catch {
      expected = null;
    }
    if (!expected) {
      console.log("UNKNOWN REGION CODE:", q.id, code, q.flagEmoji, "-> answer:", q.answer);
      continue;
    }
    const candidates = [q.answer, ...(q.acceptableAnswers || [])].map(normalize);
    const expNorm = normalize(expected);
    const match = candidates.some((c) => c === expNorm || c.includes(expNorm) || expNorm.includes(c));
    if (!match) {
      console.log(`POSSIBLE MISMATCH: ${q.id} ${q.flagEmoji} code=${code} Intl says "${expected}" but answer="${q.answer}"`);
    }
  }
}

console.log("\nTotals:", byType);
console.log("Difficulty spread:", byDiff);
console.log("Total questions:", QUIZ_QUESTIONS.length, "unique ids:", ids.size);
console.log(issues ? `\n${issues} hard issues found` : "\nNo duplicate ids / malformed emoji found");
