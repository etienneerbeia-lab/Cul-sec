"use client";

import { useEffect } from "react";
import { casinoGameById } from "@/lib/casino/catalog";
import { formatChips } from "@/lib/chips/format";
import type { GameState } from "@/lib/game/types";
import { playSound } from "@/lib/sound";
import { Button } from "../ui/Button";
import { Waiting } from "../ui/Feedback";
import { Card, Kicker, Screen, Section } from "../ui/Layout";
import { cleanName, PlayerRow } from "../ui/Players";

const MEDALS = ["🥇", "🥈", "🥉"];

// Classement final commun à tous les jeux casino.
export default function CasinoFinalScreen({
  game,
  mySlug,
  isHost,
  onReplay,
  onLobby,
  onQuit,
}: {
  game: GameState;
  mySlug: string;
  isHost: boolean;
  onReplay: () => void;
  onLobby: () => void;
  onQuit: () => void;
}) {
  useEffect(() => playSound("vote"), []);
  const meta = casinoGameById(game.casinoGameId ?? "poker");
  const ranking = game.casinoRanking ?? [];
  const winners = ranking.filter((r) => r.rank === 1);
  const mine = ranking.find((r) => r.slug === mySlug);
  const minutes = game.casinoStartedAt && game.casinoEndedAt ? Math.max(1, Math.round((game.casinoEndedAt - game.casinoStartedAt) / 60000)) : null;

  return (
    <Screen
      actions={
        <>
          {isHost ? (
            <>
              <Button onClick={onReplay} haptics="success">
                Rejouer · {meta.label}
              </Button>
              <Button variant="secondary" onClick={onLobby}>
                ↺ Revenir au salon
              </Button>
            </>
          ) : (
            <Waiting>L&apos;hôte peut relancer une partie</Waiting>
          )}
          <Button variant="ghost" onClick={onQuit}>
            Quitter le salon
          </Button>
        </>
      }
    >
      <div className="py-2 text-center">
        <Kicker>
          {meta.icon} {meta.label}
          {minutes ? ` · ${minutes} min` : ""}
        </Kicker>
        <h1 className="mt-1 font-display text-[2.4rem] font-extrabold leading-none">Classement</h1>
      </div>

      <Card className="animate-pop relative my-3 overflow-hidden text-center">
        <div className="pointer-events-none absolute -top-20 left-1/2 h-44 w-72 -translate-x-1/2 rounded-full bg-cyan/25 blur-3xl" />
        <Kicker className="mb-1">🏆 {winners.length > 1 ? "Vainqueurs" : "Vainqueur"}</Kicker>
        <div className="font-display text-[2rem] font-extrabold leading-tight break-words">
          {winners.map((w) => cleanName(w.name)).join(" & ") || "—"}
        </div>
        {mine && <p className="text-ink-2">{mine.rank === 1 ? "Bravo, c'est toi !" : `Tu termines ${mine.rank}e.`}</p>}
      </Card>

      <Section title="Classement final">
        <div className="stagger flex flex-col gap-2">
          {ranking.map((r) => (
            <PlayerRow
              key={r.slug}
              name={r.name}
              slug={r.slug}
              me={r.slug === mySlug}
              detail={r.busted ? "Éliminé" : undefined}
              right={
                <span className="flex items-center gap-2 font-display text-lg font-extrabold tabular-nums">
                  <span className="text-mute">{MEDALS[r.rank - 1] ?? `${r.rank}e`}</span>
                  {formatChips(r.stack, meta.unit)}
                </span>
              }
            />
          ))}
        </div>
      </Section>
    </Screen>
  );
}
