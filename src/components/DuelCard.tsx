import type { Card } from "@/lib/game/types";
import PlayingCard from "./PlayingCard";

// Face-down until `showFace`, then flips — the CSS transition only plays
// when `showFace` changes after mount, so a duelist's own private preview
// (showFace true from the very first render) just renders face-up with no
// animation, while everyone else watching sees the same flip live once the
// owner actually reveals.
export default function DuelCard({
  card,
  showFace,
  clickable,
  busy,
  onReveal,
}: {
  card: Card | null;
  showFace: boolean;
  clickable: boolean;
  busy?: boolean;
  onReveal?: () => void;
}) {
  const inner = (
    <div className={`duel-card-flip${showFace ? " is-revealed" : ""}`}>
      <div className="duel-card-face back">
        <div className={`duel-card-back${clickable ? " duel-card-glow" : ""}`}>🂠</div>
      </div>
      <div className="duel-card-face front">{card && <PlayingCard card={card} duel />}</div>
    </div>
  );

  if (clickable) {
    return (
      <button
        type="button"
        className="duel-card-slot duel-card-clickable"
        disabled={busy}
        onClick={onReveal}
        aria-label="Révéler ma carte"
      >
        {inner}
      </button>
    );
  }
  return <div className="duel-card-slot">{inner}</div>;
}
