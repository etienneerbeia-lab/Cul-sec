"use client";

import { useMemo } from "react";
import type { GameState } from "@/lib/game/types";

export default function MemeVoteScreen({
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
  onSubmitVote: (authorSlug: string) => void;
  onForceReveal: () => void;
}) {
  const m = game.meme!;
  const respondedCount = m.voteResponded.length;
  const total = game.playersPublic.length;
  const iHaveVoted = m.voteResponded.includes(mySlug);

  const options = useMemo(
    () => m.voteOrder.filter((slug) => slug !== mySlug && m.captions[slug]),
    [m.voteOrder, m.captions, mySlug]
  );

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

      <img className="meme-image" src={m.template.url} alt="Mème à voter" />

      {iHaveVoted ? (
        <div className="hint" style={{ marginTop: 16 }}>
          Vote envoyé ! En attente des autres...
        </div>
      ) : options.length === 0 ? (
        <div className="hint" style={{ marginTop: 16 }}>
          Personne d&apos;autre n&apos;a écrit de légende cette fois — rien à départager.
        </div>
      ) : (
        <>
          <div className="hint" style={{ marginTop: 12 }}>
            Vote pour la légende la plus drôle (pas la tienne).
          </div>
          <div className="vote-options">
            {options.map((slug) => (
              <button
                key={slug}
                className="vote-option"
                disabled={busy}
                onClick={() => onSubmitVote(slug)}
              >
                {m.captions[slug]}
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
