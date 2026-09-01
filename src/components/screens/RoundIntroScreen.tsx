import { roundTypeById } from "@/lib/game/roundTypes";
import type { GameState } from "@/lib/game/types";

export default function RoundIntroScreen({
  game,
  isHost,
  busy,
  onConfirm,
}: {
  game: GameState;
  isHost: boolean;
  busy: boolean;
  onConfirm: () => void;
}) {
  const rt = roundTypeById(game.roundTypeId as string);
  return (
    <>
      <div className="pass-screen">
        <div className="glyph">{rt.icon}</div>
        <div className="field-label">
          Manche {game.round}
          {game.totalRounds ? `/${game.totalRounds}` : ""}
        </div>
        <div className="pass-name">{rt.label}</div>
        <div className="hint">{rt.tagline}</div>
        {rt.id === "duel" && game.duelists && (
          <div className="hint">
            Ce soir, ça tape entre {game.playersPublic[game.duelists[0]].name} et{" "}
            {game.playersPublic[game.duelists[1]].name}.
          </div>
        )}
      </div>
      {isHost ? (
        <button className="btn-primary" disabled={busy} onClick={onConfirm}>
          C&apos;est parti
        </button>
      ) : (
        <div className="hint">En attente de l&apos;hôte...</div>
      )}
    </>
  );
}
