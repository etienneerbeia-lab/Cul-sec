"use client";

import { useState } from "react";
import type { GameState } from "@/lib/game/types";

export default function UndercoverClueScreen({
  game,
  mySlug,
  myWord,
  busy,
  onSubmitClue,
}: {
  game: GameState;
  mySlug: string;
  myWord: string | null;
  busy: boolean;
  onSubmitClue: (text: string) => void;
}) {
  const u = game.undercover!;
  const activeSlug = u.clueOrder[u.cluePointer];
  const activePlayer = game.playersPublic.find((p) => p.slug === activeSlug)!;
  const isMe = activeSlug === mySlug;
  const amEliminated = !u.remainingSlugs.includes(mySlug);
  const cycleClues = u.clues.filter((c) => c.cycle === u.cycle);

  const [value, setValue] = useState("");

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

      {amEliminated ? (
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
