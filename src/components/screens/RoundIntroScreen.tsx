"use client";

import { roundTypeById } from "@/lib/game/roundTypes";
import type { GameState } from "@/lib/game/types";
import { Button } from "../ui/Button";
import { Waiting } from "../ui/Feedback";
import { Screen } from "../ui/Layout";
import { Avatar, PlayerName } from "../ui/Players";

// Écran d'ouverture de chaque manche, commun à tous les mini-jeux : icône,
// numéro de manche, nom du jeu et une phrase d'accroche. Les règles
// détaillées vivent dans le menu (bottom sheet), ouvert par « Voir les règles ».
export default function RoundIntroScreen({
  game,
  isHost,
  busy,
  onConfirm,
  onShowRules,
}: {
  game: GameState;
  isHost: boolean;
  busy: boolean;
  onConfirm: () => void;
  onShowRules: () => void;
}) {
  const rt = roundTypeById(game.roundTypeId as string);
  const duelists = rt.id === "duel" && game.duelists ? game.duelists.map((i) => game.playersPublic[i]) : null;
  return (
    <Screen
      actions={
        isHost ? (
          <Button disabled={busy} haptics="turn" onClick={onConfirm}>
            C&apos;est parti !
          </Button>
        ) : (
          <Waiting>L&apos;hôte lance la manche…</Waiting>
        )
      }
    >
      <div className="cs-intro">
        <div className="cs-intro-icon" aria-hidden="true">
          <span>{rt.icon}</span>
        </div>

        <div className="cs-intro-round">
          Manche {game.round}
          {game.totalRounds ? <span className="text-mute"> / {game.totalRounds}</span> : null}
        </div>

        <h1 className="cs-intro-title">{rt.label}</h1>

        <p className="cs-intro-hook">{rt.tagline}</p>

        {duelists && (
          <div className="cs-intro-duel">
            {duelists.map((p, i) => (
              <div key={p.slug} className="contents">
                {i === 1 && <span className="font-display text-xl font-extrabold text-neon">VS</span>}
                <div className="flex min-w-0 flex-col items-center gap-1.5">
                  <Avatar name={p.name} slug={p.slug} size={52} />
                  <PlayerName name={p.name} />
                </div>
              </div>
            ))}
          </div>
        )}

        <button type="button" className="cs-intro-rules" onClick={onShowRules}>
          Voir les règles
        </button>
      </div>
    </Screen>
  );
}
