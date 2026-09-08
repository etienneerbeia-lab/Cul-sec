import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { applyBlackjackBet } from "@/lib/blackjack/engine";
import { getGame, setGame } from "@/lib/store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const session = await requireSession(req, code);
  if (!session) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const amount = body?.amount;

  const game = await getGame(code);
  if (!game || game.phase !== "blackjack" || !game.blackjack || game.blackjack.stage !== "betting") {
    return NextResponse.json({ error: "Ce n'est pas le moment." }, { status: 409 });
  }
  if (!game.blackjack.players.some((p) => p.slug === session.slug)) {
    return NextResponse.json({ error: "Tu ne participes pas à cette manche." }, { status: 403 });
  }
  if (game.blackjack.betResponded.includes(session.slug)) {
    return NextResponse.json({ error: "Tu as déjà misé." }, { status: 409 });
  }
  if (!Number.isInteger(amount) || amount < 1 || amount > 5) {
    return NextResponse.json({ error: "Mise invalide (1 à 5 gorgées)." }, { status: 400 });
  }

  applyBlackjackBet(game, session.slug, amount);
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
