import type { GolfCourse, GolfPoint, GolfStruckBallResult, GolfWall } from "../game/types";

// Fixed-step simulation — the client runs this once per shot and
// publishes the resulting path as-is (see GolfShotRecord's own comment),
// so every constant here only has to be internally consistent, not tuned
// against a server-side counterpart.
export const GOLF_STEP_DT = 1 / 60;
const MAX_STEPS = 8 * 60; // 8 simulated seconds — bigger courses, faster balls
const DRAG_PER_SEC = 1.15; // multiplicative velocity decay per second, on grass
const SAND_DRAG_PER_SEC = 7; // much stronger decay while the ball's center is over sand
const STOP_SPEED = 8; // units/s — below this the ball is considered at rest
const BOUNCE_RESTITUTION = 0.82; // energy kept (as speed) after bouncing off a wall/bumper/ball
const SINK_SPEED_THRESHOLD = 150; // units/s — too fast over the hole just lips out
const WIND_STRENGTH = 0.6; // acceleration (units/s^2) per unit of entry speed while inside a wind zone

export const GOLF_MAX_PULL = 110; // course units — how far back the slingshot drag maxes out
export const GOLF_MAX_SPEED = 340; // units/s at full pull

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
  wentInWater: boolean;
  // Index into course.obstacles of the tree this shot smashed into, if any.
  destroyedObstacle?: number;
  // Every OTHER player's ball this shot's chain of collisions knocked into
  // motion — empty when nothing got hit, the common case.
  struckBalls: GolfStruckBallResult[];
}

// An other player's ball, wherever it's currently resting — the input side
// of GolfStruckBallResult.
export interface GolfBallInput {
  slug: string;
  pos: GolfPoint;
}

type BodyStatus = "active" | "resting" | "sunk" | "watered";

