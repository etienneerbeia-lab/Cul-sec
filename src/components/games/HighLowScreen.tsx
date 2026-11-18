"use client";

import { useGame } from "../GameContext";
import { Button } from "../ui/Button";
import { cardKey, PlayingCardV2 } from "../ui/Cards";
import { TimerBar, Verdict, Waiting } from "../ui/Feedback";
import { Kicker, Screen } from "../ui/Layout";
import { Avatar, cleanName, PlayerName } from "../ui/Players";
import { GulpList, NextRoundActions, sumGulps } from "../ui/Results";

export default function HighLowScreen() {
  const { game, mySlug, busy, act } = useGame();
  const h = game.highlow!;
  const done = game.phase === "showdown";
  const activeSlug = h.order[h.pointer];
  const active = game.playersPublic.find((p) => p.slug === activeSlug);
  const myTurn = !done && activeSlug === mySlug;
  const last = h.turns[h.turns.length - 1];
  const recent = h.turns.slice(-7);

  return (
    <Screen
      actions={
        done ? (
          <NextRoundActions />
        ) : myTurn ? (
          <div className="grid grid-cols-2 gap-3">
            <Button disabled={busy} haptics="select" onClick={() => act({ type: "hlGuess", guess: "moins" })}>
              ⬇ Moins
            </Button>
            <Button disabled={busy} haptics="select" onClick={() => act({ type: "hlGuess", guess: "plus" })}>
              ⬆ Plus
            </Button>
          </div>
        ) : (
          <Waiting>{active ? `${cleanName(active.name)} réfléchit…` : "…"}</Waiting>
        )
      }
    >
      {!done && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {active && <Avatar name={active.name} slug={active.slug} size={36} />}
            <div className="min-w-0">
              <Kicker>{myTurn ? "À toi !" : "Au tour de"}</Kicker>
              {active && <PlayerName name={active.name} me={myTurn} />}
            </div>
          </div>
          <div className="text-right">
            <Kicker>Série en jeu</Kicker>
            <div className="font-display text-2xl font-extrabold text-beer">
              {h.pile} 🍺
            </div>
          </div>
        </div>
      )}
      {!done && <TimerBar deadlineAt={game.timer?.deadlineAt} totalMs={25000} />}

      <div className="relative my-6 flex items-center justify-center">
        <div className="pointer-events-none absolute h-56 w-56 rounded-full bg-violet/25 blur-3xl" />
        <PlayingCardV2 card={h.current} size="xl" flipKey={`${h.turns.length}-${cardKey(h.current)}`} />
      </div>

      {last && (
        <div key={h.turns.length}>
          <Verdict tone={last.correct ? "good" : "bad"}>
            {cleanName(last.name)} : {last.guess === "plus" ? "plus" : "moins"} →{" "}
            {last.correct ? "gagné !" : `raté, ${last.drank} 🍺`}
          </Verdict>
        </div>
      )}

      {recent.length > 1 && (
        <div className="mt-4 flex justify-center gap-1.5 overflow-hidden">
          {recent.map((t, i) => (
            <div key={i} className={`flex flex-col items-center gap-1 ${t.correct ? "" : "opacity-60"}`}>
              <PlayingCardV2 card={t.card} size="sm" />
              <span className="text-xs">{t.correct ? "✓" : "✗"}</span>
            </div>
          ))}
        </div>
      )}

      {!done && (
        <p className="mt-3 text-center text-sm text-mute">
          Une carte égale compte comme perdue. Tour {Math.min(h.pointer + 1, h.order.length)} / {h.order.length}
        </p>
      )}

      {done && (
        <div className="mt-4">
          <GulpList rows={sumGulps(game, (game.drinks ?? []).map((d) => ({ slug: d.slug, gulps: d.n })))} />
        </div>
      )}
    </Screen>
  );
}
