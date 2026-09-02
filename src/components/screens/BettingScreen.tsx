import type { BetAction } from "@/lib/api-client";
import { roundTypeById, streetLabel } from "@/lib/game/roundTypes";
import type { Card, GameState } from "@/lib/game/types";
import MyHandBlock from "../MyHandBlock";
import PlayingCard from "../PlayingCard";

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
  const rt = roundTypeById(game.roundTypeId as string);
  const revealedCommunity = (game.community ?? []).slice(0, game.communityRevealed ?? 0);
  const activePlayer = game.playersPublic[game.turnIdx as number];

  const actionButtons =
    opts.mode === "check-or-bet" && game.currentBet === 0 ? (
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
    );

  if (rt.id === "holdem") {
    const others = game.dealTargets!.filter((i) => i !== meIdx);
    const me = game.playersPublic[meIdx];
    const communitySlots = Array.from({ length: 5 }, (_, i) => revealedCommunity[i] ?? null);

    return (
      <>
        <div className="mode-label">{rt.label}</div>
        <div className="table-status">
          <div>
            <div className="label">Manche</div>
            <div className="value">
              {game.round}
              {game.totalRounds ? `/${game.totalRounds}` : ""}
            </div>
          </div>
        </div>

        <div className="poker-table">
          <div className="poker-opponents">
            {others.map((i) => {
              const pl = game.playersPublic[i];
              const isActive = game.turnIdx === i;
              return (
                <div
                  className={`poker-seat${pl.folded ? " folded" : ""}${isActive ? " active" : ""}`}
                  key={pl.slug}
                >
                  <span className="poker-seat-name">{pl.name}</span>
                  <span className="poker-seat-bet">
                    {pl.folded ? "Couché" : pl.bet > 0 ? `${pl.bet} 🥃` : "—"}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="poker-center">
            {game.street && game.street !== "single" && (
              <div className="poker-street-label">{streetLabel(game.street)}</div>
            )}
            <div className="poker-community">
              {communitySlots.map((c, i) =>
                c ? (
                  <PlayingCard key={i} card={c} small />
                ) : (
                  <div className="poker-card-placeholder" key={i} />
                )
              )}
            </div>
            <div className="poker-pot">
              <span className="poker-pot-label">Pot</span>
              <span className="poker-pot-value">{game.pot} 🥃</span>
            </div>
          </div>
        </div>

        <div className="poker-turn-indicator">
          {myTurn ? <strong>C&apos;est ton tour</strong> : <>Au tour de <strong>{activePlayer.name}</strong></>}
        </div>

        <div className={`poker-my-seat${myTurn ? " active" : ""}`}>
          <div className="poker-my-cards">
            {(myHand ?? []).map((c, i) => (
              <PlayingCard key={i} card={c} small />
            ))}
          </div>
          <div className="poker-my-meta">
            <span className="poker-my-name">{me.name} (toi)</span>
            <span className="poker-my-status">
              {me.folded ? "Couché" : me.bet > 0 ? `${me.bet} 🥃` : myTurn ? "À toi de jouer" : "En attente"}
            </span>
          </div>
        </div>

        {myTurn && <div className="bet-actions">{actionButtons}</div>}
      </>
    );
  }

  return (
    <>
      <div className="mode-label">{rt.label}</div>
      <div className="table-status">
        <div>
          <div className="label">Manche</div>
          <div className="value">
            {game.round}
            {game.totalRounds ? `/${game.totalRounds}` : ""}
          </div>
        </div>
        <div>
          <div className="label">Mise actuelle</div>
          <div className="value">{game.currentBet} 🥃</div>
        </div>
      </div>

      <MyHandBlock myHand={myHand} />

      <div className="turn-sub">{myTurn ? "C'est ton tour" : "Au tour de"}</div>
      <div className="turn-name">{myTurn ? "À toi de jouer" : activePlayer.name}</div>

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
        <div className="bet-actions">{actionButtons}</div>
      ) : (
        <>
          <div className="spacer" />
          <div className="hint">En attente de {activePlayer.name}...</div>
        </>
      )}
    </>
  );
}
