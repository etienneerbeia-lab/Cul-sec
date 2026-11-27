"use client";

import { useEffect, useMemo, useState } from "react";
import { BJ_DEAL_MS, BJ_DEALER_MS } from "@/lib/blackjack/engine";
import { BJT_RULES } from "@/lib/bjtable/config";
import { legalFor, total, totalLabel } from "@/lib/bjtable/engine";
import type { BjtDealEvent, BjtHand, BjtSeat, BjtState } from "@/lib/bjtable/types";
import type { CardCode } from "@/lib/casino/cards";
import { formatChips } from "@/lib/chips/format";
import type { GameState } from "@/lib/game/types";
import { haptic } from "@/lib/haptics";
import { playSound } from "@/lib/sound";
import { useGame } from "../GameContext";
import { Button } from "../ui/Button";
import { Kicker, Screen } from "../ui/Layout";
import { cleanName, isBotName } from "../ui/Players";
import type { TagTone } from "./TableKit";
import { ArcBlackjackTable, type ArcHand, type ArcPlace } from "./table/ArcBlackjackTable";

export const euro = (n: number) => formatChips(n, "euro");
export const signed = (n: number) => (n > 0 ? `+${euro(n)}` : n < 0 ? `−${euro(-n)}` : "0 €");

// ---- Rejeu de la distribution, carte par carte ----
// Le serveur distribue tout d'un coup ; chaque client rejoue le journal à
// son rythme (même tempo que le Blackjack Soirée : rapide pour les joueurs,
// plus lent pour le croupier). Un écran monté en cours de manche (retour,
// rechargement) affiche directement l'état courant.
export function useReplay(log: BjtDealEvent[]) {
  const [shown, setShown] = useState(log.length);
  const len = log.length;
  const next = shown < len ? log[shown] : null;
  const delay = next ? (next.t === "dr" || next.t === "dd" ? BJ_DEALER_MS : BJ_DEAL_MS) : 0;
  useEffect(() => {
    if (shown >= len) return;
    const id = setTimeout(() => {
      haptic("tap");
      setShown((n) => n + 1);
    }, delay);
    return () => clearTimeout(id);
  }, [shown, len, delay]);
  // Nouvelle manche : le journal repart de zéro.
  const effective = Math.min(shown, len);
  return { shown: effective, caughtUp: effective >= len };
}

// Nombre de cartes visibles d'une main : dernier état rejoué.
export function visibleCount(log: BjtDealEvent[], shown: number, slug: string, handId: number): number {
  for (let i = shown - 1; i >= 0; i--) {
    const e = log[i];
    if (e.t === "p" && e.s === slug && e.h === handId) return e.n;
  }
  return 0;
}

export function dealerView(log: BjtDealEvent[], shown: number, cards: CardCode[]) {
  let up = false;
  let hole = false;
  let revealed = 0;
  for (let i = 0; i < shown; i++) {
    const e = log[i];
    if (e.t === "du") up = true;
    else if (e.t === "dh") hole = true;
    else if (e.t === "dr" || e.t === "dd") revealed = e.n;
  }
  if (revealed > 0) return { codes: cards.slice(0, revealed), hidden: 0 };
  return { codes: up ? cards.slice(0, 1) : [], hidden: hole ? 1 : 0 };
}

export default function BlackjackTableScreen() {
  const { game } = useGame();
  // Une manche = un nouveau rejeu (le compteur repart de zéro).
  return <Table key={game.bjt!.round} />;
}

