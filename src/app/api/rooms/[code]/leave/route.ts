import { NextRequest, NextResponse } from "next/server";
import { handleError, roomCode, sessionToken } from "@/lib/auth";
import { tick } from "@/lib/game/room";
import { mutateRoom } from "@/lib/store";
import { clearSessionCookie } from "@/lib/session";

// Quitter le salon : au salon, on retire le joueur ; en partie, il est
// marqué parti et ses tours sont joués automatiquement. Il peut revenir
// plus tard avec le même prénom.
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = await roomCode(params);
    await mutateRoom(
      code,
      (room, snap) => {
        const slug = snap.session?.slug;
        if (!slug) return false;
        if (room.game.phase === "lobby") room.players = room.players.filter((p) => p.slug !== slug);
        else {
          const me = room.players.find((p) => p.slug === slug);
          if (me) me.left = true;
        }
        if (room.hostSlug === slug) {
          const next = room.players.find((p) => !p.bot && !p.left && p.slug !== slug);
          if (next) room.hostSlug = next.slug;
        }
        tick(room, Date.now(), snap.seen);
        return true;
      },
      sessionToken(req, code)
    ).catch(() => null);
    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res);
    return res;
  } catch (e) {
    return handleError(e);
  }
}
