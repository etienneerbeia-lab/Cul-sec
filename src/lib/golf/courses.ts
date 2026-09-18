import type { GolfCourse } from "../game/types";

// Coordinate space is arbitrary course units, not pixels — the screen
// scales the whole course (width x height) to fit, so these numbers only
// need to be internally consistent with the physics constants in
// physics.ts (BALL_RADIUS, MAX_PULL, etc., all in the same units).
//
// Every course carries at least one obstacle type — there's no "empty"
// course anymore — and "Le Chaos" is the one that combines every
// mechanic in the game at once. Roughly ordered easy -> hard below,
// though pickCourse in engine.ts draws at random (just avoiding an
// immediate repeat) — there's no enforced progression, same as every
// other mini-game's round selection.
//
// theme/decor are purely cosmetic (see their own comments in types.ts) —
// "prairie" is the open look (grass, trees, loose scenery, classic wavy
// water), "labyrinthe" is the walled/corridor look (wood-fenced walls,
// checkerboard "ice" water) — two courses of each below.
export const GOLF_COURSES: GolfCourse[] = [
  {
    id: "foret-1",
    label: "La Forêt",
    width: 340,
    height: 760,
    start: { x: 170, y: 720 },
    hole: { x: 170, y: 60 },
    holeRadius: 14,
    ballRadius: 8,
    theme: "prairie",
    decor: [
      { kind: "cow", x: 280, y: 660 },
      { kind: "bush", x: 40, y: 560 },
      { kind: "sparkle", x: 300, y: 440 },
      { kind: "bush", x: 300, y: 260 },
      { kind: "tent", x: 45, y: 150 },
    ],
    walls: [],
    // A long slalom of trees between tee and hole — no walls needed,
    // weaving around obstacles that stop the ball dead on contact is the
    // whole challenge. A gentle diamond gust guards the hole itself.
    obstacles: [
      { kind: "tree", x: 100, y: 620, radius: 22 },
      { kind: "tree", x: 250, y: 560, radius: 18 },
      { kind: "tree", x: 190, y: 480, radius: 24 },
      { kind: "tree", x: 80, y: 400, radius: 18 },
      { kind: "tree", x: 260, y: 320, radius: 22 },
      { kind: "tree", x: 120, y: 240, radius: 18 },
      { kind: "tree", x: 230, y: 160, radius: 20 },
      { kind: "tree", x: 150, y: 100, radius: 16 },
    ],
    sandZones: [],
    waterZones: [],
    teleporters: [],
    windZones: [{ x: 130, y: 20, width: 80, height: 80, dirX: 0, dirY: 1, shape: "diamond" }],
  },
  {
    id: "bunker-1",
    label: "Le Bunker",
    width: 340,
    height: 760,
    start: { x: 170, y: 720 },
    hole: { x: 170, y: 60 },
    holeRadius: 14,
    ballRadius: 8,
    theme: "prairie",
    decor: [
      { kind: "truck", x: 290, y: 700, rotation: -20 },
      { kind: "bush", x: 40, y: 400 },
      { kind: "sparkle", x: 60, y: 640 },
      { kind: "house", x: 280, y: 120 },
    ],
    // A gate of two bumpers funnels (and bounces) the ball toward a wide
    // sand band it has to cross or skirt around, then a roulette wheel
    // guards the green itself right before the hole.
    walls: [],
    obstacles: [
      { kind: "bumper", x: 55, y: 610, radius: 20 },
      { kind: "bumper", x: 285, y: 610, radius: 20 },
      { kind: "roulette", x: 170, y: 260, radius: 18 },
    ],
    sandZones: [
      { x: 170, y: 480, radius: 100 },
      { x: 170, y: 170, radius: 60 },
    ],
    waterZones: [],
    teleporters: [],
    windZones: [],
  },
  {
    id: "etang-1",
    label: "L'Étang",
    width: 340,
    height: 780,
    start: { x: 170, y: 740 },
    hole: { x: 170, y: 60 },
    holeRadius: 14,
    ballRadius: 8,
    theme: "prairie",
    decor: [
      { kind: "tent", x: 285, y: 660 },
      { kind: "cow", x: 55, y: 330 },
      { kind: "bush", x: 280, y: 200 },
      { kind: "sparkle", x: 50, y: 130 },
    ],
    // A pond the ball must be routed around — falling in sends it back
    // to where it was before the shot — flanked by pinball bumpers that
    // make a too-direct line risky.
    walls: [],
    obstacles: [
      { kind: "bumper", x: 90, y: 560, radius: 18 },
      { kind: "bumper", x: 250, y: 560, radius: 18 },
      { kind: "bumper", x: 170, y: 230, radius: 20 },
    ],
    sandZones: [],
    waterZones: [{ x: 170, y: 430, radius: 95 }],
    teleporters: [],
    windZones: [],
  },
  {
    id: "venteux-1",
    label: "Le Venteux",
    width: 340,
    height: 820,
    start: { x: 170, y: 780 },
    hole: { x: 170, y: 60 },
    holeRadius: 14,
    ballRadius: 8,
    theme: "labyrinthe",
    decor: [{ kind: "house", x: 55, y: 480 }, { kind: "sparkle", x: 280, y: 680 }],
    // Two fence walls make a loose chicane; two crosswinds (opposite
    // directions) shove the ball sideways as it crosses each corridor, so
    // the "safe" line through the wall gaps keeps moving depending on how
    // hard you hit it.
    walls: [
      { x1: 0, y1: 560, x2: 210, y2: 560 },
      { x1: 130, y1: 380, x2: 340, y2: 380 },
    ],
    obstacles: [],
    sandZones: [],
    waterZones: [],
    teleporters: [],
    windZones: [
      { x: 0, y: 640, width: 340, height: 100, dirX: 1, dirY: 0, shape: "corridor" },
      { x: 0, y: 200, width: 340, height: 100, dirX: -1, dirY: 0, shape: "corridor" },
    ],
  },
  {
    id: "chaos-1",
    label: "Le Chaos",
    width: 340,
    height: 940,
    start: { x: 170, y: 900 },
    hole: { x: 170, y: 60 },
    holeRadius: 14,
    ballRadius: 8,
    theme: "labyrinthe",
    decor: [
      { kind: "truck", x: 60, y: 860, rotation: 15 },
      { kind: "bush", x: 280, y: 500 },
      { kind: "sparkle", x: 55, y: 380 },
      { kind: "house", x: 285, y: 250 },
    ],
    // The gauntlet — every mechanic in the game, one after another: a
    // gate of trees, a bumper, a sand trap, a pond, a crosswind, a
    // one-shot teleporter shortcut, then one last diamond gust guarding
    // the green. The longest and hardest course by a wide margin.
    walls: [],
    obstacles: [
      { kind: "tree", x: 100, y: 800, radius: 20 },
      { kind: "tree", x: 250, y: 800, radius: 20 },
      { kind: "bumper", x: 170, y: 680, radius: 20 },
    ],
    sandZones: [{ x: 170, y: 560, radius: 80 }],
    waterZones: [{ x: 170, y: 420, radius: 75 }],
    teleporters: [
      { x: 60, y: 220, radius: 16, targetX: 280, targetY: 150 },
      { x: 280, y: 150, radius: 16, targetX: 60, targetY: 220 },
    ],
    windZones: [
      { x: 0, y: 300, width: 340, height: 90, dirX: 1, dirY: 0, shape: "corridor" },
      { x: 130, y: 20, width: 80, height: 80, dirX: 0, dirY: 1, shape: "diamond" },
    ],
  },
];

export function golfCourseById(id: string): GolfCourse {
  const c = GOLF_COURSES.find((course) => course.id === id);
  if (!c) throw new Error(`Unknown golf course: ${id}`);
  return c;
}
