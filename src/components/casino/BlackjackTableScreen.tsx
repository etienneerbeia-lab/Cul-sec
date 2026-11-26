"use client";

import { useEffect, useId, useMemo, useState } from "react";
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
import { CasinoCard } from "./CasinoCard";
import { ChipStack } from "./Chips";
import { Tag, type TagTone, TimerRing, useAfterFirstPaint, useWidth } from "./TableKit";
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

// ---- Géométrie de la table en demi-lune (px, d'après la largeur mesurée) ----
function geometry(W: number) {
  const H = Math.round(Math.min(560, Math.max(440, W * 1.44)));
  const h0 = Math.round(H * 0.26); // bord droit (croupier) → début de l'arc
  const cx = W / 2;
  // Arc des places : un peu à l'intérieur du rail.
  const prx = W / 2 - 36;
  const pry = H - h0 - 70;
  return { W, H, h0, cx, prx, pry, shoe: { x: W - 50, y: 40 } };
}
type Geo = ReturnType<typeof geometry>;

const rad = (d: number) => (d * Math.PI) / 180;

// Gabarits des places selon le nombre de joueurs (comme dans les applis de
// casino) : angle de chaque place à ma gauche, de la plus proche à la plus
// éloignée (90° = en bas, au centre ; la droite est symétrique), et sens de
// pose des cartes (side : vers l'intérieur de la table au lieu d'au-dessus
// du cercle). Calculés par optimisation numérique pour qu'aucune place ne
// chevauche une autre, de 343 à 488 px de large.
const SEAT_LAYOUTS: Record<number, { a: number; side: boolean }[]> = {
  2: [{ a: 159.1, side: true }],
  3: [{ a: 152.7, side: false }],
  4: [{ a: 132, side: false }, { a: 160, side: true }],
  5: [{ a: 150.1, side: false }, { a: 176, side: false }],
  6: [{ a: 134.6, side: false }, { a: 161.5, side: true }, { a: 176, side: false }],
  7: [{ a: 129.2, side: false }, { a: 155.9, side: true }, { a: 169.1, side: true }],
  8: [{ a: 123.6, side: false }, { a: 150.3, side: true }, { a: 161.2, side: true }, { a: 176, side: false }],
};

function placePos(g: Geo, angle: number) {
  return { x: g.cx + g.prx * Math.cos(rad(angle)), y: g.h0 + g.pry * Math.sin(rad(angle)) };
}

function feltPath(W: number, H: number, h0: number, inset: number) {
  const rx = W / 2 - inset;
  const ry = H - h0 - inset;
  return `M${inset} ${inset} H${W - inset} V${h0} A${rx} ${ry} 0 0 1 ${inset} ${h0} Z`;
}

