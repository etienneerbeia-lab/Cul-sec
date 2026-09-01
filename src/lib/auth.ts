import type { NextRequest } from "next/server";
import { readSessionCookie } from "./session";
import { getHost, getSession, type SessionData } from "./store";

export async function requireSession(req: NextRequest, code: string): Promise<SessionData | null> {
  const cookie = readSessionCookie(req);
  if (!cookie || cookie.code !== code) return null;
  return getSession(code, cookie.token);
}

export async function requireHostSession(req: NextRequest, code: string): Promise<SessionData | null> {
  const session = await requireSession(req, code);
  if (!session) return null;
  const hostSlug = await getHost(code);
  if (hostSlug !== session.slug) return null;
  return session;
}
