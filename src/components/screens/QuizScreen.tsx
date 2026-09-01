"use client";

import { useMemo, useState } from "react";
import type { GameState } from "@/lib/game/types";

const TYPE_LABELS: Record<string, string> = {
  capital: "Capitale",
  flag: "Drapeau",
  date: "Date historique",
};

export default function QuizScreen({
  game,
  mySlug,
  isHost,
  busy,
  onSubmitAnswer,
  onDistribute,
  onNext,
  onEndNight,
}: {
  game: GameState;
  mySlug: string;
  isHost: boolean;
  busy: boolean;
  onSubmitAnswer: (answer: string) => void;
  onDistribute: (targets: { slug: string; amount: number }[]) => void;
  onNext: () => void;
  onEndNight: () => void;
}) {
  const q = game.quiz!;
  const activePlayer = game.playersPublic[q.playerIdx];
  const isMe = activePlayer.slug === mySlug;
  const isLastPlayer = q.turnPointer + 1 >= q.turnOrder.length;

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
          <div className="label">{TYPE_LABELS[q.question.type] ?? "Question"}</div>
          <div className="value">{activePlayer.name}</div>
        </div>
      </div>

      {q.question.type === "flag" && q.question.flagEmoji && (
        <div className="quiz-flag">{q.question.flagEmoji}</div>
      )}
      <div className="quiz-prompt">{q.question.prompt}</div>

      {q.status === "asking" && (isMe ? <AnswerForm onSubmit={onSubmitAnswer} busy={busy} /> : <div className="hint">En attente de {activePlayer.name}...</div>)}

      {q.status === "distributing" &&
        (isMe ? (
          <DistributeForm players={game.playersPublic} mySlug={mySlug} onConfirm={onDistribute} busy={busy} />
        ) : (
          <div className="hint">
            Bonne réponse ! {activePlayer.name} distribue ses 2 gorgées...
          </div>
        ))}

      {q.status === "result" && (
        <>
          <div className={`quiz-result-banner ${q.correct ? "correct" : "incorrect"}`}>
            {q.correct ? "Bonne réponse !" : "Mauvaise réponse"}
          </div>
          {!q.correct && (
            <div className="hint">
              La bonne réponse était : <strong>{q.question.answer}</strong>
            </div>
          )}
          <div className="players-list">
            {q.correct ? (
              (q.distribution ?? []).map((d) => (
                <div className="player-chip" key={d.slug}>
                  <span className="pname">{d.name}</span>
                  <span className="pmeta">Boit {d.amount} 🥃</span>
                </div>
              ))
            ) : (
              <div className="player-chip">
                <span className="pname">{activePlayer.name}</span>
                <span className="pmeta">Boit 2 🥃</span>
              </div>
            )}
          </div>

          <div className="spacer" />
          {isHost ? (
            <>
              <button className="btn-primary" disabled={busy} onClick={onNext}>
                {isLastPlayer ? "Manche suivante" : "Joueur suivant"}
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

function AnswerForm({ onSubmit, busy }: { onSubmit: (answer: string) => void; busy: boolean }) {
  const [value, setValue] = useState("");
  return (
    <div className="name-inputs" style={{ marginTop: 16 }}>
      <input
        type="text"
        placeholder="Ta réponse"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim() && !busy) onSubmit(value.trim());
        }}
      />
      <button
        className="btn-primary"
        disabled={busy || !value.trim()}
        onClick={() => onSubmit(value.trim())}
      >
        Valider
      </button>
    </div>
  );
}

function DistributeForm({
  players,
  mySlug,
  onConfirm,
  busy,
}: {
  players: GameState["playersPublic"];
  mySlug: string;
  onConfirm: (targets: { slug: string; amount: number }[]) => void;
  busy: boolean;
}) {
  const others = useMemo(() => players.filter((p) => p.slug !== mySlug), [players, mySlug]);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const total = Object.values(amounts).reduce((s, n) => s + n, 0);

  function bump(slug: string, delta: number) {
    setAmounts((prev) => {
      const next = Math.max(0, (prev[slug] ?? 0) + delta);
      if (delta > 0 && total >= 2) return prev;
      return { ...prev, [slug]: next };
    });
  }

  return (
    <div>
      <div className="hint">Bonne réponse ! Distribue 2 gorgées comme tu veux.</div>
      <div className="players-list">
        {others.map((p) => {
          const amount = amounts[p.slug] ?? 0;
          return (
            <div className="player-chip" key={p.slug}>
              <span className="pname">{p.name}</span>
              <div className="stepper">
                <button className="btn-ghost" style={{ padding: "6px 12px" }} onClick={() => bump(p.slug, -1)} disabled={amount === 0}>
                  −
                </button>
                <span className="stepper-value">{amount}</span>
                <button className="btn-ghost" style={{ padding: "6px 12px" }} onClick={() => bump(p.slug, 1)} disabled={total >= 2}>
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="hint">Distribué : {total}/2</div>
      <button
        className="btn-primary"
        disabled={busy || total !== 2}
        onClick={() =>
          onConfirm(
            Object.entries(amounts)
              .filter(([, amount]) => amount > 0)
              .map(([slug, amount]) => ({ slug, amount }))
          )
        }
      >
        Confirmer
      </button>
    </div>
  );
}
