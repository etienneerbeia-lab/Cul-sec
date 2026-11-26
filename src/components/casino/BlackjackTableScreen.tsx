"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BJ_DEAL_MS, BJ_DEALER_MS } from "@/lib/blackjack/engine";
import { BJT_RULES } from "@/lib/bjtable/config";
import { legalFor, total, totalLabel } from "@/lib/bjtable/engine";
import type { BjtDealEvent, BjtHand, BjtSeat, BjtState } from "@/lib/bjtable/types";
import { fromCode, type CardCode } from "@/lib/casino/cards";
import { formatChips } from "@/lib/chips/format";
import type { GameState } from "@/lib/game/types";
import { haptic } from "@/lib/haptics";
import { playSound } from "@/lib/sound";
import { useGame } from "../GameContext";
import { Button } from "../ui/Button";
import { cardDims, type CardSize, PlayingCardV2 } from "../ui/Cards";
import { TimerBar, Waiting } from "../ui/Feedback";
import { Kicker, Screen } from "../ui/Layout";
import { cleanName } from "../ui/Players";

const euro = (n: number) => formatChips(n, "euro");
const signed = (n: number) => (n > 0 ? `+${euro(n)}` : n < 0 ? `−${euro(-n)}` : "0 €");

// ---- Rejeu de la distribution, carte par carte ----
// Le serveur distribue tout d'un coup ; chaque client rejoue le journal à
// son rythme (même tempo que le Blackjack Soirée : rapide pour les joueurs,
// plus lent pour le croupier). Un écran monté en cours de manche (retour,
// rechargement) affiche directement l'état courant.
function useReplay(log: BjtDealEvent[]) {
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
function visibleCount(log: BjtDealEvent[], shown: number, slug: string, handId: number): number {
  for (let i = shown - 1; i >= 0; i--) {
    const e = log[i];
    if (e.t === "p" && e.s === slug && e.h === handId) return e.n;
  }
  return 0;
}

function dealerView(log: BjtDealEvent[], shown: number, cards: CardCode[]) {
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
  const nameOf = (s: string) => cleanName(names.get(s) ?? s);
  const { shown, caughtUp } = useReplay(t.log);
  const seated = t.order.includes(mySlug);
  const busted = seated && chips.bustOrder.some((g) => g.includes(mySlug));
  const mySeat = t.seats.find((s) => s.slug === mySlug) ?? null;
  const turnSeat = t.stage === "playerTurns" ? t.seats[t.turn] : null;
  const myTurn = caughtUp && turnSeat?.slug === mySlug;
  const showResults = t.stage === "roundEnd" && caughtUp;

  useEffect(() => {
    if (!myTurn) return;
    haptic("tap");
    playSound("tap");
  }, [myTurn, t.actSeq]);

  const dealer = dealerView(t.log, shown, t.dealer.cards);
  const dealerTotal = dealer.codes.length ? total(dealer.codes) : 0;

  // Les autres joueurs, dans l'ordre de la table à partir de moi.
  const meIdx = t.order.indexOf(mySlug);
  const others = (meIdx >= 0 ? [...t.order.slice(meIdx + 1), ...t.order.slice(0, meIdx)] : t.order).filter((s) => s !== mySlug);
  const cols = others.length <= 4 ? Math.max(1, others.length) : Math.ceil(others.length / 2);

  const roundLabel = t.totalRounds > 0 ? `Manche ${t.round}/${t.totalRounds}` : `Manche ${t.round} · Dernier survivant`;

  return (
    <Screen
      actions={
        <ActionBar
          game={game}
          t={t}
          mySlug={mySlug}
          seated={seated}
          busted={busted}
          myTurn={myTurn}
          caughtUp={caughtUp}
          busy={busy}
          act={act}
          nameOf={nameOf}
        />
      }
    >
      <div className="flex items-center justify-between gap-2">
        <Kicker>{roundLabel}</Kicker>
        <span className="text-[0.72rem] font-semibold text-mute">
          {t.reshuffled && t.stage === "betting" ? "🔀 Sabot remélangé · " : ""}Mise {euro(BJT_RULES.minBet)} min
        </span>
      </div>

      {/* Croupier */}
      <div className="relative mt-2 rounded-[28px] border border-white/10 bg-[radial-gradient(ellipse_at_top,#1f7a57_0%,#145a40_60%,#0d3d2c_100%)] px-3 pb-3 pt-2 shadow-[inset_0_0_40px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between">
          <span className="font-display text-[0.7rem] font-bold uppercase tracking-widest text-white/70">Croupier</span>
          <span className="flex items-center gap-1.5">
            {dealer.codes.length > 0 && <TotalBadge cards={dealer.codes} blackjack={t.dealer.blackjack && dealer.codes.length === 2} />}
          </span>
        </div>
        <div className="mt-1 flex justify-center">
          <CardFan codes={dealer.codes} hidden={dealer.hidden} size={others.length >= 4 ? "xs" : "sm"} />
        </div>
        {showResults && dealer.codes.length > 0 && (
          <div className="mt-1 text-center text-[0.75rem] font-semibold text-white/75">
            {dealerTotal > 21 ? "Le croupier saute !" : t.dealer.blackjack ? "Blackjack du croupier" : `Le croupier fait ${dealerTotal}`}
          </div>
        )}
      </div>

      {/* Les autres joueurs, en arc */}
      {others.length > 0 && (
        <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {others.map((slug, i) => {
            const c = i % cols;
            const d = cols > 1 ? Math.abs(c - (cols - 1) / 2) / ((cols - 1) / 2) : 0;
            return (
              <div key={slug} style={{ marginTop: Math.round((1 - d * d) * 8) }} className="min-w-0">
                <OtherSeat
                  slug={slug}
                  name={nameOf(slug)}
                  t={t}
                  seat={t.seats.find((s) => s.slug === slug) ?? null}
                  stack={chips.stacks[slug] ?? 0}
                  busted={chips.bustOrder.some((g) => g.includes(slug))}
                  away={away.includes(slug)}
                  log={t.log}
                  shown={shown}
                  showResults={showResults}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Moi, au centre */}
      {seated && (
        <MySeat
          t={t}
          seat={mySeat}
          stack={chips.stacks[mySlug] ?? 0}
          busted={busted}
          log={t.log}
          shown={shown}
          showResults={showResults}
          slug={mySlug}
        />
      )}
      {!seated && <p className="mt-4 text-center text-sm text-mute">Table complète : tu regardes la partie.</p>}
    </Screen>
  );
}

// ---- Cartes en éventail, toujours dans la largeur disponible ----
function CardFan({
  codes,
  hidden = 0,
  size,
  dim = false,
}: {
  codes: CardCode[];
  hidden?: number;
  size: CardSize;
  dim?: boolean;
}) {
  const { w, h } = cardDims(size);
  const n = codes.length + hidden;
  if (n === 0) return <div style={{ height: h }} />;
  const natural = n * (w + 3) - 3;
  return (
    <div className="relative mx-auto" style={{ width: `min(100%, ${natural}px)`, height: h }}>
      {Array.from({ length: n }, (_, i) => {
        const left = n === 1 ? "0px" : `min(${i * (w + 3)}px, calc((100% - ${w}px) * ${i / (n - 1)}))`;
        const code = codes[i];
        return (
          <div key={i} className="absolute top-0" style={{ left }}>
            {code ? <PlayingCardV2 card={fromCode(code)} size={size} dim={dim} /> : <PlayingCardV2 faceDown size={size} />}
          </div>
        );
      })}
    </div>
  );
}

// Total en clair : « 7 / 17 », « 21 », badges Blackjack / Bust.
function TotalBadge({ cards, blackjack = false, large = false }: { cards: CardCode[]; blackjack?: boolean; large?: boolean }) {
  const v = total(cards);
  const base = `rounded-full px-2 font-display font-extrabold tabular-nums leading-[1.5] ${large ? "text-[0.95rem]" : "text-[0.72rem]"}`;
  if (blackjack) return <span className={`${base} bg-beer text-night-950`}>Blackjack</span>;
  if (v > 21) return <span className={`${base} bg-danger text-white`}>Bust · {v}</span>;
  return <span className={`${base} bg-black/50 text-white`}>{totalLabel(cards)}</span>;
}

function ResultChip({ hand }: { hand: BjtHand }) {
  if (!hand.outcome) return null;
  const n = hand.net ?? 0;
  const [label, cls] =
    hand.outcome === "blackjack"
      ? [`BJ ${signed(n)}`, "bg-beer text-night-950"]
      : hand.outcome === "win"
        ? [signed(n), "bg-lime text-night-950"]
        : hand.outcome === "push"
          ? ["Push", "bg-white/20 text-white"]
          : [signed(n), "bg-danger/90 text-white"];
  return <span className={`animate-pop rounded-full px-2 font-display text-[0.75rem] font-extrabold tabular-nums leading-[1.5] ${cls}`}>{label}</span>;
}

// ---- Un autre joueur (cellule de taille fixe) ----
function OtherSeat({
  slug,
  name,
  t,
  seat,
  stack,
  busted,
  away,
  log,
  shown,
  showResults,
}: {
  slug: string;
  name: string;
  t: BjtState;
  seat: BjtSeat | null;
  stack: number;
  busted: boolean;
  away: boolean;
  log: BjtDealEvent[];
  shown: number;
  showResults: boolean;
}) {
  const active = t.stage === "playerTurns" && t.seats[t.turn]?.slug === slug;
  const focus = seat ? Math.min(seat.active, seat.hands.length - 1) : 0;
  const hand = seat?.hands[focus];
  const codes = hand ? hand.cards.slice(0, visibleCount(log, shown, slug, hand.id)) : [];
  const bet = t.bets[slug] ?? 0;
  let status: string | null = null;
  if (busted) status = "Spectateur";
  else if (t.stage === "betting") status = t.betDone.includes(slug) ? (bet > 0 ? `Mise ${euro(bet)}` : "Passe") : "Mise…";
  else if (!seat) status = "Passe";
  return (
    <div
      className={`relative flex h-[98px] flex-col items-center rounded-2xl border px-1 pb-1 pt-1.5 text-center ${
        active ? "border-cyan bg-night-700 shadow-[0_0_0_2px_var(--color-cyan)]" : "border-white/12 bg-night-900/90"
      } ${busted ? "opacity-50" : ""}`}
      data-seat={slug}
    >
      {away && (
        <span className="absolute -right-1 -top-2 rounded-full bg-amber px-1 text-[0.55rem] font-black uppercase leading-[1.4] text-night-950">
          absent
        </span>
      )}
      <div className="w-full truncate text-[0.7rem] font-semibold leading-tight">{name}</div>
      <div className="mt-1 w-full">
        <CardFan codes={codes} size="3xs" />
      </div>
      <div className="mt-0.5 flex min-h-[18px] flex-wrap items-center justify-center gap-0.5">
        {seat && seat.hands.length > 1
          ? seat.hands.map((h, i) => {
              const vis = h.cards.slice(0, visibleCount(log, shown, slug, h.id));
              return (
                <span
                  key={h.id}
                  className={`rounded px-1 text-[0.6rem] font-bold tabular-nums leading-[1.5] ${
                    i === focus && active ? "bg-cyan text-night-950" : total(vis) > 21 ? "bg-danger/80" : "bg-white/15"
                  }`}
                >
                  {vis.length ? (total(vis) > 21 ? "Bust" : total(vis)) : "…"}
                </span>
              );
            })
          : codes.length > 0 && <TotalBadge cards={codes} blackjack={hand?.status === "blackjack" && codes.length === 2} />}
      </div>
      <div className="mt-auto w-full truncate font-display text-[0.72rem] font-extrabold tabular-nums leading-tight">
        {showResults && seat?.net !== undefined ? (
          <span className={seat.net > 0 ? "text-lime" : seat.net < 0 ? "text-danger" : "text-ink-2"}>{seat.net === 0 ? "Push" : signed(seat.net)}</span>
        ) : status ? (
          <span className="text-mute">{status}</span>
        ) : (
          euro(stack)
        )}
      </div>
    </div>
  );
}

// ---- Moi : mes mains en grand ----
function MySeat({
  t,
  seat,
  stack,
  busted,
  log,
  shown,
  showResults,
  slug,
}: {
  t: BjtState;
  seat: BjtSeat | null;
  stack: number;
  busted: boolean;
  log: BjtDealEvent[];
  shown: number;
  showResults: boolean;
  slug: string;
}) {
  const myTurnSeat = t.stage === "playerTurns" && t.seats[t.turn]?.slug === slug;
  const hands = seat?.hands ?? [];
  const size: CardSize = hands.length <= 2 ? "sm" : "2xs";
  // Mes mains restent visibles quand je dois jouer et à l'affichage des
  // résultats (sur petit écran, elles peuvent être sous la ligne de flottaison).
  const ref = useRef<HTMLDivElement>(null);
  const focusKey = myTurnSeat ? `turn:${t.actSeq}` : showResults ? "results" : "";
  useEffect(() => {
    if (focusKey) ref.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [focusKey]);
  const net = showResults && seat ? seat.net : undefined;
  return (
    <div
      ref={ref}
      className={`mt-3 rounded-[24px] border p-2.5 ${myTurnSeat ? "border-cyan/70 bg-cyan/[0.06]" : "border-white/10 bg-white/[0.03]"}`}
      style={{ scrollMarginBottom: 36 }}
      data-seat={slug}
      data-me
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-sm font-bold text-cyan">Toi</span>
        {net !== undefined ? (
          <span className="animate-pop truncate font-display text-sm font-extrabold tabular-nums">
            {seat!.insuranceNet !== undefined && <span className="text-ink-2">Assurance {signed(seat!.insuranceNet)} · </span>}
            <span className={net > 0 ? "text-lime" : net < 0 ? "text-danger" : "text-ink-2"}>
              {net === 0 ? "Équilibre" : signed(net)}
            </span>
            <span className="text-ink-2"> → {euro(stack)}</span>
          </span>
        ) : (
          <span className="font-display text-sm font-extrabold tabular-nums">{euro(stack)}</span>
        )}
      </div>
      {hands.length > 0 ? (
        <div className="mt-1.5 grid gap-2" style={{ gridTemplateColumns: `repeat(${hands.length}, minmax(0, 1fr))` }}>
          {hands.map((h, i) => {
            const vis = h.cards.slice(0, visibleCount(log, shown, slug, h.id));
            const active = myTurnSeat && seat!.active === i;
            const lostDim = showResults && h.outcome === "lose";
            return (
              <div
                key={h.id}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 transition ${
                  active ? "bg-cyan/10 shadow-[0_0_0_2px_var(--color-cyan)]" : hands.length > 1 ? "opacity-80" : ""
                }`}
                data-hand={h.id}
              >
                <CardFan codes={vis} size={size} dim={lostDim} />
                <div className="flex min-h-[22px] flex-wrap items-center justify-center gap-1">
                  {vis.length > 0 && <TotalBadge cards={vis} blackjack={h.status === "blackjack" && vis.length === 2} large={hands.length <= 2} />}
                  {showResults && <ResultChip hand={h} />}
                </div>
                <div className="text-[0.7rem] font-semibold tabular-nums text-ink-2">
                  {hands.length > 1 ? `Main ${i + 1} · ` : ""}Mise {euro(h.bet)}
                  {h.doubled ? " · doublée" : ""}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid h-[96px] place-items-center text-sm text-mute">
          {busted ? "Plus assez pour miser : tu regardes la fin." : t.stage === "betting" ? (t.betDone.includes(slug) ? "Tu passes cette manche." : "Place ta mise") : "Tu ne joues pas cette manche."}
        </div>
      )}
    </div>
  );
}

// ---- Barre d'actions ----
function ActionBar({
  game,
  t,
  mySlug,
  seated,
  busted,
  myTurn,
  caughtUp,
  busy,
  act,
  nameOf,
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
  nameOf: (s: string) => string;
}) {
  const stack = game.chips!.stacks[mySlug] ?? 0;
  const [amount, setAmount] = useState(0);
  const send = (op: string, extra: Record<string, unknown> = {}) => act({ type: "bjt", op, ...extra });
  const timer = (ms: number) => <TimerBar deadlineAt={game.timer?.deadlineAt} totalMs={ms} />;

  if (!seated) return <Waiting>Tu regardes la partie (table complète)</Waiting>;
  if (busted) return <Waiting>Plus assez pour miser · tu regardes la fin</Waiting>;

  // Mises
  if (t.stage === "betting") {
    if (t.betDone.includes(mySlug))
      return (
        <>
          {timer(BJT_RULES.betMs)}
          <Waiting>
            {(t.bets[mySlug] ?? 0) > 0 ? `Mise posée : ${euro(t.bets[mySlug])}` : "Tu passes cette manche"} · {t.betDone.length}/
            {t.order.filter((s) => !game.chips!.bustOrder.some((g) => g.includes(s))).length}
          </Waiting>
        </>
      );
    const value = Math.min(stack, amount);
    const add = (n: number) => {
      haptic("select");
      setAmount(Math.min(stack, value + n));
    };
    return (
      <>
        {timer(BJT_RULES.betMs)}
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
          {timer(BJT_RULES.insuranceMs)}
          <p className="text-center text-[0.95rem] text-ink-2">
            Le croupier montre un As. Assurance pour {euro(cost)} ? (payée 2:1 s&apos;il a blackjack)
          </p>
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
    return <Waiting>Assurance : les joueurs décident…</Waiting>;
  }

  if (t.stage === "playerTurns") {
    const seat = t.seats[t.turn];
    if (myTurn) {
      const legal = legalFor(game, mySlug)!;
      const hand = seat.hands[seat.active];
      return (
        <>
          {timer(BJT_RULES.actionMs)}
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
    return (
      <>
        {caughtUp && timer(BJT_RULES.actionMs)}
        <Waiting>{caughtUp ? `${nameOf(seat.slug)} joue…` : "Distribution…"}</Waiting>
      </>
    );
  }

  // Fin de manche
  if (t.noBets) return <Waiting>Personne n&apos;a misé · manche suivante…</Waiting>;
  if (!caughtUp) return <Waiting>Le croupier joue…</Waiting>;
  return <Waiting>{t.over ? "Fin de la partie…" : "Manche suivante…"}</Waiting>;
}
