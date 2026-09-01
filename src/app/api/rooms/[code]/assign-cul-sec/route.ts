import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { assignCulSec, culSecWinnerSlug } from "@/lib/game/engine";
import { getGame, setGame } from "@/lib/store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const session = await requireSession(req, code);
  if (!session) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const game = await getGame(code);
  if (!game || game.phase !== "final" || game.culSecRule !== "first") {
    return NextResponse.json({ error: "Ce n'est pas le moment." }, { status: 409 });
  }
  if (game.culSecTargetSlug) {
    return NextResponse.json({ error: "Déjà désigné." }, { status: 409 });
  }

  const winnerSlug = culSecWinnerSlug(game);
  if (session.slug !== winnerSlug) {
    return NextResponse.json({ error: "Seul le gagnant peut désigner." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const targetSlug = typeof body?.targetSlug === "string" ? body.targetSlug : "";
  if (targetSlug === session.slug || !game.playersPublic.some((p) => p.slug === targetSlug)) {
    return NextResponse.json({ error: "Cible invalide." }, { status: 400 });
  }

  assignCulSec(game, targetSlug);
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