function Table() {
  const { game, mySlug, busy, act, away } = useGame();
  const t = game.bjt!;
  const chips = game.chips!;
  const [ref, W] = useWidth<HTMLDivElement>(343);
  const g = geometry(W);
  const animate = useAfterFirstPaint();
  const names = useMemo(() => new Map(game.playersPublic.map((p) => [p.slug, p.name])), [game.playersPublic]);
  const nameOf = (s: string) => cleanName(names.get(s) ?? s);
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

  // Les autres joueurs dans l'ordre de la table : ceux qui jouent après moi
  // à ma gauche (côté gauche de l'écran), les autres à ma droite.
  const meIdx = t.order.indexOf(mySlug);
  const others = (meIdx >= 0 ? [...t.order.slice(meIdx + 1), ...t.order.slice(0, meIdx)] : t.order).filter((s) => s !== mySlug);
  const nLeft = Math.ceil(others.length / 2);
  const layout = SEAT_LAYOUTS[Math.min(8, Math.max(2, others.length + 1))] ?? [];
  // Ordre de jeu : à ma gauche (écran à gauche) du plus proche au plus
  // éloigné, puis de l'autre bord vers ma droite.
  const leftSlugs = others.slice(0, nLeft);
  const rightSlugs = others.slice(nLeft).reverse();
  const places: { slug: string; angle: number; side: boolean; me: boolean }[] = [
    ...leftSlugs.map((slug, i) => ({ slug, angle: layout[i]?.a ?? 150, side: !!layout[i]?.side, me: false })),
    ...rightSlugs.map((slug, i) => ({ slug, angle: 180 - (layout[i]?.a ?? 150), side: !!layout[i]?.side, me: false })),
    ...(seated ? [{ slug: mySlug, angle: 90, side: false, me: true }] : []),
  ];
  const compact = others.length >= 3;
  // 7-8 joueurs : ma main est surélevée et un peu plus petite.
  const fullTable = others.length >= 6;

  const roundLabel = t.totalRounds > 0 ? `Manche ${t.round}/${t.totalRounds}` : `Manche ${t.round} · Dernier survivant`;
  const actions = (
    <ActionBar game={game} t={t} mySlug={mySlug} seated={seated} busted={busted} myTurn={myTurn} caughtUp={caughtUp} busy={busy} act={act} />
  );
  const hasActions =
    seated &&
    !busted &&
    ((t.stage === "betting") ||
      (t.stage === "insurance" && caughtUp && t.seats.some((s) => s.slug === mySlug && s.insurance === undefined)) ||
      myTurn);

  return (
    <Screen actions={hasActions ? actions : undefined}>
      <div className="flex items-center justify-between gap-2">
        <Kicker>{roundLabel}</Kicker>
        <span className="text-[0.72rem] font-semibold text-mute">
          {t.reshuffled && t.stage === "betting" ? "🔀 Sabot remélangé · " : ""}Mise {euro(BJT_RULES.minBet)} min
        </span>
      </div>

      <div ref={ref} className="relative mt-2 w-full select-none" style={{ height: g.H }} data-table>
        <TableArt g={g} />

        {/* Cartes du croupier */}
        <div className="absolute -translate-x-1/2" style={{ left: g.cx, top: 50 }} data-dealer>
          <Fan
            count={dealer.codes.length + dealer.hidden}
            width={44}
            render={(i, st) => {
              const isHole = i === 1;
              const code = isHole ? (dealerRevealed ? dealer.codes[1] : null) : dealer.codes[i];
              return (
                <CasinoCard
                  key={i}
                  card={code ? fromCode(code) : null}
                  faceDown={isHole && !dealerRevealed}
                  width={44}
                  back="bordeaux"
                  animate={animate}
                  flipIn={!isHole}
                  dealFrom={{ x: g.shoe.x - g.cx - i * 20, y: g.shoe.y - 80 }}
                  style={st}
                />
              );
            }}
          />
          {dealer.codes.length > 0 && (
            <div className="absolute left-full top-1/2 ml-1.5 -translate-y-1/2">
              <TotalPill cards={dealer.codes} blackjack={t.dealer.blackjack && dealer.codes.length === 2} />
            </div>
          )}
        </div>
        {showResults && dealer.codes.length > 0 && (
          <div className="absolute left-1/2 -translate-x-1/2 text-[0.7rem] font-semibold text-white/75" style={{ top: 50 + 64 }}>
            {dealerTotal > 21 ? "Le croupier saute !" : t.dealer.blackjack ? "Blackjack du croupier" : `Le croupier fait ${dealerTotal}`}
          </div>
        )}

        {/* Places des joueurs, le long de l'arc */}
        {places.map(({ slug, angle, side, me }) => {
          const pos = placePos(g, angle);
          return (
            <Place
              key={slug}
              slug={slug}
              name={me ? "Toi" : nameOf(slug)}
              me={me}
              x={pos.x}
              y={pos.y}
              g={g}
              t={t}
              seat={t.seats.find((s) => s.slug === slug) ?? null}
              stack={chips.stacks[slug] ?? 0}
              busted={isBusted(slug)}
              away={away.includes(slug)}
              log={t.log}
              shown={shown}
              showResults={showResults}
              animate={animate}
              compact={compact}
              side={side}
              fullTable={fullTable}
              deadline={
                t.stage === "playerTurns" && caughtUp && turnSeat?.slug === slug
                  ? deadline
                  : me && t.stage === "betting" && !t.betDone.includes(slug)
                    ? deadline
                    : me && t.stage === "insurance" && caughtUp && t.seats.some((x) => x.slug === slug && x.insurance === undefined)
                      ? deadline
                      : null
              }
            />
          );
        })}
      </div>

      {!hasActions && (
        <p className="mt-1 text-center text-[0.72rem] text-mute">
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

// ---- Décor : rail en cuir, feutre, inscriptions, rack et sabot ----
function TableArt({ g }: { g: Geo }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { W, H, h0, cx } = g;
  // Arcs des inscriptions (texte sur un « sourire »).
  const arc = (rx: number, ry: number, cy: number) => `M${cx - rx} ${cy} A${rx} ${ry} 0 0 0 ${cx + rx} ${cy}`;
  const t1 = arc(W * 0.36, H * 0.2, h0 - H * 0.09);
  const t2 = arc(W * 0.43, H * 0.255, h0 - H * 0.09);
  return (
    <svg className="pointer-events-none absolute inset-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <defs>
        <radialGradient id={`${id}-leather`} cx="50%" cy="30%" r="80%">
          <stop offset="0" stopColor="#4a2d1b" />
          <stop offset="0.6" stopColor="#24140b" />
          <stop offset="1" stopColor="#110803" />
        </radialGradient>
        <radialGradient id={`${id}-felt`} cx="50%" cy="38%" r="75%">
          <stop offset="0" stopColor="#2c8f62" />
          <stop offset="0.45" stopColor="#1a6a45" />
          <stop offset="0.8" stopColor="#0f4a30" />
          <stop offset="1" stopColor="#082b1c" />
        </radialGradient>
        <filter id={`${id}-noise`}>
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.22 0" />
        </filter>
        <clipPath id={`${id}-clip`}>
          <path d={feltPath(W, H, h0, 14)} />
        </clipPath>
        <path id={`${id}-t1`} d={t1} />
        <path id={`${id}-t2`} d={t2} />
      </defs>
      {/* Ombre portée + rail */}
      <path d={feltPath(W, H, h0, 0)} transform="translate(0 6)" fill="rgba(0,0,0,0.45)" />
      <path d={feltPath(W, H, h0, 0)} fill={`url(#${id}-leather)`} />
      <path d={feltPath(W, H, h0, 5)} fill="none" stroke="rgba(255,214,160,0.28)" strokeDasharray="3 3" />
      {/* Feutre + grain + vignette */}
      <path d={feltPath(W, H, h0, 14)} fill={`url(#${id}-felt)`} />
      <rect width={W} height={H} filter={`url(#${id}-noise)`} clipPath={`url(#${id}-clip)`} />
      <path d={feltPath(W, H, h0, 14)} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="3" />
      {/* Ligne dorée le long de l'arc */}
      <path
        d={`M${32} ${h0} A${W / 2 - 32} ${H - h0 - 32} 0 0 0 ${W - 32} ${h0}`}
        fill="none"
        stroke="rgba(219,180,96,0.45)"
        strokeWidth="1.5"
        transform={`scale(1 1)`}
      />
      {/* Inscriptions imprimées en doré */}
      <text className="tb-print" fontSize="12.5" fontWeight="700">
        <textPath href={`#${id}-t1`} startOffset="50%" textAnchor="middle">
          BLACKJACK PAYS 3 TO 2
        </textPath>
      </text>
      <text className="tb-print" fontSize="8.6" style={{ letterSpacing: "0.08em" }}>
        <textPath href={`#${id}-t2`} startOffset="50%" textAnchor="middle">
          Dealer must stand on 17 and draw to 16
        </textPath>
      </text>
      {/* Rack de jetons du croupier */}
      <g transform={`translate(${cx - 66} 18)`}>
        <rect x="0" y="0" width="132" height="24" rx="4" fill="#1a120c" stroke="rgba(219,180,96,0.55)" />
        {["#e8631b", "#f2b81c", "#7b2cbf", "#202024", "#202024", "#1f8a4c", "#1f8a4c", "#c8202f", "#c8202f", "#f1f1f1"].map((c, i) => (
          <g key={i} transform={`translate(${5 + i * 12.6} 3)`}>
            <rect width="10.5" height="18" rx="5" fill={c} />
            {[3, 7, 11, 15].map((y) => (
              <rect key={y} x="0" y={y} width="10.5" height="1" fill="rgba(0,0,0,0.3)" />
            ))}
            <rect x="2" y="1" width="2" height="16" rx="1" fill="rgba(255,255,255,0.22)" />
          </g>
        ))}
      </g>
      {/* Sabot */}
      <g transform={`translate(${g.shoe.x - 24} 16)`}>
        <path d="M0 40 L6 4 L48 4 L48 40 Z" fill="#1b1410" stroke="rgba(219,180,96,0.7)" strokeWidth="1.2" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={10 + i * 2} y={8 + i} width="30" height="22" rx="2" fill="#7d1426" stroke="#f4ead8" strokeWidth="1" transform={`rotate(-8 25 20)`} />
        ))}
        <path d="M0 40 L48 40 L48 46 L2 46 Z" fill="#0d0907" />
      </g>
      {/* Défausse */}
      <g transform="translate(26 20)" opacity="0.9">
        <rect width="26" height="34" rx="3" fill="#1b1410" stroke="rgba(219,180,96,0.5)" />
        <rect x="3" y="4" width="20" height="26" rx="2" fill="#7d1426" stroke="#f4ead8" strokeWidth="0.8" />
      </g>
    </svg>
  );
}

// Éventail de cartes : léger décalage et rotation, centré sur son ancre.
function Fan({
  count,
  width,
  render,
  step,
}: {
  count: number;
  width: number;
  render: (i: number, style: React.CSSProperties) => React.ReactNode;
  step?: number;
}) {
  const h = Math.round(width * 1.4);
  const s = step ?? Math.round(width * 0.46);
  const w = count > 0 ? width + (count - 1) * s : width;
  return (
    <div className="relative" style={{ width: w, height: h }}>
      {Array.from({ length: count }, (_, i) => {
        const rot = count > 1 ? (i - (count - 1) / 2) * 4 : 0;
        return (
          <div key={i} className="absolute top-0" style={{ left: i * s, transform: `rotate(${rot}deg)`, transformOrigin: "50% 120%" }}>
            {render(i, {})}
          </div>
        );
      })}
    </div>
  );
}

function TotalPill({ cards, blackjack = false }: { cards: CardCode[]; blackjack?: boolean }) {
  const v = total(cards);
  if (blackjack) return <Tag tone="bj">BJ</Tag>;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-1.5 font-display text-[0.7rem] font-extrabold tabular-nums leading-[1.5] shadow-[0_2px_6px_rgba(0,0,0,0.5)] ${
        v > 21 ? "bg-danger text-white" : "bg-[#0d0a14]/90 text-white ring-1 ring-white/20"
      }`}
    >
      {totalLabel(cards)}
    </span>
  );
}

function resultTag(h: BjtHand): { tone: TagTone; text: string } | null {
  if (!h.outcome) return null;
  const n = h.net ?? 0;
  if (h.outcome === "blackjack") return { tone: "bj", text: `BLACKJACK ${signed(n)}` };
  if (h.outcome === "win") return { tone: "win", text: signed(n) };
  if (h.outcome === "push") return { tone: "push", text: "PUSH" };
  return { tone: "lose", text: signed(n) };
}

// ---- Une place (box) : cercle de mise, jetons, cartes, total, nom ----
function Place({
  slug,
  name,
  me,
  x,
  y,
  g,
  t,
  seat,
  stack,
  busted,
  away,
  log,
  shown,
  showResults,
  animate,
  compact,
  side,
  fullTable,
  deadline,
}: {
  compact: boolean;
  side: boolean;
  fullTable: boolean;
  slug: string;
  name: string;
  me: boolean;
  x: number;
  y: number;
  g: Geo;
  t: BjtState;
  seat: BjtSeat | null;
  stack: number;
  busted: boolean;
  away: boolean;
  log: BjtDealEvent[];
  shown: number;
  showResults: boolean;
  animate: boolean;
  deadline: number | null;
}) {
  const active = t.stage === "playerTurns" && t.seats[t.turn]?.slug === slug;
  const hands = seat?.hands ?? [];
  const bet = seat ? hands.reduce((a, h) => a + h.bet, 0) : t.betDone.includes(slug) ? (t.bets[slug] ?? 0) : 0;
  // Autres joueurs : on montre la main en cours (ou la première).
  const shownHands = me ? hands : hands.length ? [hands[Math.min(seat!.active, hands.length - 1)]] : [];
  const cardW = me
    ? hands.length <= 1
      ? fullTable
        ? 44
        : 50
      : hands.length === 2
        ? fullTable || g.W < 360
          ? 28
          : 34
        : fullTable || g.W < 360
          ? 24
          : 30
    : compact
      ? 22
      : 30;
  const step = me ? Math.round(cardW * 0.42) : compact ? 8 : 11;
  const split = me && hands.length > 1;
  // Cartes des autres : au-dessus de leur cercle, ou tournées vers
  // l'intérieur de la table pour les places de bord (voir SEAT_LAYOUTS).
  const ux = side ? (x < g.cx ? 0.97 : -0.97) : 0;
  const uy = side ? -0.24 : -1;
  const R = me ? 22 : compact ? 13 : 18;
  const otherNet = !me && showResults && seat?.net !== undefined ? seat.net : undefined;
  const anyBJ = hands.some((h) => h.outcome === "blackjack");
  return (
    <div className="absolute" style={{ left: x, top: y, width: 0, height: 0, zIndex: me ? 3 : 2 }} data-seat={slug} {...(me ? { "data-me": true } : {})}>
      {/* Cartes au-dessus du cercle, en léger éventail */}
      {/* Mains séparées : remontées vers le centre du tapis (libre) pour ne
          pas déborder sur les places voisines. */}
      <div
        className={`absolute ${me ? "-translate-x-1/2" : "-translate-x-1/2 -translate-y-1/2"} ${split ? "grid items-end justify-items-center gap-x-3 gap-y-5" : "flex items-end gap-2"}`}
        style={
          me
            ? // Ma main est légèrement surélevée, dans la zone libre du tapis,
              // au-dessus des cartes de mes voisins.
              { bottom: R + 8 + (split ? (compact ? 110 : 24) : fullTable ? 54 : 14), ...(split ? { gridTemplateColumns: "repeat(2, max-content)" } : {}) }
            : (() => {
                const fanW = cardW + 2 * step;
                const D = R + 10 + (Math.abs(ux) * fanW + Math.abs(uy) * cardW * 1.4) / 2;
                return { left: ux * D, top: uy * D };
              })()
        }
        data-cards
      >
        {shownHands.map((h, hi) => {
          const n = visibleCount(log, shown, slug, h.id);
          const vis = h.cards.slice(0, n);
          const isActive = active && seat!.hands[seat!.active]?.id === h.id;
          const res = showResults ? resultTag(h) : null;
          const bust = vis.length > 0 && total(vis) > 21;
          const natural = h.status === "blackjack" && vis.length === 2;
          return (
            <div key={h.id} className="relative flex flex-col items-center" data-hand={h.id}>
              <div className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2">
                {/* Mes mains : étiquette ; les autres : la pastille de total suffit. */}
                {!me ? null : res ? (
                  <Tag tone={res.tone}>{res.text}</Tag>
                ) : bust && !showResults ? (
                  <Tag tone="lose">BUST</Tag>
                ) : natural && !showResults ? (
                  <Tag tone="bj">BLACKJACK</Tag>
                ) : null}
              </div>
              <div className={`relative rounded-md ${isActive && me && hands.length > 1 ? "shadow-[0_0_0_2px_var(--color-cyan),0_0_16px_rgba(69,227,255,0.5)]" : ""}`}>
                <Fan
                  count={vis.length}
                  width={cardW}
                  step={
                    me
                      ? Math.min(step, vis.length > 1 ? Math.floor((Math.max(110, cardW * 2) - cardW) / (vis.length - 1)) : 99)
                      : Math.min(step, vis.length > 3 ? Math.floor((cardW + 3 * step - cardW) / (vis.length - 1)) : 99)
                  }
                  render={(i, st) => (
                    <CasinoCard
                      card={fromCode(vis[i])}
                      width={cardW}
                      animate={animate}
                      flipIn
                      dealFrom={{ x: g.shoe.x - x - i * 10, y: g.shoe.y - y + R + 60 }}
                      dim={showResults && h.outcome === "lose"}
                      style={st}
                    />
                  )}
                />
                {vis.length > 0 && (
                  <div className="absolute -right-2 -top-2">
                    <TotalPill cards={vis} blackjack={!me && natural} />
                  </div>
                )}
              </div>
              {me && hands.length > 1 && (
                <div className="mt-0.5 text-[0.6rem] font-semibold tabular-nums text-white/70">
                  {hi + 1} · {euro(h.bet)}
                  {h.doubled ? " ×2" : ""}
                </div>
              )}
            </div>
          );
        })}
        {!me && hands.length > 1 && (
          <span className="absolute -left-3 top-4 rounded-full bg-black/70 px-1 text-[0.55rem] font-bold text-white">×{hands.length}</span>
        )}
        {/* Résultat d'un autre joueur, posé au-dessus de ses cartes */}
        {otherNet !== undefined && (
          <div className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2">
            {/* Places compactes : étiquette réduite, sans « € ». */}
            {anyBJ ? (
              <Tag tone="bj" small={compact}>
                {compact ? "BJ" : `BJ ${signed(otherNet)}`}
              </Tag>
            ) : otherNet === 0 ? (
              <Tag tone="push" small={compact}>
                PUSH
              </Tag>
            ) : (
              <Tag tone={otherNet > 0 ? "win" : "lose"} small={compact}>
                {compact ? `${otherNet > 0 ? "+" : "−"}${Math.abs(otherNet)}` : signed(otherNet)}
              </Tag>
            )}
          </div>
        )}
      </div>

      {/* Cercle de mise dessiné sur le tapis, jetons dedans */}
      <div
        className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full ${
          me ? "border-2 border-[rgba(240,205,120,0.85)]" : "border-[1.5px] border-[rgba(219,180,96,0.6)]"
        } ${active ? "tk-halo" : ""}`}
        style={{ width: R * 2, height: R * 2, background: "radial-gradient(circle, rgba(0,0,0,0.18), rgba(0,0,0,0.04))" }}
        data-circle
      >
        {bet > 0 ? <ChipStack amount={bet} scale={me ? 0.95 : 0.8} maxColumns={2} maxPerColumn={5} /> : null}
        {deadline && <TimerRing key={deadline} deadlineAt={deadline} totalMs={t.stage === "betting" ? BJT_RULES.betMs : t.stage === "insurance" ? BJT_RULES.insuranceMs : BJT_RULES.actionMs} size={R * 2 + 10} stroke={3} />}
      </div>

      {/* Nom (et solde) sous le cercle */}
      <div
        className={`absolute -translate-x-1/2 text-center leading-tight ${busted ? "opacity-50" : ""}`}
        style={{ top: R + (me ? 7 : 3), width: compact && !me ? 56 : 74 }}
      >
        <div className={`truncate font-bold ${me ? "text-[0.68rem] text-cyan" : compact ? "text-[0.6rem] text-white/90" : "text-[0.68rem] text-white/90"}`}>{name}</div>
        {(me || !compact) && (
          <div className="truncate text-[0.62rem] font-semibold tabular-nums text-white/60">{busted ? "spectateur" : euro(stack)}</div>
        )}
        {away && (
          <span className="mt-0.5 inline-block rounded-full bg-amber px-1 text-[0.5rem] font-black uppercase leading-[1.4] text-night-950">absent</span>
        )}
      </div>
    </div>
  );
}

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