function Table() {
  const { game, mySlug, busy, act, away } = useGame();
  const t = game.bjt!;
  const chips = game.chips!;
  const names = useMemo(() => new Map(game.playersPublic.map((p) => [p.slug, p.name])), [game.playersPublic]);
  const { shown, caughtUp } = useReplay(t.log);
  const isBusted = (s: string) => chips.bustOrder.some((grp) => grp.includes(s));
  const seated = t.order.includes(mySlug);
  const busted = seated && isBusted(mySlug);
  const turnSeat = t.stage === "playerTurns" ? t.seats[t.turn] : null;
  const myTurn = caughtUp && turnSeat?.slug === mySlug;
  const showResults = t.stage === "roundEnd" && caughtUp;
  const deadline = game.timer?.deadlineAt ?? null;

  useEffect(() => {
    if (!myTurn) return;
    haptic("tap");
    playSound("tap");
  }, [myTurn, t.actSeq]);

  const dealer = dealerView(t.log, shown, t.dealer.cards);
  const dealerRevealed = dealer.hidden === 0 && dealer.codes.length >= 2;
  const dealerTotal = dealer.codes.length ? total(dealer.codes) : 0;
  const n = dealer.codes.length + dealer.hidden;

  // Les autres joueurs dans l'ordre de la table : ceux qui jouent après moi
  // à ma gauche (côté gauche de l'écran), les autres à ma droite.
  const meIdx = t.order.indexOf(mySlug);
  const others = (meIdx >= 0 ? [...t.order.slice(meIdx + 1), ...t.order.slice(0, meIdx)] : t.order).filter((s) => s !== mySlug);
  const nLeft = Math.ceil(others.length / 2);

  const deadlineFor = (slug: string, me: boolean) =>
    t.stage === "playerTurns" && caughtUp && turnSeat?.slug === slug
      ? deadline
      : me && t.stage === "betting" && !t.betDone.includes(slug)
        ? deadline
        : me && t.stage === "insurance" && caughtUp && t.seats.some((x) => x.slug === slug && x.insurance === undefined)
          ? deadline
          : null;

  const placeOf = (slug: string): ArcPlace => {
    const me = slug === mySlug;
    const seat: BjtSeat | null = t.seats.find((s) => s.slug === slug) ?? null;
    const raw = seat?.hands ?? [];
    const active = t.stage === "playerTurns" && t.seats[t.turn]?.slug === slug;
    const hands: ArcHand[] = raw.map((h) => {
      const vis = h.cards.slice(0, visibleCount(t.log, shown, slug, h.id));
      return {
        id: h.id,
        cards: vis,
        bet: h.bet,
        doubled: h.doubled,
        active: active && seat!.hands[seat!.active]?.id === h.id,
        bust: vis.length > 0 && total(vis) > 21,
        natural: h.status === "blackjack" && vis.length === 2,
        lose: showResults && h.outcome === "lose",
        res: showResults ? resultTag(h) : null,
      };
    });
    const name = names.get(slug) ?? slug;
    const bet = seat ? raw.reduce((a, h) => a + h.bet, 0) : t.betDone.includes(slug) ? (t.bets[slug] ?? 0) : 0;
    const net = showResults && seat?.net !== undefined ? seat.net : undefined;
    const bj = raw.some((h) => h.outcome === "blackjack");
    return {
      slug,
      name: cleanName(name),
      bot: isBotName(name),
      sub: isBusted(slug) ? "spectateur" : euro(chips.stacks[slug] ?? 0),
      busted: isBusted(slug),
      away: away.includes(slug),
      hands,
      shownHand: hands.length ? hands[Math.min(seat!.active, hands.length - 1)] : null,
      turn: active,
      deadline: deadlineFor(slug, me),
      stake: bet > 0 ? { amount: bet, kind: "chips" } : null,
      tag:
        net === undefined
          ? null
          : bj
            ? { tone: "bj", text: `BJ ${signed(net)}` }
            : net === 0
              ? { tone: "push", text: "PUSH" }
              : { tone: net > 0 ? "win" : "lose", text: signed(net) },
    };
  };

  const roundLabel = t.totalRounds > 0 ? `Manche ${t.round}/${t.totalRounds}` : `Manche ${t.round} · Dernier survivant`;
  const hasActions =
    seated &&
    !busted &&
    (t.stage === "betting" || (t.stage === "insurance" && caughtUp && t.seats.some((s) => s.slug === mySlug && s.insurance === undefined)) || myTurn);

  return (
    <Screen
      actions={
        hasActions ? (
          <BjActions game={game} t={t} mySlug={mySlug} seated={seated} busted={busted} myTurn={myTurn} caughtUp={caughtUp} busy={busy} act={act} />
        ) : undefined
      }
    >
      <div className="flex items-center justify-between gap-2">
        <Kicker>{roundLabel}</Kicker>
        <span className="text-[0.72rem] font-semibold text-mute">
          {t.reshuffled && t.stage === "betting" ? "🔀 Sabot remélangé · " : ""}Mise {euro(BJT_RULES.minBet)} min
        </span>
      </div>

      <ArcBlackjackTable
        dealer={{
          // Carte cachée : dos tant qu'elle n'est pas retournée.
          cards: Array.from({ length: n }, (_, i): CardCode | null => (i === 1 && !dealerRevealed ? null : dealer.codes[i])),
          visible: dealer.codes,
          blackjack: t.dealer.blackjack && dealer.codes.length === 2,
          line:
            showResults && dealer.codes.length > 0
              ? dealerTotal > 21
                ? "Le croupier saute !"
                : t.dealer.blackjack
                  ? "Blackjack du croupier"
                  : `Le croupier fait ${dealerTotal}`
              : null,
        }}
        left={others.slice(0, nLeft).map(placeOf)}
        right={others.slice(nLeft).reverse().map(placeOf)}
        me={seated ? placeOf(mySlug) : null}
        deadlineTotal={t.stage === "betting" ? BJT_RULES.betMs : t.stage === "insurance" ? BJT_RULES.insuranceMs : BJT_RULES.actionMs}
        unit="€"
      />

      {!hasActions && (
        <p className="mt-1.5 text-center text-[0.72rem] text-mute">
          {!seated
            ? "Table complète : tu regardes la partie."
            : busted
              ? "Plus assez pour miser · tu regardes la fin"
              : t.noBets
                ? "Personne n'a misé · manche suivante"
                : t.stage === "betting" && t.betDone.includes(mySlug)
                  ? `${(t.bets[mySlug] ?? 0) > 0 ? `Mise posée : ${euro(t.bets[mySlug])}` : "Tu passes cette manche"} · ${t.betDone.length}/${t.order.filter((s) => !isBusted(s)).length}`
                  : " "}
        </p>
      )}
    </Screen>
  );
}

