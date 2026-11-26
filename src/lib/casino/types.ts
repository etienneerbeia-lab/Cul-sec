import type { ChipUnit } from "../chips/format";

// Deux univers dans un salon : « Soirée » (mini-jeux à boire, tirés au
// hasard) et « Chill » (jeux casino, sans gorgées : on joue des jetons).
export type Universe = "party" | "casino";

export type CasinoGameId = "poker" | "bjtable";

// Joueurs assis au maximum à une table casino ; les suivants regardent.
export const MAX_CASINO_SEATS = 8;

export type BjEndMode = "rounds" | "survivor";

// Réglages choisis par l'hôte dans le salon.
export interface CasinoOptions {
  bjEndMode: BjEndMode;
  bjRounds: number;
}

export const DEFAULT_CASINO_OPTIONS: CasinoOptions = { bjEndMode: "rounds", bjRounds: 10 };
export const BJ_ROUND_OPTIONS = [5, 10, 15];

export interface CasinoRankEntry {
  slug: string;
  name: string;
  stack: number;
  rank: number;
  busted: boolean;
}

export interface CasinoGameMeta {
  id: CasinoGameId;
  label: string;
  icon: string;
  tagline: string;
  minPlayers: number;
  unit: ChipUnit;
  rules: string[];
  // false tant que le module n'est pas branché (affiché « Bientôt »).
  ready: boolean;
}
