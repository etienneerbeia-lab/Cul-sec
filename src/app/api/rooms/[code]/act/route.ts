import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { actBet, actCall, actCheck, actFold, actRaise } from "@/lib/game/engine";
import { getGame, handStoreFor, setGame } from "@/lib/store";

const ACTIONS = {
  fold: actFold,
  call: actCall,
  raise: actRaise,
  check: actCheck,
  bet: actBet,
} as const;
type ActionName = keyof typeof ACTIONS;

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const session = await requireSession(req, code);
  if (!session) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const action = body?.action as ActionName | undefined;
  if (!action || !(action in ACTIONS)) {
    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  }

  const game = await getGame(code);
  if (!game || game.phase !== "betting") {
    return NextResponse.json({ error: "Ce n'est pas le moment." }, { status: 409 });
  }

  const meIdx = game.playersPublic.findIndex((p) => p.slug === session.slug);
  if (meIdx === -1 || game.turnIdx !== meIdx) {
    return NextResponse.json({ error: "Ce n'est pas ton tour." }, { status: 403 });
  }

  const isCheckOrBetPhase = game.bettingOpts?.mode === "check-or-bet" && game.currentBet === 0;
  const allowed: ActionName[] = isCheckOrBetPhase ? ["check", "bet"] : ["fold", "call", "raise"];
  if (!allowed.includes(action)) {
    return NextResponse.json({ error: "Action invalide dans ce contexte." }, { status: 400 });
  }

  await ACTIONS[action](game, handStoreFor(code));
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
