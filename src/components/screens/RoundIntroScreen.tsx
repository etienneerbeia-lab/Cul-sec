"use client";

import { roundTypeById } from "@/lib/game/roundTypes";
import { RULES } from "@/lib/game/rules";
import type { GameState } from "@/lib/game/types";
import { Button } from "../ui/Button";
import { Waiting } from "../ui/Feedback";
import { Card, Hero, Kicker, Screen } from "../ui/Layout";
import { Avatar, PlayerName } from "../ui/Players";

// Écran de règles court avant chaque mini-jeu.
export default function RoundIntroScreen({
  game,
  isHost,
  busy,
  onConfirm,
}: {
  game: GameState;
  isHost: boolean;
  busy: boolean;
  onConfirm: () => void;
}) {
  const rt = roundTypeById(game.roundTypeId as string);
  const rules = RULES[rt.id];
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
      <Hero icon={rt.icon} kicker={`Manche ${game.round}${game.totalRounds ? ` sur ${game.totalRounds}` : ""}`} title={rt.label}>
        {rt.tagline}
      </Hero>

      {duelists && (
        <Card className="animate-rise mb-3 flex items-center justify-around gap-2">
          {duelists.map((p, i) => (
            <div key={p.slug} className="contents">
              {i === 1 && <span className="font-display text-2xl font-extrabold text-neon">VS</span>}
              <div className="flex flex-col items-center gap-1.5">
                <Avatar name={p.name} slug={p.slug} size={56} />
                <PlayerName name={p.name} />
              </div>
            </div>
          ))}
        </Card>
      )}

      <div className="stagger flex flex-col gap-3">
        <Card>
          <Kicker className="mb-2">Comment on joue</Kicker>
          <ul className="flex flex-col gap-2">
            {rules.how.map((line) => (
              <li key={line} className="flex gap-2.5 leading-snug">
                <span className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                {line}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="border-beer/30!">
          <Kicker className="mb-2 text-beer!">Qui boit ?</Kicker>
          <ul className="flex flex-col gap-2">
            {rules.gulps.map((line) => (
              <li key={line} className="flex gap-2.5 leading-snug">
                <span className="shrink-0">🍺</span>
                {line}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </Screen>
  );
}
