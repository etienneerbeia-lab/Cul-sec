import { NextRequest, NextResponse } from "next/server";
import { cleanName, handleError, readBody } from "@/lib/auth";
import { slugify } from "@/lib/game/engine";
import { createRoom, createSession, touchPresence } from "@/lib/store";
import { writeSessionCookie } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const name = cleanName((await readBody(req)).name);
    const slug = slugify(name);
    const room = await createRoom({ name, slug });
    const [token] = await Promise.all([createSession(room.code, slug), touchPresence(room.code, slug)]);
    const res = NextResponse.json({ code: room.code, name, slug, isHost: true });
    writeSessionCookie(res, { code: room.code, token });
    return res;
  } catch (e) {
    return handleError(e);
  }
}
