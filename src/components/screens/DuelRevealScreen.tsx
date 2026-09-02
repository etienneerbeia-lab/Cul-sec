import type { Card, GameState } from "@/lib/game/types";
import DuelCard from "../DuelCard";

export default function DuelRevealScreen({
  game,
  mySlug,
  myHand,
  busy,
  onReveal,
}: {
  game: GameState;
  mySlug: string;
  myHand: Card[] | null;
  busy: boolean;
  onReveal: () => void;
}) {
  const [i1, i2] = game.duelists!;
  const p1 = game.playersPublic[i1];
  const p2 = game.playersPublic[i2];
  const { revealed, revealedCards } = game.duelReveal!;
  const meIdx = game.playersPublic.findIndex((p) => p.slug === mySlug);
  const myPos = meIdx === i1 ? 0 : meIdx === i2 ? 1 : null;

  // For my own not-yet-revealed card, I already privately know it (same
  // as any other hand) — show it face-up to me alone. Everyone else's
  // view of that same slot stays face-down until I actually reveal.
  const slotCard = (pos: 0 | 1): Card | null =>
    revealedCards[pos] ?? (myPos === pos ? myHand?.[0] ?? null : null);
  const slotShowFace = (pos: 0 | 1): boolean => revealed[pos] || myPos === pos;

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
          <DuelCard
            card={slotCard(0)}
            showFace={slotShowFace(0)}
            clickable={myPos === 0 && !revealed[0]}
            busy={busy}
            onReveal={onReveal}
          />
        </div>
        <div className="duel-card-col">
          <div className="duel-card-name">{p2.name}</div>
          <DuelCard
            card={slotCard(1)}
            showFace={slotShowFace(1)}
            clickable={myPos === 1 && !revealed[1]}
            busy={busy}
            onReveal={onReveal}
          />
        </div>
      </div>

      {myPos !== null ? (
        revealed[myPos] ? (
          <div className="hint">
            En attente que {myPos === 0 ? p2.name : p1.name} révèle sa carte...
          </div>
        ) : (
          <div className="hint">Appuie sur ta carte pour la révéler.</div>
        )
      ) : (
        <div className="hint">
          {!revealed[0] && !revealed[1]
            ? `En attente que ${p1.name} et ${p2.name} révèlent leur carte...`
            : `En attente que ${revealed[0] ? p2.name : p1.name} révèle sa carte...`}
        </div>
      )}
    </>
  );
}
