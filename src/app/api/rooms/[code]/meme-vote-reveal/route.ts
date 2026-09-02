import { NextRequest, NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { forceMemeVoteEnd } from "@/lib/meme/engine";
import { getGame, setGame } from "@/lib/store";

// Host-only escape hatch: voting has no fixed clock (brief only calls for
// a timer on the writing phase), so this is always available once the
// round is in memeVote — lets the host move on if someone's stuck.
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const session = await requireHostSession(req, code);
  if (!session) return NextResponse.json({ error: "Réservé à l'hôte." }, { status: 403 });

  const game = await getGame(code);
  if (!game || game.phase !== "memeVote" || !game.meme) {
    return NextResponse.json({ error: "Ce n'est pas le moment." }, { status: 409 });
  }

  forceMemeVoteEnd(game);
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
