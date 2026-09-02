"use client";

import { useState } from "react";
import type { GameState } from "@/lib/game/types";

export default function UndercoverGuessScreen({
  game,
  myWord,
  busy,
  onSubmitGuess,
}: {
  game: GameState;
  myWord: string | null;
  busy: boolean;
  onSubmitGuess: (guess: string) => void;
}) {
  const isMe = myWord === null;
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
          <div className="label">Undercover</div>
          <div className="value">Démasqué</div>
        </div>
      </div>

      {isMe ? (
        <>
          <div className="uc-word-banner">
            <div className="uc-word-label">Tu es Mister White, démasqué</div>
            <div className="uc-word-value">Devine le mot secret des autres</div>
          </div>
          <div className="name-inputs" style={{ marginTop: 16 }}>
            <input
              type="text"
              placeholder="Ta réponse"
              value={value}
              maxLength={60}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && value.trim() && !busy) onSubmitGuess(value.trim());
              }}
            />
            <button
              className="btn-primary"
              disabled={busy || !value.trim()}
              onClick={() => onSubmitGuess(value.trim())}
            >
              Valider
            </button>
          </div>
        </>
      ) : (
        <div className="hint" style={{ marginTop: 40 }}>
          L&apos;imposteur a été démasqué et tente sa dernière chance : deviner le mot secret...
        </div>
      )}
    </>
  );
}
