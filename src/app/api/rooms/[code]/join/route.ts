import { NextRequest, NextResponse } from "next/server";
import { cleanName, handleError, readBody, roomCode } from "@/lib/auth";
import { fail } from "@/lib/errors";
import { uniqueSlug } from "@/lib/game/engine";
import { HOST_AWAY_MS } from "@/lib/game/room";
import { createSession, mutateRoom, touchPresence } from "@/lib/store";
import { writeSessionCookie } from "@/lib/session";

// Rejoindre un salon avec son prénom.
// - Au salon : nouveau joueur.
// - En cours de partie, avec le prénom d'un joueur parti ou absent : on
//   reprend sa place (cookie perdu, PWA ouverte à la place de Safari...).
// - En cours de partie, avec un nouveau prénom : on entre à la prochaine
//   manche.
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = await roomCode(params);
    const name = cleanName((await readBody(req)).name);
    const now = Date.now();
    const { result, room } = await mutateRoom(code, (room, snap) => {
      const same = room.players.find((p) => !p.bot && p.name.toLowerCase() === name.toLowerCase());
      if (same) {
        const seen = snap.seen[same.slug];
        const away = same.left || seen === undefined || now - seen > HOST_AWAY_MS;
        if (room.game.phase === "lobby" || !away) fail(409, "Ce prénom est déjà pris, essaie une variante.");
        same.left = false;
        return { slug: same.slug, rejoined: true };
      }
      if (room.players.filter((p) => !p.bot && !p.left).length >= 16) fail(409, "Le salon est plein (16 joueurs).");
      const slug = uniqueSlug(name, room.players.map((p) => p.slug));
      room.players.push({ name, slug });
      return { slug, rejoined: false };
    });
    const { slug, rejoined } = result as { slug: string; rejoined: boolean };
    const [token] = await Promise.all([createSession(code, slug), touchPresence(code, slug)]);
    const late = !rejoined && room.game.phase !== "lobby";
    const res = NextResponse.json({ code, name, slug, isHost: room.hostSlug === slug, rejoined, late });
    writeSessionCookie(res, { code, token });
    return res;
  } catch (e) {
    return handleError(e);
  }
}
