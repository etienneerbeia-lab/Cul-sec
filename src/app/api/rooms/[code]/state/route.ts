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
  if (session && game && ["betting", "showdown", "duelReveal"].includes(game.phase)) {
    const hand = await getHand(code, game.round, session.slug);
    myHand = hand.length ? hand : null;
  }

  // Never let the answer reach any client before the active player has
  // actually submitted — the question prompt itself is public (everyone
  // watches along), only the answer stays server-side until resolved.
  let publicGame =
    game && game.quiz && game.quiz.status === "asking"
      ? {
          ...game,
          quiz: {
            ...game.quiz,
            question: { ...game.quiz.question, answer: undefined, acceptableAnswers: undefined },
          },
        }
      : game;

  // Same idea for "Tu préfères": everyone sees the prompt, nobody sees who
  // voted for what (not even a live vote count, to avoid bandwagoning)
  // until the round resolves and moves on to phase "showdown".
  let myVoteChoice: "A" | "B" | null = null;
  if (publicGame?.vote) {
    // `responded` (who has acted) stays public so the "waiting on the
    // table" screen can show progress — it never says *what* anyone chose.
    if (session) myVoteChoice = publicGame.vote.votes[session.slug] ?? null;
    publicGame = { ...publicGame, vote: { ...publicGame.vote, votes: {} } };
  }

  // "Légende de mème": while everyone is still privately writing, nobody
  // (not even the author) needs their caption echoed back by the server —
  // the client already knows its own draft locally. Once voting starts the
  // captions themselves become the public thing being judged, so they're
  // sent as-is; only the slug->author mapping stays implicit until the
  // round resolves into lastResults.
  if (publicGame?.meme && publicGame.phase === "memeCaption") {
    publicGame = { ...publicGame, meme: { ...publicGame.meme, captions: {} } };
  }

  // Undercover: the whole round hinges on nobody but the impostor knowing
  // who the impostor is (or what their "close" word is) until it resolves
  // — so those three fields never leave the server, and each session only
  // ever learns its own word via myUndercoverWord below. Live votes are
  // hidden the same way as the vote/meme mini-games.
  let myUndercoverWord: string | null = null;
  if (publicGame?.undercover) {
    const u = publicGame.undercover;
    if (session) {
      myUndercoverWord =
        session.slug === u.impostorSlug ? (u.isMisterWhite ? null : u.impostorWord ?? null) : u.secretWord ?? null;
    }
    publicGame = {
      ...publicGame,
      undercover: { ...u, secretWord: undefined, impostorSlug: undefined, impostorWord: undefined, votes: {} },
    };
  }

  return NextResponse.json({
    players,
    game: publicGame,
    myHand,
    myVoteChoice,
    myUndercoverWord,
    mySlug: session?.slug ?? null,
    myName: session?.name ?? null,
    isHost: session ? session.slug === hostSlug : false,
  });
}
