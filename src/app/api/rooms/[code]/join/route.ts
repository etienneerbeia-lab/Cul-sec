import { NextRequest, NextResponse } from "next/server";
import { slugify } from "@/lib/game/engine";
import { createSession, getGame, getHost, getPlayers, roomExists, setPlayers } from "@/lib/store";
import { writeSessionCookie } from "@/lib/session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Entre ton prénom." }, { status: 400 });
  if (name.length > 40) return NextResponse.json({ error: "Prénom trop long." }, { status: 400 });

  if (!(await roomExists(code))) {
    return NextResponse.json({ error: "Code introuvable." }, { status: 404 });
  }
  const game = await getGame(code);
  if (game && game.phase !== "lobby") {
    return NextResponse.json({ error: "La partie a déjà commencé." }, { status: 409 });
  }

  const slug = slugify(name);
  const players = await getPlayers(code);
  if (players.find((p) => p.slug === slug)) {
    return NextResponse.json(
      { error: "Ce prénom est déjà pris, essaie une variante." },
      { status: 409 }
    );
  }
  players.push({ name, slug });
  await setPlayers(code, players);
  const token = await createSession(code, slug, name);
  const hostSlug = await getHost(code);

  const res = NextResponse.json({ code, name, slug, isHost: hostSlug === slug });
  writeSessionCookie(res, { code, token });
  return res;
}
