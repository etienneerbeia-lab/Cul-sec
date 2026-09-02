"use client";

import { useMemo } from "react";
import type { GameState } from "@/lib/game/types";

export default function UndercoverVoteScreen({
  game,
  mySlug,
  busy,
  onSubmitVote,
}: {
  game: GameState;
  mySlug: string;
  busy: boolean;
  onSubmitVote: (targetSlug: string) => void;
}) {
  const u = game.undercover!;
  const respondedCount = u.voteResponded.length;
  const total = u.remainingSlugs.length;
  const amEliminated = !u.remainingSlugs.includes(mySlug);
  const iHaveVoted = u.voteResponded.includes(mySlug);
  const waitingOn = useMemo(
    () =>
      u.remainingSlugs
        .filter((slug) => !u.voteResponded.includes(slug))
        .map((slug) => game.playersPublic.find((p) => p.slug === slug)!.name),
    [u.remainingSlugs, u.voteResponded, game.playersPublic]
  );

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
          Vote envoyé ! En attente du vote de {waitingOn.join(", ")}...
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
    </>
  );
}
