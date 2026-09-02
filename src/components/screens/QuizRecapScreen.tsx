import type { GameState } from "@/lib/game/types";

const TYPE_LABELS: Record<string, string> = {
  capital: "Capitale",
  flag: "Drapeau",
  date: "Date historique",
};

export default function QuizRecapScreen({
  game,
  isHost,
  busy,
  onContinue,
  onEndNight,
}: {
  game: GameState;
  isHost: boolean;
  busy: boolean;
  onContinue: () => void;
  onEndNight: () => void;
}) {
  const history = game.quiz?.history ?? [];

  return (
    <>
      <h2>Récap de la manche</h2>
      <div className="subtitle">Qui a répondu quoi.</div>

      <div className="players-list">
        {history.map((entry, i) => (
          <div className="player-chip" key={i} style={{ flexDirection: "column", alignItems: "stretch" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="pname">{entry.playerName}</span>
              <span className="pmeta">{TYPE_LABELS[entry.type] ?? "Question"}</span>
            </div>
            <div className="hint" style={{ margin: "6px 0 0", textAlign: "left" }}>
              {entry.prompt}
            </div>
            <div style={{ marginTop: 6 }}>
              <span className={entry.correct ? "quiz-result-banner correct" : "quiz-result-banner incorrect"} style={{ fontSize: "0.9rem", margin: 0, display: "block", textAlign: "left" }}>
                {entry.correct ? "✓ " : "✗ "}
                {entry.givenAnswer || "(pas de réponse)"}
              </span>
              {!entry.correct && (
                <span className="hint" style={{ textAlign: "left", margin: "2px 0 0" }}>
                  Bonne réponse : {entry.correctAnswer}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="spacer" />
      {isHost ? (
        <>
          <button className="btn-primary" disabled={busy} onClick={onContinue}>
            Continuer
          </button>
          <button className="btn-ghost" style={{ marginTop: 12 }} disabled={busy} onClick={onEndNight}>
            Terminer la soirée
          </button>
        </>
      ) : (
        <div className="hint">En attente de l&apos;hôte pour continuer...</div>
      )}
    </>
  );
}
