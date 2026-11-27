"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import type { CardCode } from "@/lib/casino/cards";
import { formatChips } from "@/lib/chips/format";
import { playerColor } from "../../ui/Players";
import { BlindChip, ChipStack, DealerButton } from "../Chips";
import { Tag, type TagTone, TimerRing, useAfterFirstPaint, useWidth } from "../TableKit";
import { outlinePath, perimeterPoint, placeToward, rectAt, SEAT_FRACTIONS, type Box, type Rect } from "./geometry";
import { PlayingCard } from "./PlayingCard";

// Table de poker « Néon » (Chill et Soirée) : composant d'affichage seul.
// Chaque écran lui passe des sièges déjà mis en forme (jetons ou gorgées) ;
// aucune règle de jeu ici.

export type Mark = "D" | "SB" | "BB";
export type Bubble = { tone: TagTone; text: string };
// Une mise ou un pot : en jetons (Chill) ou en gorgées (Soirée).
export interface Stake {
  amount: number;
  kind: "chips" | "gulps";
}

export interface NeonSeat {
  slug: string;
  name: string; // nom affiché (sans le 🤖)
  bot: boolean;
  line2: ReactNode; // tapis (Chill) ou gorgées bues (Soirée)
  out: boolean; // hors du coup : seul l'avatar s'éteint
  holding: boolean; // cartes en main, face cachée
  faces?: CardCode[]; // cartes retournées (abattage)
  won: boolean;
  bubble: Bubble | null;
  deadline: number | null;
  marks: Mark[];
  away: boolean;
  bet: Stake | null;
}

export interface NeonMe extends NeonSeat {
  hole?: CardCode[];
  label: ReactNode; // nom de ma main, ou « Couché »
  folded: boolean;
}

const AV = 30;
const BOX = { l: -32, r: 32, t: -22, b: 50 }; // emprise d'un siège autour de son avatar
const MY_OVERLAP = 30; // mes cartes mordent sur le bas de la table
const FELT: [string, string, string, string] = ["#2b1b5c", "#1c1140", "#120a2a", "#0a0518"];

function geometry(W: number, n: number) {
  const SW = BOX.r - BOX.l;
  const H = Math.round(Math.min(470, Math.max(400, W * 1.3)));
  const at = W / 2 - SW / 2 - 2; // demi-largeur du tracé des sièges
  const ao = Math.min(W / 2 - 3, at + 22); // demi-largeur de la table
  const inset = ao - at;
  const top = 28;
  const bottom = H - 6;
  const outline: Box = { cx: W / 2, cy: (top + bottom) / 2, a: ao, b: (bottom - top) / 2 };
  const track: Box = { cx: W / 2, cy: outline.cy, a: at, b: outline.b - inset };
  const fr = SEAT_FRACTIONS[Math.min(8, Math.max(1, n))] ?? [];
  const seats = [{ x: W / 2, y: track.cy + track.b }, ...fr.map((f) => perimeterPoint("stadium", track, f))];
  const boardY = Math.round(track.cy - 6);
  // Board : 36 px au plus, réduit si un siège latéral le gênerait.
  const gap = 4;
  let freeHalf = 999;
  const band = { t: boardY - 31, b: boardY + 31 };
  for (const s of seats.slice(1)) {
    if (s.y + BOX.b < band.t || s.y + BOX.t > band.b) continue;
    freeHalf = Math.min(freeHalf, Math.abs(s.x - W / 2) - SW / 2 - 6);
  }
  const cardW = Math.max(28, Math.min(36, Math.floor((2 * freeHalf - 4 * gap) / 5)));
  return { W, H, outline, seats, boardY, cardW, cardH: Math.round(cardW * 1.4), gap };
}
type Geo = ReturnType<typeof geometry>;

