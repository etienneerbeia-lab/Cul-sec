"use client";

import type { ReactNode } from "react";
import { useGame } from "../GameContext";
import { Button } from "./Button";
import { Gulps, Waiting } from "./Feedback";
import { Kicker } from "./Layout";
import { PlayerRow } from "./Players";

export interface ResultRow {
  slug: string;
  name: string;
  gulps: number;
  detail?: ReactNode;
  highlight?: boolean;
}

// Liste « qui boit combien » en fin de manche, du plus arrosé au moins.
export function GulpList({ rows, title = "Qui boit ?" }: { rows: ResultRow[]; title?: string }) {
  const { mySlug } = useGame();
  const sorted = [...rows].sort((a, b) => b.gulps - a.gulps);
  return (
    <div>
      <Kicker className="mb-2 px-1 text-beer!">🍺 {title}</Kicker>
      <div className="stagger flex flex-col gap-2">
        {sorted.map((r) => (
          <PlayerRow
            key={r.slug}
            name={r.name}
            slug={r.slug}
            me={r.slug === mySlug}
            detail={r.detail}
            active={r.highlight}
            dim={r.gulps === 0 && !r.highlight}
            right={<Gulps n={r.gulps} />}
          />
        ))}
      </div>
    </div>
  );
}

// Boutons de fin de manche (hôte) ou attente (les autres).
export function NextRoundActions() {
  const { isHost, busy, act, game } = useGame();
  const last = !!game.totalRounds && game.round >= game.totalRounds;
  if (!isHost) return <Waiting>L&apos;hôte lance la suite…</Waiting>;
  return (
    <>
      <Button disabled={busy} haptics="turn" onClick={() => act({ type: "nextRound" })}>
        {last ? "Voir le verdict final 🏆" : "Manche suivante"}
      </Button>
      {!last && (
        <Button variant="ghost" disabled={busy} onClick={() => act({ type: "endNight" })}>
          Terminer la soirée maintenant
        </Button>
      )}
    </>
  );
}

// Cumule des gorgées par joueur (plusieurs événements dans une manche).
export function sumGulps(game: { playersPublic: { slug: string; name: string }[] }, events: { slug: string; gulps: number }[]) {
  const map = new Map<string, number>();
  events.forEach((e) => map.set(e.slug, (map.get(e.slug) ?? 0) + e.gulps));
  return game.playersPublic.map((p) => ({ slug: p.slug, name: p.name, gulps: map.get(p.slug) ?? 0 }));
}
