import type { Card, GameState } from "@/lib/game/types";
import MyHandBlock from "../MyHandBlock";

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
  const revealed = game.duelReveal!.revealed;
  const meIdx = game.playersPublic.findIndex((p) => p.slug === mySlug);
  const myPos = meIdx === i1 ? 0 : meIdx === i2 ? 1 : null;
  const pendingNames = [!revealed[0] && p1.name, !revealed[1] && p2.name].filter(
    (v): v is string => typeof v === "string"
  );

  return (
    <>
      <div className="pass-screen">
        <div className="glyph">⚔️</div>
        <div className="field-label">Duel éclair</div>
        <div className="pass-name">
          {p1.name} vs {p2.name}
        </div>
      </div>

      <div className="players-list">
        <div className="player-chip">
          <span className="pname">{p1.name}</span>
          <span className="pmeta">{revealed[0] ? "Révélée ✓" : "En attente"}</span>
        </div>
        <div className="player-chip">
          <span className="pname">{p2.name}</span>
          <span className="pmeta">{revealed[1] ? "Révélée ✓" : "En attente"}</span>
        </div>
      </div>

      {myPos !== null ? (
        <>
          <MyHandBlock myHand={myHand} />
          {revealed[myPos] ? (
            <div className="hint">
              En attente que {myPos === 0 ? p2.name : p1.name} révèle sa carte...
            </div>
          ) : (
            <>
              <div className="spacer" />
              <button className="btn-primary" disabled={busy} onClick={onReveal}>
                Révéler ma carte
              </button>
            </>
          )}
        </>
      ) : (
        <div className="hint">
          En attente que {pendingNames.join(" et ")} révèle
          {pendingNames.length > 1 ? "nt" : ""} sa carte...
        </div>
      )}
    </>
  );
}
