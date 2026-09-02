import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { submitClue } from "@/lib/undercover/engine";
import { getGame, setGame } from "@/lib/store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const session = await requireSession(req, code);
  if (!session) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Écris un indice." }, { status: 400 });

  const game = await getGame(code);
  if (!game || game.phase !== "undercoverClue" || !game.undercover) {
    return NextResponse.json({ error: "Ce n'est pas le moment." }, { status: 409 });
  }

  const activeSlug = game.undercover.clueOrder[game.undercover.cluePointer];
  if (session.slug !== activeSlug) {
    return NextResponse.json({ error: "Ce n'est pas ton tour." }, { status: 403 });
  }

  submitClue(game, session.slug, text);
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
