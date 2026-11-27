"use client";

import { useEffect, useMemo, useState } from "react";
import { dealEventDelay, handValue, revealedCount } from "@/lib/blackjack/engine";
import { toCode } from "@/lib/casino/cards";
import type { BlackjackHand, BlackjackResultEntry, Card } from "@/lib/game/types";
import { haptic } from "@/lib/haptics";
import { useGame } from "../GameContext";
import { ArcBlackjackTable, type ArcHand, type ArcPlace } from "../casino/table/ArcBlackjackTable";
import { useDealerChat } from "../casino/table/DealerChat";
import type { Bubble } from "../casino/table/NeonPokerTable";
import { Button } from "../ui/Button";
import { Waiting } from "../ui/Feedback";
import { Kicker, Screen } from "../ui/Layout";
import { cleanName, isBotName, PlayerRow } from "../ui/Players";
import { GulpList, NextRoundActions, sumGulps } from "../ui/Results";

// Blackjack Soirée sur la table « Arc sourire » (la même que la Blackjack
// Table Chill) : on mise des gorgées contre la banque. Règles, rejeu de la
// distribution et actions inchangés.

const BET_MS = 25000;
const TURN_MS = 30000;

// Résultat d'une de mes mains.
function myResult(r: BlackjackResultEntry): Bubble {
  if (r.outcome === "lose") return { tone: "lose", text: `Tu bois ${r.amount} 🍺` };
  if (r.outcome === "push") return { tone: "push", text: "Égalité" };
  if (r.outcome === "blackjack") return { tone: "bj", text: `BJ · ${r.amount} à donner` };
  return { tone: "win", text: `${r.amount} à donner` };
}

// Résultat d'un autre joueur, en une étiquette.
function otherResult(rs: BlackjackResultEntry[]): Bubble | null {
  if (!rs.length) return null;
  const drink = rs.filter((r) => r.outcome === "lose").reduce((a, r) => a + r.amount, 0);
  if (drink > 0) return { tone: "lose", text: `BOIT ${drink}` };
  if (rs.some((r) => r.outcome === "blackjack")) return { tone: "bj", text: "BJ" };
  if (rs.some((r) => r.outcome === "win")) return { tone: "win", text: "GAGNÉ" };
  return { tone: "push", text: "ÉGAL" };
}

