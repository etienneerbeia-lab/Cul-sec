import { NextRequest, NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { restartToLobby } from "@/lib/game/engine";
import { getGame, setGame } from "@/lib/store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const session = await requireHostSession(req, code);
  if (!session) return NextResponse.json({ error: "Réservé à l'hôte." }, { status: 403 });

  const game = await getGame(code);
  // Also doubles as the host's "back to lobby" escape hatch from a
  // mid-flight mini-game (see GameApp.tsx's quit-bar) — not just the
  // "Rejouer" button on the final leaderboard — so the only phase this
  // actually refuses is "lobby" itself, already there.
  if (!game || game.phase === "lobby") {
    return NextResponse.json({ error: "Ce n'est pas le moment." }, { status: 409 });
  }

  restartToLobby(game);
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
