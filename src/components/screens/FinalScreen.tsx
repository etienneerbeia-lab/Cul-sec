"use client";

import type { GameState } from "@/lib/game/types";
import { Button } from "../ui/Button";
import { CountUp, Waiting } from "../ui/Feedback";
import { Card, Kicker, Screen, Section } from "../ui/Layout";
import { Avatar, cleanName, PlayerName, PlayerRow } from "../ui/Players";

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
  const ranked = [...game.playersPublic].sort((a, b) => b.gulpsTotal - a.gulpsTotal);
  const rule = game.culSecRule ?? "last";
  const max = ranked[0]?.gulpsTotal ?? 0;
  const mostDrunk = ranked.filter((p) => p.gulpsTotal === max);
  // Même règle que le serveur (culSecWinnerSlug) : tri croissant stable.
  const sober = [...game.playersPublic].sort((a, b) => a.gulpsTotal - b.gulpsTotal)[0];
  const target = game.playersPublic.find((p) => p.slug === game.culSecTargetSlug);
  const solo = game.playersPublic.length === 1;

  let banner: React.ReactNode;
  if (solo) {
    banner = <BannerText title="Partie terminée" sub={`${max} gorgée${max > 1 ? "s" : ""} au compteur. Santé !`} />;
  } else if (rule === "last") {
    banner = (
      <BannerText
        title={mostDrunk.map((p) => cleanName(p.name)).join(" & ")}
        sub={`${mostDrunk.length > 1 ? "Ex æquo, ils finissent" : "Le plus arrosé finit"} sur un cul sec !`}
      />
    );
  } else if (target) {
    banner = <BannerText title={cleanName(target.name)} sub={`Désigné par ${cleanName(sober.name)}, le plus sobre de la soirée.`} />;
  } else if (sober.slug === mySlug) {
    banner = (
      <div>
        <div className="font-display text-2xl font-extrabold">Tu es le plus sobre !</div>
        <p className="mb-3 text-ink-2">Choisis qui boit le cul sec final.</p>
        <div className="flex flex-col gap-2 text-left">
          {game.playersPublic
            .filter((p) => p.slug !== mySlug)
            .map((p) => (
              <PlayerRow key={p.slug} name={p.name} slug={p.slug} onClick={() => onAssignCulSec(p.slug)} right={<span>🍺</span>} />
            ))}
        </div>
      </div>
    );
  } else {
    banner = <Waiting>{cleanName(sober.name)}, le plus sobre, choisit qui boit le cul sec…</Waiting>;
  }

  const podium = ranked.slice(0, 3);
  return (
    <Screen
      actions={
        <>
          {isHost ? (
            <Button onClick={onRejouer} haptics="success">
              Rejouer avec la même table
            </Button>
          ) : (
            <Waiting>L&apos;hôte peut relancer une partie</Waiting>
          )}
          <Button variant="ghost" onClick={onNewRoom}>
            Quitter le salon
          </Button>
        </>
      }
    >
      <div className="py-2 text-center">
        <Kicker>Fin de soirée · {game.round} manche{game.round > 1 ? "s" : ""}</Kicker>
        <h1 className="mt-1 font-display text-[2.4rem] font-extrabold leading-none">Le verdict</h1>
      </div>

      <Card className="animate-pop relative my-3 overflow-hidden text-center">
        <div className="pointer-events-none absolute -top-20 left-1/2 h-44 w-72 -translate-x-1/2 rounded-full bg-amber/30 blur-3xl" />
        <Kicker className="mb-1 text-beer!">🍺 Cul sec final</Kicker>
        {banner}
      </Card>

      {!solo && (
        <div className="mt-2 flex items-end justify-center gap-3">
          {[podium[1], podium[0], podium[2]].map((p, i) =>
            p ? (
              <div key={p.slug} className="animate-rise flex w-[30%] flex-col items-center gap-1.5" style={{ animationDelay: `${0.15 * i}s` }}>
                <Avatar name={p.name} slug={p.slug} size={i === 1 ? 60 : 48} />
                <PlayerName name={p.name} me={p.slug === mySlug} />
                <div
                  className={`flex w-full flex-col items-center justify-start rounded-t-2xl border border-white/10 pt-2 font-display font-extrabold ${
                    i === 1 ? "h-28 bg-gradient-to-b from-beer/40 to-beer/5 text-2xl" : i === 0 ? "h-20 bg-white/10 text-xl" : "h-14 bg-white/[0.06] text-lg"
                  }`}
                >
                  <CountUp value={p.gulpsTotal} duration={1200} /> 🍺
                </div>
              </div>
            ) : (
              <div key={i} className="w-[30%]" />
            )
          )}
        </div>
      )}

      <Section title="Classement des gorgées">
        <div className="stagger flex flex-col gap-2">
          {ranked.map((p, i) => (
            <PlayerRow
              key={p.slug}
              name={p.name}
              slug={p.slug}
              me={p.slug === mySlug}
              detail={i === 0 && max > 0 ? "Le plus arrosé" : p.slug === sober.slug ? "Le plus sobre" : undefined}
              right={
                <span className="font-display text-xl font-extrabold tabular-nums">
                  <CountUp value={p.gulpsTotal} duration={1000} />
                </span>
              }
            />
          ))}
        </div>
      </Section>
    </Screen>
  );
}

function BannerText({ title, sub }: { title: string; sub: string }) {
  return (
    <>
      <div className="font-display text-[2.2rem] font-extrabold leading-tight">{title}</div>
      <p className="text-ink-2">{sub}</p>
    </>
  );
}
