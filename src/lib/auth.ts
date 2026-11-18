import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "./errors";
import { readSessionCookie } from "./session";

export async function roomCode(params: Promise<{ code: string }>): Promise<string> {
  return (await params).code.toUpperCase().slice(0, 8);
}

// Jeton de session du joueur pour ce salon (cookie), ou null.
export function sessionToken(req: NextRequest, code: string): string | null {
  const cookie = readSessionCookie(req);
  return cookie && cookie.code === code ? cookie.token : null;
}

export async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null);
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

// Transforme une ApiError (ou une erreur imprévue) en réponse JSON.
export function handleError(e: unknown): NextResponse {
  if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Erreur serveur, réessaie." }, { status: 500 });
}

export function cleanName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!name) throw new ApiError(400, "Entre ton prénom.");
  if (name.length > 24) throw new ApiError(400, "Prénom trop long (24 caractères max).");
  return name;
}
