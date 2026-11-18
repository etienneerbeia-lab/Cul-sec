"use client";

import { DUEL_BASE } from "@/lib/games/duel";
import { useGame } from "../GameContext";
import { Button } from "../ui/Button";
import { PlayingCardV2 } from "../ui/Cards";
import { TimerBar, Verdict, Waiting } from "../ui/Feedback";
import { Kicker, Screen } from "../ui/Layout";
import { Avatar, cleanName, PlayerName } from "../ui/Players";
import { GulpList, NextRoundActions, sumGulps } from "../ui/Results";

export default function DuelScreen() {
  const { game, mySlug, busy, act } = useGame();
  const d = game.duel!;
  const done = game.phase === "showdown";
  const pa = game.playersPublic.find((p) => p.slug === d.a)!;
  const pb = game.playersPublic.find((p) => p.slug === d.b)!;
  const amDuelist = mySlug === d.a || mySlug === d.b;
  const myPos = mySlug === d.a ? 0 : 1;
  const lastFlip = d.flips[d.flips.length - 1];
  const batailles = d.flips.filter((f) => f.a.value === f.b.value).length;
  // Cartes affichées : celles du coup en cours, sinon celles du dernier coup.
  const cardA = d.pendingA ?? (d.revealed[0] ? undefined : done ? lastFlip?.a : undefined);
  const cardB = d.pendingB ?? (d.revealed[1] ? undefined : done ? lastFlip?.b : undefined);
  const stake = DUEL_BASE + 2 * batailles;

  let actions;
  if (done) actions = <NextRoundActions />;
  else if (d.stage === "bets") {
    if (amDuelist) actions = <Waiting>Les autres parient sur toi…</Waiting>;
    else if (d.betResponded.includes(mySlug))
      actions = <Waiting>Pari enregistré sur {cleanName(d.bets[mySlug] === "a" ? pa.name : pb.name)}</Waiting>;
    else
      actions = (
        <div className="grid grid-cols-2 gap-3">
          <Button disabled={busy} haptics="select" onClick={() => act({ type: "duelBet", side: "a" })}>
            {cleanName(pa.name)}
          </Button>
          <Button disabled={busy} haptics="select" onClick={() => act({ type: "duelBet", side: "b" })}>
            {cleanName(pb.name)}
          </Button>
        </div>
      );
  } else if (amDuelist && !d.revealed[myPos])
    actions = (
      <Button disabled={busy} haptics="impact" onClick={() => act({ type: "duelFlip" })}>
        Retourner ma carte
      </Button>
    );
  else actions = <Waiting>{amDuelist ? "L'adversaire retourne sa carte…" : "Les duellistes retournent leurs cartes…"}</Waiting>;

  return (
    <Screen actions={actions}>
      {!done && (
        <div className="mb-3">
          <Kicker className="mb-1 text-center">
            {d.stage === "bets" ? "Faites vos paris : qui va gagner ?" : batailles ? `Bataille ! ×${batailles}` : "Retournez vos cartes"}
          </Kicker>
          <TimerBar deadlineAt={game.timer?.deadlineAt} totalMs={d.stage === "bets" ? 15000 : 20000} />
        </div>
      )}

      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {[
          { p: pa, card: cardA, side: "a" as const },
          null,
          { p: pb, card: cardB, side: "b" as const },
        ].map((slot, i) =>
          slot ? (
            <div key={slot.p.slug} className="flex flex-col items-center gap-2">
              <Avatar name={slot.p.name} slug={slot.p.slug} size={48} />
              <PlayerName name={slot.p.name} me={slot.p.slug === mySlug} />
              <div className={done && d.winner === slot.side ? "drop-shadow-[0_0_24px_rgba(159,242,122,0.6)]" : ""}>
                <PlayingCardV2 card={slot.card} faceDown={!slot.card} size="lg" />
              </div>
              {d.stage === "bets" && (
                <span className="text-sm text-mute">
                  {Object.values(d.bets).filter((s) => s === slot.side).length} pari(s)
                </span>
              )}
            </div>
          ) : (
            <div key={i} className="font-display text-3xl font-extrabold text-neon">VS</div>
          )
        )}
      </div>

      {batailles > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {d.flips
            .filter((f) => f.a.value === f.b.value)
            .map((f, i) => (
              <span key={i} className="rounded-full bg-amber/20 px-3 py-1 text-sm font-bold text-amber">
                Bataille sur {f.a.value > 10 ? ["V", "D", "R", "A"][f.a.value - 11] : f.a.value} !
              </span>
            ))}
        </div>
      )}

      {!done && <p className="mt-4 text-center text-sm text-mute">Le perdant boira {stake} 🍺 (+2 par bataille).</p>}

      {done && (
        <div className="mt-4 flex flex-col gap-4">
          <Verdict tone="neutral">{cleanName(d.winner === "a" ? pa.name : pb.name)} gagne le duel !</Verdict>
          <GulpList rows={sumGulps(game, (game.drinks ?? []).map((x) => ({ slug: x.slug, gulps: x.n })))} />
        </div>
      )}
    </Screen>
  );
}
