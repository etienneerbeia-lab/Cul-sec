import { NextRequest, NextResponse } from "next/server";
import { slugify } from "@/lib/game/engine";
import { createRoomCode, createSession, setGame, setHost, setPlayers } from "@/lib/store";
import { writeSessionCookie } from "@/lib/session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Entre ton prénom." }, { status: 400 });
  if (name.length > 40) return NextResponse.json({ error: "Prénom trop long." }, { status: 400 });

  const code = await createRoomCode();
  const slug = slugify(name);

  await setPlayers(code, [{ name, slug }]);
  await setGame(code, { phase: "lobby", round: 0, startIndex: 0, lastRoundTypeId: null, playersPublic: [] });
  await setHost(code, slug);
  const token = await createSession(code, slug, name);

  const res = NextResponse.json({ code, name, slug, isHost: true });
  writeSessionCookie(res, { code, token });
  return res;
}
