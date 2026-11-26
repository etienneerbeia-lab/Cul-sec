import { NextRequest, NextResponse } from "next/server";
import { handleError, roomCode, sessionToken } from "@/lib/auth";
import { awaySlugs, tick } from "@/lib/game/room";
import { viewFor } from "@/lib/game/view";
import { mutateRoom, readRoom, touchPresence, type Room } from "@/lib/store";

// Rafraîchissement d'un joueur. Une lecture groupée (1 requête Upstash),
// puis — seulement si un bot doit jouer ou un délai a expiré — une écriture
// atomique. ?beat=1 (envoyé une fois sur trois) met à jour la présence.
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = await roomCode(params);
    const token = sessionToken(req, code);
    const snap = await readRoom(code, token);
    if (!snap) return NextResponse.json({ error: "Code introuvable." }, { status: 404 });
    const slug = snap.session?.slug ?? null;
    const now = Date.now();
    if (slug && req.nextUrl.searchParams.get("beat")) {
      snap.seen[slug] = now;
      await touchPresence(code, slug);
    }

    let room: Room = snap.room;
    let version = snap.version;
    // Essai à blanc sur une copie : n'écrit que s'il y a vraiment du nouveau.
    const probe: Room = structuredClone(room);
    if (tick(probe, now, snap.seen)) {
      const res = await mutateRoom(code, (r, s) => (tick(r, Date.now(), { ...s.seen, ...snap.seen }) ? true : false));
      room = res.room;
      version = res.version;
    }

    const view = viewFor(room.game, slug);
    return NextResponse.json({
      v: version,
      serverNow: Date.now(),
      players: room.players,
      ...view,
      mySlug: slug,
      myName: room.players.find((p) => p.slug === slug)?.name ?? null,
      isHost: !!slug && slug === room.hostSlug,
      hostSlug: room.hostSlug,
      // Questions de la table : chacun ne voit que les siennes, et le total.
      myQuestions: (room.customQuestions ?? []).filter((q) => q.authorSlug === slug),
      tableQuestionCount: (room.customQuestions ?? []).length,
      // Joueurs absents (partis ou silencieux depuis 45 s) : leurs coups
      // sont joués pour eux ; badge « absent » sur leur siège.
      away: awaySlugs(room, now, snap.seen),
    });
  } catch (e) {
    return handleError(e);
  }
}
