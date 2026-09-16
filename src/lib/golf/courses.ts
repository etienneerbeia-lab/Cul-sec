import type { GolfCourse } from "../game/types";

// Coordinate space is arbitrary course units, not pixels — the screen
// scales the whole course (width x height) to fit, so these numbers only
// need to be internally consistent with the physics constants in
// physics.ts (BALL_RADIUS, MAX_PULL, etc., all in the same units).
export const GOLF_COURSES: GolfCourse[] = [
  {
    id: "chicane-1",
    label: "Le chicane",
    width: 300,
    height: 460,
    start: { x: 150, y: 420 },
    hole: { x: 150, y: 50 },
    holeRadius: 13,
    ballRadius: 8,
    // Two walls jutting from opposite sides, offset in height, forcing a
    // slight S-curve between the tee and the hole — "un léger coude", not
    // a full maze.
    walls: [
      { x1: 0, y1: 300, x2: 195, y2: 300 },
      { x1: 105, y1: 180, x2: 300, y2: 180 },
    ],
  },
];

export function golfCourseById(id: string): GolfCourse {
  const c = GOLF_COURSES.find((course) => course.id === id);
  if (!c) throw new Error(`Unknown golf course: ${id}`);
  return c;
}