// Pendant mon tour, les 4 coups sur une seule rangée (la table garde sa
// hauteur) ; mises et assurance : barre complète ci-dessous.
function BjActions(props: Parameters<typeof ActionBar>[0]) {
  const { game, t, mySlug, busy, act, myTurn } = props;
  if (t.stage !== "playerTurns" || !myTurn) return <ActionBar {...props} />;
  const seat = t.seats[t.turn];
  const legal = legalFor(game, mySlug)!;
  const hand = seat.hands[seat.active];
  const send = (op: string) => act({ type: "bjt", op });
  return (
    <>
      {seat.hands.length > 1 && (
        <div className="text-center text-[0.8rem] font-semibold text-cyan">
          Main {seat.active + 1} sur {seat.hands.length} · {totalLabel(hand.cards)}
        </div>
      )}
      <div className="grid grid-cols-4 gap-1.5">
        <Button size="sm" className="px-1!" disabled={busy} onClick={() => send("hit")}>
          Carte
        </Button>
        <Button size="sm" variant="secondary" className="px-1!" disabled={busy} onClick={() => send("stand")}>
          Rester
        </Button>
        <Button size="sm" variant="secondary" className="px-1!" disabled={busy || !legal.canDouble} onClick={() => send("double")}>
          <span className="flex flex-col items-center leading-none">
            Doubler<span className="mt-0.5 text-[0.62rem] font-semibold opacity-75">+{euro(hand.bet)}</span>
          </span>
        </Button>
        <Button size="sm" variant="secondary" className="px-1!" disabled={busy || !legal.canSplit} onClick={() => send("split")}>
          Séparer
        </Button>
      </div>
    </>
  );
}

export function resultTag(h: BjtHand): { tone: TagTone; text: string } | null {
  if (!h.outcome) return null;
  const n = h.net ?? 0;
  if (h.outcome === "blackjack") return { tone: "bj", text: `BLACKJACK ${signed(n)}` };
  if (h.outcome === "win") return { tone: "win", text: signed(n) };
  if (h.outcome === "push") return { tone: "push", text: "PUSH" };
  return { tone: "lose", text: signed(n) };
}

