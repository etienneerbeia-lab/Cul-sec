import type { GolfCourse } from "../game/types";

// Coordinate space is arbitrary course units, not pixels — the screen
// scales the whole course (width x height) to fit, so these numbers only
// need to be internally consistent with the physics constants in
// physics.ts (BALL_RADIUS, MAX_PULL, etc., all in the same units).
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
    // A loose slalom of trees and bushes between tee and hole — no walls
    // needed, weaving around solid obstacles is the whole challenge.
    obstacles: [
      { kind: "tree", x: 100, y: 470, radius: 22 },
      { kind: "bush", x: 250, y: 430, radius: 16 },
      { kind: "tree", x: 190, y: 340, radius: 24 },
      { kind: "bush", x: 80, y: 260, radius: 16 },
      { kind: "tree", x: 260, y: 200, radius: 22 },
      { kind: "bush", x: 150, y: 140, radius: 15 },
    ],
    sandZones: [],
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
    // A gate of two trees funnels the ball toward a wide sand band it has
    // to cross (or skirt around the edges of), then a smaller bunker
    // guards the green itself right before the hole.
    walls: [],
    obstacles: [
      { kind: "tree", x: 55, y: 470, radius: 20 },
      { kind: "tree", x: 285, y: 470, radius: 20 },
    ],
    sandZones: [
      { x: 170, y: 350, radius: 95 },
      { x: 170, y: 140, radius: 55 },
    ],
  },
];

export function golfCourseById(id: string): GolfCourse {
  const c = GOLF_COURSES.find((course) => course.id === id);
  if (!c) throw new Error(`Unknown golf course: ${id}`);
  return c;
}
