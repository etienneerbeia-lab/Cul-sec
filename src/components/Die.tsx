const PIP_LAYOUTS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// Deliberately plain 2D — two earlier attempts at a "real" CSS 3D cube
// never rendered reliably. A flat pip card plus a fast face-cycling
// animation (driven by the caller, see DiceScreen.tsx) reads clearly as
// "the dice are rolling" without depending on 3D transforms at all.
export default function Die({ value, small }: { value: number | null; small?: boolean }) {
  const pips = value ? PIP_LAYOUTS[value] : [];
  const classes = ["die-2d"];
  if (small) classes.push("die-2d-small");
  if (!value) classes.push("die-2d-idle");
  return (
    <div className={classes.join(" ")}>
      <div className="die-2d-grid">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className={pips.includes(i) ? "die-pip" : "die-pip die-pip-empty"} />
        ))}
      </div>
    </div>
  );
}
