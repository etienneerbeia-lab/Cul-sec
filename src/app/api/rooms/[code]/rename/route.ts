import { NextRequest, NextResponse } from "next/server";
import { cleanName, handleError, readBody, roomCode, sessionToken } from "@/lib/auth";
import { fail } from "@/lib/errors";
import { mutateRoom } from "@/lib/store";

// Changement de prénom depuis le salon. Le slug (identifiant stable) ne
// change pas.
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = await roomCode(params);
    const name = cleanName((await readBody(req)).name);
    await mutateRoom(
      code,
      (room, snap) => {
        if (!snap.session) fail(401, "Session invalide.");
        if (room.game.phase !== "lobby") fail(409, "La partie a déjà commencé.");
        const me = room.players.find((p) => p.slug === snap.session!.slug);
        if (!me) fail(404, "Joueur introuvable.");
        if (room.players.some((p) => p !== me && p.name.toLowerCase() === name.toLowerCase()))
          fail(409, "Ce prénom est déjà pris, essaie une variante.");
        me.name = name;
        return true;
      },
      sessionToken(req, code)
    );
    return NextResponse.json({ ok: true, name });
  } catch (e) {
    return handleError(e);
  }
}
