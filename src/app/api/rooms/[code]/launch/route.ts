import { NextRequest, NextResponse } from "next/server";
import { handleError, readBody, roomCode, sessionToken } from "@/lib/auth";
import { fail } from "@/lib/errors";
import { launchGame, playableTypes } from "@/lib/game/engine";
import { tick } from "@/lib/game/room";
import { ROUND_TYPES } from "@/lib/game/roundTypes";
import { MIN_ENABLED_ROUND_TYPES, type CulSecRule, type RoundTypeId } from "@/lib/game/types";
import { autoBotCount, makeBots, MAX_BOTS } from "@/lib/bots/names";
import { mutateRoom } from "@/lib/store";

const VALID_ROUND_COUNTS = new Set([5, 10, 15, 20]);
const VALID_ROUND_TYPE_IDS = new Set(ROUND_TYPES.map((t) => t.id));

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = await roomCode(params);
    const body = await readBody(req);
    const totalRounds = Number(body.totalRounds);
    const culSecRule: CulSecRule = body.culSecRule === "first" ? "first" : "last";
    if (!VALID_ROUND_COUNTS.has(totalRounds)) fail(400, "Nombre de manches invalide.");
    const enabled: RoundTypeId[] = Array.isArray(body.enabledRoundTypeIds)
      ? (body.enabledRoundTypeIds as unknown[]).filter(
          (id): id is RoundTypeId => typeof id === "string" && VALID_ROUND_TYPE_IDS.has(id as RoundTypeId)
        )
      : [];
    if (enabled.length < MIN_ENABLED_ROUND_TYPES) fail(400, `Choisis au moins ${MIN_ENABLED_ROUND_TYPES} mini-jeux.`);
    const extraBots = Math.max(0, Math.min(MAX_BOTS, Math.floor(Number(body.bots) || 0)));

    await mutateRoom(
      code,
      (room, snap) => {
        if (!snap.session || snap.session.slug !== room.hostSlug) fail(403, "Réservé à l'hôte.");
        if (room.game.phase !== "lobby") fail(409, "La partie a déjà commencé.");
        // Minimum : 1 joueur (mode solo / test). Les bots complètent la table.
        const humans = room.players.filter((p) => !p.bot && !p.left);
        if (humans.length < 1) fail(400, "Il faut au moins 1 joueur pour commencer.");
        const bots = makeBots(autoBotCount(humans.length, enabled, extraBots), humans);
        const table = [...humans, ...bots];
        if (playableTypes(enabled, table.length).length === 0)
          fail(400, "Aucun des mini-jeux choisis n'est jouable avec si peu de joueurs : ajoute des bots.");
        room.players = table;
        room.game = launchGame(table, totalRounds, culSecRule, enabled);
        tick(room, Date.now(), snap.seen);
        return true;
      },
      sessionToken(req, code)
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
