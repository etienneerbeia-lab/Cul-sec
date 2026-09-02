"use client";

import { useState } from "react";
import type { DiceRoll, GameState } from "@/lib/game/types";
import Die from "../Die";

const ROLL_ANIM_MS = 1000;

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
        // Keyed by playerIdx so a fresh turn always mounts fresh local
        // state — no reset effect needed.
        <DiceMyTurn key={d.playerIdx} myRoll={myRoll} busy={busy} onRoll={onRoll} />
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

function DiceMyTurn({
  myRoll,
  busy,
  onRoll,
}: {
  myRoll: DiceRoll | undefined;
  busy: boolean;
  onRoll: () => void;
}) {
  const [rolling, setRolling] = useState(false);
  const [revealReady, setRevealReady] = useState(false);

  function trigger() {
    if (rolling || busy) return;
    setRolling(true);
    onRoll();
    setTimeout(() => setRevealReady(true), ROLL_ANIM_MS);
  }

  const showResult = !!myRoll && revealReady;
  const showRollingDice = rolling && !showResult;

  if (showResult) {
    return (
      <>
        <div className="dice-sum">{myRoll!.d1 + myRoll!.d2}</div>
        <div className="dice-row">
          <Die value={myRoll!.d1} />
          <Die value={myRoll!.d2} />
        </div>
        <div className="hint">En attente des autres joueurs...</div>
      </>
    );
  }

  return (
    <>
      <div className="turn-name">À toi de jouer</div>
      <div className="hint">Appuie sur les dés pour les lancer</div>
      <button
        className="dice-tap-area"
        disabled={busy || rolling}
        onClick={trigger}
        aria-label="Lancer les dés"
      >
        <div className="dice-row">
          <Die value={null} rolling={showRollingDice} />
          <Die value={null} rolling={showRollingDice} />
        </div>
      </button>
      {!rolling && (
        <button className="btn-primary" disabled={busy} onClick={trigger}>
          Lancer les dés
        </button>
      )}
    </>
  );
}
