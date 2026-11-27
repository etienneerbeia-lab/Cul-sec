import { NextRequest, NextResponse } from "next/server";
import { handleError, readBody, roomCode, sessionToken } from "@/lib/auth";
import { fail } from "@/lib/errors";
import { scheduleDealerJobs } from "@/lib/dealer/llm";
import { performAction } from "@/lib/game/room";
import type { Action } from "@/lib/game/module";
import { mutateRoom } from "@/lib/store";

// La rédaction des répliques de la croupière (après la réponse) peut
// prendre quelques secondes.
export const maxDuration = 30;

// Point d'entrée unique de toutes les actions de jeu : { type, ...données }.
// La modification est atomique (voir mutateRoom) : deux joueurs qui votent
// au même instant sont tous les deux comptés.
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = await roomCode(params);
    const body = await readBody(req);
    if (typeof body.type !== "string") fail(400, "Action inconnue.");
    const { version, room } = await mutateRoom(
      code,
      (room, snap) => {
        if (!snap.session) fail(401, "Session invalide.");
        performAction(room, snap.session.slug, body as Action, Date.now(), snap.seen);
        return true;
      },
      sessionToken(req, code)
    );
    // Réplique de la croupière rédigée par l'IA, après la réponse.
    scheduleDealerJobs(code, room);
    return NextResponse.json({ ok: true, v: version });
  } catch (e) {
    return handleError(e);
  }
}
