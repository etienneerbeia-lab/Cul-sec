"use client";

import { useState } from "react";
import { DICE421_MAX_THROWS, label421, score421 } from "@/lib/games/dice421";
import { haptic } from "@/lib/haptics";
import { useGame } from "../GameContext";
import { Button } from "../ui/Button";
import { Die } from "../ui/Dice";
import { TimerBar, Waiting } from "../ui/Feedback";
import { Card, Kicker, Screen } from "../ui/Layout";
import { Avatar, cleanName, PlayerName } from "../ui/Players";
import { GulpList, NextRoundActions, sumGulps } from "../ui/Results";

export default function Dice421Screen() {
  const { game, mySlug, busy, act } = useGame();
  const d = game.dice421!;
  const done = game.phase === "showdown";
  const cur = d.current;
  const myTurn = !done && cur?.slug === mySlug;
  // Dés que je choisis de garder, remis à zéro à chaque lancer.
  const [holdState, setHoldState] = useState<{ key: string; hold: boolean[] }>({ key: "", hold: [false, false, false] });
  const turnKey = cur ? `${cur.slug}:${cur.throws}` : "";
  const hold = holdState.key === turnKey ? holdState.hold : [false, false, false];
  const toggle = (i: number) => {
    haptic("select");
    const next = [...hold];
    next[i] = !next[i];
    setHoldState({ key: turnKey, hold: next });
  };
  const last = d.finished[d.finished.length - 1];
  // Dés affichés : le lancer en cours, sinon le dernier lancer terminé.
  const showRoll = cur && cur.throws > 0 ? cur : (last ?? null);
  const ranking = [...d.finished].sort((a, b) => score421(b.dice) - score421(a.dice));

  let actions;
  if (done) actions = <NextRoundActions />;
  else if (myTurn && cur)
    actions =
      cur.throws === 0 ? (
        <Button disabled={busy} haptics="impact" onClick={() => act({ type: "d421Roll" })}>
          🎲 Lancer les dés
        </Button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" disabled={busy} onClick={() => act({ type: "d421Stop" })}>
            Je garde ça
          </Button>
          <Button disabled={busy || hold.every(Boolean)} haptics="impact" onClick={() => act({ type: "d421Roll", hold })}>
            Relancer ({DICE421_MAX_THROWS - cur.throws})
          </Button>
        </div>
      );
  else actions = <Waiting>{cur ? `${cleanName(cur.name)} lance…` : "…"}</Waiting>;

  return (
    <Screen actions={actions}>
      {!done && cur && (
        <>
          <div className="mb-2 flex items-center gap-2">
            <Avatar name={cur.name} slug={cur.slug} size={36} />
            <div className="flex-1">
              <Kicker>{myTurn ? "À toi !" : "Au tour de"}</Kicker>
              <PlayerName name={cur.name} me={myTurn} />
            </div>
            <div className="text-right">
              <Kicker>Lancer</Kicker>
              <div className="font-display text-xl font-extrabold">
                {cur.throws} / {DICE421_MAX_THROWS}
              </div>
            </div>
          </div>
          <TimerBar deadlineAt={game.timer?.deadlineAt} totalMs={30000} />
        </>
      )}

      <Card className="relative mt-4 overflow-hidden bg-[radial-gradient(ellipse_at_center,#2a5a46_0%,#14342a_75%)]! py-8 text-center">
        <div className="flex justify-center gap-4">
          {(showRoll?.dice ?? [0, 0, 0]).map((v, i) =>
            showRoll ? (
              <Die
                key={i}
                value={v}
                size={76}
                red
                held={myTurn ? hold[i] : !!showRoll.held?.[i]}
                rollKey={`${showRoll.slug}:${showRoll.throws}`}
                delay={i * 0.08}
                onClick={myTurn && cur && cur.throws > 0 ? () => toggle(i) : undefined}
              />
            ) : (
              <div key={i} className="h-[76px] w-[76px] rounded-[15px] border-2 border-dashed border-white/20" />
            )
          )}
        </div>
        {showRoll && (
          <div key={`${showRoll.slug}:${showRoll.throws}`} className="animate-pop mt-5 font-display text-3xl font-extrabold" style={{ animationDelay: "0.7s" }}>
            {label421(showRoll.dice)}
          </div>
        )}
        {myTurn && cur && cur.throws > 0 && <p className="mt-2 text-sm text-white/70">Touche un dé pour le garder.</p>}
      </Card>

      {ranking.length > 0 && (
        <div className="mt-5">
          <Kicker className="mb-2 px-1">Classement</Kicker>
          <div className="flex flex-col gap-2">
            {ranking.map((r, i) => (
              <div key={r.slug} className="cs-row" data-dim={done && i === ranking.length - 1 ? false : undefined}>
                <Avatar name={r.name} slug={r.slug} size={34} />
                <span className="min-w-0 flex-1">
                  <PlayerName name={r.name} me={r.slug === mySlug} />
                </span>
                <span className="flex gap-1">
                  {r.dice.map((v, k) => (
                    <Die key={k} value={v} size={24} red />
                  ))}
                </span>
                <span className="w-24 text-right text-sm font-bold text-ink-2">{label421(r.dice)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {done && (
        <div className="mt-5">
          <GulpList rows={sumGulps(game, (game.drinks ?? []).map((x) => ({ slug: x.slug, gulps: x.n })))} />
        </div>
      )}
    </Screen>
  );
}
