import type { ArcheryPoint, ArcheryWind, ArcheryWindDirection } from "../game/types";

// Coordinate space is arbitrary target units, not pixels — the screen
// scales the whole board to fit.
// The board is a square target area with a short "runway" below it where
// the flight animation starts, off the visible rings, so an incoming
// arrow reads as flying in from the archer rather than popping into place.
export const ARCHERY_TARGET_SIZE = 340;
export const ARCHERY_CENTER: ArcheryPoint = { x: ARCHERY_TARGET_SIZE / 2, y: ARCHERY_TARGET_SIZE / 2 };
export const ARCHERY_OUTER_RADIUS = 150;
export const ARCHERY_RUNWAY_HEIGHT = 80;
export const ARCHERY_BOARD_HEIGHT = ARCHERY_TARGET_SIZE + ARCHERY_RUNWAY_HEIGHT;
export const ARCHERY_LAUNCH_POINT: ArcheryPoint = { x: ARCHERY_CENTER.x, y: ARCHERY_BOARD_HEIGHT - 15 };

// Outer -> inner, purely decorative — scoring (see archeryScoreForDistance
// below) is a continuous falloff from ARCHERY_OUTER_RADIUS, not which band
// an arrow visually lands in, but these still line up with 2-point steps
// (10/8/6/4/2) at each ring's radius for a sane-looking target.
// 10 anneaux, couleurs d'une cible officielle (blanc, noir, bleu, rouge, or).
export const ARCHERY_RINGS: { r: number; cls: string }[] = Array.from({ length: 10 }, (_, i) => ({
  r: 150 - i * 15,
  cls: ["white", "white", "black", "black", "blue", "blue", "red", "red", "gold", "gold"][i] + (i % 2 ? " inner" : ""),
}));

// How far off the aim point the wind can push an arrow at full (1.0)
// intensity — big enough that a dead-center aim can end up clear outside
// the outer ring, so ignoring the wind is never safe.
export const ARCHERY_MAX_DEVIATION = 130;
export const ARCHERY_PATH_SAMPLES = 24;

export const WIND_VECTORS: Record<ArcheryWindDirection, ArcheryPoint> = {
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

// Deterministic given (aim, wind, power) — computed server-side (see
// applyArcheryShot) from what the client submitted and the wind already
// on record for this shot, then published as-is so every client just
// replays the same flight instead of resimulating it.
//
// `power` (0..1, from however long the player held the shot charging —
// see ArcheryScreen's own comment) scales how far toward `aim` the arrow
// actually travels before it's spent — at power 1 it reaches `aim`
// exactly (before wind); a weaker charge falls short, landing short of
// the target along the aim line. Wind deviation scales with power too: a
// shot that barely leaves the bow spends less time in flight, so it
// barely drifts either — it just plops down short and close to true,
// still a bad score, but for a different reason than a full-power shot
// the wind carried wide.
export function simulateArcheryShot(
  aim: ArcheryPoint,
  wind: ArcheryWind,
  power: number,
  dispersion: ArcheryPoint = { x: 0, y: 0 }
): ArcheryShotResult {
  const p = Math.max(0, Math.min(1, power));
  const drawnAim = {
    x: ARCHERY_LAUNCH_POINT.x + (aim.x - ARCHERY_LAUNCH_POINT.x) * p,
    y: ARCHERY_LAUNCH_POINT.y + (aim.y - ARCHERY_LAUNCH_POINT.y) * p,
  };
  const dir = WIND_VECTORS[wind.direction];
  const deviation = {
    x: dir.x * wind.intensity * ARCHERY_MAX_DEVIATION * p,
    y: dir.y * wind.intensity * ARCHERY_MAX_DEVIATION * p,
  };
  const impact = clampToTarget({
    x: drawnAim.x + deviation.x + dispersion.x,
    y: drawnAim.y + deviation.y + dispersion.y,
  });

  // The flight drifts progressively off the drawn line as the wind pushes
  // it — starts true from the launch point, ends at the actual impact —
  // rather than jumping straight there, so the deviation reads as wind
  // acting on the arrow instead of the aim just having been wrong.
  const path: ArcheryPoint[] = [];
  for (let i = 0; i <= ARCHERY_PATH_SAMPLES; i++) {
    const t = i / ARCHERY_PATH_SAMPLES;
    const eased = t * t;
    const x = ARCHERY_LAUNCH_POINT.x + (drawnAim.x - ARCHERY_LAUNCH_POINT.x) * t + (deviation.x + dispersion.x) * eased;
    const y = ARCHERY_LAUNCH_POINT.y + (drawnAim.y - ARCHERY_LAUNCH_POINT.y) * t + (deviation.y + dispersion.y) * eased;
    path.push({ x: round1(x), y: round1(y) });
  }
  path[path.length - 1] = { x: round1(impact.x), y: round1(impact.y) };

  const distance = round1(Math.hypot(impact.x - ARCHERY_CENTER.x, impact.y - ARCHERY_CENTER.y));
  return { impact, path, distance };
}

// Continuous falloff from 10 (dead center) to 0 (at or beyond the outer
// ring) — smoother than scoring by which discrete ring the impact falls
// in, but still lines up with ARCHERY_RINGS' radii at each whole-point
// boundary. Never negative, never above 10.
// Comme une vraie cible : 10 anneaux de même largeur, 10 points au centre,
// 1 point sur l'anneau extérieur, 0 en dehors.
export function archeryScoreForDistance(distance: number): number {
  if (distance >= ARCHERY_OUTER_RADIUS) return 0;
  return 10 - Math.floor(distance / (ARCHERY_OUTER_RADIUS / 10));
}

// Dispersion naturelle d'une flèche (tension de la corde, lâcher) : un
// petit écart aléatoire, plus grand quand l'arc n'est pas bandé à fond.
export function arrowDispersion(power: number): ArcheryPoint {
  const sigma = 5 + (1 - Math.max(0, Math.min(1, power))) * 10;
  const gauss = () => {
    const u = 1 - Math.random();
    const v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return { x: gauss() * sigma, y: gauss() * sigma };
}
