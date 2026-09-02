import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { submitMemeCaption } from "@/lib/meme/engine";
import { getGame, setGame } from "@/lib/store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const session = await requireSession(req, code);
  if (!session) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const caption = typeof body?.caption === "string" ? body.caption : "";

  const game = await getGame(code);
  if (!game || game.phase !== "memeCaption" || !game.meme) {
    return NextResponse.json({ error: "Ce n'est pas le moment." }, { status: 409 });
  }
  if (!game.playersPublic.some((p) => p.slug === session.slug)) {
    return NextResponse.json({ error: "Tu ne participes pas à cette manche." }, { status: 403 });
  }
  if (game.meme.captionResponded.includes(session.slug)) {
    return NextResponse.json({ error: "Tu as déjà validé ta légende." }, { status: 409 });
  }

  submitMemeCaption(game, session.slug, caption);
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
