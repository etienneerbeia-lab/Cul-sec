"use client";

import { useCallback, useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { BJT_RULES } from "@/lib/bjtable/config";
import { legalFor, total, totalLabel } from "@/lib/bjtable/engine";
import type { BjtSeat } from "@/lib/bjtable/types";
import type { CardCode } from "@/lib/casino/cards";
import type { GameState } from "@/lib/game/types";
import { haptic } from "@/lib/haptics";
import { playSound } from "@/lib/sound";
import { useGame } from "../../GameContext";
import { Button } from "../../ui/Button";
import { Kicker, Screen } from "../../ui/Layout";
import { cleanName, isBotName, playerColor } from "../../ui/Players";
import { ActionBar, dealerView, euro, resultTag, signed, useReplay, visibleCount } from "../BlackjackTableScreen";
import { ChipStack } from "../Chips";
import { Tag, type TagTone, TimerRing, useAfterFirstPaint, useWidth } from "../TableKit";
import { HandRun, HandZoom, TotalBadge, layoutRun, type Align, type ZoomHand } from "./Hand";
import type { Deck } from "./PlayingCard";

// Blackjack Table « labo » : même logique que BlackjackTableScreen (même
// rejeu carte par carte, mêmes actions), trois mises en page :
// A « Demi-lune classique », B « Grille compacte », C « Arc sourire ».

export type BjVariantId = "A" | "B" | "C";
const BJ_DECK: Record<BjVariantId, Deck> = { A: "classic", B: "minimal", C: "classic" };

// ---------------------------------------------------------------------
// Vue : ce que chaque mise en page affiche (calculé comme l'écran actuel)
// ---------------------------------------------------------------------

interface HandV {
  id: number;
  cards: CardCode[];
  bet: number;
  doubled: boolean;
  active: boolean;
  bust: boolean;
  natural: boolean;
  lose: boolean;
  res: { tone: TagTone; text: string } | null;
}

interface PlaceV {
  slug: string;
  name: string;
  initial: string;
  bot: boolean;
  me: boolean;
  stack: number;
  busted: boolean;
  away: boolean;
  bet: number;
  hands: HandV[];
  // Main affichée pour les autres joueurs (la main en cours, ou la 1re).
  shownHand: HandV | null;
  turn: boolean;
  net: number | undefined;
  anyBJ: boolean;
  deadline: number | null;
  deadlineTotal: number;
}

function useBjView() {
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

  // Les autres dans l'ordre de la table : ceux qui jouent après moi à ma
  // gauche (écran à gauche), les autres à ma droite.
  const meIdx = t.order.indexOf(mySlug);
  const others = (meIdx >= 0 ? [...t.order.slice(meIdx + 1), ...t.order.slice(0, meIdx)] : t.order).filter((s) => s !== mySlug);
  const nLeft = Math.ceil(others.length / 2);
  const leftSlugs = others.slice(0, nLeft);
  const rightSlugs = others.slice(nLeft).reverse();

  const deadlineFor = (slug: string, me: boolean) =>
    t.stage === "playerTurns" && caughtUp && turnSeat?.slug === slug
      ? deadline
      : me && t.stage === "betting" && !t.betDone.includes(slug)
        ? deadline
        : me && t.stage === "insurance" && caughtUp && t.seats.some((x) => x.slug === slug && x.insurance === undefined)
          ? deadline
          : null;

  const placeOf = (slug: string): PlaceV => {
    const me = slug === mySlug;
    const seat: BjtSeat | null = t.seats.find((s) => s.slug === slug) ?? null;
    const raw = seat?.hands ?? [];
    const active = t.stage === "playerTurns" && t.seats[t.turn]?.slug === slug;
    const hands: HandV[] = raw.map((h) => {
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
    return {
      slug,
      name: me ? "Toi" : cleanName(name),
      initial: cleanName(name).charAt(0).toUpperCase(),
      bot: isBotName(name),
      me,
      stack: chips.stacks[slug] ?? 0,
      busted: isBusted(slug),
      away: away.includes(slug),
      bet: seat ? raw.reduce((a, h) => a + h.bet, 0) : t.betDone.includes(slug) ? (t.bets[slug] ?? 0) : 0,
      hands,
      shownHand: hands.length ? hands[Math.min(seat!.active, hands.length - 1)] : null,
      turn: active,
      net: showResults && seat?.net !== undefined ? seat.net : undefined,
      anyBJ: raw.some((h) => h.outcome === "blackjack"),
      deadline: deadlineFor(slug, me),
      deadlineTotal: t.stage === "betting" ? BJT_RULES.betMs : t.stage === "insurance" ? BJT_RULES.insuranceMs : BJT_RULES.actionMs,
    };
  };

  const hasActions =
    seated &&
    !busted &&
    (t.stage === "betting" || (t.stage === "insurance" && caughtUp && t.seats.some((s) => s.slug === mySlug && s.insurance === undefined)) || myTurn);

  const footer = !seated
    ? "Table complète : tu regardes la partie."
    : busted
      ? "Plus assez pour miser · tu regardes la fin"
      : t.noBets
        ? "Personne n'a misé · manche suivante"
        : t.stage === "betting" && t.betDone.includes(mySlug)
          ? `${(t.bets[mySlug] ?? 0) > 0 ? `Mise posée : ${euro(t.bets[mySlug])}` : "Tu passes cette manche"} · ${t.betDone.length}/${t.order.filter((s) => !isBusted(s)).length}`
          : " ";

  return {
    game,
    t,
    mySlug,
    busy,
    act,
    seated,
    busted,
    myTurn,
    caughtUp,
    showResults,
    dealer: {
      codes: dealer.codes,
      hidden: dealer.hidden,
      revealed: dealerRevealed,
      total: dealerTotal,
      blackjack: t.dealer.blackjack && dealer.codes.length === 2,
    },
    others: others.map(placeOf),
    left: leftSlugs.map(placeOf),
    right: rightSlugs.map(placeOf),
    me: seated ? placeOf(mySlug) : null,
    hasActions,
    footer,
    roundLabel: t.totalRounds > 0 ? `Manche ${t.round}/${t.totalRounds}` : `Manche ${t.round} · Dernier survivant`,
  };
}
type BjView = ReturnType<typeof useBjView>;

// ---------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------

export default function BlackjackVariantScreen(props: { variant: BjVariantId; deck?: Deck; fourColor?: boolean }) {
  const { game } = useGame();
  // Une manche = un nouveau rejeu (le compteur repart de zéro).
  return <BjTable key={game.bjt!.round} {...props} />;
}

interface Ctx {
  v: BjView;
  W: number;
  deck: Deck;
  fourColor: boolean;
  animate: boolean;
  open: (slug: string) => void;
}

function BjTable({ variant, deck: deckOverride, fourColor = false }: { variant: BjVariantId; deck?: Deck; fourColor?: boolean }) {
  const v = useBjView();
  const deck = deckOverride ?? BJ_DECK[variant];
  const [ref, W] = useWidth<HTMLDivElement>(358);
  const animate = useAfterFirstPaint();
  const [zoom, setZoom] = useState<string | null>(null);
  const open = useCallback((slug: string) => setZoom(slug), []);
  const close = useCallback(() => setZoom(null), []);
  const zoomPlace = zoom ? [...v.others, ...(v.me ? [v.me] : [])].find((p) => p.slug === zoom) : null;
  const c: Ctx = { v, W, deck, fourColor, animate, open };

  return (
    <Screen actions={v.hasActions ? <BjActions v={v} /> : undefined}>
      <div className="flex items-center justify-between gap-2">
        <Kicker>{v.roundLabel}</Kicker>
        <span className="text-[0.72rem] font-semibold text-mute">
          {v.t.reshuffled && v.t.stage === "betting" ? "🔀 Sabot remélangé · " : ""}Mise {euro(BJT_RULES.minBet)} min
        </span>
      </div>

      <div ref={ref} className={`bv bv-${variant} relative mt-2 w-full select-none`} data-table data-variant={variant}>
        {variant === "A" ? <LayoutA c={c} /> : variant === "B" ? <LayoutB c={c} /> : <LayoutC c={c} />}
      </div>

      {!v.hasActions && <p className="mt-1.5 text-center text-[0.72rem] text-mute">{v.footer}</p>}

      <HandZoom
        open={!!zoomPlace}
        onClose={close}
        name={zoomPlace ? (zoomPlace.me ? "Ta main" : zoomPlace.name) : ""}
        hands={(zoomPlace?.hands ?? []).map<ZoomHand>((h) => ({ cards: h.cards, bet: h.bet, doubled: h.doubled, natural: h.natural, res: h.res }))}
        deck={deck}
        fourColor={fourColor}
      />
    </Screen>
  );
}

// Barre d'actions : pendant mon tour, les 4 coups sur une seule rangée
// (la table garde sa hauteur) ; mises et assurance : barre actuelle.
function BjActions({ v }: { v: BjView }) {
  const { game, t, mySlug, busy, act, seated, busted, myTurn, caughtUp } = v;
  if (t.stage !== "playerTurns" || !myTurn)
    return <ActionBar game={game} t={t} mySlug={mySlug} seated={seated} busted={busted} myTurn={myTurn} caughtUp={caughtUp} busy={busy} act={act} />;
  const seat = t.seats[t.turn];
  const legal = legalFor(game as GameState, mySlug)!;
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

// ---------------------------------------------------------------------
// Éléments communs
// ---------------------------------------------------------------------

function SpotCircle({ p, r, style }: { p: PlaceV; r: number; style?: CSSProperties }) {
  return (
    <div
      className={`bv-spot absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full ${p.me ? "bv-spot-me" : ""} ${p.turn ? "tk-halo" : ""}`}
      style={{ width: r * 2, height: r * 2, ...style }}
      data-spot
    >
      {p.bet > 0 ? <ChipStack amount={p.bet} scale={p.me ? 0.95 : 0.72} maxColumns={2} maxPerColumn={4} /> : null}
      {p.deadline && <TimerRing key={p.deadline} deadlineAt={p.deadline} totalMs={p.deadlineTotal} size={r * 2 + 10} stroke={3} />}
    </div>
  );
}

// Résultat d'un autre joueur : étiquette compacte.
function NetTag({ p, small = true }: { p: PlaceV; small?: boolean }) {
  if (p.net === undefined) return null;
  if (p.anyBJ)
    return (
      <Tag tone="bj" small={small}>
        BJ {signed(p.net)}
      </Tag>
    );
  if (p.net === 0)
    return (
      <Tag tone="push" small={small}>
        PUSH
      </Tag>
    );
  return (
    <Tag tone={p.net > 0 ? "win" : "lose"} small={small}>
      {signed(p.net)}
    </Tag>
  );
}

// Main du croupier (boîte fixe) avec son total à droite.
function DealerHand({ c, w, h, maxCw, style }: { c: Ctx; w: number; h: number; maxCw: number; style?: CSSProperties }) {
  const { v } = c;
  const d = v.dealer;
  const n = d.codes.length + d.hidden;
  // Carte cachée : dos tant qu'elle n'est pas retournée.
  const cards = Array.from({ length: n }, (_, i) => (i === 1 && !d.revealed ? null : d.codes[i]));
  return (
    <div className="absolute" style={style} data-dealer>
      <DealerRun c={c} cards={cards} w={w} h={h} maxCw={maxCw} />
      {d.codes.length > 0 && (
        <div className="absolute top-1/2 -translate-y-1/2" style={{ left: w + 6 }}>
          <TotalBadge cards={d.codes} blackjack={d.blackjack} />
        </div>
      )}
      {v.showResults && d.codes.length > 0 && (
        <div className="bv-dealer-line absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap">
          {d.total > 21 ? "Le croupier saute !" : v.t.dealer.blackjack ? "Blackjack du croupier" : `Le croupier fait ${d.total}`}
        </div>
      )}
    </div>
  );
}

// Le croupier peut avoir une carte face cachée : rangée simple, même règle
// d'index visible que les mains.
function DealerRun({ c, cards, w, h, maxCw }: { c: Ctx; cards: (CardCode | null)[]; w: number; h: number; maxCw: number }) {
  const codes = cards.map((x) => x ?? "As");
  return (
    <HandRun
      cards={codes}
      w={w}
      h={h}
      maxCw={maxCw}
      deck={c.deck}
      fourColor={c.fourColor}
      animate={c.animate}
      dealFrom={(i) => ({ x: 60 - i * 14, y: -30 })}
      faceDown={(i) => cards[i] === null}
    />
  );
}

// Ma main en grand (variantes A et B) : sous la table / la grille.
function MyPanel({ c, spot }: { c: Ctx; spot: boolean }) {
  const { v } = c;
  const me = v.me;
  if (!me) return null;
  const hands = me.hands;
  const split = hands.length > 1;
  const avail = c.W - 96;
  const boxW = split ? Math.floor((avail - 8 * (hands.length - 1)) / hands.length) : Math.min(230, avail);
  const boxH = split ? 70 : 86;
  return (
    <div className="bv-me relative flex items-stretch gap-2" data-me data-seat={me.slug}>
      <div className="flex w-[76px] shrink-0 flex-col items-center justify-center gap-1">
        <div className={`relative grid place-items-center rounded-full ${me.turn ? "tk-halo" : ""}`} style={{ width: 40, height: 40 }} data-spot>
          <span className={`bv-me-avatar ${spot ? "" : "bv-me-face"}`}>
            {spot ? me.bet > 0 ? <ChipStack amount={me.bet} scale={0.9} maxColumns={2} maxPerColumn={4} /> : "€" : me.initial}
          </span>
          {me.deadline && <TimerRing key={me.deadline} deadlineAt={me.deadline} totalMs={me.deadlineTotal} size={50} stroke={3} />}
        </div>
        <div className="text-center leading-tight" data-name>
          <div className="text-[0.72rem] font-bold text-cyan">Toi{me.away ? " · absent" : ""}</div>
          <div className="text-[0.7rem] font-semibold tabular-nums text-ink-2">{me.busted ? "spectateur" : euro(me.stack)}</div>
          {me.bet > 0 && <div className="text-[0.62rem] font-semibold tabular-nums text-mute">mise {euro(me.bet)}</div>}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 items-end justify-center gap-2">
        {hands.length === 0 && (
          <div className="grid h-[104px] flex-1 place-items-center text-[0.75rem] text-mute">{v.t.stage === "betting" ? "Pose ta mise" : " "}</div>
        )}
        {hands.map((h) => (
          <div key={h.id} className="flex flex-col items-center gap-1" data-hand={h.id}>
            <div className="flex h-[20px] items-center gap-1.5">
              <TotalBadge cards={h.cards} blackjack={h.natural} size="lg" />
              {h.res ? <Tag tone={h.res.tone}>{h.res.text}</Tag> : h.bust ? <Tag tone="lose">BUST</Tag> : h.natural ? <Tag tone="bj">BLACKJACK</Tag> : null}
              {split && (
                <span className="text-[0.6rem] font-semibold tabular-nums text-white/70">
                  {euro(h.bet)}
                  {h.doubled ? " ×2" : ""}
                </span>
              )}
            </div>
            <HandRun
              cards={h.cards}
              w={boxW}
              h={boxH}
              maxCw={split ? 46 : 60}
              deck={c.deck}
              fourColor={c.fourColor}
              animate={c.animate}
              spread={0.55}
              dealFrom={(k) => ({ x: 80 - k * 10, y: -260 })}
              dim={h.lose}
              active={split && h.active}
              onOpen={() => c.open(me.slug)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Décor partagé : sabot et défausse (SVG).
function Shoe({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 30 L5 3 L38 3 L38 30 Z" fill="#1b1410" stroke="rgba(219,180,96,0.7)" strokeWidth="1.1" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={8 + i * 1.6} y={6 + i} width="23" height="17" rx="2" fill="#7d1426" stroke="#f4ead8" strokeWidth="0.8" transform="rotate(-8 20 15)" />
      ))}
      <path d="M0 30 L38 30 L38 35 L2 35 Z" fill="#0d0907" />
    </g>
  );
}
function Discard({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity="0.9">
      <rect width="21" height="28" rx="3" fill="#1b1410" stroke="rgba(219,180,96,0.5)" />
      <rect x="2.5" y="3" width="16" height="22" rx="2" fill="#7d1426" stroke="#f4ead8" strokeWidth="0.7" />
    </g>
  );
}

function FeltDefs({ id, felt }: { id: string; felt: [string, string, string, string] }) {
  return (
    <>
      <radialGradient id={`${id}-leather`} cx="50%" cy="30%" r="80%">
        <stop offset="0" stopColor="#4a2d1b" />
        <stop offset="0.6" stopColor="#24140b" />
        <stop offset="1" stopColor="#110803" />
      </radialGradient>
      <radialGradient id={`${id}-felt`} cx="50%" cy="35%" r="80%">
        <stop offset="0" stopColor={felt[0]} />
        <stop offset="0.45" stopColor={felt[1]} />
        <stop offset="0.8" stopColor={felt[2]} />
        <stop offset="1" stopColor={felt[3]} />
      </radialGradient>
      <filter id={`${id}-noise`}>
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.22 0" />
      </filter>
      <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="8" />
      </filter>
    </>
  );
}
const GREEN: [string, string, string, string] = ["#2c8f62", "#1a6a45", "#0f4a30", "#082b1c"];

const rad = (d: number) => (d * Math.PI) / 180;

// ---------------------------------------------------------------------
// A · Demi-lune classique
// ---------------------------------------------------------------------

const A_OFFSETS: Record<number, number[]> = { 0: [], 1: [45], 2: [30, 60], 3: [22, 46, 71], 4: [17, 36, 55, 75] };

function LayoutA({ c }: { c: Ctx }) {
  const { v, W } = c;
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const perSide = Math.max(v.left.length, v.right.length);
  const four = perSide >= 4;
  const H = four ? 424 : 386;
  const h0 = 50;
  const cx = W / 2;
  const rx = W / 2 - 34;
  const ry = H - 44; // mon cercle, au bas de l'arc
  const offs = A_OFFSETS[Math.min(4, perSide)] ?? [];
  const unitW = four ? 66 : 76;
  const cardsH = four ? 38 : 46;
  const headH = 17;
  const R = four ? 11 : 13;
  // Chaque place : cercle sur l'arc, et devant lui (vers le croupier) sa
  // main avec, au-dessus, le nom et le total.
  const spots = [
    ...v.left.map((p, i) => ({ p, side: -1, th: 90 + (offs[i] ?? 45) })),
    ...v.right.map((p, i) => ({ p, side: 1, th: 90 - (offs[i] ?? 45) })),
  ].map((s) => {
    const x = cx + rx * Math.cos(rad(s.th));
    const y = ry * Math.sin(rad(s.th));
    const ux = Math.min(W - 4 - unitW / 2, Math.max(4 + unitW / 2, x));
    const top = y - R - 4 - headH - cardsH;
    const room = s.side < 0 ? x - R - 4 : W - x - R - 4;
    return { ...s, x, y, ux, top, below: room < 36 };
  });
  const felt = `M0 0 H${W} V${h0} A${W / 2} ${H - h0} 0 0 1 0 ${h0} Z`;
  const inner = (k: number) => `M${k} ${k} H${W - k} V${h0} A${W / 2 - k} ${H - h0 - k} 0 0 1 ${k} ${h0} Z`;
  const line = `M${cx - rx} 0 A${rx} ${ry} 0 0 0 ${cx + rx} 0`;
  return (
    <>
      <div className="relative" style={{ height: H }}>
        <svg className="pointer-events-none absolute inset-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
          <defs>
            <FeltDefs id={id} felt={GREEN} />
            <clipPath id={`${id}-clip`}>
              <path d={inner(12)} />
            </clipPath>
            <path id={`${id}-t1`} d={`M${cx - 70} 112 Q${cx} 130 ${cx + 70} 112`} />
            <path id={`${id}-t2`} d={`M${cx - 66} 126 Q${cx} 143 ${cx + 66} 126`} />
          </defs>
          <path d={felt} transform="translate(0 8)" fill="rgba(0,0,0,0.55)" filter={`url(#${id}-shadow)`} />
          <path d={felt} fill={`url(#${id}-leather)`} />
          <path d={inner(5)} fill="none" stroke="rgba(255,214,160,0.28)" strokeDasharray="3 3" />
          <path d={inner(12)} fill={`url(#${id}-felt)`} />
          <rect width={W} height={H} filter={`url(#${id}-noise)`} clipPath={`url(#${id}-clip)`} />
          <path d={inner(12)} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="3" />
          <path d={line} fill="none" stroke="rgba(219,180,96,0.38)" strokeWidth="1.4" clipPath={`url(#${id}-clip)`} />
          <text className="tb-print" fontSize="9.5" fontWeight="700">
            <textPath href={`#${id}-t1`} startOffset="50%" textAnchor="middle">
              BLACKJACK PAYS 3 TO 2
            </textPath>
          </text>
          <text className="tb-print" fontSize="6.6" style={{ letterSpacing: "0.06em" }}>
            <textPath href={`#${id}-t2`} startOffset="50%" textAnchor="middle">
              Dealer must stand on 17
            </textPath>
          </text>
          <Shoe x={W - 52} y={4} />
          <Discard x={16} y={8} />
        </svg>

        <DealerHand c={c} w={106} h={58} maxCw={40} style={{ left: cx - 53, top: 12 }} />

        {spots.map(({ p, side, x, y, ux, top, below }) => {
          const h = p.shownHand;
          return (
            <div key={p.slug} data-seat={p.slug}>
              <div className="absolute" style={{ left: ux - unitW / 2, top, width: unitW }}>
                <div className={`flex items-center gap-1 ${side < 0 ? "" : "flex-row-reverse"}`} style={{ height: headH }} data-name>
                  <span className={`bv-unit-name min-w-0 truncate ${side < 0 ? "" : "text-right"}`}>
                    {p.bot && !four && <span className="bv-bot">🤖</span>}
                    {p.name}
                  </span>
                  {h && <TotalBadge cards={h.cards} blackjack={h.natural} size="sm" />}
                  {p.hands.length > 1 && <span className="bv-multi">×{p.hands.length}</span>}
                </div>
                {h ? (
                  <HandRun
                    cards={h.cards}
                    w={unitW}
                    h={cardsH}
                    maxCw={four ? 27 : 32}
                    minCw={18}
                    deck={c.deck}
                    fourColor={c.fourColor}
                    align={[side < 0 ? "start" : "end", "end"]}
                    animate={c.animate}
                    dealFrom={(i) => ({ x: W - 50 - ux - i * 6, y: 20 - top })}
                    dim={h.lose}
                    onOpen={() => c.open(p.slug)}
                  />
                ) : (
                  <div style={{ height: cardsH }} />
                )}
              </div>
              <SpotCircle p={p} r={R} style={{ left: x, top: y }} />
              <div
                className={`absolute ${below ? "-translate-x-1/2 text-center" : side < 0 ? "-translate-x-full -translate-y-1/2 text-right" : "-translate-y-1/2"}`}
                style={below ? { left: x, top: y + R + 2 } : side < 0 ? { left: x - R - 4, top: y } : { left: x + R + 4, top: y }}
                data-name
              >
                {p.net !== undefined ? <NetTag p={p} /> : <span className="bv-unit-stack">{p.busted ? "spectateur" : euro(p.stack)}</span>}
                {p.away && <span className="bv-away ml-1">absent</span>}
              </div>
            </div>
          );
        })}

        {v.me && <SpotCircle p={v.me} r={18} style={{ left: cx, top: ry }} />}
      </div>
      <div className="relative -mt-1">
        <MyPanel c={c} spot={false} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------
// B · Grille compacte
// ---------------------------------------------------------------------

function LayoutB({ c }: { c: Ctx }) {
  const { v, W } = c;
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const n = v.others.length;
  const cols = n > 6 ? 4 : 3;
  const rows = Math.max(1, Math.ceil(n / cols));
  const gap = 6;
  const cellW = Math.floor((W - gap * (cols - 1)) / cols);
  const cellH = cols === 4 ? 100 : 116;
  const cardsH = cols === 4 ? 46 : 62;
  // Ordre de jeu : la première case est la première à parler.
  const cells = [...v.others, ...Array.from({ length: rows * cols - n }, () => null)];
  const dealerH = 120;
  return (
    <div className="flex flex-col gap-1.5">
      {/* Croupier */}
      <div className="bv-felt relative overflow-hidden rounded-[22px]" style={{ height: dealerH }}>
        <svg className="pointer-events-none absolute inset-0" width={W} height={dealerH} viewBox={`0 0 ${W} ${dealerH}`} aria-hidden>
          <defs>
            <path id={`${id}-t`} d={`M${W / 2 - 150} ${dealerH - 16} Q${W / 2} ${dealerH - 2} ${W / 2 + 150} ${dealerH - 16}`} />
          </defs>
          <text className="bv-print" fontSize="8" fontWeight="700">
            <textPath href={`#${id}-t`} startOffset="50%" textAnchor="middle">
              BLACKJACK PAYS 3 TO 2 · DEALER STANDS ON 17
            </textPath>
          </text>
          <Shoe x={W - 50} y={10} />
          <Discard x={14} y={26} />
        </svg>
        <div className="bv-label absolute left-3.5 top-2.5">Croupier</div>
        <DealerHand c={c} w={140} h={62} maxCw={44} style={{ left: W / 2 - 70, top: 18 }} />
      </div>

      {/* Les autres joueurs */}
      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, ${cellW}px)`, gap }}>
        {cells.map((p, i) =>
          p ? (
            <GridCell key={p.slug} c={c} p={p} w={cellW} h={cellH} cardsH={cardsH} small={cols === 4} />
          ) : (
            <div key={`empty-${i}`} className="bv-cell-empty" style={{ height: cellH }}>
              place libre
            </div>
          ),
        )}
      </div>

      {/* Ma main, en grand */}
      <div className="bv-felt rounded-[22px] px-2 py-2">
        <MyPanel c={c} spot />
      </div>
    </div>
  );
}

function GridCell({ c, p, w, h, cardsH, small }: { c: Ctx; p: PlaceV; w: number; h: number; cardsH: number; small: boolean }) {
  const hand = p.shownHand;
  return (
    <div className={`bv-cell ${p.turn ? "bv-cell-turn" : ""} ${p.busted ? "bv-cell-out" : ""}`} style={{ height: h }} data-seat={p.slug}>
      <div className={`flex h-[20px] items-center ${small ? "gap-1 px-1" : "gap-1.5 px-1.5"}`} data-name>
        <div className="relative grid shrink-0 place-items-center" style={{ width: small ? 10 : 16, height: small ? 10 : 16 }}>
          <span className="block h-full w-full rounded-full" style={{ background: playerColor(p.slug) }} />
          {p.deadline && <TimerRing key={p.deadline} deadlineAt={p.deadline} totalMs={p.deadlineTotal} size={small ? 18 : 24} stroke={2.5} />}
        </div>
        <span className={`bv-cell-name min-w-0 flex-1 truncate ${small ? "text-[0.64rem]!" : ""}`}>
          {p.name}
          {p.bot && !small ? " 🤖" : ""}
        </span>
        {hand && <TotalBadge cards={hand.cards} blackjack={hand.natural} size="sm" />}
      </div>
      <div className="flex justify-center">
        {hand ? (
          <HandRun
            cards={hand.cards}
            w={w - 8}
            h={cardsH}
            maxCw={small ? 30 : 40}
            deck={c.deck}
            fourColor={c.fourColor}
            animate={c.animate}
            dealFrom={() => ({ x: 0, y: -120 })}
            dim={hand.lose}
            onOpen={() => c.open(p.slug)}
          />
        ) : (
          <div style={{ height: cardsH }} className="grid place-items-center text-[0.62rem] text-mute">
            {p.busted ? "spectateur" : "—"}
          </div>
        )}
      </div>
      <div className="flex h-[22px] items-center justify-between gap-1 px-1.5">
        <span className="bv-cell-bet">
          {p.bet > 0 && <ChipStack amount={p.bet} scale={0.55} maxColumns={1} maxPerColumn={3} />}
          {p.bet > 0 ? euro(p.bet) : ""}
          {p.hands.length > 1 && <span className="bv-multi ml-1">×{p.hands.length}</span>}
        </span>
        {p.net !== undefined ? <NetTag p={p} /> : <span className="bv-cell-stack">{p.busted ? "" : euro(p.stack)}</span>}
      </div>
      {p.away && <span className="bv-away absolute right-1 top-1">absent</span>}
    </div>
  );
}

// ---------------------------------------------------------------------
// C · Arc sourire
// ---------------------------------------------------------------------

function LayoutC({ c }: { c: Ctx }) {
  const { v, W } = c;
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const H = 448;
  const cx = W / 2;
  const meY = H - 80;
  const colTop = 136; // haut des colonnes de cartes (sous les inscriptions)
  const perSide = Math.max(1, v.left.length, v.right.length);
  const meW = perSide >= 4 ? 88 : 100;
  const slotW = Math.min(56, Math.floor((W - meW - 8) / (2 * perSide)));
  const R = slotW < 38 ? 11 : 13;
  const maxCw = Math.min(30, slotW - 10);
  // Cascade vers le centre : en diagonale à 45° tant que ça tient, plus
  // raide quand la main s'allonge.
  const towards = (side: number) => [45, 58, 70, 80].map((a) => ({ x: side * Math.cos(rad(a)), y: -Math.sin(rad(a)) }));
  // Places sur un « sourire » : plus on s'éloigne du centre, plus on monte.
  const smileY = (x: number) => meY + 4 - 104 * Math.pow(Math.abs(x - cx) / (W / 2), 2);
  const spots = [
    ...v.left.map((p, i) => ({ p, side: 1, x: cx - meW / 2 - 4 - slotW * (i + 0.5) })),
    ...v.right.map((p, i) => ({ p, side: -1, x: cx + meW / 2 + 4 + slotW * (i + 0.5) })),
  ].map((s) => {
    const y = smileY(s.x);
    const bottom = y - R - 4;
    // Cascade : vers le haut, légèrement penchée vers le centre.
    const dirs = towards(s.side);
    const bw = slotW - 2;
    const bh = bottom - colTop;
    const h = s.p.shownHand;
    const lay = h
      ? layoutRun(h.cards.length, { w: bw, h: bh }, { maxCw, minCw: 16, deck: c.deck, dirs, align: [s.side > 0 ? "start" : "end", "end"], spread: 0.3 })
      : null;
    const topCard = lay && lay.pos.length ? Math.min(...lay.pos.map((q) => q.y)) : bh;
    return { ...s, y, dirs, bw, bh, lay, topCard };
  });
  const smile = (() => {
    const pts = Array.from({ length: 41 }, (_, i) => {
      const x = 14 + ((W - 28) * i) / 40;
      return `${i ? "L" : "M"}${x.toFixed(1)} ${smileY(x).toFixed(1)}`;
    });
    return pts.join(" ");
  })();
  const shape = `M26 0 H${W - 26} Q${W} 0 ${W} 26 V${H - 120} Q${W} ${H - 4} ${cx} ${H - 4} Q0 ${H - 4} 0 ${H - 120} V26 Q0 0 26 0 Z`;
  // Ma colonne : cascade en diagonale, cartes plus grandes.
  const me = v.me;
  const myHands = me?.hands ?? [];
  const myBottom = meY - 24 - 6;
  return (
    <div className="relative" style={{ height: H }}>
      <svg className="pointer-events-none absolute inset-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <defs>
          <FeltDefs id={id} felt={["#2f9566", "#1d6e48", "#114c31", "#08291a"]} />
          <clipPath id={`${id}-clip`}>
            <path d={shape} />
          </clipPath>
          <path id={`${id}-t1`} d={`M${cx - 110} 98 Q${cx} 122 ${cx + 110} 98`} />
          <path id={`${id}-t2`} d={`M${cx - 112} 112 Q${cx} 136 ${cx + 112} 112`} />
        </defs>
        <path d={shape} transform="translate(0 8)" fill="rgba(0,0,0,0.55)" filter={`url(#${id}-shadow)`} />
        <path d={shape} fill={`url(#${id}-leather)`} />
        <g clipPath={`url(#${id}-clip)`}>
          <path d={shape} fill={`url(#${id}-felt)`} transform={`translate(${W * 0.035} 10) scale(0.93 0.955)`} />
        </g>
        <rect width={W} height={H} filter={`url(#${id}-noise)`} clipPath={`url(#${id}-clip)`} />
        <path d={smile} fill="none" stroke="rgba(219,180,96,0.45)" strokeWidth="1.4" />
        <text className="tb-print" fontSize="10" fontWeight="700">
          <textPath href={`#${id}-t1`} startOffset="50%" textAnchor="middle">
            BLACKJACK PAYS 3 TO 2
          </textPath>
        </text>
        <text className="tb-print" fontSize="7.2" style={{ letterSpacing: "0.08em" }}>
          <textPath href={`#${id}-t2`} startOffset="50%" textAnchor="middle">
            Dealer must stand on 17 and draw to 16
          </textPath>
        </text>
        <Shoe x={W - 56} y={12} />
        <Discard x={22} y={14} />
      </svg>

      <DealerHand c={c} w={118} h={60} maxCw={42} style={{ left: cx - 59, top: 14 }} />

      {spots.map(({ p, side, x, y, dirs, bw, bh, topCard }) => {
        const h = p.shownHand;
        const left = x - bw / 2;
        return (
          <div key={p.slug} data-seat={p.slug}>
            {h && (
              <HandRun
                cards={h.cards}
                w={bw}
                h={bh}
                maxCw={maxCw}
                minCw={16}
                deck={c.deck}
                fourColor={c.fourColor}
                dirs={dirs}
                align={[side > 0 ? "start" : "end", "end"]}
                spread={0.3}
                animate={c.animate}
                dealFrom={(i) => ({ x: W - 40 - left - i * 4, y: 20 - colTop - bh })}
                dim={h.lose}
                onOpen={() => c.open(p.slug)}
                style={{ position: "absolute", left, top: colTop, zIndex: 2 }}
              />
            )}
            {/* Total au-dessus de la carte du haut */}
            {h && h.cards.length > 0 && (
              <div className="absolute flex -translate-x-1/2 items-center gap-0.5" style={{ left: x, top: colTop + topCard - 19, zIndex: 4 }}>
                <TotalBadge cards={h.cards} blackjack={h.natural} size="sm" />
                {p.hands.length > 1 && <span className="bv-multi">×{p.hands.length}</span>}
              </div>
            )}
            <SpotCircle p={p} r={R} style={{ left: x, top: y, zIndex: 3 }} />
            <div
              className={`bv-col-name absolute -translate-x-1/2 text-center ${slotW < 38 ? "bv-col-small" : ""}`}
              style={{ left: x, top: y + R + 2, width: slotW - 2, zIndex: 4 }}
              data-name
            >
              <div className="bv-name-n">{p.name}</div>
              {p.net !== undefined ? <NetTag p={p} /> : <div className="bv-name-s">{p.busted ? "—" : euro(p.stack)}</div>}
              {p.away && <span className="bv-away">absent</span>}
            </div>
          </div>
        );
      })}

      {me && (
        <div data-seat={me.slug} data-me>
          {myHands.map((h, i) => {
            const n = myHands.length;
            const w = Math.floor((meW - 6 * (n - 1)) / n);
            const left = cx - meW / 2 + i * (w + 6);
            const bh = myBottom - colTop - 20;
            const dirs = (n > 1 ? [62, 72, 82] : [40, 52, 64, 76]).map((a) => ({ x: Math.cos(rad(a)), y: -Math.sin(rad(a)) }));
            const opts = { maxCw: n > 1 ? 32 : 44, minCw: 18, deck: c.deck, dirs, align: ["center", "end"] as [Align, Align], spread: 0.45 };
            const lay = layoutRun(h.cards.length, { w, h: bh }, opts);
            const top = lay.pos.length ? Math.min(...lay.pos.map((q) => q.y)) : bh;
            const res = h.res;
            return (
              <div key={h.id}>
                <HandRun
                  cards={h.cards}
                  w={w}
                  h={bh}
                  {...opts}
                  fourColor={c.fourColor}
                  animate={c.animate}
                  dealFrom={(k) => ({ x: W - 60 - left - k * 8, y: -colTop - bh })}
                  dim={h.lose}
                  active={n > 1 && h.active}
                  onOpen={() => c.open(me.slug)}
                  style={{ position: "absolute", left, top: colTop + 20, zIndex: 2 }}
                />
                <div className="absolute flex -translate-x-1/2 items-center gap-1" style={{ left: left + w / 2, top: colTop + 20 + top - 22, zIndex: 5 }}>
                  <TotalBadge cards={h.cards} blackjack={h.natural} size={n > 1 ? "md" : "lg"} />
                  {res ? (
                    <Tag tone={res.tone} small={n > 1}>
                      {res.text}
                    </Tag>
                  ) : h.bust ? (
                    <Tag tone="lose">BUST</Tag>
                  ) : h.natural ? (
                    <Tag tone="bj">BJ</Tag>
                  ) : null}
                </div>
              </div>
            );
          })}
          <SpotCircle p={me} r={24} style={{ left: cx, top: meY, zIndex: 3 }} />
          <div className="absolute -translate-x-1/2 text-center leading-tight" style={{ left: cx, top: meY + 31 }} data-name>
            <div className="text-[0.74rem] font-bold text-cyan">Toi{me.away ? " · absent" : ""}</div>
            <div className="text-[0.66rem] font-semibold tabular-nums text-white/75">{me.busted ? "spectateur" : euro(me.stack)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
