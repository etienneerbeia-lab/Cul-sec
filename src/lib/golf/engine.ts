import type { GameState, GolfPoint, GolfRankingEntry, GolfShotRecord } from "../game/types";
import { GOLF_COURSES } from "./courses";

function orderAllPlayers(g: GameState): number[] {
  const n = g.playersPublic.length;
  const order: number[] = [];
  for (let i = 0; i < n; i++) order.push((g.startIndex + i) % n);
  return order;
}

// Avoids replaying the same course twice in a row when there's more than
// one to pick from — same "don't repeat the last one" idea as the
// mini-game selector itself (setupRoundType), just scoped to golf courses.
function pickCourse(g: GameState) {
  const lastId = g.golf?.courseId;
  const pool = GOLF_COURSES.length > 1 ? GOLF_COURSES.filter((c) => c.id !== lastId) : GOLF_COURSES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function startGolfRound(g: GameState): void {
  const course = pickCourse(g);
  const order = orderAllPlayers(g);
  const positions: Record<string, GolfPoint> = {};
  const strokeCounts: Record<string, number> = {};
  g.playersPublic.forEach((p) => {
    positions[p.slug] = { x: course.start.x, y: course.start.y };
    strokeCounts[p.slug] = 0;
  });
  g.golf = {
    courseId: course.id,
    turnOrder: order,
    turnPointer: 0,
    playerIdx: order[0],
    positions,
    strokeCounts,
    shots: [],
    finishedSlugs: [],
  };
  g.phase = "golf";
}

export function golfActiveSlug(g: GameState): string {
  const gl = g.golf!;
  return g.playersPublic[gl.playerIdx].slug;
}

// Moves the turn to the next player around the table who hasn't sunk
// their ball yet — a finished player keeps their final position/stroke
// count on the board but is skipped forever after, same idea as folded
// players in the card rounds. Only called once the caller has already
// confirmed at least one player is still in play, so this always finds
// someone and terminates within one lap.
function advanceToNextActivePlayer(g: GameState): void {
  const gl = g.golf!;
  const n = gl.turnOrder.length;
  for (let i = 1; i <= n; i++) {
    const idx = gl.turnOrder[(gl.turnPointer + i) % n];
    if (!gl.finishedSlugs.includes(g.playersPublic[idx].slug)) {
      gl.turnPointer = (gl.turnPointer + i) % n;
      gl.playerIdx = idx;
      return;
    }
  }
}

// Records a shot the active player's own client already simulated (see
// lib/golf/physics.ts — deterministic, so there's nothing to redo
// server-side). Sinking it doesn't end the round by itself — everyone
// plays their own hole out, and the final ranking (see resolveGolfRound)
// is by stroke count, not by who finished first, so a sunk ball just
// marks that player done and hands the turn to whoever's still playing.
export function applyGolfShot(g: GameState, slug: string, path: GolfPoint[], finalPos: GolfPoint, sunk: boolean): void {
  const gl = g.golf!;
  const player = g.playersPublic.find((p) => p.slug === slug)!;
  const strokeNumber = (gl.strokeCounts[slug] ?? 0) + 1;
  gl.strokeCounts[slug] = strokeNumber;
  gl.positions[slug] = finalPos;

  const shot: GolfShotRecord = { slug, name: player.name, strokeNumber, path, finalPos, sunk };
  gl.shots = [...gl.shots, shot];

  if (sunk) {
    gl.finishedSlugs = [...gl.finishedSlugs, slug];
  }

  if (gl.finishedSlugs.length >= g.playersPublic.length) {
    resolveGolfRound(g);
    return;
  }

  advanceToNextActivePlayer(g);
}

// Ranked by strokes ascending, dense (tied stroke counts share a rank,
// the next distinct value takes the very next rank — no gaps). Gulps are
// rank - 1, so a clean 1st place drinks nothing and, in the extreme case
// where everyone ties, everyone is 1st and nobody drinks.
function resolveGolfRound(g: GameState): void {
  const gl = g.golf!;
  const sorted = g.playersPublic
    .map((p) => ({ slug: p.slug, name: p.name, strokes: gl.strokeCounts[p.slug] ?? 0 }))
    .sort((a, b) => a.strokes - b.strokes);

  const ranking: GolfRankingEntry[] = [];
  let rank = 0;
  let lastStrokes: number | null = null;
  sorted.forEach((entry) => {
    if (lastStrokes === null || entry.strokes !== lastStrokes) {
      rank += 1;
      lastStrokes = entry.strokes;
    }
    ranking.push({ slug: entry.slug, name: entry.name, strokes: entry.strokes, rank, gulps: rank - 1 });
  });

  ranking.forEach((entry) => {
    if (entry.gulps > 0) {
      g.playersPublic.find((p) => p.slug === entry.slug)!.gulpsTotal += entry.gulps;
    }
  });

  g.lastResults = { type: "golf", golfRanking: ranking };
  g.phase = "showdown";
}
