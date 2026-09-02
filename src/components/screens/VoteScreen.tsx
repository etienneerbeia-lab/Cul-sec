"use client";

import { useEffect, useRef, useState } from "react";
import { TIMED_ANSWER_MS } from "@/lib/game/types";
import type { GameState, VoteChoice } from "@/lib/game/types";

export default function VoteScreen({
  game,
  myVoteChoice,
  isHost,
  busy,
  onSubmitVote,
  onForceReveal,
}: {
  game: GameState;
  myVoteChoice: VoteChoice | null;
  isHost: boolean;
  busy: boolean;
  onSubmitVote: (choice: VoteChoice | null) => void;
  onForceReveal: () => void;
}) {
  const v = game.vote!;
  const respondedCount = v.responded.length;
  const total = game.playersPublic.length;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [v.askedAt]);

  const remainingMs = Math.max(0, TIMED_ANSWER_MS - (now - v.askedAt));
  const remainingSec = Math.ceil(remainingMs / 1000);
  const timeUp = remainingMs <= 0;

  // Auto-submit an abstain the moment my own countdown runs out, same
  // pattern as the quiz's timed-out turn — this still closes out my slot
  // without joining either camp.
  const timedOutForRef = useRef<number | null>(null);
  useEffect(() => {
    if (!myVoteChoice && timeUp && timedOutForRef.current !== v.askedAt) {
      timedOutForRef.current = v.askedAt;
      onSubmitVote(null);
    }
  }, [myVoteChoice, timeUp, v.askedAt, onSubmitVote]);

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
          <div className="label">Tu préfères</div>
          <div className="value">
            {respondedCount}/{total}
          </div>
        </div>
      </div>

      {!timeUp && (
        <div className="quiz-timer">
          <div
            className="quiz-timer-bar"
            style={{ width: `${(remainingMs / TIMED_ANSWER_MS) * 100}%` }}
          />
          <span className="quiz-timer-text">{remainingSec}s</span>
        </div>
      )}

      {myVoteChoice ? (
        <div className="hint" style={{ marginTop: 16 }}>
          Tu as voté <strong>{myVoteChoice === "A" ? v.question.promptA : v.question.promptB}</strong>.
          En attente des autres...
        </div>
      ) : (
        <div className="vote-options">
          <button className="vote-option" disabled={busy} onClick={() => onSubmitVote("A")}>
            {v.question.promptA}
          </button>
          <div className="vote-divider">ou</div>
          <button className="vote-option" disabled={busy} onClick={() => onSubmitVote("B")}>
            {v.question.promptB}
          </button>
        </div>
      )}

      {isHost && timeUp && respondedCount < total && (
        <>
          <div className="spacer" />
          <button className="btn-ghost" disabled={busy} onClick={onForceReveal}>
            Voir les résultats
          </button>
        </>
      )}
    </>
  );
}
