import type { Card } from "@/lib/game/types";
import PlayingCard from "./PlayingCard";

// Purely a display element — always the same DOM shape (a plain div)
// regardless of who's viewing or whether it's revealed yet. That stability
// is what makes the flip animate: React just updates `is-revealed` on an
// already-mounted `.duel-card-flip`, so the CSS transition on `transform`
// has something to interpolate from. Wrapping this in a <button> only for
// the owner (as a previous version did) meant the element swapped types
// the instant `revealed` flipped true, which unmounts/remounts the flip
// element and skips the transition entirely — cards just popped straight
// to "revealed" for their own owner instead of flipping.
export default function DuelCard({ card, showFace }: { card: Card | null; showFace: boolean }) {
  return (
    <div className="duel-card-slot">
      <div className={`duel-card-flip${showFace ? " is-revealed" : ""}`}>
        <div className="duel-card-face back">
          <div className="duel-card-back">🂠</div>
        </div>
        <div className="duel-card-face front">{card && <PlayingCard card={card} duel />}</div>
      </div>
    </div>
  );
}
