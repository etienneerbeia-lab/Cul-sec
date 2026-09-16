import type { GolfCourse, GolfPoint, GolfWall } from "../game/types";

// Fixed-step simulation — the client runs this once per shot and
// publishes the resulting path as-is (see GolfShotRecord's own comment),
// so every constant here only has to be internally consistent, not tuned
// against a server-side counterpart.
export const GOLF_STEP_DT = 1 / 60;
const MAX_STEPS = 6 * 60; // 6 simulated seconds is plenty for these course sizes
const DRAG_PER_SEC = 1.15; // multiplicative velocity decay per second
const STOP_SPEED = 8; // units/s — below this the ball is considered at rest
const BOUNCE_RESTITUTION = 0.82; // energy kept (as speed) after bouncing off a wall
const SINK_SPEED_THRESHOLD = 130; // units/s — too fast over the hole just lips out

export const GOLF_MAX_PULL = 90; // course units — how far back the slingshot drag maxes out
export const GOLF_MAX_SPEED = 220; // units/s at full pull

function len(v: GolfPoint): number {
  return Math.hypot(v.x, v.y);
}

function closestPointOnSegment(p: GolfPoint, a: GolfPoint, b: GolfPoint): GolfPoint {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) return a;
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + abx * t, y: a.y + aby * t };
}

function boundaryWalls(course: GolfCourse): GolfWall[] {
  const { width: w, height: h } = course;
  return [
    { x1: 0, y1: 0, x2: w, y2: 0 },
    { x1: w, y1: 0, x2: w, y2: h },
    { x1: w, y1: h, x2: 0, y2: h },
    { x1: 0, y1: h, x2: 0, y2: 0 },
  ];
}

export interface GolfShotResult {
  path: GolfPoint[];
  finalPos: GolfPoint;
  sunk: boolean;
}

// Deterministic given (course, startPos, velocity) — same inputs always
// produce the same path, which is what lets one client compute a shot and
// everyone else just replay the recorded result instead of resimulating.
export function simulateShot(course: GolfCourse, startPos: GolfPoint, velocity: GolfPoint): GolfShotResult {
  const walls = [...course.walls, ...boundaryWalls(course)];
  let pos: GolfPoint = { x: startPos.x, y: startPos.y };
  let v: GolfPoint = { x: velocity.x, y: velocity.y };
  const path: GolfPoint[] = [{ x: round1(pos.x), y: round1(pos.y) }];
  let sunk = false;

  for (let step = 0; step < MAX_STEPS; step++) {
    v = { x: v.x * (1 - DRAG_PER_SEC * GOLF_STEP_DT), y: v.y * (1 - DRAG_PER_SEC * GOLF_STEP_DT) };
    const speed = len(v);
    if (speed < STOP_SPEED) {
      v = { x: 0, y: 0 };
      path.push({ x: round1(pos.x), y: round1(pos.y) });
      break;
    }

    let next: GolfPoint = { x: pos.x + v.x * GOLF_STEP_DT, y: pos.y + v.y * GOLF_STEP_DT };

    // At most one bounce resolved per step — safe at this speed/dt ratio
    // (see this module's top comment) and simple enough not to need a
    // proper continuous-collision sweep for two short wall segments.
    for (const wall of walls) {
      const closest = closestPointOnSegment(next, { x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 });
      const dx = next.x - closest.x;
      const dy = next.y - closest.y;
      const dist = Math.hypot(dx, dy);
      if (dist < course.ballRadius) {
        const nx = dist > 0 ? dx / dist : 1;
        const ny = dist > 0 ? dy / dist : 0;
        const dot = v.x * nx + v.y * ny;
        v = { x: (v.x - 2 * dot * nx) * BOUNCE_RESTITUTION, y: (v.y - 2 * dot * ny) * BOUNCE_RESTITUTION };
        next = { x: closest.x + nx * course.ballRadius, y: closest.y + ny * course.ballRadius };
        break;
      }
    }

    pos = next;
    path.push({ x: round1(pos.x), y: round1(pos.y) });

    const distToHole = Math.hypot(pos.x - course.hole.x, pos.y - course.hole.y);
    if (distToHole < course.holeRadius && len(v) < SINK_SPEED_THRESHOLD) {
      sunk = true;
      break;
    }
  }

  return { path, finalPos: { x: round1(pos.x), y: round1(pos.y) }, sunk };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Converts a slingshot drag (pointer position minus ball position, in
// course units) into the shot's initial velocity — direction is the
// OPPOSITE of the drag (pull back to send it forward), magnitude scales
// with drag length up to GOLF_MAX_PULL.
export function velocityFromPull(pull: GolfPoint): GolfPoint {
  const pullLen = Math.min(len(pull), GOLF_MAX_PULL);
  if (pullLen < 1) return { x: 0, y: 0 };
  const power = pullLen / GOLF_MAX_PULL;
  const dirX = -pull.x / len(pull);
  const dirY = -pull.y / len(pull);
  return { x: dirX * GOLF_MAX_SPEED * power, y: dirY * GOLF_MAX_SPEED * power };
}
