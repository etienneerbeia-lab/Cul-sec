"use client";

import { QCM_ASK_MS, QCM_CHAMPION_GULPS } from "@/lib/games/qcm";
import { useGame } from "../GameContext";
import { haptic } from "@/lib/haptics";
import { TimerBar, Waiting } from "../ui/Feedback";
import { Card, Kicker, Screen } from "../ui/Layout";
import { Avatar, cleanName, PlayerRow } from "../ui/Players";
import { GulpList, NextRoundActions, sumGulps } from "../ui/Results";

const LETTERS = ["A", "B", "C", "D"];

export default function QcmScreen() {
  const { game, mySlug, busy, act } = useGame();
  const q = game.qcm!;
  const done = game.phase === "showdown";
  const question = q.questions[q.index];
  const mine = q.answers[mySlug];
  const answeredCount = Object.keys(q.answers).length;
  const reveal = q.stage === "reveal" || q.stage === "champion" || done;
  const last = q.history[q.history.length - 1];
  const champion = q.champion ? game.playersPublic.find((p) => p.slug === q.champion) : null;

  if (done || q.stage === "champion") {
    const ranked = [...game.playersPublic].sort(
      (a, b) => q.scores[b.slug].correct - q.scores[a.slug].correct || q.scores[a.slug].ms - q.scores[b.slug].ms
    );
    return (
      <Screen
        actions={
          done ? (
            <NextRoundActions />
          ) : q.champion === mySlug ? undefined : (
            <Waiting>{champion ? `${cleanName(champion.name)} choisit qui boit ${QCM_CHAMPION_GULPS} gorgées…` : "…"}</Waiting>
          )
        }
      >
        <Kicker className="mb-2 px-1">Score final</Kicker>
        <div className="stagger mb-5 flex flex-col gap-2">
          {ranked.map((p, i) => (
            <PlayerRow
              key={p.slug}
              name={p.name}
              slug={p.slug}
              me={p.slug === mySlug}
              active={p.slug === q.champion}
              detail={i === 0 && p.slug === q.champion ? "🏆 Champion de la manche" : undefined}
              right={
                <span className="font-display text-xl font-extrabold tabular-nums">
                  {q.scores[p.slug].correct}/{q.questions.length}
                </span>
              }
            />
          ))}
        </div>
        {q.stage === "champion" && q.champion === mySlug && (
          <Card className="border-beer/40!">
            <div className="mb-3 font-display text-xl font-extrabold">🏆 Tu es le champion !</div>
            <p className="mb-3 text-ink-2">Qui boit tes {QCM_CHAMPION_GULPS} gorgées ?</p>
            <div className="flex flex-col gap-2">
              {game.playersPublic
                .filter((p) => p.slug !== mySlug)
                .map((p) => (
                  <PlayerRow
                    key={p.slug}
                    name={p.name}
                    slug={p.slug}
                    disabled={busy}
                    onClick={() => act({ type: "qcmGive", targetSlug: p.slug })}
                    right={<span className="text-xl">🍺</span>}
                  />
                ))}
            </div>
          </Card>
        )}
        {done && <GulpList rows={sumGulps(game, (game.drinks ?? []).map((d) => ({ slug: d.slug, gulps: d.n })))} />}
      </Screen>
    );
  }

  return (
    <Screen
      actions={
        q.stage === "ask" ? (
          mine ? (
            <Waiting>
              Réponse envoyée · {answeredCount}/{game.playersPublic.length}
            </Waiting>
          ) : (
            <p className="text-center text-sm text-mute">Une seule réponse, pas de retour en arrière !</p>
          )
        ) : (
          <Waiting>Question suivante…</Waiting>
        )
      }
    >
      <div className="mb-2 flex items-center justify-between">
        <Kicker>
          Question {q.index + 1} / {q.questions.length}
        </Kicker>
        <span className="rounded-full bg-cyan/15 px-2.5 py-1 text-xs font-bold text-cyan">{question.category}</span>
      </div>
      {q.stage === "ask" && <TimerBar deadlineAt={game.timer?.deadlineAt} totalMs={QCM_ASK_MS} />}

      <Card key={q.index} className="animate-enter mt-3 text-center">
        {question.flagEmoji && <div className="mb-2 text-[5.5rem] leading-none">{question.flagEmoji}</div>}
        <h2 className="font-display text-[1.45rem] font-bold leading-snug text-balance">{question.prompt}</h2>
      </Card>

      <div className="mt-4 flex flex-col gap-2.5">
        {question.choices.map((c, i) => {
          const isRight = reveal && i === question.answerIdx;
          const isMine = mine?.choice === i;
          const wrongMine = reveal && isMine && !isRight;
          let cls = "border-white/12 bg-white/[0.05]";
          if (isRight) cls = "border-lime/70 bg-lime/15 text-lime";
          else if (wrongMine) cls = "border-danger/70 bg-danger/15 text-danger animate-shake";
          else if (isMine) cls = "border-neon/70 bg-neon/15";
          else if (reveal || mine) cls += " opacity-50";
          return (
            <button
              key={i}
              type="button"
              disabled={busy || !!mine || q.stage !== "ask"}
              onClick={() => {
                haptic("select");
                act({ type: "qcmAnswer", choice: i });
              }}
              className={`flex min-h-[58px] items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[1.05rem] font-semibold transition active:scale-[0.98] ${cls}`}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 font-display font-extrabold">
                {isRight ? "✓" : wrongMine ? "✗" : LETTERS[i]}
              </span>
              {c}
            </button>
          );
        })}
      </div>

      {q.stage === "reveal" && last && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {game.playersPublic.map((p) => (
            <span
              key={p.slug}
              className={`inline-flex items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-sm font-semibold ${
                last.correct[p.slug] ? "bg-lime/15 text-lime" : "bg-danger/15 text-danger"
              }`}
            >
              <Avatar name={p.name} slug={p.slug} size={24} />
              {cleanName(p.name)} {last.correct[p.slug] ? (last.fastest === p.slug ? "⚡" : "✓") : "🍺"}
            </span>
          ))}
        </div>
      )}
    </Screen>
  );
}
