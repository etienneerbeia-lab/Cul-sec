import type { Card } from "@/lib/game/types";
import { valueLabel } from "@/lib/game/cards";

export default function PlayingCard({ card, small }: { card: Card; small?: boolean }) {
  const colorClass = card.suit.color === "red" ? "suit-red" : "suit-black";
  const label = `${valueLabel(card.value)}${card.suit.sym}`;
  return (
    <div className={`playing-card${small ? " small" : ""}`}>
      <div className={`corner ${colorClass}`}>{label}</div>
      <div className={`center-suit ${colorClass}`}>{card.suit.sym}</div>
      <div className={`corner bottom ${colorClass}`}>{label}</div>
    </div>
  );
}
