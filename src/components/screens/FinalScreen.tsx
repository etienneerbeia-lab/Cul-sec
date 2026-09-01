import type { GameState } from "@/lib/game/types";

export default function FinalScreen({ game, onRestart }: { game: GameState; onRestart: () => void }) {
  const sorted = [...game.playersPublic].sort((a, b) => b.gulpsTotal - a.gulpsTotal);
  return (
    <>
      <div className="title">Fin de soirée</div>
      <div className="subtitle">
        {game.round} manche{game.round > 1 ? "s" : ""} jouée{game.round > 1 ? "s" : ""}. Voici le
        tableau des courageux.
      </div>
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
      <button className="btn-primary" onClick={onRestart}>
        Nouvelle partie
      </button>
    </>
  );
}
