import { randomBytes } from "crypto";
import { ROOM_TTL_SECONDS, redis } from "./redis";
import { generateCode } from "./game/engine";
import type { Card, GameState, Player } from "./game/types";

function kPlayers(code: string) {
  return `room:${code}:players`;
}
function kGame(code: string) {
  return `room:${code}:game`;
}
function kHand(code: string, round: number, slug: string) {
  return `room:${code}:hand:${round}:${slug}`;
}
function kHost(code: string) {
  return `room:${code}:host`;
}
function kSession(code: string, token: string) {
  return `room:${code}:session:${token}`;
}

export async function roomExists(code: string): Promise<boolean> {
  const v = await redis.exists(kPlayers(code));
  return v > 0;
}

export async function createRoomCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = generateCode();
    if (!(await roomExists(code))) return code;
  }
  throw new Error("Impossible de générer un code de partie unique.");
}

export async function getPlayers(code: string): Promise<Player[]> {
  const v = await redis.get<Player[]>(kPlayers(code));
  return v || [];
}
export async function setPlayers(code: string, players: Player[]): Promise<void> {
  await redis.set(kPlayers(code), players, { ex: ROOM_TTL_SECONDS });
}

export async function getGame(code: string): Promise<GameState | null> {
  return redis.get<GameState>(kGame(code));
}
export async function setGame(code: string, game: GameState): Promise<void> {
  await redis.set(kGame(code), game, { ex: ROOM_TTL_SECONDS });
}

export async function getHost(code: string): Promise<string | null> {
  return redis.get<string>(kHost(code));
}
export async function setHost(code: string, slug: string): Promise<void> {
  await redis.set(kHost(code), slug, { ex: ROOM_TTL_SECONDS });
}

export async function getHand(code: string, round: number, slug: string): Promise<Card[]> {
  const v = await redis.get<Card[]>(kHand(code, round, slug));
  return v || [];
}
export async function setHand(code: string, round: number, slug: string, cards: Card[]): Promise<void> {
  await redis.set(kHand(code, round, slug), cards, { ex: ROOM_TTL_SECONDS });
}

export interface SessionData {
  slug: string;
  name: string;
}

export async function createSession(code: string, slug: string, name: string): Promise<string> {
  const token = randomBytes(24).toString("hex");
  await redis.set(kSession(code, token), { slug, name } satisfies SessionData, {
    ex: ROOM_TTL_SECONDS,
  });
  return token;
}

export async function getSession(code: string, token: string): Promise<SessionData | null> {
  return redis.get<SessionData>(kSession(code, token));
}

export function handStoreFor(code: string) {
  return {
    getHand: (round: number, slug: string) => getHand(code, round, slug),
    setHand: (round: number, slug: string, cards: Card[]) => setHand(code, round, slug, cards),
  };
}
