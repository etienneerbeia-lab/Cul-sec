import { NextRequest, NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { resolveVote } from "@/lib/vote/engine";
import { getGame, setGame } from "@/lib/store";
import { TIMED_ANSWER_MS } from "@/lib/game/types";

// Host-only escape hatch: once the 15s deadline has visibly passed, the
// host can force the reveal even if not everyone has voted yet — covers a
// player whose device never checked in (screen locked, app backgrounded).
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const session = await requireHostSession(req, code);
  if (!session) return NextResponse.json({ error: "Réservé à l'hôte." }, { status: 403 });

  const game = await getGame(code);
  if (!game || game.phase !== "vote" || !game.vote) {
    return NextResponse.json({ error: "Ce n'est pas le moment." }, { status: 409 });
  }
  if (Date.now() - game.vote.askedAt < TIMED_ANSWER_MS) {
    return NextResponse.json({ error: "Le temps n'est pas encore écoulé." }, { status: 409 });
  }

  resolveVote(game);
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
