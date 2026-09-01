import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { applyQuizAnswer } from "@/lib/quiz/engine";
import { getGame, setGame } from "@/lib/store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const session = await requireSession(req, code);
  if (!session) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const answer = typeof body?.answer === "string" ? body.answer : "";

  const game = await getGame(code);
  if (!game || game.phase !== "quiz" || !game.quiz || game.quiz.status !== "asking") {
    return NextResponse.json({ error: "Ce n'est pas le moment." }, { status: 409 });
  }

  const activeSlug = game.playersPublic[game.quiz.playerIdx].slug;
  if (session.slug !== activeSlug) {
    return NextResponse.json({ error: "Ce n'est pas ton tour." }, { status: 403 });
  }

  applyQuizAnswer(game, answer);
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
