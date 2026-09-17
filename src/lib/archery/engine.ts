import type { ArcheryPoint, ArcheryRankingEntry, ArcheryShotRecord, GameState } from "../game/types";
import { ARCHERY_TIE_TOLERANCE, clampToTarget, randomWind, simulateArcheryShot } from "./physics";

function orderAllPlayers(g: GameState): number[] {
  const n = g.playersPublic.length;
  const order: number[] = [];
  for (let i = 0; i < n; i++) order.push((g.startIndex + i) % n);
  return order;
}

export function startArcheryRound(g: GameState): void {
  const order = orderAllPlayers(g);
  g.archery = {
    turnOrder: order,
    turnPointer: 0,
    playerIdx: order[0],
    wind: randomWind(),
    shots: [],
  };
  g.phase = "archery";
}

export function archeryActiveSlug(g: GameState): string {
  const ar = g.archery!;
  return g.playersPublic[ar.playerIdx].slug;
}

// The client only ever sends where it aimed — the wind that bends the
// shot and the resulting impact are both computed here, from the wind
// already on record for this turn, rather than trusted from the client
// the way golf's full collision physics are (see simulateShot's own
// comment). Archery's physics are cheap enough to redo, and a
// self-reported distance would be a direct incentive to cheat in a game
// about who ends up drinking the most.
export function applyArcheryShot(g: GameState, slug: string, rawAim: ArcheryPoint): void {
  const ar = g.archery!;
  const player = g.playersPublic.find((p) => p.slug === slug)!;
  const aim = clampToTarget(rawAim);
  const wind = ar.wind;
  const { impact, path, distance } = simulateArcheryShot(aim, wind);

  const shot: ArcheryShotRecord = { slug, name: player.name, wind, aim, impact, path, distance };
  ar.shots = [...ar.shots, shot];

  if (ar.turnPointer + 1 >= ar.turnOrder.length) {
    resolveArcheryRound(g);
    return;
  }

  ar.turnPointer += 1;
  ar.playerIdx = ar.turnOrder[ar.turnPointer];
  ar.wind = randomWind();
}

// Ranked by distance to center ascending, dense (shots within
// ARCHERY_TIE_TOLERANCE of each other share a rank, the next distinct
// value takes the very next rank — no gaps). The tolerance is small
// enough relative to the board that chaining ties transitively (A ties B,
// B ties C, but A and C are further apart than the tolerance) is not a
// realistic concern in practice. Gulps are rank - 1, so a clean 1st place
// drinks nothing and, in the extreme case where everyone ties, everyone
// is 1st and nobody drinks.
function resolveArcheryRound(g: GameState): void {
  const ar = g.archery!;
  const sorted = [...ar.shots].sort((a, b) => a.distance - b.distance);

  const ranking: ArcheryRankingEntry[] = [];
  let rank = 0;
  let lastDistance: number | null = null;
  sorted.forEach((shot) => {
    if (lastDistance === null || shot.distance - lastDistance > ARCHERY_TIE_TOLERANCE) {
      rank += 1;
    }
    lastDistance = shot.distance;
    ranking.push({ slug: shot.slug, name: shot.name, distance: shot.distance, rank, gulps: rank - 1 });
  });

  ranking.forEach((entry) => {
    if (entry.gulps > 0) {
      g.playersPublic.find((p) => p.slug === entry.slug)!.gulpsTotal += entry.gulps;
    }
  });

  g.lastResults = { type: "archery", archeryRanking: ranking };
  g.phase = "showdown";
}
