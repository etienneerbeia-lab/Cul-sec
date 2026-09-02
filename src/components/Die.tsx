const PIP_LAYOUTS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export default function Die({
  value,
  rolling,
  small,
}: {
  value: number | null;
  rolling?: boolean;
  small?: boolean;
}) {
  const face = value && value >= 1 && value <= 6 ? value : 1;
  const pips = PIP_LAYOUTS[face];
  const classes = ["die"];
  if (small) classes.push("die-small");
  if (rolling) classes.push("die-rolling");
  if (!value) classes.push("die-idle");
  return (
    <div className={classes.join(" ")}>
      <div className="die-grid">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className={pips.includes(i) && value ? "die-pip" : "die-pip die-pip-empty"} />
        ))}
      </div>
    </div>
  );
}
