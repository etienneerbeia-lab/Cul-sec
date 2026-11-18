"use client";

import { VOTE_MS } from "@/lib/vote/engine";
import { useGame } from "../GameContext";
import { OptionCard } from "../ui/Form";
import { TimerBar, Waiting } from "../ui/Feedback";
import { Card, Kicker, Screen } from "../ui/Layout";
import { cleanName, PlayerRow } from "../ui/Players";
import { GulpList, NextRoundActions, sumGulps } from "../ui/Results";

export default function VoteScreen() {
  const { game, mySlug, busy, act, myVoteChoice } = useGame();
  const done = game.phase === "showdown";
  const v = game.vote!;
  const r = done ? game.lastResults! : null;
  const qui = (r?.voteMode ?? v.mode) === "qui";
  const responded = v.responded.includes(mySlug);
  const waitingOn = game.playersPublic.filter((p) => !v.responded.includes(p.slug)).map((p) => cleanName(p.name));

  return (
    <Screen
      actions={
        done ? (
          <NextRoundActions />
        ) : responded ? (
          <Waiting>
            {waitingOn.length ? `On attend ${waitingOn.slice(0, 3).join(", ")}${waitingOn.length > 3 ? "…" : ""}` : "Dépouillement…"}
          </Waiting>
        ) : (
          <p className="text-center text-sm text-mute">Vote secret, résultat quand tout le monde a voté.</p>
        )
      }
    >
      <Kicker className="mb-2 text-center">{qui ? "Qui de nous…" : "Tu préfères…"}</Kicker>
      {!done && (
        <div className="mb-4">
          <TimerBar deadlineAt={game.timer?.deadlineAt} totalMs={VOTE_MS} />
        </div>
      )}

      {qui ? (
        <>
          <Card className="mb-4 text-center">
            <h2 className="font-display text-[1.5rem] font-bold leading-snug text-balance">{v.prompt}</h2>
          </Card>
          {!done ? (
            <div className="flex flex-col gap-2">
              {game.playersPublic
                .filter((p) => p.slug !== mySlug)
                .map((p) => (
                  <PlayerRow
                    key={p.slug}
                    name={p.name}
                    slug={p.slug}
                    selected={myVoteChoice === p.slug}
                    dim={responded && myVoteChoice !== p.slug}
                    disabled={busy || responded}
                    onClick={() => act({ type: "vote", choice: p.slug })}
                    right={myVoteChoice === p.slug ? <span className="text-neon">✓</span> : undefined}
                  />
                ))}
            </div>
          ) : (
            <div className="stagger flex flex-col gap-2">
              {r!.voteTally!.map((t, i) => (
                <div key={t.slug} className="cs-row" data-active={i === 0 && t.votes > 0}>
                  <span className="flex-1 font-semibold">{cleanName(t.name)}</span>
                  <div className="flex gap-1">
                    {Array.from({ length: t.votes }).map((_, k) => (
                      <span key={k} className="h-3 w-3 rounded-full bg-neon" style={{ animation: `cs-pop 0.4s ${0.15 * k}s both` }} />
                    ))}
                  </div>
                  <span className="w-16 text-right font-display font-extrabold">
                    {t.votes} voix
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : !done ? (
        <div className="flex flex-col gap-3">
          <OptionCard selected={myVoteChoice === "A"} disabled={busy || responded} onClick={() => act({ type: "vote", choice: "A" })}>
            {v.question.promptA}
          </OptionCard>
          <div className="text-center font-display text-lg font-extrabold text-neon">OU</div>
          <OptionCard selected={myVoteChoice === "B"} disabled={busy || responded} onClick={() => act({ type: "vote", choice: "B" })}>
            {v.question.promptB}
          </OptionCard>
        </div>
      ) : (
        <TpResult />
      )}

      {done && (
        <div className="mt-5">
          <GulpList rows={sumGulps(game, (game.drinks ?? []).map((d) => ({ slug: d.slug, gulps: d.n })))} />
        </div>
      )}
    </Screen>
  );
}

function TpResult() {
  const { game } = useGame();
  const r = game.lastResults!;
  const total = Math.max(1, (r.countA ?? 0) + (r.countB ?? 0));
  const sides = [
    { key: "A", label: r.promptA!, count: r.countA ?? 0 },
    { key: "B", label: r.promptB!, count: r.countB ?? 0 },
  ];
  return (
    <div className="flex flex-col gap-3">
      {sides.map((s) => {
        const pct = Math.round((s.count / total) * 100);
        const minority = !r.voteTie && s.count < total - s.count;
        const names = (r.voteEntries ?? []).filter((e) => e.choice === s.key).map((e) => cleanName(e.name));
        return (
          <Card key={s.key} className={`relative overflow-hidden ${minority ? "border-danger/50!" : ""}`}>
            <div
              className={`absolute inset-y-0 left-0 ${minority ? "bg-danger/15" : "bg-lime/12"}`}
              style={{ width: `${pct}%`, transition: "width 1s var(--ease-out)" }}
            />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold leading-snug">{s.label}</div>
                <div className="mt-1 text-sm text-mute">{names.join(", ") || "Personne"}</div>
              </div>
              <div className="font-display text-2xl font-extrabold">{pct}%</div>
            </div>
          </Card>
        );
      })}
      {r.voteTie && <p className="text-center text-ink-2">Égalité parfaite : tout le monde trinque !</p>}
    </div>
  );
}
