"use client";

import { useEffect, useRef, useState } from "react";
import type { DiceRoll, DiceTieBreakRound, GameState, PlayerPublic } from "@/lib/game/types";
import Die from "../Die";

const FLICKER_MS = 1000;
const HOLD_MS = 1500;
const FLICKER_TICK_MS = 90;

function randFace(): number {
  return 1 + Math.floor(Math.random() * 6);
}

function tieBreakBanner(tb: Pick<DiceTieBreakRound, "participantNames" | "tiedSum" | "amount">): string {
  return `Égalité entre ${tb.participantNames.join(", ")} à ${tb.tiedSum} — départage, le perdant boira ${tb.amount} 🥃.`;
}

// The full roll history as an ordered sequence of groups: the main round
// first, then one group per tie-break level (completed ones from
// tieBreakHistory, plus the currently-live one if a level is still in
// progress) — chronological order, which is also turn order within each
// group. Flattening this is what lets the existing "replay one roll at a
// time" mechanism below extend to tie-break levels for free.
interface RollGroup {
  level: number | null; // null for the main round, 1/2/3... per tie-break level
  banner: string | null;
  rolls: DiceRoll[];
}

function buildGroups(game: GameState): RollGroup[] {
  const d = game.dice!;
  const groups: RollGroup[] = [{ level: null, banner: null, rolls: d.rolls }];
  (d.tieBreakHistory ?? []).forEach((tb) =>
    groups.push({ level: tb.level, banner: tieBreakBanner(tb), rolls: tb.rolls })
  );
  if (d.tieBreak) groups.push({ level: d.tieBreak.level, banner: tieBreakBanner(d.tieBreak), rolls: d.tieBreak.rolls });
  return groups;
}

function groupAtIndex(groups: RollGroup[], index: number): RollGroup | null {
  let offset = 0;
  for (const g of groups) {
    if (index < offset + g.rolls.length) return g;
    offset += g.rolls.length;
  }
  return null;
}

export default function DiceScreen({
  game,
  mySlug,
  isHost,
  busy,
  onRoll,
  onNextRound,
  onEndNight,
}: {
  game: GameState;
  mySlug: string;
  isHost: boolean;
  busy: boolean;
  onRoll: () => void;
  onNextRound: () => void;
  onEndNight: () => void;
}) {
  const d = game.dice!;
  const groups = buildGroups(game);
  const allRolls = groups.flatMap((g) => g.rolls);
  // How many of allRolls this viewer has already watched play out on the
  // big stage below. Starts at the count already present on mount (a
  // fresh page load mid-round shouldn't replay the whole history), then
  // only ever catches up one roll at a time as fresh ones land — that's
  // what makes every viewer watch each turn's animation live instead of
  // just seeing the table fill in silently. Extends across tie-break
  // levels transparently since it's driven off the flattened sequence.
  const [shownCount, setShownCount] = useState(() => allRolls.length);
  const pendingRoll: DiceRoll | null = shownCount < allRolls.length ? allRolls[shownCount] : null;
  const pendingGroup = pendingRoll ? groupAtIndex(groups, shownCount) : null;

  const activePlayerIdx = d.tieBreak ? d.tieBreak.playerIdx : d.playerIdx;
  const activePlayer = game.playersPublic[activePlayerIdx];
  const isMeActive = activePlayer.slug === mySlug;
  const liveBanner = d.tieBreak ? tieBreakBanner(d.tieBreak) : null;

  // The engine resolves the round (phase -> "showdown") the instant the
  // decisive roll lands, in that same request — same tick as the roll
  // itself, before this viewer has watched it play out. So "resolved"
  // alone isn't enough to show results: this stays on the reveal
  // animation until the replay queue actually catches up, same idea as
  // the duel screen never navigating away, just gated on the queue
  // instead of a reveal button.
  const resolved = game.phase === "showdown" && !pendingRoll;
  const r = resolved ? game.lastResults : undefined;
  const lastGroup = groups[groups.length - 1];

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
        <>
          {pendingGroup?.banner && <div className="dice-tiebreak-banner">{pendingGroup.banner}</div>}
          {/* Keyed by slug so back-to-back rolls (two bots can land well
              under the flicker+hold duration apart) always remount this
              fresh instead of reusing an instance still sitting in "hold"
              from the previous roll — without the key, `phase` never
              resets to "flicker" and the hold-timeout effect (dep:
              [phase]) never re-fires either, freezing the screen on the
              earlier roll forever. */}
          <TurnReveal key={pendingRoll.slug} roll={pendingRoll} onDone={() => setShownCount((n) => n + 1)} />
        </>
      ) : resolved ? (
        <div className="pass-screen" style={{ flex: "0 0 auto", padding: "8px 0 4px" }}>
          <div className="glyph">🎲</div>
          <div className="subtitle" style={{ marginBottom: 0 }}>
            {r!.diceLowest![0]} boit {r!.diceLowestAmount} 🥃.
          </div>
        </div>
      ) : (
        <>
          {liveBanner && <div className="dice-tiebreak-banner">{liveBanner}</div>}
          <LiveTurn activePlayer={activePlayer} isMe={isMeActive} busy={busy} onRoll={onRoll} />
        </>
      )}

      {shownCount > 0 && (
        <>
          {groups.map((group, gi) => {
            const start = groups.slice(0, gi).reduce((n, g2) => n + g2.rolls.length, 0);
            const visible = group.rolls.slice(0, Math.max(0, shownCount - start));
            if (visible.length === 0) return null;
            return (
              <div key={gi}>
                <h3>{group.level === null ? "Lancers" : `Départage ${group.level}`}</h3>
                {group.banner && <div className="hint">{group.banner}</div>}
                <div className="players-list">
                  {visible.map((roll) => {
                    const isLoser = resolved && group.rolls === lastGroup.rolls && roll.name === r!.diceLowest![0];
                    return (
                      <div className="player-chip" key={roll.slug}>
                        <span className="pname">{roll.name}</span>
                        <span className="pmeta dice-chip-result">
                          <Die value={roll.d1} small />
                          <Die value={roll.d2} small />
                          {roll.sum}
                          {isLoser && ` — Boit ${r!.diceLowestAmount} 🥃`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}

      {resolved && (
        <>
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

// The active player's own dice, shown big to EVERYONE (only the active
// player gets the button) — this is what makes "someone's turn" visible
// to the whole table before they've even rolled. Reused as-is for
// tie-break turns; the banner above it is what explains the stakes.
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
// advances to the next player's LiveTurn (or the next tie-break level).
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
