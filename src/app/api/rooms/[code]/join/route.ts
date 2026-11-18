import { NextRequest, NextResponse } from "next/server";
import { cleanName, handleError, readBody, roomCode } from "@/lib/auth";
import { fail } from "@/lib/errors";
import { uniqueSlug } from "@/lib/game/engine";
import { createSession, mutateRoom } from "@/lib/store";
import { writeSessionCookie } from "@/lib/session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = await roomCode(params);
    const name = cleanName((await readBody(req)).name);
    const { result: slug, room } = await mutateRoom(code, (room) => {
      if (room.game.phase !== "lobby") fail(409, "La partie a déjà commencé.");
      if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase()))
        fail(409, "Ce prénom est déjà pris, essaie une variante.");
      if (room.players.filter((p) => !p.bot).length >= 16) fail(409, "Le salon est plein (16 joueurs).");
      const slug = uniqueSlug(name, room.players.map((p) => p.slug));
      room.players.push({ name, slug });
      return slug;
    });
    const token = await createSession(code, slug as string);
    const res = NextResponse.json({ code, name, slug, isHost: room.hostSlug === slug });
    writeSessionCookie(res, { code, token });
    return res;
  } catch (e) {
    return handleError(e);
  }
}
