"use client";

import { useEffect, useRef, useState } from "react";
import { MEME_CAPTION_MS } from "@/lib/game/types";
import type { GameState } from "@/lib/game/types";

export default function MemeCaptionScreen({
  game,
  mySlug,
  isHost,
  busy,
  onSubmitCaption,
  onForceReveal,
}: {
  game: GameState;
  mySlug: string;
  isHost: boolean;
  busy: boolean;
  onSubmitCaption: (caption: string) => void;
  onForceReveal: () => void;
}) {
  const m = game.meme!;
  const respondedCount = m.captionResponded.length;
  const total = game.playersPublic.length;
  const iHaveSubmitted = m.captionResponded.includes(mySlug);

  const [value, setValue] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [m.askedAt]);

  const remainingMs = Math.max(0, MEME_CAPTION_MS - (now - m.askedAt));
  const remainingSec = Math.ceil(remainingMs / 1000);
  const timeUp = remainingMs <= 0;

  const timedOutForRef = useRef<number | null>(null);
  useEffect(() => {
    if (!iHaveSubmitted && timeUp && timedOutForRef.current !== m.askedAt) {
      timedOutForRef.current = m.askedAt;
      onSubmitCaption("");
    }
  }, [iHaveSubmitted, timeUp, m.askedAt, onSubmitCaption]);

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
          <div className="label">Make It Meme</div>
          <div className="value">
            {respondedCount}/{total}
          </div>
        </div>
      </div>

      {!timeUp && (
        <div className="quiz-timer">
          <div
            className="quiz-timer-bar"
            style={{ width: `${(remainingMs / MEME_CAPTION_MS) * 100}%` }}
          />
          <span className="quiz-timer-text">{remainingSec}s</span>
        </div>
      )}

      <img className="meme-image" src={m.template.url} alt="Mème à légender" />

      {iHaveSubmitted ? (
        <div className="hint" style={{ marginTop: 16 }}>
          Légende envoyée ! En attente des autres...
        </div>
      ) : (
        <div className="name-inputs" style={{ marginTop: 16 }}>
          <input
            type="text"
            placeholder="Ta légende"
            value={value}
            maxLength={200}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim() && !busy) onSubmitCaption(value.trim());
            }}
          />
          <button
            className="btn-primary"
            disabled={busy || !value.trim()}
            onClick={() => onSubmitCaption(value.trim())}
          >
            Valider
          </button>
        </div>
      )}

      {isHost && timeUp && respondedCount < total && (
        <>
          <div className="spacer" />
          <button className="btn-ghost" disabled={busy} onClick={onForceReveal}>
            Passer au vote
          </button>
        </>
      )}
    </>
  );
}
