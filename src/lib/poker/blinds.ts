// Structure du tournoi express : les blindes DOUBLENT toutes les 2 minutes
// (heure serveur depuis le lancement), quel que soit le nombre de joueurs :
// 10/20 → 20/40 → 40/80 → 80/160 → 160/320 → ...
// Un nouveau niveau s'applique à la main suivante, comme en tournoi réel.
// Durées observées : voir scripts/sim-poker.ts.

export const STARTING_STACK = 1000;
export const ACTION_MS = 15000;
export const LEVEL_MS = 2 * 60 * 1000;
export const START_BLINDS: [number, number] = [10, 20];

export interface BlindStructure {
  levelMs: number;
  // Blindes du niveau 0 ; chaque niveau suivant les double.
  start: [number, number];
}

export const BLIND_STRUCTURE: BlindStructure = { levelMs: LEVEL_MS, start: START_BLINDS };

// Niveau (0, 1, 2...) à l'instant `elapsedMs` depuis le lancement.
export function levelAt(s: BlindStructure, elapsedMs: number): number {
  return Math.max(0, Math.floor(elapsedMs / s.levelMs));
}

export function blindsFor(s: BlindStructure, level: number): [number, number] {
  const k = 2 ** level;
  return [s.start[0] * k, s.start[1] * k];
}
