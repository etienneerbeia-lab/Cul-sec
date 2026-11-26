import type { CasinoGameId } from "../casino/types";
import type { GameState, Player, RoundTypeId } from "./types";

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
  id: RoundTypeId | CasinoGameId;
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
  // ---- Jeux casino uniquement ----
  // Retire de l'état ce que `slug` n'a pas le droit de voir (deck, cartes
  // des autres...). Appelé par viewFor sur une copie superficielle de
  // l'état : ne jamais modifier les objets imbriqués en place.
  redact?(g: GameState, slug: string | null): GameState;
  // Joueurs du salon pas encore assis (arrivés en cours de partie) : le jeu
  // décide s'il les fait asseoir maintenant. Retourne true s'il a changé
  // l'état.
  admit?(g: GameState, waiting: Player[], ctx: Ctx): boolean;
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

// Tire un contenu (question, image, paire de mots...) pas encore vu ce
// soir ; quand tout a été vu, on recommence. Les ids vus sont gardés dans
// g.usedQuestionIds (partagé par tous les jeux, préfixes distincts).
export function pickFresh<T extends { id: string }>(g: GameState, list: T[]): T {
  const used = new Set(g.usedQuestionIds ?? []);
  let pool = list.filter((x) => !used.has(x.id));
  if (pool.length === 0) {
    const ids = new Set(list.map((x) => x.id));
    g.usedQuestionIds = (g.usedQuestionIds ?? []).filter((id) => !ids.has(id));
    pool = list;
  }
  const chosen = pick(pool);
  g.usedQuestionIds = [...(g.usedQuestionIds ?? []), chosen.id];
  return chosen;
}

// Une gorgée « événement » ne dépasse jamais ce plafond : au-delà, c'est
// un cul sec (affiché comme tel).
export const MAX_GULPS = 10;

// Fait boire `n` gorgées à un joueur et l'inscrit au journal de la manche.
export function drink(g: GameState, slug: string, n: number, why: string): void {
  const amount = Math.max(0, Math.min(MAX_GULPS, Math.round(n)));
  const p = g.playersPublic.find((pl) => pl.slug === slug);
  if (!p || amount <= 0) return;
  p.gulpsTotal += amount;
  g.drinks = [...(g.drinks ?? []), { slug, name: p.name, n: amount, why }];
}

export function nameOf(g: GameState, slug: string): string {
  return g.playersPublic.find((p) => p.slug === slug)?.name ?? slug;
}

export function slugsInOrder(g: GameState): string[] {
  return tableOrder(g).map((i) => g.playersPublic[i].slug);
}
