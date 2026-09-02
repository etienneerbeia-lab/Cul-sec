import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { applyUndercoverVote } from "@/lib/undercover/engine";
import { getGame, setGame } from "@/lib/store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const session = await requireSession(req, code);
  if (!session) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const targetSlug = typeof body?.targetSlug === "string" ? body.targetSlug : "";

  const game = await getGame(code);
  if (!game || game.phase !== "undercoverVote" || !game.undercover) {
    return NextResponse.json({ error: "Ce n'est pas le moment." }, { status: 409 });
  }
  const u = game.undercover;
  if (!u.remainingSlugs.includes(session.slug)) {
    return NextResponse.json({ error: "Tu ne participes plus à cette manche." }, { status: 403 });
  }
  if (u.voteResponded.includes(session.slug)) {
    return NextResponse.json({ error: "Tu as déjà voté." }, { status: 409 });
  }
  if (targetSlug === session.slug) {
    return NextResponse.json({ error: "Tu ne peux pas voter pour toi-même." }, { status: 400 });
  }
  const validTargets = u.tieBreakCandidates ?? u.remainingSlugs;
  if (!validTargets.includes(targetSlug)) {
    return NextResponse.json({ error: "Cible de vote invalide." }, { status: 400 });
  }

  applyUndercoverVote(game, session.slug, targetSlug);
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
