import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { submitGuess } from "@/lib/undercover/engine";
import { getGame, setGame } from "@/lib/store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const session = await requireSession(req, code);
  if (!session) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const guess = typeof body?.guess === "string" ? body.guess.trim() : "";
  if (!guess) return NextResponse.json({ error: "Tape une réponse." }, { status: 400 });

  const game = await getGame(code);
  if (!game || game.phase !== "undercoverGuess" || !game.undercover) {
    return NextResponse.json({ error: "Ce n'est pas le moment." }, { status: 409 });
  }
  if (session.slug !== game.undercover.impostorSlug) {
    return NextResponse.json({ error: "Ce n'est pas à toi de deviner." }, { status: 403 });
  }

  submitGuess(game, guess);
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