export default function BlackjackScreen() {
  const { game, mySlug, busy, act, away } = useGame();
  const bj = game.blackjack!;
  const done = game.phase === "showdown";
  const [bet, setBet] = useState(2);
  const chat = useDealerChat();

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
  const holeRevealed = bj.dealer.cards.length > 1 && (hasRevealEvent ? revealedCount(log, "dealer-reveal") > 0 : caughtUp);
  const hits = revealedCount(log, "dealer-hit");
  // Toujours dans l'ordre du tirage : carte visible, carte cachée, puis tirages.
  const slotCards: (Card | null)[] = [
    ...(upShown ? [bj.dealer.cards[0]] : []),
    ...(holeShown ? [holeRevealed ? bj.dealer.cards[1] : null] : []),
    ...bj.dealer.cards.slice(2, 2 + hits),
  ];
  const dealerSlots = slotCards.map((c) => (c ? toCode(c) : null));
  const dealerVisible = slotCards.filter((c): c is Card => !!c);
  const dealerCards = dealerVisible.map(toCode);
  const dealerTotal = handValue(dealerVisible);
  const dealerDone = caughtUp && holeRevealed;

  const turnPlayer = caughtUp && bj.stage === "playerTurns" ? bj.players[bj.turnPointer] : null;
  const myTurn = turnPlayer?.slug === mySlug;
  const myHand = turnPlayer && myTurn ? turnPlayer.hands[turnPlayer.activeHandIdx] : null;
  const pending = caughtUp ? bj.distributionQueue[0] : undefined;
  const results = done ? (game.lastResults?.blackjackResults ?? []) : [];
  const deadline = game.timer?.deadlineAt ?? null;

  const visibleCards = (slug: string, h: BlackjackHand) => h.cards.slice(0, revealedCount(log, "player", slug, h.id));

  // Places : ceux qui jouent après moi à ma gauche (écran à gauche).
  const meIdx = bj.players.findIndex((p) => p.slug === mySlug);
  const others = meIdx >= 0 ? [...bj.players.slice(meIdx + 1), ...bj.players.slice(0, meIdx)] : bj.players;
  const nLeft = Math.ceil(others.length / 2);
  const placeOf = (p: (typeof bj.players)[number]): ArcPlace => {
    const me = p.slug === mySlug;
    const isTurn = turnPlayer?.slug === p.slug;
    const res = caughtUp ? results.filter((x) => x.slug === p.slug) : [];
    const hands: ArcHand[] = p.hands.map((h, hi) => {
      const cards = visibleCards(p.slug, h);
      const r = res.find((x) => x.handIdx === hi);
      return {
        id: h.id,
        cards: cards.map(toCode),
        bet: h.bet,
        doubled: h.doubled,
        active: isTurn && p.activeHandIdx === hi,
        bust: cards.length > 0 && handValue(cards) > 21,
        natural: h.status === "blackjack" && cards.length === 2,
        lose: r?.outcome === "lose",
        res: r ? myResult(r) : null,
      };
    });
    const betting = bj.stage === "betting";
    const staked = betting ? (bj.betResponded.includes(p.slug) ? (bj.bets[p.slug] ?? 0) : 0) : p.hands.reduce((s, h) => s + h.bet, 0);
    return {
      slug: p.slug,
      name: cleanName(p.name),
      bot: isBotName(p.name),
      // Ma mise sous mon nom ; pour les autres, le cercle suffit.
      sub: me ? (betting && !bj.betResponded.includes(p.slug) ? "mise…" : `mise ${staked} 🍺`) : betting && !bj.betResponded.includes(p.slug) ? "mise…" : "",
      busted: false,
      away: away.includes(p.slug),
      hands,
      shownHand: hands.length ? hands[Math.min(p.activeHandIdx, hands.length - 1)] : null,
      turn: isTurn,
      deadline: isTurn ? deadline : me && betting && !bj.betResponded.includes(p.slug) ? deadline : null,
      stake: staked > 0 ? { amount: staked, kind: "gulps" } : null,
      tag: otherResult(res),
    };
  };

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
              className={`grid h-12 w-12 place-items-center rounded-full border-4 border-dashed font-display text-lg font-extrabold transition active:scale-90 ${
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
      <div className="grid grid-cols-4 gap-1.5">
        <Button size="sm" className="px-1!" disabled={busy} haptics="tap" onClick={() => act({ type: "bjAct", action: "hit" })}>
          Carte
        </Button>
        <Button variant="secondary" size="sm" className="px-1!" disabled={busy} onClick={() => act({ type: "bjAct", action: "stand" })}>
          Je reste
        </Button>
        <Button variant="secondary" size="sm" className="px-1!" disabled={busy || !two} onClick={() => act({ type: "bjAct", action: "double" })}>
          Doubler
        </Button>
        <Button variant="secondary" size="sm" className="px-1!" disabled={busy || !canSplit} onClick={() => act({ type: "bjAct", action: "split" })}>
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

  const stageLabel =
    bj.stage === "betting" ? "Mises · 1 à 5 gorgées" : done ? "Résultats" : turnPlayer ? "À vous de jouer" : !caughtUp ? "Distribution" : "La banque joue";

  return (
    <Screen actions={actions}>
      <div className="flex items-center justify-between gap-2">
        <Kicker>{stageLabel}</Kicker>
        <span className="text-[0.72rem] font-semibold text-mute">Contre la banque</span>
      </div>

      <ArcBlackjackTable
        dealer={{
          cards: dealerSlots,
          visible: dealerCards,
          blackjack: false,
          line: dealerDone && dealerCards.length > 1 ? (dealerTotal > 21 ? `La banque saute à ${dealerTotal} !` : `La banque fait ${dealerTotal}`) : null,
        }}
        left={others.slice(0, nLeft).map(placeOf)}
        right={others.slice(nLeft).reverse().map(placeOf)}
        me={meIdx >= 0 ? placeOf(bj.players[meIdx]) : null}
        deadlineTotal={bj.stage === "betting" ? BET_MS : TURN_MS}
        unit="🍺"
        croupier={chat ? { look: chat.croupier.look, dealCount: shown, chat } : null}
      />

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

      {done && caughtUp && (
        <div className="mt-5">
          <GulpList
            rows={sumGulps(
              game,
              (game.drinks ?? []).map((d) => ({ slug: d.slug, gulps: d.n })),
            )}
          />
        </div>
      )}
    </Screen>
  );
}
