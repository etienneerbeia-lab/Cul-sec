import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { advanceClueReveal } from "@/lib/undercover/engine";
import { getGame, setGame } from "@/lib/store";

// Any player (not just the host) can move things along past the reveal
// pause — it's not "unstick a stalled game" like the vote/caption force-
// reveals, it's just "we've all read it, let's go" once the pin timer or
// an early click says it's time. Idempotent: if another client already
// advanced this same reveal first, revealUntil will already be cleared and
// this just no-ops with a 409 instead of double-advancing the turn.
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const session = await requireSession(req, code);
  if (!session) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const game = await getGame(code);
  if (!game || game.phase !== "undercoverClue" || !game.undercover) {
    return NextResponse.json({ error: "Ce n'est pas le moment." }, { status: 409 });
  }
  if (!game.playersPublic.some((p) => p.slug === session.slug)) {
    return NextResponse.json({ error: "Tu ne participes pas à cette manche." }, { status: 403 });
  }
  if (game.undercover.revealUntil === undefined) {
    return NextResponse.json({ error: "Rien à passer pour l'instant." }, { status: 409 });
  }

  advanceClueReveal(game);
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
