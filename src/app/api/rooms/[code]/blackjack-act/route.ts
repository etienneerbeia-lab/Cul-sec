import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { blackjackDouble, blackjackHit, blackjackSplit, blackjackStand } from "@/lib/blackjack/engine";
import { getGame, setGame } from "@/lib/store";

const ACTIONS = {
  hit: blackjackHit,
  stand: blackjackStand,
  double: blackjackDouble,
  split: blackjackSplit,
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
  const bj = game?.blackjack;
  if (!game || game.phase !== "blackjack" || !bj || bj.stage !== "playerTurns") {
    return NextResponse.json({ error: "Ce n'est pas le moment." }, { status: 409 });
  }

  const player = bj.players[bj.turnPointer];
  if (player.slug !== session.slug) {
    return NextResponse.json({ error: "Ce n'est pas ton tour." }, { status: 403 });
  }
  const hand = player.hands[player.activeHandIdx];
  if (!hand || hand.status !== "playing") {
    return NextResponse.json({ error: "Cette main n'est plus jouable." }, { status: 409 });
  }

  if (action === "double" && hand.cards.length !== 2) {
    return NextResponse.json({ error: "Doubler n'est possible qu'en tout début de main." }, { status: 400 });
  }
  if (action === "split" && !(hand.cards.length === 2 && hand.cards[0].value === hand.cards[1].value)) {
    return NextResponse.json({ error: "Split impossible : les deux cartes doivent être identiques." }, { status: 400 });
  }

  ACTIONS[action](game);
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
