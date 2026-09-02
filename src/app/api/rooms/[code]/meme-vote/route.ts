import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { submitMemeVote } from "@/lib/meme/engine";
import { getGame, setGame } from "@/lib/store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const session = await requireSession(req, code);
  if (!session) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const authorSlug = typeof body?.authorSlug === "string" ? body.authorSlug : null;

  const game = await getGame(code);
  if (!game || game.phase !== "memeVote" || !game.meme) {
    return NextResponse.json({ error: "Ce n'est pas le moment." }, { status: 409 });
  }
  if (!game.playersPublic.some((p) => p.slug === session.slug)) {
    return NextResponse.json({ error: "Tu ne participes pas à cette manche." }, { status: 403 });
  }
  if (game.meme.voteResponded.includes(session.slug)) {
    return NextResponse.json({ error: "Tu as déjà voté." }, { status: 409 });
  }
  if (authorSlug === session.slug) {
    return NextResponse.json({ error: "Tu ne peux pas voter pour ta propre légende." }, { status: 400 });
  }

  submitMemeVote(game, session.slug, authorSlug);
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
