import { NextRequest, NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { forceMemeCaptionEnd } from "@/lib/meme/engine";
import { getGame, setGame } from "@/lib/store";
import { MEME_CAPTION_MS } from "@/lib/game/types";

// Host-only escape hatch: once the 60s deadline has visibly passed, the
// host can force the move to voting even if not everyone has submitted a
// caption yet — covers a player whose device never checked in.
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const session = await requireHostSession(req, code);
  if (!session) return NextResponse.json({ error: "Réservé à l'hôte." }, { status: 403 });

  const game = await getGame(code);
  if (!game || game.phase !== "memeCaption" || !game.meme) {
    return NextResponse.json({ error: "Ce n'est pas le moment." }, { status: 409 });
  }
  if (Date.now() - game.meme.askedAt < MEME_CAPTION_MS) {
    return NextResponse.json({ error: "Le temps n'est pas encore écoulé." }, { status: 409 });
  }

  forceMemeCaptionEnd(game);
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
