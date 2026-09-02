"use client";

import { useMemo } from "react";
import type { GameState } from "@/lib/game/types";

export default function UndercoverVoteScreen({
  game,
  mySlug,
  isHost,
  busy,
  onSubmitVote,
  onForceReveal,
}: {
  game: GameState;
  mySlug: string;
  isHost: boolean;
  busy: boolean;
  onSubmitVote: (targetSlug: string) => void;
  onForceReveal: () => void;
}) {
  const u = game.undercover!;
  const respondedCount = u.voteResponded.length;
  const total = u.remainingSlugs.length;
  const amEliminated = !u.remainingSlugs.includes(mySlug);
  const iHaveVoted = u.voteResponded.includes(mySlug);

  const candidates = useMemo(() => {
    const pool = u.tieBreakCandidates ?? u.remainingSlugs;
    return pool
      .filter((slug) => slug !== mySlug)
      .map((slug) => game.playersPublic.find((p) => p.slug === slug)!);
  }, [u.tieBreakCandidates, u.remainingSlugs, mySlug, game.playersPublic]);

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
          <div className="label">Vote</div>
          <div className="value">
            {respondedCount}/{total}
          </div>
        </div>
      </div>

      {u.tieBreakCandidates && (
        <div className="hint" style={{ marginBottom: 8 }}>
          Égalité au premier tour — revote entre{" "}
          {u.tieBreakCandidates
            .map((slug) => game.playersPublic.find((p) => p.slug === slug)!.name)
            .join(" et ")}
          .
        </div>
      )}

      {amEliminated ? (
        <div className="hint" style={{ marginTop: 16 }}>
          Tu as été éliminé de cette manche. Observe la suite...
        </div>
      ) : iHaveVoted ? (
        <div className="hint" style={{ marginTop: 16 }}>
          Vote envoyé ! En attente des autres...
        </div>
      ) : (
        <>
          <div className="hint" style={{ marginTop: 12 }}>
            Qui penses-tu être l&apos;imposteur ?
          </div>
          <div className="vote-options">
            {candidates.map((p) => (
              <button
                key={p.slug}
                className="vote-option"
                disabled={busy}
                onClick={() => onSubmitVote(p.slug)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </>
      )}

      {isHost && respondedCount < total && (
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
