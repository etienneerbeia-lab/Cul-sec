"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

const PIP_LAYOUTS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// Fixed pip count per physical face (opposite faces sum to 7, as on a real
// die) — rolling to a given value never changes which pips are drawn where,
// it only rotates the whole cube so that face ends up pointing at the
// viewer. FACE_ROTATION is the inverse of each face's own placement
// transform below, i.e. "how far do we spin the cube to bring this face
// to the front."
const FACE_ROTATION: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  6: { x: 0, y: 180 },
  2: { x: 0, y: -90 },
  5: { x: 0, y: 90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
};

const IDLE_ANGLE = { x: -18, y: 24 };

// Smallest forward rotation from `current` that lands on an angle
// congruent to `targetMod` (mod 360) — always positive, so the cube only
// ever spins one direction and never "unwinds" backwards.
function forwardAngleTo(current: number, targetMod: number): number {
  const currentMod = ((current % 360) + 360) % 360;
  const targetNorm = ((targetMod % 360) + 360) % 360;
  let diff = targetNorm - currentMod;
  if (diff <= 0) diff += 360;
  return current + diff;
}

function DieFace({ value, position }: { value: number; position: string }) {
  const pips = PIP_LAYOUTS[value];
  return (
    <div className={`die-face die-face-${position}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={pips.includes(i) ? "die-pip" : "die-pip die-pip-empty"} />
      ))}
    </div>
  );
}

// A real CSS 3D cube: 6 absolutely-positioned faces folded into a box via
// `transform-style: preserve-3d`, and ONE property — `.die-cube`'s own
// `transform` — that we change through React state. The roll itself is
// nothing but that state change plus the CSS `transition` already sitting
// on `.die-cube` (globals.css): no `@keyframes`, no separate "spinning"
// class. The browser's transition engine is what animates the tumble,
// landing exactly on the target face because the target angle is always
// `faceAngle + a few extra full turns` — visually indistinguishable from
// `faceAngle` alone once the roll settles, but the extra turns are what
// make the transition actually visible as a roll instead of a snap.
export default function Die({ value, small }: { value: number | null; small?: boolean }) {
  const [angle, setAngle] = useState(IDLE_ANGLE);
  const rolledRef = useRef(false);

  useEffect(() => {
    if (value === null || rolledRef.current) return;
    rolledRef.current = true;
    const face = FACE_ROTATION[value];
    const extraTurns = 2 + Math.floor(Math.random() * 2); // 2 or 3 full turns
    setAngle((prev) => ({
      x: forwardAngleTo(prev.x, face.x) + 360 * extraTurns,
      y: forwardAngleTo(prev.y, face.y) + 360 * extraTurns,
    }));
  }, [value]);

  const style: CSSProperties = { transform: `rotateX(${angle.x}deg) rotateY(${angle.y}deg)` };

  return (
    <div className={`die-scene${small ? " die-scene-small" : ""}`}>
      <div className={`die-cube${small ? " die-small" : ""}`} style={style}>
        <DieFace value={1} position="front" />
        <DieFace value={6} position="back" />
        <DieFace value={2} position="right" />
        <DieFace value={5} position="left" />
        <DieFace value={3} position="top" />
        <DieFace value={4} position="bottom" />
      </div>
    </div>
  );
}
