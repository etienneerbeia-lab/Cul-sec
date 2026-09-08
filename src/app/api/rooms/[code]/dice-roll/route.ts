import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { diceActiveSlug, rollDice } from "@/lib/dice/engine";
import { getGame, setGame } from "@/lib/store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const session = await requireSession(req, code);
  if (!session) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const game = await getGame(code);
  if (!game || game.phase !== "dice" || !game.dice) {
    return NextResponse.json({ error: "Ce n'est pas le moment." }, { status: 409 });
  }

  const activeSlug = diceActiveSlug(game);
  if (session.slug !== activeSlug) {
    return NextResponse.json({ error: "Ce n'est pas ton tour." }, { status: 403 });
  }

  rollDice(game);
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
