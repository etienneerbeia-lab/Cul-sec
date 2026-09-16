import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { readSessionCookie } from "@/lib/session";
import { getGame, getPlayers, setPlayers, updateSessionName } from "@/lib/store";

// Lets a player change their own display name from the lobby, before the
// host launches the game — same validation as join/route.ts (non-empty,
// 40 chars max, no collision with another player's current name), but the
// slug assigned at join stays untouched so host tracking and any other
// slug-keyed reference keeps working.
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const session = await requireSession(req, code);
  if (!session) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const game = await getGame(code);
  if (game && game.phase !== "lobby") {
    return NextResponse.json({ error: "La partie a déjà commencé." }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Entre un prénom." }, { status: 400 });
  if (name.length > 40) return NextResponse.json({ error: "Prénom trop long." }, { status: 400 });

  const players = await getPlayers(code);
  const me = players.find((p) => p.slug === session.slug);
  if (!me) return NextResponse.json({ error: "Joueur introuvable." }, { status: 404 });

  const collision = players.some(
    (p) => p.slug !== session.slug && p.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (collision) {
    return NextResponse.json({ error: "Ce prénom est déjà pris, essaie une variante." }, { status: 409 });
  }

  me.name = name;
  await setPlayers(code, players);

  const cookie = readSessionCookie(req);
  if (cookie) await updateSessionName(code, cookie.token, name);

  return NextResponse.json({ ok: true, name });
}