export function NeonPokerTable({
  seats,
  me,
  board,
  highlight,
  pot,
  winnerLine,
  deadlineTotal,
  spectator,
}: {
  // Tous les joueurs assis, dans l'ordre de la table, en partant de la place
  // du bas (la mienne ; si je regarde, celle du premier joueur).
  seats: NeonSeat[];
  // Ma place (sous la table, cartes en main) ; null si je regarde.
  me: NeonMe | null;
  board: CardCode[];
  highlight: Set<CardCode> | null;
  pot: Stake | null;
  winnerLine: { label: string; split: boolean } | null;
  deadlineTotal: number;
  spectator?: ReactNode;
}) {
  const [ref, W] = useWidth<HTMLDivElement>(358);
  const g = geometry(W, seats.length);
  const animate = useAfterFirstPaint();
  const cx = g.W / 2;
  const pos = new Map(seats.map((s, k) => [s.slug, g.seats[k] ?? g.seats[0]]));
  const drawn = me ? seats.slice(1) : seats;

  // Mises : entre chaque siège et le centre, sans rien chevaucher.
  const boardRect = rectAt(cx, g.boardY, g.cardW * 5 + g.gap * 4 + 8, g.cardH + 8);
  const potRect: Rect = { l: cx - 56, r: cx + 56, t: g.boardY - g.cardH / 2 - 50, b: g.boardY - g.cardH / 2 - 2 };
  const obstacles: Rect[] = [boardRect, potRect];
  if (me) obstacles.push({ l: cx - 78, r: cx + 78, t: g.H - MY_OVERLAP - 4, b: g.H + 40 });
  for (const s of drawn) {
    const q = pos.get(s.slug)!;
    obstacles.push({ l: q.x + BOX.l - 2, r: q.x + BOX.r + 2, t: q.y + BOX.t - 22, b: q.y + BOX.b + 2 });
    if (s.bubble) {
      const b = bubbleBox(s.bubble.text, q.x, g.W);
      obstacles.push({ l: q.x + b.shift - b.w / 2 - 2, r: q.x + b.shift + b.w / 2 + 2, t: q.y + BOX.t - 22, b: q.y + BOX.t });
    }
  }
  const betSpots = placeToward(
    seats.filter((s) => s.bet && s.bet.amount > 0).map((s) => ({ key: s.slug, from: pos.get(s.slug)! })),
    { x: cx, y: g.boardY },
    seats.length >= 7 ? { w: 44, h: 32 } : { w: 50, h: 34 },
    obstacles,
    { l: cx - g.outline.a + 4, r: cx + g.outline.a - 4, t: 32, b: g.H - 10 },
  );

  return (
    <div className="pv">
      <div ref={ref} className="relative mt-2 w-full select-none" style={{ height: g.H }} data-table>
        <TableArt g={g} />

        {/* Board : 5 emplacements, cartes retournées à leur arrivée */}
        <div className="absolute flex -translate-x-1/2 -translate-y-1/2" style={{ left: cx, top: g.boardY, gap: g.gap }} data-board>
          {[0, 1, 2, 3, 4].map((i) => {
            const code = board[i];
            const lit = !!code && !!highlight?.has(code);
            return (
              <div key={i} className="pv-slot relative" style={{ width: g.cardW, height: g.cardH }}>
                {code && (
                  <PlayingCard
                    code={code}
                    deck="neon"
                    width={g.cardW}
                    flipIn
                    animate={animate}
                    delayMs={board.length === 3 && i < 3 ? i * 140 : 0}
                    dealFrom={{ x: 0, y: -18 }}
                    highlight={lit}
                    dim={!!highlight && !lit}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Pot, au-dessus du board */}
        {pot && pot.amount > 0 && (
          <div
            className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center gap-0.5"
            style={{ left: cx, top: g.boardY - g.cardH / 2 - 6 }}
            data-pot
          >
            {pot.kind === "chips" ? <ChipStack amount={pot.amount} maxColumns={4} maxPerColumn={6} /> : <span className="pv-mug">🍺</span>}
            <span key={pot.amount} className="pv-pot animate-pop">
              Pot {pot.kind === "chips" ? formatChips(pot.amount) : `${pot.amount} 🍺`}
            </span>
          </div>
        )}

        {winnerLine && (
          <div
            className="animate-pop pointer-events-none absolute left-1/2 max-w-[70%] -translate-x-1/2 text-center whitespace-nowrap"
            style={{ top: g.boardY + g.cardH / 2 + 6 }}
            data-winner
          >
            <span className={`pv-winner ${winnerLine.label.length > 15 ? "text-[0.8rem]" : "text-[0.95rem]"}`}>
              {winnerLine.split ? `Partage · ${winnerLine.label}` : winnerLine.label}
            </span>
          </div>
        )}

        {/* Mises devant chaque siège */}
        {seats.map((s) => {
          const b = betSpots.get(s.slug);
          if (!b || !s.bet) return null;
          return (
            <div
              key={`bet-${s.slug}`}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: b.x, top: b.y }}
              data-bet
            >
              {s.bet.kind === "chips" ? (
                <>
                  <ChipStack amount={s.bet.amount} maxColumns={2} maxPerColumn={5} />
                  <span className="pv-bet">{formatChips(s.bet.amount)}</span>
                </>
              ) : (
                <span key={s.bet.amount} className="pv-gulps animate-pop">
                  🍺 {s.bet.amount}
                </span>
              )}
            </div>
          );
        })}

        {drawn.map((s) => {
          const q = pos.get(s.slug)!;
          return (
            <Seat
              key={s.slug}
              s={s}
              x={q.x}
              y={q.y}
              W={g.W}
              from={{ x: cx - q.x, y: g.boardY - q.y }}
              animate={animate}
              highlight={highlight}
              deadlineTotal={deadlineTotal}
            />
          );
        })}
      </div>

      {me ? <MyHand me={me} animate={animate} highlight={highlight} deadlineTotal={deadlineTotal} /> : spectator}
    </div>
  );
}

// ---- Décor : feutre indigo, bord néon, ligne de mise, logo ----
function TableArt({ g }: { g: Geo }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const o = g.outline;
  const felt = outlinePath("stadium", o);
  const logoY = g.boardY + g.cardH / 2 + 46;
  return (
    <svg className="pointer-events-none absolute inset-0" width={g.W} height={g.H} viewBox={`0 0 ${g.W} ${g.H}`} aria-hidden>
      <defs>
        <radialGradient id={`${id}-felt`} cx="50%" cy="44%" r="68%">
          <stop offset="0" stopColor={FELT[0]} />
          <stop offset="0.45" stopColor={FELT[1]} />
          <stop offset="0.8" stopColor={FELT[2]} />
          <stop offset="1" stopColor={FELT[3]} />
        </radialGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff3d8b" />
          <stop offset="0.5" stopColor="#9b6bff" />
          <stop offset="1" stopColor="#45e3ff" />
        </linearGradient>
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
      <path d={felt} transform="translate(0 12)" fill="rgba(0,0,0,0.6)" filter={`url(#${id}-shadow)`} />
      <path d={felt} fill={`url(#${id}-felt)`} />
      <path d={felt} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="14" clipPath={`url(#${id}-clip)`} />
      <path d={felt} fill="none" stroke={`url(#${id}-edge)`} strokeWidth={3} filter={`url(#${id}-glow)`} />
      <path d={outlinePath("stadium", o, 8)} fill="none" stroke="rgba(69,227,255,0.3)" strokeWidth="1" />
      <path d={outlinePath("stadium", o, 24)} fill="none" stroke="rgba(69,227,255,0.28)" strokeWidth={1.2} strokeDasharray="2 6" />
      {logoY + 20 < g.H - 30 && (
        <g>
          <text
            x={g.W / 2}
            y={logoY}
            textAnchor="middle"
            fontSize={14}
            fontWeight={800}
            style={{ fontFamily: "var(--font-bricolage), system-ui, sans-serif", letterSpacing: "0.16em" }}
            fill="rgba(255,61,139,0.45)"
          >
            CUL·SEC
          </text>
          <text
            x={g.W / 2}
            y={logoY + 15}
            textAnchor="middle"
            fontSize="8"
            style={{ fontFamily: "var(--font-inter), system-ui, sans-serif", letterSpacing: "0.22em" }}
            fill="rgba(255,61,139,0.45)"
            opacity="0.8"
          >
            NEON NIGHT POKER
          </text>
        </g>
      )}
    </svg>
  );
}

// Jetons D / SB / BB : dans le coin de la tuile (ne chevauchent ni le
// voisin, ni les mises).
function Marks({ marks, style }: { marks: Mark[]; style: CSSProperties }) {
  if (!marks.length) return null;
  return (
    <div className="absolute flex flex-col items-center gap-0.5" style={{ zIndex: 4, ...style }} data-marker>
      {marks.map((k) => (k === "D" ? <DealerButton key={k} size={17} /> : <BlindChip key={k} kind={k} size={16} />))}
    </div>
  );
}

function Avatar({ s, size, deadline, deadlineTotal, dim }: { s: NeonSeat; size: number; deadline: number | null; deadlineTotal: number; dim?: boolean }) {
  return (
    <div className={`relative grid shrink-0 place-items-center rounded-full ${deadline ? "tk-halo" : ""}`} style={{ width: size, height: size }}>
      <span
        className={`pv-avatar ${dim ? "pv-avatar-out" : ""}`}
        style={{ background: `radial-gradient(circle at 35% 30%, ${playerColor(s.slug)}, #1a1030 125%)`, fontSize: size * 0.42 }}
      >
        {s.bot ? "🤖" : s.name.charAt(0).toUpperCase()}
      </span>
      {deadline && <TimerRing key={deadline} deadlineAt={deadline} totalMs={deadlineTotal} size={size + 10} stroke={3.5} />}
    </div>
  );
}

// La bulle d'action reste dans l'écran pour les sièges du bord : largeur
// estimée d'après le texte, et décalage horizontal à appliquer.
function bubbleBox(text: string, x: number, W: number) {
  const w = text.length * 6.8 + 16;
  return { w, shift: Math.max(0, 2 - (x - w / 2)) + Math.min(0, W - 2 - (x + w / 2)) };
}

// ---- Un siège : tuile en verre ----
function Seat({
  s,
  x,
  y,
  W,
  from,
  animate,
  highlight,
  deadlineTotal,
}: {
  s: NeonSeat;
  x: number;
  y: number;
  W: number;
  from: { x: number; y: number };
  animate: boolean;
  highlight: Set<CardCode> | null;
  deadlineTotal: number;
}) {
  const state = s.won ? "pv-won" : s.deadline ? "pv-active" : "";
  const shift = s.bubble ? bubbleBox(s.bubble.text, x, W).shift : 0;
  return (
    <div className="absolute" style={{ left: x, top: y, width: 0, height: 0 }} data-seat={s.slug}>
      <div className="absolute left-1/2" style={{ top: BOX.t - 20, zIndex: 6, transform: `translateX(calc(-50% + ${shift}px))` }} data-bubble>
        {s.bubble && <Tag tone={s.bubble.tone}>{s.bubble.text}</Tag>}
      </div>
      <div className={`pv-tile ${state}`} style={{ left: BOX.l, top: BOX.t, width: BOX.r - BOX.l, height: BOX.b - BOX.t }} data-plate>
        <Avatar s={s} size={AV} deadline={s.deadline} deadlineTotal={deadlineTotal} dim={s.out} />
        <div className="pv-name">{s.name}</div>
        <div className="pv-stack">{s.line2}</div>
      </div>
      <Marks marks={s.marks} style={{ left: BOX.l + 2, top: BOX.t + 3 }} />
      {(s.holding || s.faces) && (
        <div className="absolute flex" style={s.faces ? { left: -26, top: -24, gap: 2, zIndex: 5 } : { left: 10, top: BOX.t + 1, zIndex: 3 }}>
          {s.faces
            ? s.faces.map((c, i) => {
                const lit = !!highlight?.has(c);
                return <PlayingCard key={i} code={c} deck="neon" width={25} flipIn animate={animate} highlight={lit} dim={!!highlight && !lit} />;
              })
            : [0, 1].map((i) => (
                <PlayingCard
                  key={i}
                  faceDown
                  deck="neon"
                  width={15}
                  animate={animate}
                  dealFrom={from}
                  delayMs={i * 140}
                  style={{ transform: `rotate(${i ? 14 : -6}deg)`, marginLeft: i ? -8 : 0 }}
                />
              ))}
        </div>
      )}
      {s.away && (
        <span className="pv-away" style={{ top: BOX.b - 6 }}>
          absent
        </span>
      )}
    </div>
  );
}

// ---- Ma place : avatar + cartes tenues en main ----
function MyHand({ me, animate, highlight, deadlineTotal }: { me: NeonMe; animate: boolean; highlight: Set<CardCode> | null; deadlineTotal: number }) {
  const CW = 70;
  const state = me.won ? "pv-won" : me.deadline ? "pv-active" : "";
  return (
    <div className="relative flex items-end justify-center gap-2.5 px-1" style={{ marginTop: -MY_OVERLAP, height: 120, zIndex: 3 }} data-seat={me.slug} data-me>
      <div className="relative flex w-[84px] shrink-0 flex-col items-center">
        <div className="mb-1 h-[18px]">{me.bubble && <Tag tone={me.bubble.tone}>{me.bubble.text}</Tag>}</div>
        <Marks marks={me.marks} style={{ left: 0, top: 22 }} />
        <Avatar s={me} size={42} deadline={me.deadline} deadlineTotal={deadlineTotal} dim={me.out} />
        <div className={`pv-tile pv-tile-me ${state}`}>
          <div className="pv-name pv-me">Toi{me.away ? " · absent" : ""}</div>
          <div className="pv-stack">{me.line2}</div>
        </div>
      </div>
      <div className="flex min-w-0 flex-col items-center">
        <div className="flex items-end" style={{ height: Math.round(CW * 1.4) + 4 }}>
          {me.hole?.map((c, i) => {
            const lit = !!highlight?.has(c);
            return (
              <div
                key={i}
                style={{ transform: `rotate(${i ? 6 : -6}deg) translateY(${i ? 2 : 0}px)`, marginLeft: i ? -16 : 0, transformOrigin: "bottom center" }}
              >
                <PlayingCard
                  code={c}
                  deck="neon"
                  width={CW}
                  flipIn
                  animate={animate}
                  delayMs={i * 160}
                  dealFrom={{ x: 0, y: -170 }}
                  highlight={lit}
                  dim={me.folded || (!!highlight && !lit)}
                />
              </div>
            );
          })}
        </div>
        <div className="pv-handlabel mt-1 h-4 max-w-[180px] truncate text-center">
          {me.folded ? <span className="font-sans text-xs font-semibold text-mute">{me.label}</span> : me.label}
        </div>
      </div>
    </div>
  );
}
