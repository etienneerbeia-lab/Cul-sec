"use client";

import { useEffect, useRef, useState } from "react";
import type { DiceRoll, GameState, PlayerPublic } from "@/lib/game/types";
import Die from "../Die";

const FLICKER_MS = 1000;
const HOLD_MS = 1500;
const FLICKER_TICK_MS = 90;

function randFace(): number {
  return 1 + Math.floor(Math.random() * 6);
}

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
  // How many of d.rolls this viewer has already watched play out on the
  // big stage below. Starts at the count already present on mount (a
  // fresh page load mid-round shouldn't replay the whole history), then
  // only ever catches up one roll at a time as fresh ones land — that's
  // what makes every viewer watch each turn's animation live instead of
  // just seeing the table fill in silently.
  const [shownCount, setShownCount] = useState(() => d.rolls.length);
  const pendingRoll: DiceRoll | null = shownCount < d.rolls.length ? d.rolls[shownCount] : null;
  const activePlayer = game.playersPublic[d.playerIdx];
  const isMeActive = activePlayer.slug === mySlug;

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

      {pendingRoll ? (
        // Keyed by slug so back-to-back rolls (two bots can land well
        // under the flicker+hold duration apart) always remount this
        // fresh instead of reusing an instance still sitting in "hold"
        // from the previous roll — without the key, `phase` never resets
        // to "flicker" and the hold-timeout effect (dep: [phase]) never
        // re-fires either, freezing the screen on the earlier roll forever.
        <TurnReveal key={pendingRoll.slug} roll={pendingRoll} onDone={() => setShownCount((n) => n + 1)} />
      ) : (
        <LiveTurn activePlayer={activePlayer} isMe={isMeActive} busy={busy} onRoll={onRoll} />
      )}

      {shownCount > 0 && (
        <>
          <h3>Lancers</h3>
          <div className="players-list">
            {d.rolls.slice(0, shownCount).map((r) => (
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

// The active player's own dice, shown big to EVERYONE (only the active
// player gets the button) — this is what makes "someone's turn" visible
// to the whole table before they've even rolled.
function LiveTurn({
  activePlayer,
  isMe,
  busy,
  onRoll,
}: {
  activePlayer: PlayerPublic;
  isMe: boolean;
  busy: boolean;
  onRoll: () => void;
}) {
  const [tapped, setTapped] = useState(false);
  const [faces, setFaces] = useState<[number, number]>([randFace(), randFace()]);

  useEffect(() => {
    if (!tapped) return;
    const id = setInterval(() => setFaces([randFace(), randFace()]), FLICKER_TICK_MS);
    return () => clearInterval(id);
  }, [tapped]);

  function trigger() {
    if (tapped || busy) return;
    setTapped(true);
    onRoll();
  }

  const diceRow = (
    <div className={`dice-row${tapped ? " dice-flicker" : ""}`}>
      <Die value={tapped ? faces[0] : null} />
      <Die value={tapped ? faces[1] : null} />
    </div>
  );

  return (
    <>
      <div className="turn-name">{isMe ? "À toi de jouer" : `Au tour de ${activePlayer.name}`}</div>
      {!tapped && (
        <div className="hint">
          {isMe ? "Appuie sur les dés pour les lancer" : `En attente de ${activePlayer.name}...`}
        </div>
      )}
      {isMe && !tapped ? (
        <button className="dice-tap-area" disabled={busy} onClick={trigger} aria-label="Lancer les dés">
          {diceRow}
        </button>
      ) : (
        diceRow
      )}
      {isMe && !tapped && (
        <button className="btn-primary" disabled={busy} onClick={trigger}>
          Lancer les dés
        </button>
      )}
    </>
  );
}

// A completed roll this viewer hasn't watched yet — flickers for
// everyone the same way (nobody, not even the roller, sees the real
// numbers land before this plays out), then holds the settled result
// clearly on screen for a beat before handing back to the parent, which
// advances to the next player's LiveTurn.
function TurnReveal({ roll, onDone }: { roll: DiceRoll; onDone: () => void }) {
  const [phase, setPhase] = useState<"flicker" | "hold">("flicker");
  const [faces, setFaces] = useState<[number, number]>([randFace(), randFace()]);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (phase !== "flicker") return;
    const tick = setInterval(() => setFaces([randFace(), randFace()]), FLICKER_TICK_MS);
    const settle = setTimeout(() => setPhase("hold"), FLICKER_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(settle);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "hold") return;
    const t = setTimeout(() => onDoneRef.current(), HOLD_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const flickering = phase === "flicker";

  return (
    <>
      <div className="turn-name">{roll.name}</div>
      {!flickering && <div className="dice-sum">{roll.sum}</div>}
      <div className={`dice-row${flickering ? " dice-flicker" : ""}`}>
        <Die value={flickering ? faces[0] : roll.d1} />
        <Die value={flickering ? faces[1] : roll.d2} />
      </div>
    </>
  );
}
