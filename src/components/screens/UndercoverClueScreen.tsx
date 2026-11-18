"use client";

import { serverNow } from "@/lib/clock";
import { useEffect, useRef, useState } from "react";
import { CLUE_REVEAL_MS } from "@/lib/game/types";
import type { GameState } from "@/lib/game/types";

export default function UndercoverClueScreen({
  game,
  mySlug,
  myWord,
  busy,
  onSubmitClue,
  onAdvance,
}: {
  game: GameState;
  mySlug: string;
  myWord: string | null;
  busy: boolean;
  onSubmitClue: (text: string) => void;
  onAdvance: () => void;
}) {
  const u = game.undercover!;
  const activeSlug = u.clueOrder[u.cluePointer];
  const activePlayer = game.playersPublic.find((p) => p.slug === activeSlug)!;
  const isMe = activeSlug === mySlug;
  const amEliminated = !u.remainingSlugs.includes(mySlug);
  const cycleClues = u.clues.filter((c) => c.cycle === u.cycle);
  const lastClue = cycleClues[cycleClues.length - 1];
  const isRevealing = u.revealUntil !== undefined;

  const [value, setValue] = useState("");

  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    if (!isRevealing) return;
    const id = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(id);
  }, [isRevealing, u.revealUntil]);

  const remainingMs = isRevealing ? Math.max(0, u.revealUntil! - now) : 0;

  // Any client's own timer auto-advances once the pin window is over —
  // guarded so this fires at most once per reveal even if this component
  // stays mounted across the whole thing.
  const advancedForRef = useRef<number | null>(null);
  useEffect(() => {
    if (isRevealing && remainingMs <= 0 && advancedForRef.current !== u.revealUntil) {
      advancedForRef.current = u.revealUntil!;
      onAdvance();
    }
  }, [isRevealing, remainingMs, u.revealUntil, onAdvance]);

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
          <div className="label">Indices</div>
          <div className="value">
            {u.cluePointer}/{u.clueOrder.length}
          </div>
        </div>
      </div>

      <div className="uc-word-banner">
        <div className="uc-word-label">Ton mot</div>
        <div className="uc-word-value">{myWord ?? "Tu es Mister White — pas de mot !"}</div>
      </div>

      {isRevealing && lastClue ? (
        <>
          <div className="uc-clue-reveal">
            <div className="uc-clue-reveal-name">{lastClue.name} a dit</div>
            <div className="uc-clue-reveal-text">« {lastClue.text} »</div>
          </div>
          <div className="quiz-timer">
            <div
              className="quiz-timer-bar"
              style={{ width: `${(remainingMs / CLUE_REVEAL_MS) * 100}%` }}
            />
          </div>
          <button className="btn-ghost" style={{ marginTop: 12 }} disabled={busy} onClick={onAdvance}>
            Continuer
          </button>
        </>
      ) : amEliminated ? (
        <div className="hint" style={{ marginTop: 16 }}>
          Tu as été éliminé de cette manche. Observe la suite...
        </div>
      ) : isMe ? (
        <div className="name-inputs" style={{ marginTop: 16 }}>
          <div className="hint">
            Décris ton mot à voix haute à la table, puis tape le même indice ici (sans jamais dire le
            mot).
          </div>
          <input
            type="text"
            placeholder="Ton indice"
            value={value}
            maxLength={60}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim() && !busy) {
                onSubmitClue(value.trim());
                setValue("");
              }
            }}
          />
          <button
            className="btn-primary"
            disabled={busy || !value.trim()}
            onClick={() => {
              onSubmitClue(value.trim());
              setValue("");
            }}
          >
            Valider
          </button>
        </div>
      ) : (
        <div className="hint" style={{ marginTop: 16 }}>
          En attente de {activePlayer.name}...
        </div>
      )}

      {cycleClues.length > 0 && (
        <>
          <h3>Indices donnés</h3>
          <div className="players-list">
            {cycleClues.map((c, i) => (
              <div className="player-chip" key={i}>
                <span className="pname">{c.name}</span>
                <span className="pmeta">{c.text}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {u.eliminatedSlugs.length > 0 && (
        <>
          <h3>Éliminés</h3>
          <div className="players-list">
            {u.eliminatedSlugs.map((slug) => {
              const p = game.playersPublic.find((pp) => pp.slug === slug)!;
              return (
                <div className="player-chip folded" key={slug}>
                  <span className="pname">{p.name}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
