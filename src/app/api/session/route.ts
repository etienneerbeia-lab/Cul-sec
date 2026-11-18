import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, readSessionCookie } from "@/lib/session";
import { readRoom } from "@/lib/store";

export async function GET(req: NextRequest) {
  const cookie = readSessionCookie(req);
  if (!cookie) return NextResponse.json({ loggedIn: false });
  const snap = await readRoom(cookie.code, cookie.token).catch(() => null);
  if (!snap || !snap.session) {
    const res = NextResponse.json({ loggedIn: false });
    clearSessionCookie(res);
    return res;
  }
  const me = snap.room.players.find((p) => p.slug === snap.session!.slug);
  return NextResponse.json({
    loggedIn: true,
    code: cookie.code,
    slug: snap.session.slug,
    name: me?.name ?? "",
    isHost: snap.session.slug === snap.room.hostSlug,
  });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
