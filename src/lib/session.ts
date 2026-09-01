import type { NextRequest, NextResponse } from "next/server";
import { ROOM_TTL_SECONDS } from "./redis";

export const SESSION_COOKIE = "maa_session";

export interface SessionCookieValue {
  code: string;
  token: string;
}

export function readSessionCookie(req: NextRequest): SessionCookieValue | null {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.code === "string" && typeof parsed.token === "string") {
      return parsed as SessionCookieValue;
    }
  } catch {
    // malformed cookie, ignore
  }
  return null;
}

export function writeSessionCookie(res: NextResponse, value: SessionCookieValue): void {
  res.cookies.set(SESSION_COOKIE, JSON.stringify(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ROOM_TTL_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.delete(SESSION_COOKIE);
}
