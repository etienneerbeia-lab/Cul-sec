import { randomBytes } from "crypto";
import { ROOM_TTL_SECONDS, redis } from "./redis";
import { ApiError } from "./errors";
import type { CustomQuestion, GameState, Player } from "./game/types";

// Un salon = un seul document JSON (joueurs + hôte + partie), versionné.
// Toute écriture passe par mutateRoom : lecture, modification, puis écriture
// conditionnelle (script Lua) qui échoue si quelqu'un a écrit entre-temps —
// on relit et on rejoue alors la modification. Plus aucune mise à jour
// perdue quand plusieurs joueurs agissent au même moment.
//
// Préfixe "cs2:" : ne touche jamais aux clés de l'ancienne version (room:*),
// donc les salons de la prod et ceux de la preview ne se marchent pas dessus
// même s'ils partagent la même base Upstash.
export interface Room {
  code: string;
  hostSlug: string;
  players: Player[];
  game: GameState;
  createdAt: number;
  // Questions écrites par les joueurs dans le salon ; gardées d'une partie
  // à l'autre dans le même salon.
  customQuestions?: CustomQuestion[];
}

export interface SessionData {
  slug: string;
}

const kRoom = (code: string) => `cs2:room:${code}`;
const kVer = (code: string) => `cs2:room:${code}:v`;
const kSession = (code: string, token: string) => `cs2:room:${code}:s:${token}`;
const kSeen = (code: string) => `cs2:room:${code}:seen`;

const CAS_SCRIPT = `
if redis.call('GET', KEYS[2]) == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
  redis.call('SET', KEYS[2], ARGV[4], 'EX', ARGV[3])
  redis.call('EXPIRE', KEYS[3], ARGV[3])
  return 1
end
return 0`;

export function lobbyGame(): GameState {
  return { phase: "lobby", round: 0, startIndex: 0, lastRoundTypeId: null, playersPublic: [] };
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

export async function createRoom(host: Player): Promise<Room> {
  for (let i = 0; i < 20; i++) {
    const code = generateCode();
    const room: Room = { code, hostSlug: host.slug, players: [host], game: lobbyGame(), createdAt: Date.now() };
    const ok = await redis.set(kRoom(code), JSON.stringify(room), { nx: true, ex: ROOM_TTL_SECONDS });
    if (ok) {
      await redis.set(kVer(code), "1", { ex: ROOM_TTL_SECONDS });
      return room;
    }
  }
  throw new ApiError(500, "Impossible de générer un code de partie unique.");
}

export interface RoomSnapshot {
  room: Room;
  version: number;
  session: SessionData | null;
  seen: Record<string, number>;
}

function parseRoom(raw: unknown): Room | null {
  if (!raw) return null;
  if (typeof raw === "string") return JSON.parse(raw) as Room;
  return raw as Room;
}

// Une seule requête HTTP : document + version + session + présence.
export async function readRoom(code: string, token?: string | null): Promise<RoomSnapshot | null> {
  const p = redis.pipeline();
  p.mget(kRoom(code), kVer(code), token ? kSession(code, token) : kSession(code, "-"));
  p.hgetall(kSeen(code));
  const [values, seenRaw] = (await p.exec()) as [unknown[], Record<string, unknown> | null];
  const room = parseRoom(values[0]);
  if (!room) return null;
  const seen: Record<string, number> = {};
  Object.entries(seenRaw ?? {}).forEach(([k, v]) => (seen[k] = Number(v)));
  return {
    room,
    version: Number(values[1] ?? 0),
    session: (values[2] as SessionData | null) ?? null,
    seen,
  };
}

export async function touchPresence(code: string, slug: string): Promise<void> {
  await redis.hset(kSeen(code), { [slug]: Date.now() });
}

async function casWrite(code: string, expected: number, room: Room): Promise<boolean> {
  const res = await redis.eval(
    CAS_SCRIPT,
    [kRoom(code), kVer(code), kSeen(code)],
    [String(expected), JSON.stringify(room), String(ROOM_TTL_SECONDS), String(expected + 1)]
  );
  return Number(res) === 1;
}

// Applique `fn` au salon de façon atomique. `fn` peut lever ApiError
// (renvoyée telle quelle) ou retourner false pour « rien à écrire ».
export async function mutateRoom<T>(
  code: string,
  fn: (room: Room, snap: RoomSnapshot) => T | false,
  token?: string | null
): Promise<{ room: Room; result: T | false; version: number }> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const snap = await readRoom(code, token);
    if (!snap) throw new ApiError(404, "Code introuvable.");
    const room = snap.room;
    const result = fn(room, snap);
    if (result === false) return { room, result, version: snap.version };
    if (await casWrite(code, snap.version, room)) return { room, result, version: snap.version + 1 };
    // Conflit : quelqu'un a écrit entre notre lecture et notre écriture.
    await new Promise((r) => setTimeout(r, 15 + Math.random() * 60 * (attempt + 1)));
  }
  throw new ApiError(503, "Trop d'actions en même temps, réessaie.");
}

export async function createSession(code: string, slug: string): Promise<string> {
  const token = randomBytes(24).toString("hex");
  await redis.set(kSession(code, token), { slug } satisfies SessionData, { ex: ROOM_TTL_SECONDS });
  return token;
}
