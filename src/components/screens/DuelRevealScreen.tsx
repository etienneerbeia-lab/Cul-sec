import type { GameState } from "@/lib/game/types";
import DuelCard from "../DuelCard";

// Identical screen for everyone at the table — both duelists and every
// spectator see the exact same two cards in the exact same place, face
// down until `revealed[pos]` (synced state, not a local guess) flips true.
// The only thing that differs per viewer is whether a "Révéler" button
// shows up under one of the cards, and it only ever shows up under a
// duelist's own, not-yet-revealed card.
export default function DuelRevealScreen({
  game,
  mySlug,
  busy,
  onReveal,
}: {
  game: GameState;
  mySlug: string;
  busy: boolean;
  onReveal: () => void;
}) {
  const [i1, i2] = game.duelists!;
  const p1 = game.playersPublic[i1];
  const p2 = game.playersPublic[i2];
  const { revealed, revealedCards } = game.duelReveal!;
  const meIdx = game.playersPublic.findIndex((p) => p.slug === mySlug);
  const myPos = meIdx === i1 ? 0 : meIdx === i2 ? 1 : null;

  return (
    <>
      <div className="pass-screen" style={{ flex: "0 0 auto", padding: "8px 0 4px" }}>
        <div className="glyph">⚔️</div>
        <div className="field-label">Bataille</div>
        <div className="pass-name">
          {p1.name} vs {p2.name}
        </div>
      </div>

      <div className="duel-card-row">
        <div className="duel-card-col">
          <div className="duel-card-name">{p1.name}</div>
          <DuelCard card={revealedCards[0]} showFace={revealed[0]} />
          {myPos === 0 && !revealed[0] && (
            <button
              className="btn-primary"
              style={{ marginTop: 6 }}
              disabled={busy}
              onClick={onReveal}
            >
              Révéler
            </button>
          )}
        </div>
        <div className="duel-card-col">
          <div className="duel-card-name">{p2.name}</div>
          <DuelCard card={revealedCards[1]} showFace={revealed[1]} />
          {myPos === 1 && !revealed[1] && (
            <button
              className="btn-primary"
              style={{ marginTop: 6 }}
              disabled={busy}
              onClick={onReveal}
            >
              Révéler
            </button>
          )}
        </div>
      </div>

      {!revealed[0] && !revealed[1] ? (
        <div className="hint">
          En attente que {p1.name} et {p2.name} révèlent leur carte...
        </div>
      ) : !(revealed[0] && revealed[1]) ? (
        <div className="hint">
          En attente que {revealed[0] ? p2.name : p1.name} révèle sa carte...
        </div>
      ) : null}
    </>
  );
}
