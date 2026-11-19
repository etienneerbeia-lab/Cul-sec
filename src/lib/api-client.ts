import type { Card, CustomQuestion, GameState, Player } from "./game/types";

async function unwrap<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Une erreur est survenue.");
  return data as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return unwrap<T>(await fetch(path));
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return unwrap<T>(
    await fetch(path, {
      method: "POST",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  );
}

export async function apiDelete<T>(path: string): Promise<T> {
  return unwrap<T>(await fetch(path, { method: "DELETE" }));
}

export interface SessionResponse {
  loggedIn: boolean;
  code?: string;
  slug?: string;
  name?: string;
  isHost?: boolean;
}

export interface RoomResponse {
  code: string;
  name: string;
  slug: string;
  isHost: boolean;
}

export interface StateResponse {
  v: number;
  serverNow: number;
  hostSlug: string;
  players: Player[];
  game: GameState | null;
  myHand: Card[] | null;
  myVoteChoice: string | null;
  myUndercoverWord: string | null;
  mySlug: string | null;
  myName: string | null;
  isHost: boolean;
  myQuestions?: CustomQuestion[];
  tableQuestionCount?: number;
}

export type BetAction = "fold" | "call" | "raise" | "check" | "bet";
export type BlackjackAction = "hit" | "stand" | "double" | "split";
