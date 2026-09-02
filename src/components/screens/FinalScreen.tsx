import type { GameState } from "@/lib/game/types";

export default function FinalScreen({
  game,
  mySlug,
  isHost,
  onAssignCulSec,
  onRejouer,
  onNewRoom,
}: {
  game: GameState;
  mySlug: string;
  isHost: boolean;
  onAssignCulSec: (targetSlug: string) => void;
  onRejouer: () => void;
  onNewRoom: () => void;
}) {
  const sorted = [...game.playersPublic].sort((a, b) => b.gulpsTotal - a.gulpsTotal);
  const rule = game.culSecRule ?? "last";
  const mostGulps = sorted[0];
  // Matches culSecWinnerSlug() in src/lib/game/engine.ts exactly (ascending
  // sort, take index 0) — the server authorizes assign-cul-sec against that
  // same computation, so any divergence here would let the UI show the
  // picker to the wrong player.
  const leastGulps = [...game.playersPublic].sort((a, b) => a.gulpsTotal - b.gulpsTotal)[0];

  return (
    <>
      <div className="title">Fin de soirée</div>
      <div className="subtitle">
        {game.round} manche{game.round > 1 ? "s" : ""} jouée{game.round > 1 ? "s" : ""}. Voici le
        tableau des courageux.
      </div>

      {rule === "last" ? (
        <div className="cul-sec-banner">
          <div className="cul-sec-label">Cul sec final</div>
          <div className="cul-sec-name">{mostGulps.name}</div>
          <div className="hint">Le plus arrosé de la soirée clôture avec un cul sec.</div>
        </div>
      ) : game.culSecTargetSlug ? (
        <div className="cul-sec-banner">
          <div className="cul-sec-label">Cul sec final</div>
          <div className="cul-sec-name">
            {game.playersPublic.find((p) => p.slug === game.culSecTargetSlug)?.name}
          </div>
          <div className="hint">Désigné par {leastGulps.name}, le plus sobre de la soirée.</div>
        </div>
      ) : mySlug === leastGulps.slug ? (
        <div className="cul-sec-banner">
          <div className="cul-sec-label">C&apos;est toi le plus sobre !</div>
          <div className="hint" style={{ marginBottom: 10 }}>
            Choisis qui boit le cul sec final.
          </div>
          <div className="players-list">
            {game.playersPublic
              .filter((p) => p.slug !== mySlug)
              .map((p) => (
                <button
                  key={p.slug}
                  className="btn-wine"
                  style={{ marginBottom: 8 }}
                  onClick={() => onAssignCulSec(p.slug)}
                >
                  {p.name}
                </button>
              ))}
          </div>
        </div>
      ) : (
        <div className="cul-sec-banner">
          <div className="cul-sec-label">Cul sec final</div>
          <div className="hint">
            En attente que {leastGulps.name} désigne qui boit le cul sec...
          </div>
        </div>
      )}

      <div className="stack">
        {sorted.map((p, i) => (
          <div className={`leaderboard-row${i === 0 && p.gulpsTotal > 0 ? " top" : ""}`} key={p.slug}>
            <div className="lb-rank">{i + 1}</div>
            <div className="lb-name">
              {p.name}
              {i === 0 && p.gulpsTotal > 0 ? " 🏆" : ""}
            </div>
            <div className="lb-total">{p.gulpsTotal} 🥃</div>
          </div>
        ))}
      </div>
      <div className="spacer" />
      {isHost ? (
        <button className="btn-primary" onClick={onRejouer}>
          Rejouer
        </button>
      ) : (
        <div className="hint">En attente que l&apos;hôte relance une partie...</div>
      )}
      <button className="btn-ghost" style={{ marginTop: 12 }} onClick={onNewRoom}>
        Nouvelle partie
      </button>
    </>
  );
}
