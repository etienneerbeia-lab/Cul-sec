import { NextRequest, NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { launchGame } from "@/lib/game/engine";
import { getPlayers, roomExists, setGame } from "@/lib/store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  if (!(await roomExists(code))) return NextResponse.json({ error: "Code introuvable." }, { status: 404 });

  const session = await requireHostSession(req, code);
  if (!session) return NextResponse.json({ error: "Réservé à l'hôte." }, { status: 403 });

  const players = await getPlayers(code);
  if (players.length < 3) {
    return NextResponse.json({ error: "Il faut au moins 3 joueurs pour commencer." }, { status: 400 });
  }

  const game = launchGame(players);
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
