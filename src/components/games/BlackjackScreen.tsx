"use client";

import { useEffect, useMemo, useState } from "react";
import { dealEventDelay, handValue, revealedCount } from "@/lib/blackjack/engine";
import type { BlackjackHand } from "@/lib/game/types";
import { haptic } from "@/lib/haptics";
import { useGame } from "../GameContext";
import { Button } from "../ui/Button";
import { PlayingCardV2 } from "../ui/Cards";
import { Gulps, TimerBar, Waiting } from "../ui/Feedback";
import { Kicker, Screen } from "../ui/Layout";
import { Avatar, cleanName, PlayerName, PlayerRow } from "../ui/Players";
import { GulpList, NextRoundActions, sumGulps } from "../ui/Results";

const OUTCOME_LABEL = { win: "Gagné", lose: "Perdu", push: "Égalité", blackjack: "Blackjack !" } as const;

export default function BlackjackScreen() {
  const { game, mySlug, busy, act } = useGame();
  const bj = game.blackjack!;
  const done = game.phase === "showdown";
  const [bet, setBet] = useState(2);

  // Les cartes arrivent une à une (rejoue le journal de distribution), puis
  // la banque retourne sa carte cachée et tire ses cartes une par une, plus
  // lentement, chacune ajoutée à droite dans l'ordre réel du tirage.
  // (Dépendances sur des valeurs, pas sur le tableau : chaque rafraîchissement
  // renvoie un nouveau dealLog, qui ne doit pas relancer le minuteur.)
  const [shown, setShown] = useState(bj.dealLog.length);
  const logLength = bj.dealLog.length;
  const nextDelay = shown < logLength ? dealEventDelay(bj.dealLog[shown]) : 0;
  useEffect(() => {
    if (shown >= logLength) return;
    const t = setTimeout(() => {
      haptic("tap");
      setShown((n) => n + 1);
    }, nextDelay);
    return () => clearTimeout(t);
  }, [shown, logLength, nextDelay]);
  const caughtUp = shown >= bj.dealLog.length;
  const log = useMemo(() => bj.dealLog.slice(0, shown), [bj.dealLog, shown]);

  const upShown = revealedCount(log, "dealer-up") > 0;
  const holeShown = revealedCount(log, "dealer-hidden") > 0;
  // Ancien journal sans événement « dealer-reveal » : on retourne la carte
  // à la fin du rejeu.
  const hasRevealEvent = bj.dealLog.some((e) => e.target === "dealer-reveal");
  const holeRevealed =
    bj.dealer.cards.length > 1 && (hasRevealEvent ? revealedCount(log, "dealer-reveal") > 0 : caughtUp);
  const hits = revealedCount(log, "dealer-hit");
  // Toujours dans l'ordre du tirage : carte visible, carte cachée, puis tirages.
  const dealerSlots = [
    ...(upShown ? [{ key: "up", card: bj.dealer.cards[0] }] : []),
    ...(holeShown ? [{ key: "hole", card: holeRevealed ? bj.dealer.cards[1] : null }] : []),
    ...bj.dealer.cards.slice(2, 2 + hits).map((card, i) => ({ key: `hit-${i}`, card })),
  ];
  const dealerCards = dealerSlots.flatMap((s) => (s.card ? [s.card] : []));
  const dealerTotal = handValue(dealerCards);
  const dealerDone = caughtUp && holeRevealed;

  const turnPlayer = caughtUp && bj.stage === "playerTurns" ? bj.players[bj.turnPointer] : null;
  const myTurn = turnPlayer?.slug === mySlug;
  const myHand = turnPlayer && myTurn ? turnPlayer.hands[turnPlayer.activeHandIdx] : null;
  const pending = caughtUp ? bj.distributionQueue[0] : undefined;
  const results = done ? (game.lastResults?.blackjackResults ?? []) : [];

  const visibleCards = (slug: string, h: BlackjackHand) => h.cards.slice(0, revealedCount(log, "player", slug, h.id));

  let actions: React.ReactNode;
  if (done) actions = caughtUp ? <NextRoundActions /> : <Waiting>La banque joue…</Waiting>;
  else if (bj.stage === "betting") {
    actions = bj.betResponded.includes(mySlug) ? (
      <Waiting>
        Mise posée · {bj.betResponded.length}/{bj.players.length}
      </Waiting>
    ) : (
      <>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                haptic("select");
                setBet(n);
              }}
              className={`grid h-14 w-14 place-items-center rounded-full border-4 border-dashed font-display text-xl font-extrabold transition active:scale-90 ${
                bet === n ? "scale-110 border-white bg-neon text-white shadow-[0_0_20px_rgba(255,61,139,0.7)]" : "border-white/40 bg-white/10"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <Button disabled={busy} haptics="success" onClick={() => act({ type: "bjBet", amount: bet })}>
          Miser {bet} gorgée{bet > 1 ? "s" : ""}
        </Button>
      </>
    );
  } else if (myHand) {
    const two = myHand.cards.length === 2;
    const canSplit = two && myHand.cards[0].value === myHand.cards[1].value;
    actions = (
      <div className="grid grid-cols-2 gap-2.5">
        <Button disabled={busy} haptics="tap" onClick={() => act({ type: "bjAct", action: "hit" })}>
          Carte
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => act({ type: "bjAct", action: "stand" })}>
          Je reste
        </Button>
        <Button variant="secondary" size="sm" disabled={busy || !two} onClick={() => act({ type: "bjAct", action: "double" })}>
          Doubler ×2
        </Button>
        <Button variant="secondary" size="sm" disabled={busy || !canSplit} onClick={() => act({ type: "bjAct", action: "split" })}>
          Séparer
        </Button>
      </div>
    );
  } else if (pending?.slug === mySlug) {
    actions = <p className="text-center text-sm text-mute">Choisis qui boit ta mise.</p>;
  } else {
    actions = (
      <Waiting>
        {!caughtUp
          ? hasRevealEvent && shown >= bj.dealLog.findIndex((e) => e.target === "dealer-reveal")
            ? "La banque joue…"
            : "Distribution…"
          : turnPlayer
            ? `${cleanName(turnPlayer.name)} joue…`
            : pending
              ? `${cleanName(pending.name)} choisit qui boit…`
              : "La banque joue…"}
      </Waiting>
    );
  }

  return (
    <Screen actions={actions}>
      {!done && bj.stage !== "dealerTurn" && caughtUp && (
        <div className="mb-3">
          <TimerBar deadlineAt={game.timer?.deadlineAt} totalMs={bj.stage === "betting" ? 25000 : 30000} />
        </div>
      )}

      <div className="relative rounded-[28px] border border-white/10 bg-[radial-gradient(ellipse_at_top,#1f6b4f_0%,#123f31_75%)] p-4 shadow-[inset_0_0_50px_rgba(0,0,0,0.55)]">
        <div className="mb-2 flex items-center justify-between">
          <Kicker className="text-white/70!">Banque</Kicker>
          {dealerCards.length > 0 && (
            <span
              key={dealerCards.length}
              className={`animate-pop font-display text-xl font-extrabold tabular-nums ${
                dealerDone && dealerTotal > 21 ? "text-danger" : "text-white"
              }`}
            >
              {dealerDone && dealerTotal > 21 ? `${dealerTotal} · Sauté !` : dealerTotal}
            </span>
          )}
        </div>
        <div className="flex min-h-[90px] flex-wrap gap-1.5">
          {dealerSlots.map((s) => (
            <div key={s.key} className={s.key.startsWith("hit") ? "bj-deal-in" : undefined}>
              <PlayingCardV2 card={s.card} faceDown={!s.card} size="sm" />
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-[0.7rem] font-semibold tracking-widest text-white/50 uppercase">
          La banque tire jusqu&apos;à 17 · Blackjack paie 3 pour 2
        </p>
      </div>

      {pending?.slug === mySlug && (
        <div className="mt-4">
          <Kicker className="mb-2 px-1 text-beer!">🎉 Gagné ! Qui boit tes {pending.amount} gorgées ?</Kicker>
          <div className="flex flex-col gap-2">
            {game.playersPublic
              .filter((p) => p.slug !== mySlug)
              .map((p) => (
                <PlayerRow
                  key={p.slug}
                  name={p.name}
                  slug={p.slug}
                  disabled={busy}
                  onClick={() => act({ type: "bjDistribute", targetSlug: p.slug })}
                  right={<span className="text-xl">🍺</span>}
                />
              ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {bj.players.map((p) => {
          const isTurn = turnPlayer?.slug === p.slug;
          const res = results.filter((r) => r.slug === p.slug);
          return (
            <div key={p.slug} className="cs-row flex-col items-stretch! gap-2! p-3!" data-active={isTurn}>
              <div className="flex items-center gap-2">
                <Avatar name={p.name} slug={p.slug} size={30} />
                <span className="min-w-0 flex-1">
                  <PlayerName name={p.name} me={p.slug === mySlug} />
                </span>
                {bj.stage === "betting" ? (
                  <span className="text-sm text-mute">{bj.betResponded.includes(p.slug) ? "Mise posée ✓" : "Mise…"}</span>
                ) : (
                  <span className="text-sm font-bold text-beer">Mise {p.hands.reduce((s, h) => s + h.bet, 0)}</span>
                )}
              </div>
              {p.hands.map((h, hi) => {
                const cards = visibleCards(p.slug, h);
                const total = handValue(cards);
                const r = res.find((x) => x.handIdx === hi);
                const activeHand = isTurn && p.activeHandIdx === hi;
                return (
                  <div key={h.id} className={`flex items-center gap-2 rounded-xl p-1.5 ${activeHand ? "bg-white/10" : ""}`}>
                    <div className="flex -space-x-5">
                      {cards.map((c, k) => (
                        <PlayingCardV2 key={k} card={c} size={p.slug === mySlug ? "sm" : "xs"} />
                      ))}
                    </div>
                    <div className="ml-auto text-right">
                      <div className={`font-display text-lg font-extrabold ${total > 21 ? "text-danger" : ""}`}>{cards.length ? total : ""}</div>
                      <div className="text-xs text-mute">
                        {r && caughtUp
                          ? h.status === "bust"
                            ? "Sauté"
                            : OUTCOME_LABEL[r.outcome]
                          : h.status === "bust"
                            ? "Sauté"
                            : h.status === "blackjack"
                              ? "Blackjack !"
                              : h.doubled
                                ? "Doublé"
                                : ""}
                      </div>
                    </div>
                    {r && caughtUp && r.outcome === "lose" && <Gulps n={r.amount} />}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {done && caughtUp && (
        <div className="mt-5">
          <GulpList rows={sumGulps(game, (game.drinks ?? []).map((d) => ({ slug: d.slug, gulps: d.n })))} />
        </div>
      )}
    </Screen>
  );
}
