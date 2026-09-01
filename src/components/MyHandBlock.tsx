import type { Card } from "@/lib/game/types";
import PlayingCard from "./PlayingCard";

export default function MyHandBlock({ myHand }: { myHand: Card[] | null }) {
  if (!myHand || !myHand.length) return null;
  return (
    <div>
      <label className="field-label">{myHand.length > 1 ? "Ta main" : "Ta carte"}</label>
      <div className="community-row">
        {myHand.map((c, i) => (
          <PlayingCard key={i} card={c} small />
        ))}
      </div>
    </div>
  );
}
