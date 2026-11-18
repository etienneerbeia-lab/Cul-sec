const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// Dé à points. `rollKey` change à chaque lancer : le dé rebondit et tourne
// avant de se poser (animation CSS au remontage). Un dé gardé ne roule pas.
export function Die({
  value,
  size = 64,
  held = false,
  rollKey,
  delay = 0,
  onClick,
  red = false,
}: {
  value: number;
  size?: number;
  held?: boolean;
  rollKey?: string | number;
  delay?: number;
  onClick?: () => void;
  red?: boolean;
}) {
  const pips = PIPS[value] ?? [];
  const body = (
    <div
      key={held ? "held" : rollKey}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(3, 1fr)",
        gap: size * 0.06,
        padding: size * 0.15,
        width: size,
        height: size,
        borderRadius: size * 0.2,
        background: held ? "linear-gradient(145deg,#fff3c4,#ffd36b)" : "linear-gradient(145deg,#ffffff,#e9e1f5)",
        boxShadow: held
          ? "0 0 0 3px #ff3d8b, 0 10px 24px -8px rgba(255,61,139,0.8)"
          : "inset 0 -4px 0 rgba(0,0,0,0.12), 0 12px 24px -10px rgba(0,0,0,0.8)",
        animation: !held && rollKey !== undefined ? `cs-dice-roll 0.85s ${delay}s var(--ease-out) both` : undefined,
      }}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className="block h-full w-full rounded-full"
          style={{ background: pips.includes(i) ? (red && value === 1 ? "#e0335a" : "#1a1030") : "transparent" }}
        />
      ))}
    </div>
  );
  if (!onClick) return body;
  return (
    <button type="button" onClick={onClick} className="relative transition active:scale-90" aria-pressed={held}>
      {body}
      {held && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-neon px-2 py-0.5 text-[0.65rem] font-black uppercase text-white">
          gardé
        </span>
      )}
    </button>
  );
}
