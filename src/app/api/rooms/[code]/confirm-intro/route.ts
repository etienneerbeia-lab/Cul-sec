import { NextRequest, NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { confirmRoundIntro } from "@/lib/game/engine";
import { getGame, handStoreFor, setGame } from "@/lib/store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const session = await requireHostSession(req, code);
  if (!session) return NextResponse.json({ error: "Réservé à l'hôte." }, { status: 403 });

  const game = await getGame(code);
  if (!game || game.phase !== "roundIntro") {
    return NextResponse.json({ error: "Ce n'est pas le moment." }, { status: 409 });
  }

  await confirmRoundIntro(game, handStoreFor(code));
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
