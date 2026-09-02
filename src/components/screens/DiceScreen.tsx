"use client";

import type { GameState } from "@/lib/game/types";
import Die from "../Die";

// No local timers, no "rolling" placeholder state. The active player taps,
// the roll is submitted, and the very next poll (or the immediate refresh
// right after the POST resolves, for the roller themself) delivers the
// real result — at which point every Die below mounts (or updates) with
// that value and plays its own roll animation. Same mechanism for the
// roller and every spectator: whoever's screen learns the result, animates
// it, whenever that happens to land for them.
export default function DiceScreen({
  game,
  mySlug,
  busy,
  onRoll,
}: {
  game: GameState;
  mySlug: string;
  busy: boolean;
  onRoll: () => void;
}) {
  const d = game.dice!;
  const activePlayer = game.playersPublic[d.playerIdx];
  const isMe = activePlayer.slug === mySlug;
  const myRoll = d.rolls.find((r) => r.slug === mySlug);

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
        <div>
          <div className="label">Lancé de dés</div>
          <div className="value">
            {d.rolls.length}/{d.turnOrder.length}
          </div>
        </div>
      </div>

      {isMe ? (
        myRoll ? (
          <>
            <div className="dice-sum">{myRoll.d1 + myRoll.d2}</div>
            <div className="dice-row">
              <Die value={myRoll.d1} />
              <Die value={myRoll.d2} />
            </div>
            <div className="hint">En attente des autres joueurs...</div>
          </>
        ) : (
          <>
            <div className="turn-name">À toi de jouer</div>
            <div className="hint">Appuie sur les dés pour les lancer</div>
            <button
              className="dice-tap-area"
              disabled={busy}
              onClick={onRoll}
              aria-label="Lancer les dés"
            >
              <div className="dice-row">
                <Die value={null} />
                <Die value={null} />
              </div>
            </button>
            <button className="btn-primary" disabled={busy} onClick={onRoll}>
              Lancer les dés
            </button>
          </>
        )
      ) : (
        <div className="hint">En attente de {activePlayer.name}...</div>
      )}

      {d.rolls.length > 0 && (
        <>
          <h3>Lancers</h3>
          <div className="players-list">
            {d.rolls.map((r) => (
              <div className="player-chip" key={r.slug}>
                <span className="pname">{r.name}</span>
                <span className="pmeta dice-chip-result">
                  <Die value={r.d1} small />
                  <Die value={r.d2} small />
                  {r.sum}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
