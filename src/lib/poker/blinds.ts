// Structure du tournoi express : les blindes montent avec le TEMPS (heure
// serveur depuis le lancement), pas au nombre de mains. Un nouveau niveau
// s'applique à la main suivante, comme en tournoi réel.
// Calibrée par scripts/sim-poker.ts (voir les résultats dans le commit).

export const STARTING_STACK = 1000;
export const ACTION_MS = 15000;

// [petite blinde, grosse blinde]
export const BLIND_LEVELS: [number, number][] = [
  [10, 20],
  [20, 40],
  [40, 80],
  [75, 150],
  [150, 300],
  [250, 500],
  [500, 1000],
];

// Durée d'un niveau selon le nombre de joueurs au départ : plus il y a de
// joueurs, plus il y a de jetons à faire tomber (point de départ, à
// recalibrer avec la simulation).
export const LEVEL_MS_BY_PLAYERS: Record<number, number> = {
  2: 45000,
  3: 45000,
  4: 45000,
  5: 45000,
  6: 45000,
  7: 45000,
  8: 45000,
};

export interface BlindStructure {
  levelMs: number;
  levels: [number, number][];
}

export function structureFor(players: number): BlindStructure {
  const n = Math.max(2, Math.min(8, players));
  return { levelMs: LEVEL_MS_BY_PLAYERS[n], levels: BLIND_LEVELS };
}

// Niveau (0, 1, 2...) à l'instant `elapsedMs` depuis le lancement.
export function levelAt(s: BlindStructure, elapsedMs: number): number {
  return Math.max(0, Math.floor(elapsedMs / s.levelMs));
}

// Blindes d'un niveau ; au-delà du dernier palier, elles doublent à chaque
// niveau (garantit que le tournoi se termine).
export function blindsFor(s: BlindStructure, level: number): [number, number] {
  const last = s.levels.length - 1;
  if (level <= last) return s.levels[level];
  const k = 2 ** (level - last);
  return [s.levels[last][0] * k, s.levels[last][1] * k];
}
