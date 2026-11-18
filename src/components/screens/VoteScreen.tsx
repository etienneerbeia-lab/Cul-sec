"use client";

import { serverNow } from "@/lib/clock";
import { useEffect, useMemo, useRef, useState } from "react";
import { TIMED_ANSWER_MS } from "@/lib/game/types";
import type { GameState, VoteChoice } from "@/lib/game/types";

export default function VoteScreen({
  game,
  myVoteChoice,
  busy,
  onSubmitVote,
}: {
  game: GameState;
  myVoteChoice: VoteChoice | null;
  busy: boolean;
  onSubmitVote: (choice: VoteChoice | null) => void;
}) {
  const v = game.vote!;
  const respondedCount = v.responded.length;
  const total = game.playersPublic.length;
  const waitingOn = useMemo(
    () => game.playersPublic.filter((p) => !v.responded.includes(p.slug)).map((p) => p.name),
    [game.playersPublic, v.responded]
  );

  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 250);
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
          <br />
          En attente du vote de {waitingOn.join(", ")}...
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
    </>
  );
}
