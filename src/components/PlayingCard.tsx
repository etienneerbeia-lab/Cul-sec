import type { Card } from "@/lib/game/types";
import { valueLabel } from "@/lib/game/cards";

export default function PlayingCard({
  card,
  small,
  duel,
}: {
  card: Card;
  small?: boolean;
  duel?: boolean;
}) {
  const colorClass = card.suit.color === "red" ? "suit-red" : "suit-black";
  const label = `${valueLabel(card.value)}${card.suit.sym}`;
  const sizeClass = small ? " small" : duel ? " duel" : "";
  return (
    <div className={`playing-card${sizeClass}`}>
      <div className={`corner ${colorClass}`}>{label}</div>
      <div className={`center-suit ${colorClass}`}>{card.suit.sym}</div>
      <div className={`corner bottom ${colorClass}`}>{label}</div>
    </div>
  );
}
