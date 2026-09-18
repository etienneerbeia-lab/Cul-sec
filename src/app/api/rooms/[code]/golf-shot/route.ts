import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { applyGolfShot, golfActiveSlug } from "@/lib/golf/engine";
import { getGame, setGame } from "@/lib/store";
import type { GolfPoint, GolfStruckBallResult } from "@/lib/game/types";

function isPoint(v: unknown): v is GolfPoint {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as GolfPoint).x === "number" &&
    typeof (v as GolfPoint).y === "number" &&
    Number.isFinite((v as GolfPoint).x) &&
    Number.isFinite((v as GolfPoint).y)
  );
}

function isStruckBall(v: unknown): v is GolfStruckBallResult {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.slug === "string" &&
    Array.isArray(s.path) &&
    s.path.length > 0 &&
    s.path.every(isPoint) &&
    isPoint(s.finalPos) &&
    typeof s.sunk === "boolean" &&
    typeof s.wentInWater === "boolean"
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const session = await requireSession(req, code);
  if (!session) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const game = await getGame(code);
  if (!game || game.phase !== "golf" || !game.golf) {
    return NextResponse.json({ error: "Ce n'est pas le moment." }, { status: 409 });
  }

  const activeSlug = golfActiveSlug(game);
  if (session.slug !== activeSlug) {
    return NextResponse.json({ error: "Ce n'est pas ton tour." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const path = Array.isArray(body?.path) ? body.path : null;
  const finalPos = body?.finalPos;
  const sunk = body?.sunk === true;
  const wentInWater = body?.wentInWater === true;
  const destroyedObstacleRaw = body?.destroyedObstacle;
  const destroyedObstacle =
    typeof destroyedObstacleRaw === "number" && Number.isInteger(destroyedObstacleRaw) && destroyedObstacleRaw >= 0
      ? destroyedObstacleRaw
      : undefined;
  const struckBalls = Array.isArray(body?.struckBalls) ? body.struckBalls.filter(isStruckBall) : [];
  if (!path || path.length === 0 || !path.every(isPoint) || !isPoint(finalPos)) {
    return NextResponse.json({ error: "Coup invalide." }, { status: 400 });
  }

  applyGolfShot(game, session.slug, path, finalPos, sunk, wentInWater, destroyedObstacle, struckBalls);
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
