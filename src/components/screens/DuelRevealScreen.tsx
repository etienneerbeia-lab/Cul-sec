import type { GameState } from "@/lib/game/types";
import DuelCard from "../DuelCard";

// One screen for the whole duel, start to finish — never navigates away.
// Both duelists and every spectator see the exact same two cards in the
// exact same place, face down until `revealed[pos]` flips true. Once both
// are revealed the engine has already resolved into lastResults and moved
// the phase to "showdown", but GameApp keeps rendering THIS component for
// duel-flavored showdowns instead of swapping to ShowdownScreen — so the
// result (who won, who drinks) just appears below the same two revealed
// cards instead of cutting to a different screen.
export default function DuelRevealScreen({
  game,
  mySlug,
  isHost,
  busy,
  onReveal,
  onNextRound,
  onEndNight,
}: {
  game: GameState;
  mySlug: string;
  isHost: boolean;
  busy: boolean;
  onReveal: () => void;
  onNextRound: () => void;
  onEndNight: () => void;
}) {
  const [i1, i2] = game.duelists!;
  const p1 = game.playersPublic[i1];
  const p2 = game.playersPublic[i2];
  const { revealed, revealedCards } = game.duelReveal!;
  const meIdx = game.playersPublic.findIndex((p) => p.slug === mySlug);
  const myPos = meIdx === i1 ? 0 : meIdx === i2 ? 1 : null;
  const resolved = game.phase === "showdown";
  const r = resolved ? game.lastResults : undefined;

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
          {!resolved && myPos === 0 && !revealed[0] && (
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
          {!resolved && myPos === 1 && !revealed[1] && (
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

      {!resolved ? (
        !revealed[0] && !revealed[1] ? (
          <div className="hint">
            En attente que {p1.name} et {p2.name} révèlent leur carte...
          </div>
        ) : (
          <div className="hint">
            En attente que {revealed[0] ? p2.name : p1.name} révèle sa carte...
          </div>
        )
      ) : (
        <>
          {r!.tie ? (
            <div className="subtitle">
              {r!.names![0]} et {r!.names![1]} tirent la même carte. Les deux boivent 1 🥃.
            </div>
          ) : (
            <div className="subtitle">
              {r!.winner} bat {r!.loser}. {r!.loser} boit 2 🥃.
            </div>
          )}
          <div className="spacer" />
          {isHost ? (
            <>
              <button className="btn-primary" disabled={busy} onClick={onNextRound}>
                Manche suivante
              </button>
              <button className="btn-ghost" style={{ marginTop: 12 }} disabled={busy} onClick={onEndNight}>
                Terminer la soirée
              </button>
            </>
          ) : (
            <div className="hint">En attente de l&apos;hôte pour continuer...</div>
          )}
        </>
      )}
    </>
  );
}
