import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { revealDuelCard } from "@/lib/game/engine";
import { getGame, handStoreFor, setGame } from "@/lib/store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const session = await requireSession(req, code);
  if (!session) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const game = await getGame(code);
  if (!game || game.phase !== "duelReveal" || !game.duelReveal || !game.duelists) {
    return NextResponse.json({ error: "Ce n'est pas le moment." }, { status: 409 });
  }

  const [i1, i2] = game.duelists;
  const meIdx = game.playersPublic.findIndex((p) => p.slug === session.slug);
  if (meIdx !== i1 && meIdx !== i2) {
    return NextResponse.json({ error: "Tu ne participes pas à ce duel." }, { status: 403 });
  }
  const pos = meIdx === i1 ? 0 : 1;
  if (game.duelReveal.revealed[pos]) {
    return NextResponse.json({ error: "Déjà révélé." }, { status: 409 });
  }

  await revealDuelCard(game, meIdx, handStoreFor(code));
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
