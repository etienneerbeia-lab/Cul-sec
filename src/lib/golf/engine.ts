import type { GameState, GolfPoint, GolfShotRecord } from "../game/types";
import { GOLF_COURSES } from "./courses";

const GOLF_LOSER_GULPS = 2;

function orderAllPlayers(g: GameState): number[] {
  const n = g.playersPublic.length;
  const order: number[] = [];
  for (let i = 0; i < n; i++) order.push((g.startIndex + i) % n);
  return order;
}

export function startGolfRound(g: GameState): void {
  const course = GOLF_COURSES[0];
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
  };
  g.phase = "golf";
}

export function golfActiveSlug(g: GameState): string {
  const gl = g.golf!;
  return g.playersPublic[gl.playerIdx].slug;
}

// Records a shot the active player's own client already simulated (see
// lib/golf/physics.ts — deterministic, so there's nothing to redo
// server-side) and either resolves the round if it sank, or hands the
// turn to the next player around the table. turnPointer only ever
// increases and wraps via modulo, since — unlike every other turn-based
// mini-game here — this one keeps cycling through players (each shooting
// from wherever their own ball stopped last time) until someone wins.
export function applyGolfShot(g: GameState, slug: string, path: GolfPoint[], finalPos: GolfPoint, sunk: boolean): void {
  const gl = g.golf!;
  const player = g.playersPublic.find((p) => p.slug === slug)!;
  const strokeNumber = (gl.strokeCounts[slug] ?? 0) + 1;
  gl.strokeCounts[slug] = strokeNumber;
  gl.positions[slug] = finalPos;

  const shot: GolfShotRecord = { slug, name: player.name, strokeNumber, path, finalPos, sunk };
  gl.shots = [...gl.shots, shot];

  if (sunk) {
    gl.winnerSlug = slug;
    resolveGolfRound(g, slug, strokeNumber);
    return;
  }

  gl.turnPointer += 1;
  gl.playerIdx = gl.turnOrder[gl.turnPointer % gl.turnOrder.length];
}

function resolveGolfRound(g: GameState, winnerSlug: string, strokes: number): void {
  const winner = g.playersPublic.find((p) => p.slug === winnerSlug)!;
  const losers = g.playersPublic.filter((p) => p.slug !== winnerSlug);
  losers.forEach((p) => {
    p.gulpsTotal += GOLF_LOSER_GULPS;
  });

  g.lastResults = {
    type: "golf",
    winner: winner.name,
    losers: losers.map((p) => p.name),
    golfStrokes: strokes,
  };
  g.phase = "showdown";
}
