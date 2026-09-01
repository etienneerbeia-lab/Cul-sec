import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getGame, getHand, getHost, getPlayers, roomExists } from "@/lib/store";
import type { Card } from "@/lib/game/types";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  if (!(await roomExists(code))) {
    return NextResponse.json({ error: "Code introuvable." }, { status: 404 });
  }

  const session = await requireSession(req, code);
  const [players, game, hostSlug] = await Promise.all([
    getPlayers(code),
    getGame(code),
    getHost(code),
  ]);

  let myHand: Card[] | null = null;
  if (session && game && ["betting", "communityReveal", "showdown"].includes(game.phase)) {
    const hand = await getHand(code, game.round, session.slug);
    myHand = hand.length ? hand : null;
  }

  return NextResponse.json({
    players,
    game,
    myHand,
    mySlug: session?.slug ?? null,
    myName: session?.name ?? null,
    isHost: session ? session.slug === hostSlug : false,
  });
}
