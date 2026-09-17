import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { applyArcheryShot, archeryActiveSlug } from "@/lib/archery/engine";
import { getGame, setGame } from "@/lib/store";
import type { ArcheryPoint } from "@/lib/game/types";

function isPoint(v: unknown): v is ArcheryPoint {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as ArcheryPoint).x === "number" &&
    typeof (v as ArcheryPoint).y === "number" &&
    Number.isFinite((v as ArcheryPoint).x) &&
    Number.isFinite((v as ArcheryPoint).y)
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const session = await requireSession(req, code);
  if (!session) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const game = await getGame(code);
  if (!game || game.phase !== "archery" || !game.archery) {
    return NextResponse.json({ error: "Ce n'est pas le moment." }, { status: 409 });
  }

  const activeSlug = archeryActiveSlug(game);
  if (session.slug !== activeSlug) {
    return NextResponse.json({ error: "Ce n'est pas ton tour." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const aim = body?.aim;
  if (!isPoint(aim)) {
    return NextResponse.json({ error: "Visée invalide." }, { status: 400 });
  }

  applyArcheryShot(game, session.slug, aim);
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
