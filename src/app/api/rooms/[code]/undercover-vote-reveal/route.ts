import { NextRequest, NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { resolveUndercoverVote } from "@/lib/undercover/engine";
import { getGame, setGame } from "@/lib/store";

// Host-only escape hatch: no timer on this vote (it's a discussion-driven
// social game, not a race), so this is always available rather than gated
// on elapsed time — covers a player whose device never checked in.
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const session = await requireHostSession(req, code);
  if (!session) return NextResponse.json({ error: "Réservé à l'hôte." }, { status: 403 });

  const game = await getGame(code);
  if (!game || game.phase !== "undercoverVote" || !game.undercover) {
    return NextResponse.json({ error: "Ce n'est pas le moment." }, { status: 409 });
  }

  resolveUndercoverVote(game);
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