export function ActionBar({
  game,
  t,
  mySlug,
  seated,
  busted,
  myTurn,
  caughtUp,
  busy,
  act,
}: {
  game: GameState;
  t: BjtState;
  mySlug: string;
  seated: boolean;
  busted: boolean;
  myTurn: boolean;
  caughtUp: boolean;
  busy: boolean;
  act: (a: { type: string; [k: string]: unknown }) => void;
}) {
  const stack = game.chips!.stacks[mySlug] ?? 0;
  const [amount, setAmount] = useState(0);
  const send = (op: string, extra: Record<string, unknown> = {}) => act({ type: "bjt", op, ...extra });

  // Les messages d'attente sont affichés en discret sous la table : la barre
  // n'apparaît que quand j'ai quelque chose à faire.
  if (!seated || busted) return null;

  // Mises
  if (t.stage === "betting") {
    if (t.betDone.includes(mySlug))
      return (
        <p className="text-center text-[0.75rem] text-mute">
          {(t.bets[mySlug] ?? 0) > 0 ? `Mise posée : ${euro(t.bets[mySlug])}` : "Tu passes cette manche"} · {t.betDone.length}/
          {t.order.filter((s) => !game.chips!.bustOrder.some((g) => g.includes(s))).length}
        </p>
      );
    const value = Math.min(stack, amount);
    const add = (n: number) => {
      haptic("select");
      setAmount(Math.min(stack, value + n));
    };
    return (
      <>
        <div className="flex items-center justify-between">
          <Kicker>Ta mise · solde {euro(stack)}</Kicker>
          <span className="font-display text-2xl font-extrabold tabular-nums">{euro(value)}</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {BJT_RULES.chipValues.map((c) => (
            <button key={c} type="button" className="cs-chip" disabled={value + c > stack} onClick={() => add(c)}>
              +{c}
            </button>
          ))}
          <button type="button" className="cs-chip" onClick={() => add(stack)}>
            Tapis
          </button>
          <button
            type="button"
            className="cs-chip"
            disabled={value === 0}
            onClick={() => {
              haptic("select");
              setAmount(0);
            }}
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => send("bet", { amount: 0 })}>
            Passer
          </Button>
          <Button disabled={busy || value < BJT_RULES.minBet} onClick={() => send("bet", { amount: value })}>
            {value < BJT_RULES.minBet ? `Mise min ${euro(BJT_RULES.minBet)}` : `Miser ${euro(value)}`}
          </Button>
        </div>
      </>
    );
  }

  // Assurance
  if (t.stage === "insurance") {
    const seat = t.seats.find((s) => s.slug === mySlug);
    if (seat && seat.insurance === undefined && caughtUp) {
      const cost = Math.floor(seat.hands[0].bet / 2);
      return (
        <>
          <p className="text-center text-[0.95rem] text-ink-2">Le croupier montre un As. Assurance pour {euro(cost)} ? (payée 2:1 s&apos;il a blackjack)</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => send("insurance", { take: false })}>
              Non merci
            </Button>
            <Button disabled={busy} onClick={() => send("insurance", { take: true })}>
              Assurer {euro(cost)}
            </Button>
          </div>
        </>
      );
    }
    return null;
  }

  if (t.stage === "playerTurns") {
    const seat = t.seats[t.turn];
    if (myTurn) {
      const legal = legalFor(game, mySlug)!;
      const hand = seat.hands[seat.active];
      return (
        <>
          {seat.hands.length > 1 && (
            <div className="text-center text-[0.8rem] font-semibold text-cyan">
              Main {seat.active + 1} sur {seat.hands.length} · {totalLabel(hand.cards)}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={busy} onClick={() => send("hit")}>
              Carte
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => send("stand")}>
              Rester
            </Button>
            <Button variant="secondary" size="sm" disabled={busy || !legal.canDouble} onClick={() => send("double")}>
              Doubler (+{euro(hand.bet)})
            </Button>
            <Button variant="secondary" size="sm" disabled={busy || !legal.canSplit} onClick={() => send("split")}>
              Séparer
            </Button>
          </div>
        </>
      );
    }
    return null;
  }
  return null;
}
