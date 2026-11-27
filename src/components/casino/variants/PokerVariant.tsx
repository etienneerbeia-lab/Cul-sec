"use client";

import { useEffect, useId, useMemo, type CSSProperties } from "react";
import { fromCodes, type CardCode } from "@/lib/casino/cards";
import { formatChips } from "@/lib/chips/format";
import { bestHand, describeHand } from "@/lib/game/evaluate";
import { haptic } from "@/lib/haptics";
import { playSound } from "@/lib/sound";
import { ACTION_MS } from "@/lib/poker/blinds";
import type { PokerState } from "@/lib/poker/types";
import { useGame } from "../../GameContext";
import { Screen } from "../../ui/Layout";
import { cleanName, isBotName, playerColor } from "../../ui/Players";
import { ActionBar, BETTING, LevelBar, bubbleFor, lastActions } from "../PokerScreen";
import { BlindChip, ChipStack, DealerButton } from "../Chips";
import { Tag, type TagTone, TimerRing, useAfterFirstPaint, useWidth } from "../TableKit";
import { PlayingCard, type Deck } from "./PlayingCard";
import { POKER_THEMES, type PokerTheme, type PokerVariantId } from "./themes";
import { outlinePath, perimeterPoint, placeToward, rectAt, SEAT_FRACTIONS, type Box, type Rect } from "./geometry";

// Table de poker « labo » : même logique que PokerScreen (mêmes données,
// mêmes actions), habillage au choix (variantes A à D, voir themes.ts).

const AV = 38; // avatar des sièges adverses
const PLATE_H = 34;
const MY_OVERLAP = 30; // mes cartes mordent sur le bas de la table

type Mark = "D" | "SB" | "BB";

// Emprise d'un siège autour du centre de son avatar.
function seatBox(th: PokerTheme) {
  return th.seat === "tile" ? { l: -32, r: 32, t: -22, b: 50 } : { l: -36, r: 36, t: -AV / 2, b: AV / 2 - 4 + PLATE_H };
}

function geometry(W: number, th: PokerTheme, n: number) {
  const box = seatBox(th);
  const SW = box.r - box.l;
  const H = Math.round(Math.min(470, Math.max(400, W * 1.3)));
  const at = W / 2 - SW / 2 - 2; // demi-largeur du tracé des sièges
  const ao = Math.min(W / 2 - 3, at + 22); // demi-largeur de la table
  const inset = ao - at;
  const top = 28;
  const bottom = H - 6;
  const outline: Box = { cx: W / 2, cy: (top + bottom) / 2, a: ao, b: (bottom - top) / 2 };
  const track: Box = { cx: W / 2, cy: outline.cy, a: at, b: outline.b - inset };
  const radius = Math.min(outline.a, outline.b) * 0.42 - inset;
  const fr = SEAT_FRACTIONS[Math.min(8, Math.max(1, n))] ?? [];
  const seats = fr.map((f) => perimeterPoint(th.shape, track, f, radius));
  const me = { x: W / 2, y: track.cy + track.b };
  const boardY = Math.round(track.cy - 6);
  // Board : 36 px au plus, réduit si un siège latéral le gênerait.
  const gap = 4;
  let freeHalf = 999;
  const band = { t: boardY - 31, b: boardY + 31 };
  for (const s of seats) {
    if (s.y + box.b < band.t || s.y + box.t > band.b) continue;
    freeHalf = Math.min(freeHalf, Math.abs(s.x - W / 2) - SW / 2 - 6);
  }
  const cardW = Math.max(28, Math.min(36, Math.floor((2 * freeHalf - 4 * gap) / 5)));
  const cardH = Math.round(cardW * 1.4);
  return { W, H, outline, track, seats, me, boardY, cardW, cardH, gap, box, inset };
}
type Geo = ReturnType<typeof geometry>;

