import type { GolfCourse } from "../game/types";

// Coordinate space is arbitrary course units, not pixels — the screen
// scales the whole course (width x height) to fit, so these numbers only
// need to be internally consistent with the physics constants in
// physics.ts (BALL_RADIUS, MAX_PULL, etc., all in the same units).
//
// Roughly ordered easy -> hard below, though pickCourse in engine.ts
// draws at random (just avoiding an immediate repeat) — there's no
// enforced progression, same as every other mini-game's round selection.
export const GOLF_COURSES: GolfCourse[] = [
  {
    id: "chicane-1",
    label: "Le Chicane",
    width: 340,
    height: 620,
    start: { x: 170, y: 580 },
    hole: { x: 170, y: 60 },
    holeRadius: 14,
    ballRadius: 8,
    // Two walls jutting from opposite sides, offset in height, forcing a
    // slight S-curve between the tee and the hole.
    walls: [
      { x1: 0, y1: 380, x2: 220, y2: 380 },
      { x1: 120, y1: 220, x2: 340, y2: 220 },
    ],
    obstacles: [],
    sandZones: [],
    waterZones: [],
    teleporters: [],
    slopes: [],
  },
  {
    id: "foret-1",
    label: "La Forêt",
    width: 340,
    height: 620,
    start: { x: 170, y: 580 },
    hole: { x: 170, y: 60 },
    holeRadius: 14,
    ballRadius: 8,
    walls: [],
    // A loose slalom of trees between tee and hole — no walls needed,
    // weaving around obstacles that stop the ball dead on contact is the
    // whole challenge.
    obstacles: [
      { kind: "tree", x: 100, y: 470, radius: 22 },
      { kind: "tree", x: 250, y: 430, radius: 18 },
      { kind: "tree", x: 190, y: 340, radius: 24 },
      { kind: "tree", x: 80, y: 260, radius: 18 },
      { kind: "tree", x: 260, y: 200, radius: 22 },
      { kind: "tree", x: 150, y: 140, radius: 16 },
    ],
    sandZones: [],
    waterZones: [],
    teleporters: [],
    slopes: [],
  },
  {
    id: "bunker-1",
    label: "Le Bunker",
    width: 340,
    height: 620,
    start: { x: 170, y: 580 },
    hole: { x: 170, y: 60 },
    holeRadius: 14,
    ballRadius: 8,
    // A gate of two bumpers funnels (and bounces) the ball toward a wide
    // sand band it has to cross or skirt around, then a smaller bunker
    // guards the green itself right before the hole.
    walls: [],
    obstacles: [
      { kind: "bumper", x: 55, y: 470, radius: 20 },
      { kind: "bumper", x: 285, y: 470, radius: 20 },
    ],
    sandZones: [
      { x: 170, y: 350, radius: 95 },
      { x: 170, y: 140, radius: 55 },
    ],
    waterZones: [],
    teleporters: [],
    slopes: [],
  },
  {
    id: "etang-1",
    label: "L'Étang",
    width: 340,
    height: 620,
    start: { x: 170, y: 580 },
    hole: { x: 170, y: 60 },
    holeRadius: 14,
    ballRadius: 8,
    // A pond dead center the ball must be routed around — falling in
    // sends it back to where it was before the shot — flanked by
    // pinball bumpers that make a too-direct line risky.
    walls: [],
    obstacles: [
      { kind: "bumper", x: 90, y: 420, radius: 18 },
      { kind: "bumper", x: 250, y: 420, radius: 18 },
      { kind: "bumper", x: 170, y: 190, radius: 20 },
    ],
    sandZones: [],
    waterZones: [{ x: 170, y: 320, radius: 85 }],
    teleporters: [],
    slopes: [],
  },
  {
    id: "labyrinthe-1",
    label: "Le Labyrinthe",
    width: 340,
    height: 620,
    start: { x: 170, y: 580 },
    hole: { x: 170, y: 60 },
    holeRadius: 14,
    ballRadius: 8,
    // A triple chicane — the "long way" — with a one-shot teleporter
    // pair shortcutting the middle leg for whoever finds it, and a slope
    // curving the final approach to the hole. The hardest course: every
    // mechanic except sand/water shows up at once.
    walls: [
      { x1: 0, y1: 480, x2: 220, y2: 480 },
      { x1: 120, y1: 340, x2: 340, y2: 340 },
      { x1: 0, y1: 200, x2: 220, y2: 200 },
    ],
    obstacles: [],
    sandZones: [],
    waterZones: [],
    teleporters: [
      { x: 280, y: 460, radius: 18, targetX: 280, targetY: 220 },
      { x: 280, y: 220, radius: 18, targetX: 280, targetY: 460 },
    ],
    slopes: [{ x: 170, y: 130, radius: 70, forceX: 55, forceY: 0 }],
  },
];

export function golfCourseById(id: string): GolfCourse {
  const c = GOLF_COURSES.find((course) => course.id === id);
  if (!c) throw new Error(`Unknown golf course: ${id}`);
  return c;
}
