import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { handleError, readBody, roomCode, sessionToken } from "@/lib/auth";
import { fail } from "@/lib/errors";
import { MAX_CUSTOM_QUESTIONS_PER_PLAYER, type CustomQuestion } from "@/lib/game/types";
import { mutateRoom } from "@/lib/store";

const MAX_OPTION = 90;
const MAX_QUI = 120;

function clean(raw: unknown, max: number, label: string): string {
  const s = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (s.length < 2) fail(400, `${label} : trop court.`);
  if (s.length > max) fail(400, `${label} : ${max} caractères max.`);
  return s;
}

// « Questions de la table » : chaque joueur écrit jusqu'à
// MAX_CUSTOM_QUESTIONS_PER_PLAYER questions dans le salon, en attendant le
// lancement. { action: "add", mode, promptA, promptB | prompt } ou
// { action: "remove", id }.
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = await roomCode(params);
    const body = await readBody(req);
    await mutateRoom(
      code,
      (room, snap) => {
        if (!snap.session) fail(401, "Session invalide.");
        if (room.game.phase !== "lobby") fail(409, "La partie a déjà commencé.");
        const slug = snap.session!.slug;
        const list = room.customQuestions ?? [];
        if (body.action === "remove") {
          room.customQuestions = list.filter((q) => !(q.id === body.id && q.authorSlug === slug));
          return true;
        }
        if (list.filter((q) => q.authorSlug === slug).length >= MAX_CUSTOM_QUESTIONS_PER_PLAYER)
          fail(400, `${MAX_CUSTOM_QUESTIONS_PER_PLAYER} questions max par joueur.`);
        const id = `custom-${randomBytes(4).toString("hex")}`;
        let q: CustomQuestion;
        if (body.mode === "qui") {
          // On accepte « Qui de nous… a déjà… ? » comme « a déjà… ».
          const prompt = clean(body.prompt, MAX_QUI, "Question")
            .replace(/^qui de nous\s*/i, "")
            .replace(/^[.…]+\s*/, "")
            .replace(/\s*\?+$/, "");
          if (prompt.length < 2) fail(400, "Question : trop court.");
          q = { id, authorSlug: slug, mode: "qui", prompt };
        } else {
          q = {
            id,
            authorSlug: slug,
            mode: "tp",
            promptA: clean(body.promptA, MAX_OPTION, "Option 1"),
            promptB: clean(body.promptB, MAX_OPTION, "Option 2"),
          };
        }
        room.customQuestions = [...list, q];
        return true;
      },
      sessionToken(req, code)
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