export default function PokerVariantScreen({ variant, deck: deckOverride, fourColor = false }: { variant: PokerVariantId; deck?: Deck; fourColor?: boolean }) {
  const th = POKER_THEMES[variant];
  const deck = deckOverride ?? th.deck;
  const { game, mySlug, busy, act, away } = useGame();
  const p = game.poker!;
  const chips = game.chips!;
  const [ref, W] = useWidth<HTMLDivElement>(358);
  const g = geometry(W, th, p.seats.length);
  const animate = useAfterFirstPaint();
  const names = useMemo(() => new Map(game.playersPublic.map((pl) => [pl.slug, pl.name])), [game.playersPublic]);
  const seated = p.seats.includes(mySlug);
  const isBusted = (s: string) => chips.bustOrder.some((grp) => grp.includes(s));
  const busted = seated && isBusted(mySlug);
  const myTurn = p.toAct === mySlug && BETTING.includes(p.stage);
  const pot = Object.values(chips.committed).reduce((a, b) => a + b, 0);
  const result = p.stage === "handEnd" ? p.result : undefined;
  const last = lastActions(p);
  const deadline = game.timer?.deadlineAt ?? null;
  const handOver = p.stage === "handEnd";

  const turnKey = myTurn ? `${p.handNo}:${p.actSeq}` : "";
  useEffect(() => {
    if (!turnKey) return;
    haptic("tap");
    playSound("tap");
  }, [turnKey]);

  const highlight = useMemo(() => {
    if (!result || result.uncontested) return null;
    const w = result.pots[0]?.winners[0];
    return w ? new Set(result.best[w] ?? []) : null;
  }, [result]);
  const winnerLine = useMemo(() => {
    if (!result || result.uncontested) return null;
    const main = result.pots[0];
    if (!main) return null;
    return { label: result.labels[main.winners[0]] ?? "", split: main.winners.length > 1 };
  }, [result]);

  const myHole = p.hole[mySlug];
  const myHandLabel = useMemo(() => {
    if (!myHole) return null;
    if (p.board.length === 0) {
      const [a, b] = fromCodes(myHole);
      return a.value === b.value ? describeHand(bestHand([a, b]).eval) : null;
    }
    return describeHand(bestHand(fromCodes([...myHole, ...p.board])).eval);
  }, [myHole, p.board]);

  // Sièges dans l'ordre de la table, le mien en bas (spectateur : le 1er).
  const meIdx = Math.max(0, p.seats.indexOf(mySlug));
  const rotated = p.seats.map((_, k) => p.seats[(meIdx + k) % p.seats.length]);
  const pos = new Map<string, { x: number; y: number }>(rotated.map((s, k) => [s, k === 0 ? g.me : g.seats[k - 1]]));
  const buttonSlug = p.seats[p.button];
  const marksOf = (slug: string) => {
    const inHand = p.inHand.includes(slug);
    const m: Mark[] = [];
    if (slug === buttonSlug) m.push("D");
    if (inHand && slug === p.sbSlug) m.push("SB");
    if (inHand && slug === p.bbSlug) m.push("BB");
    return m;
  };
  const showPot = result ? result.pots.reduce((a, x) => a + x.amount, 0) : pot;

  // Mises : entre chaque siège et le centre, sans rien chevaucher.
  const cx = g.W / 2;
  const boardRect = rectAt(cx, g.boardY, g.cardW * 5 + g.gap * 4 + 8, g.cardH + 8);
  const potRect: Rect = { l: cx - 56, r: cx + 56, t: g.boardY - g.cardH / 2 - 50, b: g.boardY - g.cardH / 2 - 2 };
  const obstacles: Rect[] = [boardRect, potRect, { l: cx - 78, r: cx + 78, t: g.H - MY_OVERLAP - 4, b: g.H + 40 }];
  for (const s of rotated.slice(1)) {
    const q = pos.get(s)!;
    obstacles.push({ l: q.x + g.box.l - 2, r: q.x + g.box.r + 2, t: q.y + g.box.t - 22, b: q.y + g.box.b + 2 });
  }
  const big = rotated.length >= 7;
  const betSpots = placeToward(
    rotated.filter((s) => (p.streetBet[s] ?? 0) > 0).map((s) => ({ key: s, from: pos.get(s)! })),
    { x: cx, y: g.boardY },
    big ? { w: 44, h: 32 } : { w: 50, h: 34 },
    obstacles,
    { l: cx - g.outline.a + th.rail + 4, r: cx + g.outline.a - th.rail - 4, t: 28 + th.rail + 4, b: g.H - 6 - th.rail - 4 },
  );

  return (
    <Screen
      actions={myTurn || busted ? <ActionBar game={game} p={p} myTurn={myTurn} seated={seated} busted={busted} busy={busy} act={act} pot={pot} /> : undefined}
    >
      <LevelBar game={game} p={p} />

      <div className={`pv pv-${th.id}`}>
        <div ref={ref} className="relative mt-2 w-full select-none" style={{ height: g.H }} data-table data-variant={th.id}>
          <TableArt th={th} g={g} />

          {/* Board : 5 emplacements, cartes retournées à leur arrivée */}
          <div className="absolute flex -translate-x-1/2 -translate-y-1/2" style={{ left: cx, top: g.boardY, gap: g.gap }} data-board>
            {[0, 1, 2, 3, 4].map((i) => {
              const code = p.board[i];
              const lit = !!code && !!highlight?.has(code);
              return (
                <div key={i} className="pv-slot relative" style={{ width: g.cardW, height: g.cardH }}>
                  {code && (
                    <PlayingCard
                      code={code}
                      deck={deck}
                      fourColor={fourColor}
                      width={g.cardW}
                      flipIn
                      animate={animate}
                      delayMs={p.board.length === 3 && i < 3 ? i * 140 : 0}
                      dealFrom={{ x: 0, y: -18 }}
                      highlight={lit}
                      dim={!!highlight && !lit}
                      className="absolute left-0 top-0"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Pot, au-dessus du board */}
          {showPot > 0 && !handOver && (
            <div
              className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center gap-0.5"
              style={{ left: cx, top: g.boardY - g.cardH / 2 - 6 }}
              data-pot
            >
              <ChipStack amount={showPot} maxColumns={4} maxPerColumn={6} />
              <span className="pv-pot">Pot {formatChips(showPot)}</span>
            </div>
          )}

          {winnerLine && (
            <div
              className="animate-pop pointer-events-none absolute left-1/2 max-w-[70%] -translate-x-1/2 whitespace-nowrap text-center"
              style={{ top: g.boardY + g.cardH / 2 + 6 }}
              data-winner
            >
              <span className={`pv-winner ${winnerLine.label.length > 15 ? "text-[0.8rem]" : "text-[0.95rem]"}`}>
                {winnerLine.split ? `Partage · ${winnerLine.label}` : winnerLine.label}
              </span>
            </div>
          )}

          {/* Mises devant chaque siège */}
          {rotated.map((slug) => {
            const bet = p.streetBet[slug] ?? 0;
            if (bet <= 0 || handOver) return null;
            const b = betSpots.get(slug)!;
            return (
              <div
                key={`bet-${slug}`}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                style={{ left: b.x, top: b.y }}
                data-bet
              >
                <ChipStack amount={bet} maxColumns={2} maxPerColumn={5} />
                <span className="pv-bet">{formatChips(bet)}</span>
              </div>
            );
          })}

          {/* Sièges adverses */}
          {rotated.slice(1).map((slug) => {
            const q = pos.get(slug)!;
            return (
              <Seat
                key={slug}
                th={th}
                deck={deck}
                fourColor={fourColor}
                slug={slug}
                name={names.get(slug) ?? slug}
                stack={chips.stacks[slug] ?? 0}
                p={p}
                x={q.x}
                y={q.y}
                from={{ x: cx - q.x, y: g.boardY - q.y }}
                animate={animate}
                away={away.includes(slug)}
                busted={isBusted(slug)}
                highlight={highlight}
                bubble={bubbleFor(p, slug, last[slug])}
                deadline={p.toAct === slug && BETTING.includes(p.stage) ? deadline : null}
                marks={marksOf(slug)}
              />
            );
          })}
        </div>

        {seated ? (
          <MyHand
            th={th}
            deck={deck}
            fourColor={fourColor}
            name={names.get(mySlug) ?? mySlug}
            slug={mySlug}
            stack={chips.stacks[mySlug] ?? 0}
            hole={myHole}
            label={myHandLabel}
            folded={p.folded.includes(mySlug)}
            busted={busted}
            highlight={highlight}
            animate={animate}
            bubble={bubbleFor(p, mySlug, last[mySlug])}
            deadline={myTurn ? deadline : null}
            away={away.includes(mySlug)}
            marks={marksOf(mySlug)}
            won={(p.result?.net[mySlug] ?? 0) > 0 && handOver}
          />
        ) : (
          <p className="mt-2 text-center text-xs text-mute">Table complète : tu regardes la partie.</p>
        )}
      </div>
    </Screen>
  );
}

// ---- Décor : rail, feutre, ligne de mise, logo ----
function TableArt({ th, g }: { th: PokerTheme; g: Geo }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const o = g.outline;
  const outer = outlinePath(th.shape, o);
  const felt = outlinePath(th.shape, o, th.rail);
  const lineInset = th.rail + 24;
  const logoY = g.boardY + g.cardH / 2 + 46;
  const serif = th.print.font === "serif";
  return (
    <svg className="pointer-events-none absolute inset-0" width={g.W} height={g.H} viewBox={`0 0 ${g.W} ${g.H}`} aria-hidden>
      <defs>
        <radialGradient id={`${id}-rail`} cx="50%" cy="28%" r="80%">
          <stop offset="0" stopColor={th.railColors[0]} />
          <stop offset="0.6" stopColor={th.railColors[1]} />
          <stop offset="1" stopColor={th.railColors[2]} />
        </radialGradient>
        <radialGradient id={`${id}-felt`} cx="50%" cy="44%" r="68%">
          <stop offset="0" stopColor={th.felt[0]} />
          <stop offset="0.45" stopColor={th.felt[1]} />
          <stop offset="0.8" stopColor={th.felt[2]} />
          <stop offset="1" stopColor={th.felt[3]} />
        </radialGradient>
        {th.edge?.gradient && (
          <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={th.edge.gradient[0]} />
            <stop offset="0.5" stopColor={th.edge.gradient[1]} />
            <stop offset="1" stopColor={th.edge.gradient[2]} />
          </linearGradient>
        )}
        <filter id={`${id}-noise`}>
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
        </filter>
        <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <clipPath id={`${id}-clip`}>
          <path d={felt} />
        </clipPath>
      </defs>
      {/* Ombre portée */}
      <path d={outer} transform="translate(0 12)" fill="rgba(0,0,0,0.6)" filter={`url(#${id}-shadow)`} />
      {/* Rail */}
      {th.rail > 0 && <path d={outer} fill={`url(#${id}-rail)`} />}
      {th.rail > 0 && <path d={outer} fill="none" stroke="rgba(255,240,220,0.12)" strokeWidth="1" />}
      {th.stitch && <path d={outlinePath(th.shape, o, 4.5)} fill="none" stroke={th.stitch} strokeDasharray="3 3" />}
      {/* Feutre, grain, vignette intérieure */}
      <path d={felt} fill={`url(#${id}-felt)`} />
      {th.grain > 0 && <rect width={g.W} height={g.H} filter={`url(#${id}-noise)`} clipPath={`url(#${id}-clip)`} opacity={th.grain} />}
      <path d={felt} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="14" clipPath={`url(#${id}-clip)`} />
      {/* Liseré lumineux (club : or ; néon : dégradé) */}
      {th.edge && (
        <>
          <path
            d={felt}
            fill="none"
            stroke={th.edge.gradient ? `url(#${id}-edge)` : th.edge.color}
            strokeWidth={th.edge.gradient ? 3 : 2}
            filter={th.edge.glow ? `url(#${id}-glow)` : undefined}
          />
          {th.edge.gradient && <path d={outlinePath(th.shape, o, 8)} fill="none" stroke="rgba(69,227,255,0.3)" strokeWidth="1" />}
        </>
      )}
      {/* Ligne de mise */}
      <path
        d={outlinePath(th.shape, o, lineInset)}
        fill="none"
        stroke={th.line.color}
        strokeWidth={th.line.width}
        strokeDasharray={th.line.dash}
        filter={th.line.glow ? `url(#${id}-glow)` : undefined}
      />
      {/* Logo imprimé */}
      {logoY + 20 < g.H - th.rail - 30 && (
        <g>
          <text
            x={g.W / 2}
            y={logoY}
            textAnchor="middle"
            fontSize={serif ? 15 : 14}
            fontWeight={serif ? 700 : 800}
            style={{ fontFamily: serif ? "Georgia, 'Times New Roman', serif" : "var(--font-bricolage), system-ui, sans-serif", letterSpacing: "0.16em" }}
            fill={th.print.color}
          >
            {th.logo[0]}
          </text>
          <text
            x={g.W / 2}
            y={logoY + 15}
            textAnchor="middle"
            fontSize="8"
            style={{ fontFamily: serif ? "Georgia, 'Times New Roman', serif" : "var(--font-inter), system-ui, sans-serif", letterSpacing: "0.22em" }}
            fill={th.print.color}
            opacity="0.8"
          >
            {th.logo[1]}
          </text>
        </g>
      )}
    </svg>
  );
}

// Jetons D / SB / BB : en colonne contre l'avatar, dans l'emprise du siège
// (ne chevauchent ni le rail, ni le voisin, ni les mises).
function Marks({ marks, style }: { marks: Mark[]; style: CSSProperties }) {
  if (!marks.length) return null;
  return (
    <div className="absolute flex flex-col items-center gap-0.5" style={{ zIndex: 4, ...style }} data-marker>
      {marks.map((k) => (k === "D" ? <DealerButton key={k} size={17} /> : <BlindChip key={k} kind={k} size={16} />))}
    </div>
  );
}

function Avatar({ th, name, slug, size, deadline, dim }: { th: PokerTheme; name: string; slug: string; size: number; deadline: number | null; dim?: boolean }) {
  const color = playerColor(slug);
  return (
    <div className={`relative grid shrink-0 place-items-center rounded-full ${deadline ? "tk-halo" : ""}`} style={{ width: size, height: size }}>
      <span
        className={`pv-avatar pv-avatar-${th.seat} ${dim ? "pv-avatar-out" : ""}`}
        style={{
          background: th.seat === "flat" ? color : `radial-gradient(circle at 35% 30%, ${color}, #1a1030 125%)`,
          fontSize: size * 0.42,
        }}
      >
        {isBotName(name) ? "🤖" : cleanName(name).charAt(0).toUpperCase()}
      </span>
      {deadline && <TimerRing key={deadline} deadlineAt={deadline} totalMs={ACTION_MS} size={size + 10} stroke={3.5} />}
    </div>
  );
}

// ---- Un siège adverse ----
function Seat({
  th,
  deck,
  fourColor,
  slug,
  name,
  stack,
  p,
  x,
  y,
  from,
  animate,
  away,
  busted,
  highlight,
  bubble,
  deadline,
  marks,
}: {
  th: PokerTheme;
  deck: Deck;
  fourColor: boolean;
  slug: string;
  name: string;
  stack: number;
  p: PokerState;
  x: number;
  y: number;
  from: { x: number; y: number };
  animate: boolean;
  away: boolean;
  busted: boolean;
  highlight: Set<CardCode> | null;
  bubble: { tone: TagTone; text: string } | null;
  deadline: number | null;
  marks: Mark[];
}) {
  const inHand = p.inHand.includes(slug);
  const folded = p.folded.includes(slug);
  const hole = p.hole[slug];
  const out = busted || folded || !inHand;
  const showFaces = inHand && !folded && !!hole;
  const won = (p.result?.net[slug] ?? 0) > 0 && p.stage === "handEnd";
  const tile = th.seat === "tile";
  const box = seatBox(th);
  const state = won ? "won" : deadline ? "active" : out ? "out" : "";
  const label = (
    <>
      <div className="pv-name">{cleanName(name)}</div>
      <div className="pv-stack">{busted ? <span className="pv-busted">Éliminé</span> : formatChips(stack)}</div>
    </>
  );
  return (
    <div className="absolute" style={{ left: x, top: y, width: 0, height: 0 }} data-seat={slug}>
      {/* Bulle d'action, au-dessus du siège */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: box.t - 20, zIndex: 6 }} data-bubble>
        {bubble && <Tag tone={bubble.tone}>{bubble.text}</Tag>}
      </div>

      {tile ? (
        <div className={`pv-tile ${state ? `pv-${state}` : ""}`} style={{ left: box.l, top: box.t, width: box.r - box.l, height: box.b - box.t }} data-plate>
          <Avatar th={th} name={name} slug={slug} size={30} deadline={deadline} dim={out} />
          {label}
        </div>
      ) : (
        <div className="absolute flex flex-col items-center" style={{ left: box.l, top: -AV / 2, width: box.r - box.l, zIndex: 2 }} data-plate>
          <Avatar th={th} name={name} slug={slug} size={AV} deadline={deadline} dim={out} />
          <div className={`pv-plate pv-plate-${th.seat} ${state ? `pv-${state}` : ""}`} style={{ height: PLATE_H }}>
            {label}
          </div>
        </div>
      )}

      <Marks marks={marks} style={tile ? { left: box.l + 2, top: box.t + 3 } : { left: box.l, top: -AV / 2 }} />

      {/* Cartes : dos tenus à côté de l'avatar ; faces retournées par-dessus */}
      {inHand && !folded && (
        <div
          className="absolute flex"
          style={
            showFaces
              ? { left: -26, top: tile ? -24 : -AV / 2 - 1, gap: 2, zIndex: 5 }
              : { left: tile ? 10 : AV / 2 - 6, top: tile ? box.t + 1 : -AV / 2 - 3, zIndex: 3 }
          }
        >
          {showFaces
            ? hole.map((c, i) => {
                const lit = !!highlight?.has(c);
                return (
                  <PlayingCard
                    key={i}
                    code={c}
                    deck={deck}
                    fourColor={fourColor}
                    width={25}
                    flipIn
                    animate={animate}
                    highlight={lit}
                    dim={!!highlight && !lit}
                  />
                );
              })
            : [0, 1].map((i) => (
                <PlayingCard
                  key={i}
                  faceDown
                  deck={deck}
                  width={15}
                  animate={animate}
                  dealFrom={from}
                  delayMs={i * 140}
                  style={{ transform: `rotate(${i ? 14 : -6}deg)`, marginLeft: i ? -8 : 0 }}
                />
              ))}
        </div>
      )}

      {away && (
        <span className="pv-away" style={{ top: box.b - 6 }}>
          absent
        </span>
      )}
    </div>
  );
}

// ---- Ma place : avatar + cartes tenues en main ----
function MyHand({
  th,
  deck,
  fourColor,
  name,
  slug,
  stack,
  hole,
  label,
  folded,
  busted,
  highlight,
  animate,
  bubble,
  deadline,
  away,
  marks,
  won,
}: {
  th: PokerTheme;
  deck: Deck;
  fourColor: boolean;
  name: string;
  slug: string;
  stack: number;
  hole: CardCode[] | undefined;
  label: string | null;
  folded: boolean;
  busted: boolean;
  highlight: Set<CardCode> | null;
  animate: boolean;
  bubble: { tone: TagTone; text: string } | null;
  deadline: number | null;
  away: boolean;
  marks: Mark[];
  won: boolean;
}) {
  const CW = 70;
  const state = won ? "won" : deadline ? "active" : "";
  return (
    <div className="relative flex items-end justify-center gap-2.5 px-1" style={{ marginTop: -MY_OVERLAP, height: 120, zIndex: 3 }} data-seat={slug} data-me>
      <div className="relative flex w-[84px] shrink-0 flex-col items-center">
        <div className="mb-1 h-[18px]">{bubble && <Tag tone={bubble.tone}>{bubble.text}</Tag>}</div>
        <Marks marks={marks} style={{ left: 0, top: 22 }} />
        <Avatar th={th} name={name} slug={slug} size={42} deadline={deadline} dim={folded || busted} />
        {th.seat === "tile" ? (
          <div className={`pv-tile pv-tile-me ${state ? `pv-${state}` : ""}`}>
            <div className="pv-name pv-me">Toi{away ? " · absent" : ""}</div>
            <div className="pv-stack">{busted ? "Éliminé" : formatChips(stack)}</div>
          </div>
        ) : (
          <div className={`pv-plate pv-plate-${th.seat} ${state ? `pv-${state}` : ""} w-full`} style={{ height: PLATE_H }}>
            <div className="pv-name pv-me">Toi{away ? " · absent" : ""}</div>
            <div className="pv-stack">{busted ? "Éliminé" : formatChips(stack)}</div>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-col items-center">
        <div className="flex items-end" style={{ height: Math.round(CW * 1.4) + 4 }}>
          {hole && !busted
            ? hole.map((c, i) => {
                const lit = !!highlight?.has(c);
                return (
                  <div
                    key={i}
                    style={{ transform: `rotate(${i ? 6 : -6}deg) translateY(${i ? 2 : 0}px)`, marginLeft: i ? -16 : 0, transformOrigin: "bottom center" }}
                  >
                    <PlayingCard
                      code={c}
                      deck={deck}
                      fourColor={fourColor}
                      width={CW}
                      flipIn
                      animate={animate}
                      delayMs={i * 160}
                      dealFrom={{ x: 0, y: -170 }}
                      highlight={lit}
                      dim={folded || (!!highlight && !lit)}
                    />
                  </div>
                );
              })
            : null}
        </div>
        <div className="pv-handlabel mt-1 h-4 max-w-[170px] truncate text-center">
          {folded ? <span className="font-sans text-xs font-semibold text-mute">Couché</span> : label}
        </div>
      </div>
    </div>
  );
}