interface Body {
  slug: string | null; // null = the shooter's own ball
  pos: GolfPoint;
  v: GolfPoint;
  path: GolfPoint[];
  status: BodyStatus;
  windMagnitudes: (number | undefined)[];
  teleported: boolean;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Deterministic given (course, startPos, velocity, destroyedObstacles,
// otherBalls) — same inputs always produce the same outcome for every ball
// involved, which is what lets one client compute a whole shot (including
// any chain of balls it knocks into along the way) and everyone else just
// replay the recorded result instead of resimulating. destroyedObstacles is
// the room's already-broken tree indices (see GolfRoundState) — those
// obstacles are skipped entirely, as if they were never there. otherBalls
// is every OTHER player's ball still on the course (skip anyone already
// finished) at wherever it's currently resting.
export function simulateShot(
  course: GolfCourse,
  startPos: GolfPoint,
  velocity: GolfPoint,
  destroyedObstacles: number[] = [],
  otherBalls: GolfBallInput[] = []
): GolfShotResult {
  const destroyedSet = new Set(destroyedObstacles);
  const walls = [...course.walls, ...boundaryWalls(course)];
  // A tree hard-stops whichever ball hits it immediately, so at most one
  // gets reported here even though destroyedSet (and thus the physics
  // itself) tracks every tree destroyed this shot, chain included.
  let destroyedObstacle: number | undefined;

  const shooter: Body = {
    slug: null,
    pos: { x: startPos.x, y: startPos.y },
    v: { x: velocity.x, y: velocity.y },
    path: [{ x: round1(startPos.x), y: round1(startPos.y) }],
    status: "active",
    windMagnitudes: course.windZones.map(() => undefined),
    teleported: false,
  };
  const others: Body[] = otherBalls.map((b) => ({
    slug: b.slug,
    pos: { x: b.pos.x, y: b.pos.y },
    v: { x: 0, y: 0 },
    path: [{ x: round1(b.pos.x), y: round1(b.pos.y) }],
    status: "resting",
    windMagnitudes: course.windZones.map(() => undefined),
    teleported: false,
  }));
  const bodies: Body[] = [shooter, ...others];

  function stepBody(body: Body): void {
    // Resting balls stay exactly where they are until a collision wakes
    // them (see resolveBallCollisions) — sunk/watered balls are off the
    // field for the rest of this shot, nothing left to simulate.
    if (body.status !== "active") return;

    const inSand = course.sandZones.some((z) => Math.hypot(body.pos.x - z.x, body.pos.y - z.y) < z.radius);
    const drag = inSand ? SAND_DRAG_PER_SEC : DRAG_PER_SEC;
    body.v = { x: body.v.x * (1 - drag * GOLF_STEP_DT), y: body.v.y * (1 - drag * GOLF_STEP_DT) };

    course.windZones.forEach((zone, i) => {
      const inside =
        body.pos.x >= zone.x && body.pos.x <= zone.x + zone.width && body.pos.y >= zone.y && body.pos.y <= zone.y + zone.height;
      if (!inside) return;
      if (body.windMagnitudes[i] === undefined) body.windMagnitudes[i] = len(body.v) * WIND_STRENGTH;
      const mag = body.windMagnitudes[i]!;
      const dirLen = Math.hypot(zone.dirX, zone.dirY) || 1;
      body.v = {
        x: body.v.x + (zone.dirX / dirLen) * mag * GOLF_STEP_DT,
        y: body.v.y + (zone.dirY / dirLen) * mag * GOLF_STEP_DT,
      };
    });

    const speed = len(body.v);
    if (speed < STOP_SPEED) {
      body.v = { x: 0, y: 0 };
      body.status = "resting";
      body.path.push({ x: round1(body.pos.x), y: round1(body.pos.y) });
      return;
    }

    let next: GolfPoint = { x: body.pos.x + body.v.x * GOLF_STEP_DT, y: body.pos.y + body.v.y * GOLF_STEP_DT };
    let stoppedDead = false;

    // At most one collision resolved per step, walls first then round
    // obstacles — safe at this speed/dt ratio and simple enough not to
    // need a proper continuous-collision sweep. Ball-vs-ball collisions
    // are resolved separately, once per step, after every body has moved
    // (see resolveBallCollisions).
    let handled = false;
    for (const wall of walls) {
      const closest = closestPointOnSegment(next, { x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 });
      const dx = next.x - closest.x;
      const dy = next.y - closest.y;
      const dist = Math.hypot(dx, dy);
      if (dist < course.ballRadius) {
        const nx = dist > 0 ? dx / dist : 1;
        const ny = dist > 0 ? dy / dist : 0;
        const dot = body.v.x * nx + body.v.y * ny;
        body.v = { x: (body.v.x - 2 * dot * nx) * BOUNCE_RESTITUTION, y: (body.v.y - 2 * dot * ny) * BOUNCE_RESTITUTION };
        next = { x: closest.x + nx * course.ballRadius, y: closest.y + ny * course.ballRadius };
        handled = true;
        break;
      }
    }
    if (!handled) {
      for (let oi = 0; oi < course.obstacles.length; oi++) {
        if (destroyedSet.has(oi)) continue;
        const obstacle = course.obstacles[oi];
        const dx = next.x - obstacle.x;
        const dy = next.y - obstacle.y;
        const dist = Math.hypot(dx, dy);
        const minDist = obstacle.radius + course.ballRadius;
        if (dist < minDist) {
          const nx = dist > 0 ? dx / dist : 1;
          const ny = dist > 0 ? dy / dist : 0;
          if (obstacle.kind === "tree") {
            body.v = { x: 0, y: 0 };
            next = { x: obstacle.x + nx * minDist, y: obstacle.y + ny * minDist };
            stoppedDead = true;
            destroyedSet.add(oi);
            if (destroyedObstacle === undefined) destroyedObstacle = oi;
          } else {
            const dot = body.v.x * nx + body.v.y * ny;
            body.v = { x: (body.v.x - 2 * dot * nx) * BOUNCE_RESTITUTION, y: (body.v.y - 2 * dot * ny) * BOUNCE_RESTITUTION };
            next = { x: obstacle.x + nx * minDist, y: obstacle.y + ny * minDist };
          }
          break;
        }
      }
    }

    body.pos = next;
    body.path.push({ x: round1(body.pos.x), y: round1(body.pos.y) });
    if (stoppedDead) {
      body.status = "resting";
      return;
    }

    const distToHole = Math.hypot(body.pos.x - course.hole.x, body.pos.y - course.hole.y);
    if (distToHole < course.holeRadius && len(body.v) < SINK_SPEED_THRESHOLD) {
      body.status = "sunk";
      return;
    }

    const water = course.waterZones.find((z) => Math.hypot(body.pos.x - z.x, body.pos.y - z.y) < z.radius);
    if (water) {
      body.status = "watered";
      return;
    }

    if (!body.teleported) {
      const gate = course.teleporters.find((t) => Math.hypot(body.pos.x - t.x, body.pos.y - t.y) < t.radius);
      if (gate) {
        body.pos = { x: gate.targetX, y: gate.targetY };
        body.path.push({ x: round1(body.pos.x), y: round1(body.pos.y) });
        body.teleported = true;
      }
    }
  }

  // Elastic collision between two equal-mass circles: each ball's velocity
  // component along the line connecting their centers is exchanged with
  // the other's (the classic billiard-ball result), scaled down by the
  // same restitution every other bounce in this engine uses — an
  // "approximate conservation", not a perfectly lossless one. Whichever
  // ball this wakes from "resting" flips to "active" so stepBody starts
  // carrying it through its own drag/obstacles/water/sinking checks next
  // frame, exactly like a real shot — that's what lets a chain of hits
  // ripple from ball to ball within the same simulateShot call.
  function resolveBallCollisions(): void {
    const minDist = course.ballRadius * 2;
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      if (a.status === "sunk" || a.status === "watered") continue;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        if (b.status === "sunk" || b.status === "watered") continue;
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= minDist || dist <= 0) continue;

        const nx = dx / dist;
        const ny = dy / dist;
        const approach = (a.v.x - b.v.x) * nx + (a.v.y - b.v.y) * ny;
        if (approach <= 0) continue; // already separating — nothing to resolve

        const aN = a.v.x * nx + a.v.y * ny;
        const bN = b.v.x * nx + b.v.y * ny;
        const aT = { x: a.v.x - aN * nx, y: a.v.y - aN * ny };
        const bT = { x: b.v.x - bN * nx, y: b.v.y - bN * ny };
        const newAN = bN * BOUNCE_RESTITUTION;
        const newBN = aN * BOUNCE_RESTITUTION;
        a.v = { x: aT.x + newAN * nx, y: aT.y + newAN * ny };
        b.v = { x: bT.x + newBN * nx, y: bT.y + newBN * ny };

        const overlap = (minDist - dist) / 2;
        a.pos = { x: a.pos.x - nx * overlap, y: a.pos.y - ny * overlap };
        b.pos = { x: b.pos.x + nx * overlap, y: b.pos.y + ny * overlap };

        if (a.status === "resting" && len(a.v) >= STOP_SPEED) a.status = "active";
        if (b.status === "resting" && len(b.v) >= STOP_SPEED) b.status = "active";
      }
    }
  }

  for (let step = 0; step < MAX_STEPS; step++) {
    for (const body of bodies) stepBody(body);
    resolveBallCollisions();
    if (!bodies.some((b) => b.status === "active")) break;
  }

  const struckBalls: GolfStruckBallResult[] = others
    .filter((b) => b.path.length > 1) // only balls actually knocked into motion
    .map((b) => ({
      slug: b.slug!,
      path: b.path,
      finalPos: { x: round1(b.pos.x), y: round1(b.pos.y) },
      sunk: b.status === "sunk",
      wentInWater: b.status === "watered",
    }));

  return {
    path: shooter.path,
    finalPos: { x: round1(shooter.pos.x), y: round1(shooter.pos.y) },
    sunk: shooter.status === "sunk",
    wentInWater: shooter.status === "watered",
    destroyedObstacle,
    struckBalls,
  };
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
