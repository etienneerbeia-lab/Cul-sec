import type { GameState, RoundTypeId } from "./types";

// Une action envoyée par un joueur (ou jouée pour lui par le serveur).
export interface Action {
  type: string;
  [key: string]: unknown;
}

export interface Ctx {
  now: number;
  hostSlug: string;
}

// Ce que le jeu attend en ce moment : qui doit agir, et combien de temps
// on attend un humain avant de jouer à sa place.
export interface Pending {
  // Identifie cette attente : tant qu'il ne change pas, le délai et le
  // planning des bots restent les mêmes.
  key: string;
  actors: string[];
  timeoutMs: number | null;
}

export interface AutoOptions {
  // true : c'est un bot qui joue ; false : un humain a dépassé le délai.
  bot: boolean;
}

export interface GameModule {
  id: RoundTypeId;
  // Minimum de joueurs (humains + bots) pour que ce jeu soit tiré.
  minPlayers: number;
  start(g: GameState, ctx: Ctx): void;
  // Valide et applique une action ; lève ApiError si elle est invalide.
  act(g: GameState, slug: string, action: Action, ctx: Ctx): void;
  pending(g: GameState): Pending | null;
  // Coup automatique : celui d'un bot, ou le coup par défaut d'un humain
  // absent. null = rien à jouer pour ce joueur.
  auto(g: GameState, slug: string, ctx: Ctx, opts: AutoOptions): Action | null;
  // Délai (ms) avant qu'un bot joue, pour un rythme réaliste.
  botDelay?(g: GameState, slug: string): [number, number];
  // Ce qui se passe quand le délai expire sans acteur (ex. fin d'un
  // affichage). Par défaut : chaque acteur joue son coup automatique.
  onDeadline?(g: GameState, ctx: Ctx): void;
}

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function chance(p: number): boolean {
  return Math.random() < p;
}

export function tableOrder(g: GameState): number[] {
  const n = g.playersPublic.length;
  const order: number[] = [];
  for (let i = 0; i < n; i++) order.push((g.startIndex + i) % n);
  return order;
}

export function findPlayer(g: GameState, slug: string) {
  return g.playersPublic.find((p) => p.slug === slug);
}
