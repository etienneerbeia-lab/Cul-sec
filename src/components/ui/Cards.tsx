import { valueLabel } from "@/lib/game/cards";
import type { Card } from "@/lib/game/types";

const SIZES = {
  xl: { w: 168, h: 236, corner: 26, suit: 76, r: 18 },
  lg: { w: 128, h: 180, corner: 21, suit: 58, r: 15 },
  md: { w: 92, h: 130, corner: 17, suit: 40, r: 12 },
  sm: { w: 54, h: 76, corner: 13, suit: 22, r: 8 },
  xs: { w: 46, h: 66, corner: 12, suit: 19, r: 7 },
  // Table de poker casino (board, sièges) : lisible à 375 px avec 8 sièges.
  "2xs": { w: 34, h: 48, corner: 11, suit: 15, r: 6 },
  "3xs": { w: 24, h: 34, corner: 9, suit: 11, r: 4 },
} as const;

export type CardSize = keyof typeof SIZES;

export function cardDims(size: CardSize): { w: number; h: number } {
  return { w: SIZES[size].w, h: SIZES[size].h };
}

export function cardKey(c: Card): string {
  return `${c.value}${c.suit.sym}`;
}

// Carte à jouer. `card` absent ou `faceDown` = dos de carte. Chaque nouvelle
// carte se retourne (animation au montage, clé = la carte).
export function PlayingCardV2({
  card,
  size = "md",
  faceDown = false,
  dim = false,
  flipKey,
  className = "",
}: {
  card?: Card | null;
  size?: CardSize;
  faceDown?: boolean;
  dim?: boolean;
  flipKey?: string;
  className?: string;
}) {
  const s = SIZES[size];
  const base = `relative shrink-0 select-none ${className}`;
  const style = { width: s.w, height: s.h, borderRadius: s.r, perspective: 800 };
  if (!card || faceDown) {
    return (
      <div className={base} style={style}>
        <div
          className="absolute inset-0 overflow-hidden border-2 border-white/20 shadow-[0_14px_30px_-10px_rgba(0,0,0,0.8)]"
          style={{
            borderRadius: s.r,
            background:
              "repeating-linear-gradient(45deg, rgba(255,255,255,0.07) 0 6px, transparent 6px 12px), linear-gradient(145deg, #ff3d8b, #6a2bd6)",
          }}
        >
          <div className="absolute inset-[10%] rounded-[inherit] border border-white/30" />
          <div className="absolute inset-0 grid place-items-center font-display font-extrabold text-white/80" style={{ fontSize: s.suit * 0.5 }}>
            CS
          </div>
        </div>
      </div>
    );
  }
  const red = card.suit.color === "red";
  const label = valueLabel(card.value);
  const color = red ? "#d6284b" : "#1a1030";
  return (
    <div className={base} style={style}>
      <div
        key={flipKey ?? cardKey(card)}
        className={`absolute inset-0 flex flex-col justify-between border border-black/10 shadow-[0_16px_34px_-12px_rgba(0,0,0,0.85)] ${dim ? "opacity-50" : ""}`}
        style={{
          borderRadius: s.r,
          padding: s.w * 0.08,
          background: "linear-gradient(160deg, #fffaf0, #f3e7d3)",
          color,
          animation: "cs-flip-in 0.45s var(--ease-out) both",
          transformOrigin: "center",
        }}
      >
        <div className="font-display font-extrabold leading-none" style={{ fontSize: s.corner }}>
          {label}
          <div style={{ fontSize: s.corner * 0.8 }}>{card.suit.sym}</div>
        </div>
        <div className="absolute inset-0 grid place-items-center leading-none" style={{ fontSize: s.suit }}>
          {card.suit.sym}
        </div>
        <div className="rotate-180 self-end font-display font-extrabold leading-none" style={{ fontSize: s.corner }}>
          {label}
          <div style={{ fontSize: s.corner * 0.8 }}>{card.suit.sym}</div>
        </div>
      </div>
    </div>
  );
}
