import { ARCHERY_ARROWS_PER_TURN } from "../game/types";
import type { ArcheryPoint, ArcheryRankingEntry, ArcheryShotRecord, GameState } from "../game/types";
import { archeryScoreForDistance, arrowDispersion, clampToTarget, randomWind, simulateArcheryShot } from "./physics";
import { drink } from "../game/module";

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
    arrowNumber: 1,
    wind: randomWind(),
    shots: [],
  };
  g.phase = "archery";
}

export function archeryActiveSlug(g: GameState): string {
  const ar = g.archery!;
  return g.playersPublic[ar.playerIdx].slug;
}

// The client only ever sends where it aimed and how long it charged the
// shot — the wind that bends the shot and the resulting impact are both
// computed here, from the wind already on record for this arrow, rather
// than trusted from the client the way golf's full collision physics are
// (see simulateShot's own comment). Archery's physics are cheap enough to
// redo, and a self-reported score would be a direct incentive to cheat in
// a game about who ends up drinking the most.
//
// Each player fires ARCHERY_ARROWS_PER_TURN arrows back to back before the
// turn moves on — a fresh wind is rolled before every single arrow, not
// just every player, so mid-turn there's still real tension between
// consecutive shots.
export function applyArcheryShot(g: GameState, slug: string, rawAim: ArcheryPoint, rawPower: number): void {
  const ar = g.archery!;
  const player = g.playersPublic.find((p) => p.slug === slug)!;
  const aim = clampToTarget(rawAim);
  const power = Math.max(0, Math.min(1, rawPower));
  const wind = ar.wind;
  const { impact, path, distance } = simulateArcheryShot(aim, wind, power, arrowDispersion(power));
  const points = archeryScoreForDistance(distance);

  const shot: ArcheryShotRecord = { slug, name: player.name, arrowNumber: ar.arrowNumber, wind, aim, power, impact, path, points };
  ar.shots = [...ar.shots, shot];

  if (ar.arrowNumber < ARCHERY_ARROWS_PER_TURN) {
    // Same player, next arrow — only the wind changes.
    ar.arrowNumber += 1;
    ar.wind = randomWind();
    return;
  }

  // That was this player's last arrow.
  if (ar.turnPointer + 1 >= ar.turnOrder.length) {
    resolveArcheryRound(g);
    return;
  }

  ar.turnPointer += 1;
  ar.playerIdx = ar.turnOrder[ar.turnPointer];
  ar.arrowNumber = 1;
  ar.wind = randomWind();
}

// Ranked by total score (sum of a player's ARCHERY_ARROWS_PER_TURN arrows)
// descending — unlike golf's ascending strokes, here the HIGHEST total
// wins. Dense rank: exact-score ties share a rank and the next distinct
// value takes the very next rank, no gaps — scores are whole points so
// ties are exact equality, no tolerance needed (unlike distance, which was
// a continuous float). Gulps are rank - 1, so the top score(s) drink
// nothing, and if everyone ties, everyone is rank 1 and nobody drinks.
function resolveArcheryRound(g: GameState): void {
  const ar = g.archery!;
  const totals = new Map<string, { name: string; totalScore: number }>();
  ar.shots.forEach((shot) => {
    const entry = totals.get(shot.slug) ?? { name: shot.name, totalScore: 0 };
    entry.totalScore += shot.points;
    totals.set(shot.slug, entry);
  });

  const sorted = [...totals.entries()].sort((a, b) => b[1].totalScore - a[1].totalScore);

  const ranking: ArcheryRankingEntry[] = [];
  let rank = 0;
  let lastScore: number | null = null;
  sorted.forEach(([slug, { name, totalScore }]) => {
    if (lastScore === null || totalScore !== lastScore) {
      rank += 1;
      lastScore = totalScore;
    }
    ranking.push({ slug, name, totalScore, rank, gulps: rank - 1 });
  });

  // On boit selon l'écart avec le meilleur total : 1 gorgée par tranche de
  // 6 points (arrondi au-dessus), 5 max.
  const best = sorted[0]?.[1].totalScore ?? 0;
  ranking.forEach((entry) => {
    entry.gulps = Math.min(5, Math.ceil((best - entry.totalScore) / 6));
    drink(g, entry.slug, entry.gulps, `${best - entry.totalScore} points de moins que le meilleur`);
  });

  g.lastResults = { type: "archery", archeryRanking: ranking };
  g.phase = "showdown";
}
