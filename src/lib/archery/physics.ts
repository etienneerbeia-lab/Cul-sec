import type { ArcheryPoint, ArcheryWind, ArcheryWindDirection } from "../game/types";

// Coordinate space is arbitrary target units, not pixels — the screen
// scales the whole board to fit, same convention as lib/golf/physics.ts.
// The board is a square target area with a short "runway" below it where
// the flight animation starts, off the visible rings, so an incoming
// arrow reads as flying in from the archer rather than popping into place.
export const ARCHERY_TARGET_SIZE = 340;
export const ARCHERY_CENTER: ArcheryPoint = { x: ARCHERY_TARGET_SIZE / 2, y: ARCHERY_TARGET_SIZE / 2 };
export const ARCHERY_OUTER_RADIUS = 150;
export const ARCHERY_RUNWAY_HEIGHT = 80;
export const ARCHERY_BOARD_HEIGHT = ARCHERY_TARGET_SIZE + ARCHERY_RUNWAY_HEIGHT;
export const ARCHERY_LAUNCH_POINT: ArcheryPoint = { x: ARCHERY_CENTER.x, y: ARCHERY_BOARD_HEIGHT - 15 };

// Outer -> inner, purely decorative (scoring is continuous distance to
// center, not which band an arrow lands in).
export const ARCHERY_RINGS: { r: number; cls: string }[] = [
  { r: 150, cls: "outer" },
  { r: 120, cls: "second" },
  { r: 90, cls: "third" },
  { r: 60, cls: "fourth" },
  { r: 30, cls: "bullseye" },
];

// How far off the aim point the wind can push an arrow at full (1.0)
// intensity — big enough that a dead-center aim can end up clear outside
// the outer ring, so ignoring the wind is never safe.
export const ARCHERY_MAX_DEVIATION = 130;
export const ARCHERY_PATH_SAMPLES = 24;

// Shots within this many units of each other count as tied for ranking —
// just above float/rounding noise, not a real gameplay margin, so it only
// ever catches genuine near-exact coincidences (see resolveArcheryRound's
// own comment in lib/archery/engine.ts for why chaining this is safe at
// such a small value).
export const ARCHERY_TIE_TOLERANCE = 0.5;

const WIND_VECTORS: Record<ArcheryWindDirection, ArcheryPoint> = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  E: { x: 1, y: 0 },
  W: { x: -1, y: 0 },
  NE: { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
  NW: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
  SE: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  SW: { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
};

// Degrees to rotate a rightward-pointing arrow glyph so it reads as "the
// wind blows this way" in screen space (y grows downward).
export const ARCHERY_WIND_ANGLES: Record<ArcheryWindDirection, number> = {
  E: 0,
  SE: 45,
  S: 90,
  SW: 135,
  W: 180,
  NW: 225,
  N: 270,
  NE: 315,
};

export const ARCHERY_WIND_LABELS: Record<ArcheryWindDirection, string> = {
  N: "vers le haut",
  S: "vers le bas",
  E: "vers la droite",
  W: "vers la gauche",
  NE: "vers le haut à droite",
  NW: "vers le haut à gauche",
  SE: "vers le bas à droite",
  SW: "vers le bas à gauche",
};

export function windIntensityLabel(intensity: number): string {
  if (intensity < 0.35) return "Faible";
  if (intensity < 0.65) return "Modéré";
  if (intensity < 0.85) return "Fort";
  return "Très fort";
}

// Server-generated, same as every other random draw in the app (dice
// rolls, card shuffles) — never left to the client to pick. Intensity is
// never quite zero: a dead-calm shot would make the wind indicator pure
// decoration for that turn, and the whole point is that it's always a
// real read.
export function randomWind(): ArcheryWind {
  const directions = Object.keys(WIND_VECTORS) as ArcheryWindDirection[];
  const direction = directions[Math.floor(Math.random() * directions.length)];
  const intensity = Math.round((0.15 + Math.random() * 0.85) * 100) / 100;
  return { direction, intensity };
}

export function clampToTarget(p: ArcheryPoint): ArcheryPoint {
  return {
    x: Math.max(0, Math.min(ARCHERY_TARGET_SIZE, p.x)),
    y: Math.max(0, Math.min(ARCHERY_TARGET_SIZE, p.y)),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export interface ArcheryShotResult {
  impact: ArcheryPoint;
  path: ArcheryPoint[];
  distance: number;
}

// Deterministic given (aim, wind) — computed server-side (see
// applyArcheryShot) from the aim the client submitted and the wind
// already on record for this shot, then published as-is so every client
// just replays the same flight instead of resimulating it.
export function simulateArcheryShot(aim: ArcheryPoint, wind: ArcheryWind): ArcheryShotResult {
  const dir = WIND_VECTORS[wind.direction];
  const deviation = { x: dir.x * wind.intensity * ARCHERY_MAX_DEVIATION, y: dir.y * wind.intensity * ARCHERY_MAX_DEVIATION };
  const impact = clampToTarget({ x: aim.x + deviation.x, y: aim.y + deviation.y });

  // The flight drifts progressively off the aimed line as the wind pushes
  // it — starts true from the launch point, ends at the actual impact —
  // rather than jumping straight there, so the deviation reads as wind
  // acting on the arrow instead of the aim just having been wrong.
  const path: ArcheryPoint[] = [];
  for (let i = 0; i <= ARCHERY_PATH_SAMPLES; i++) {
    const t = i / ARCHERY_PATH_SAMPLES;
    const eased = t * t;
    const x = ARCHERY_LAUNCH_POINT.x + (aim.x - ARCHERY_LAUNCH_POINT.x) * t + deviation.x * eased;
    const y = ARCHERY_LAUNCH_POINT.y + (aim.y - ARCHERY_LAUNCH_POINT.y) * t + deviation.y * eased;
    path.push({ x: round1(x), y: round1(y) });
  }
  path[path.length - 1] = { x: round1(impact.x), y: round1(impact.y) };

  const distance = round1(Math.hypot(impact.x - ARCHERY_CENTER.x, impact.y - ARCHERY_CENTER.y));
  return { impact, path, distance };
}
