import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, readSessionCookie } from "@/lib/session";
import { getHost, getSession, roomExists } from "@/lib/store";

export async function GET(req: NextRequest) {
  const cookie = readSessionCookie(req);
  if (!cookie) return NextResponse.json({ loggedIn: false });

  const { code, token } = cookie;
  if (!(await roomExists(code))) {
    const res = NextResponse.json({ loggedIn: false });
    clearSessionCookie(res);
    return res;
  }

  const session = await getSession(code, token);
  if (!session) {
    const res = NextResponse.json({ loggedIn: false });
    clearSessionCookie(res);
    return res;
  }

  const hostSlug = await getHost(code);
  return NextResponse.json({
    loggedIn: true,
    code,
    slug: session.slug,
    name: session.name,
    isHost: session.slug === hostSlug,
  });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
