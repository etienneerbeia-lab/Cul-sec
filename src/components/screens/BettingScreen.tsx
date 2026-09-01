import type { BetAction } from "@/lib/api-client";
import { streetLabel } from "@/lib/game/roundTypes";
import type { Card, GameState } from "@/lib/game/types";
import MyHandBlock from "../MyHandBlock";

export default function BettingScreen({
  game,
  myHand,
  mySlug,
  busy,
  onAct,
}: {
  game: GameState;
  myHand: Card[] | null;
  mySlug: string;
  busy: boolean;
  onAct: (action: BetAction) => void;
}) {
  const opts = game.bettingOpts!;
  const meIdx = game.playersPublic.findIndex((p) => p.slug === mySlug);
  const myTurn = game.turnIdx === meIdx;

  return (
    <>
      <div className="table-status">
        <div>
          <div className="label">Manche</div>
          <div className="value">
            {game.round}
            {game.totalRounds ? `/${game.totalRounds}` : ""}
          </div>
        </div>
        {opts.foldCost === "pot" ? (
          <div>
            <div className="label">Pot</div>
            <div className="value">{game.pot} 🥃</div>
          </div>
        ) : (
          <div>
            <div className="label">Mise actuelle</div>
            <div className="value">{game.currentBet} 🥃</div>
          </div>
        )}
      </div>
      {game.street && game.street !== "single" && <div className="hint">{streetLabel(game.street)}</div>}

      <MyHandBlock myHand={myHand} />

      <div className="turn-sub">{myTurn ? "C'est ton tour" : "Au tour de"}</div>
      <div className="turn-name">
        {myTurn ? "À toi de jouer" : game.playersPublic[game.turnIdx as number].name}
      </div>

      <div className="players-list">
        {game.dealTargets!.map((i) => {
          const pl = game.playersPublic[i];
          return (
            <div className={`player-chip${pl.folded ? " folded" : ""}`} key={pl.slug}>
              <span className="pname">
                {pl.name}
                {i === meIdx ? " (toi)" : ""}
              </span>
              <span className="pmeta">
                {pl.folded ? "Couché" : pl.bet > 0 ? `Mise ${pl.bet}` : "En attente"}
              </span>
            </div>
          );
        })}
      </div>

      {myTurn ? (
        <div className="bet-actions">
          {opts.mode === "check-or-bet" && game.currentBet === 0 ? (
            <>
              <button className="btn-ghost" disabled={busy} onClick={() => onAct("check")}>
                Checker
              </button>
              <button className="btn-primary" disabled={busy} onClick={() => onAct("bet")}>
                Miser 1
              </button>
            </>
          ) : (
            <>
              <button className="btn-wine" disabled={busy} onClick={() => onAct("fold")}>
                Se coucher
              </button>
              <button className="btn-ghost" disabled={busy} onClick={() => onAct("call")}>
                Suivre ({game.currentBet})
              </button>
              <button className="btn-primary" disabled={busy} onClick={() => onAct("raise")}>
                Relancer à {(game.currentBet as number) + 1}
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="spacer" />
          <div className="hint">
            En attente de {game.playersPublic[game.turnIdx as number].name}...
          </div>
        </>
      )}
    </>
  );
}
