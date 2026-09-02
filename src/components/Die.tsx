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

export default function Die({
  value,
  rolling,
  small,
}: {
  value: number | null;
  rolling?: boolean;
  small?: boolean;
}) {
  const cubeClasses = ["die-cube"];
  if (small) cubeClasses.push("die-small");
  if (rolling) cubeClasses.push("die-spinning");

  // While spinning, the keyframe animation owns the transform entirely.
  // Once settled on a real value, straighten the cube so that face reads
  // dead-on instead of at the resting idle tilt. Idle (no value yet, not
  // rolling) keeps the CSS default tilt so it still reads as a 3D object.
  const style: CSSProperties | undefined =
    !rolling && value ? { transform: `rotateX(${FACE_ROTATION[value].x}deg) rotateY(${FACE_ROTATION[value].y}deg)` } : undefined;

  return (
    <div className={`die-scene${small ? " die-scene-small" : ""}`}>
      <div className={cubeClasses.join(" ")} style={style}>
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
