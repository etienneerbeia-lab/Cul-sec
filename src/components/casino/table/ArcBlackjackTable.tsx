"use client";

import { useCallback, useId, useState, type CSSProperties, type ReactNode } from "react";
import type { CardCode } from "@/lib/casino/cards";
import { ChipStack } from "../Chips";
import { Tag, TimerRing, useAfterFirstPaint, useWidth } from "../TableKit";
import { HandRun, HandZoom, TotalBadge, layoutRun, type Align } from "./Hand";
import type { Bubble, Stake } from "./NeonPokerTable";

// Table de blackjack « Arc sourire » (Chill et Soirée) : composant
// d'affichage seul. Les joueurs sont sur un arc en bas, leurs cartes en
// cascade diagonale vers le croupier ; ma place au centre, plus grande.
// Chaque main a une boîte de taille fixe : rien ne bouge quand elle grandit.

export interface ArcHand {
  id: number;
  cards: CardCode[]; // cartes visibles (rejeu de la distribution)
  bet: number;
  doubled: boolean;
  active: boolean; // main en cours (split)
  bust: boolean;
  natural: boolean; // blackjack servi
  lose: boolean; // perdue (cartes assombries)
  res: Bubble | null; // résultat de cette main
}

export interface ArcPlace {
  slug: string;
  name: string; // nom affiché (sans le 🤖)
  bot: boolean;
  sub: ReactNode; // solde (Chill) ou mise (Soirée), sous le nom
  busted: boolean;
  away: boolean;
  hands: ArcHand[];
  // Main affichée pour les autres joueurs (la main en cours, ou la 1re).
  shownHand: ArcHand | null;
  turn: boolean;
  deadline: number | null;
  stake: Stake | null; // mise posée dans le cercle
  tag: Bubble | null; // résultat d'un autre joueur
}

export interface ArcDealer {
  // Dans l'ordre du tirage ; null = carte face cachée.
  cards: (CardCode | null)[];
  visible: CardCode[];
  blackjack: boolean;
  line: string | null; // « Le croupier fait 17 »...
}

const rad = (d: number) => (d * Math.PI) / 180;

export function ArcBlackjackTable({
  dealer,
  left,
  right,
  me,
  deadlineTotal,
  unit,
}: {
  dealer: ArcDealer;
  // Les autres joueurs : à ma gauche (écran à gauche) et à ma droite, du
  // plus proche au plus éloigné.
  left: ArcPlace[];
  right: ArcPlace[];
  me: ArcPlace | null;
  deadlineTotal: number;
  unit: string;
}) {
  const [ref, W] = useWidth<HTMLDivElement>(358);
  const animate = useAfterFirstPaint();
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [zoom, setZoom] = useState<string | null>(null);
  const close = useCallback(() => setZoom(null), []);
  const zoomPlace = zoom ? [...left, ...right, ...(me ? [me] : [])].find((p) => p.slug === zoom) : null;

  const H = 448;
  const cx = W / 2;
  const meY = H - 80;
  const colTop = 136; // haut des colonnes de cartes (sous les inscriptions)
  const perSide = Math.max(1, left.length, right.length);
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
    ...left.map((p, i) => ({ p, side: 1, x: cx - meW / 2 - 4 - slotW * (i + 0.5) })),
    ...right.map((p, i) => ({ p, side: -1, x: cx + meW / 2 + 4 + slotW * (i + 0.5) })),
  ].map((s) => {
    const y = smileY(s.x);
    const dirs = towards(s.side);
    const bw = slotW - 2;
    const bh = y - R - 4 - colTop;
    const h = s.p.shownHand;
    const lay = h
      ? layoutRun(h.cards.length, { w: bw, h: bh }, { maxCw, minCw: 16, deck: "classic", dirs, align: [s.side > 0 ? "start" : "end", "end"], spread: 0.3 })
      : null;
    const topCard = lay && lay.pos.length ? Math.min(...lay.pos.map((q) => q.y)) : bh;
    return { ...s, y, dirs, bw, bh, topCard };
  });
  const smile = Array.from({ length: 41 }, (_, i) => {
    const x = 14 + ((W - 28) * i) / 40;
    return `${i ? "L" : "M"}${x.toFixed(1)} ${smileY(x).toFixed(1)}`;
  }).join(" ");
  const shape = `M26 0 H${W - 26} Q${W} 0 ${W} 26 V${H - 120} Q${W} ${H - 4} ${cx} ${H - 4} Q0 ${H - 4} 0 ${H - 120} V26 Q0 0 26 0 Z`;
  const myHands = me?.hands ?? [];
  const myBottom = meY - 24 - 6;

  return (
    <>
      <div ref={ref} className="relative mt-2 w-full select-none" style={{ height: H }} data-table>
        <svg className="pointer-events-none absolute inset-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
          <defs>
            <radialGradient id={`${id}-leather`} cx="50%" cy="30%" r="80%">
              <stop offset="0" stopColor="#4a2d1b" />
              <stop offset="0.6" stopColor="#24140b" />
              <stop offset="1" stopColor="#110803" />
            </radialGradient>
            <radialGradient id={`${id}-felt`} cx="50%" cy="35%" r="80%">
              <stop offset="0" stopColor="#2f9566" />
              <stop offset="0.45" stopColor="#1d6e48" />
              <stop offset="0.8" stopColor="#114c31" />
              <stop offset="1" stopColor="#08291a" />
            </radialGradient>
            <filter id={`${id}-noise`}>
              <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" stitchTiles="stitch" />
              <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.22 0" />
            </filter>
            <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" />
            </filter>
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

        <DealerHand dealer={dealer} animate={animate} style={{ left: cx - 59, top: 14 }} />

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
                  deck="classic"
                  dirs={dirs}
                  align={[side > 0 ? "start" : "end", "end"]}
                  spread={0.3}
                  animate={animate}
                  dealFrom={(i) => ({ x: W - 40 - left - i * 4, y: 20 - colTop - bh })}
                  dim={h.lose}
                  onOpen={() => setZoom(p.slug)}
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
              <SpotCircle p={p} r={R} deadlineTotal={deadlineTotal} style={{ left: x, top: y, zIndex: 3 }} />
              <div
                className={`bv-col-name absolute -translate-x-1/2 text-center ${slotW < 38 ? "bv-col-small" : ""} ${p.busted ? "bv-name-out" : ""}`}
                style={{ left: x, top: y + R + 2, width: slotW - 2, zIndex: 4 }}
                data-name
              >
                <div className="bv-name-n">{p.name}</div>
                {p.tag ? (
                  <Tag tone={p.tag.tone} small>
                    {p.tag.text}
                  </Tag>
                ) : (
                  <div className="bv-name-s">{p.sub}</div>
                )}
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
              const opts = { maxCw: n > 1 ? 32 : 44, minCw: 18, deck: "classic" as const, dirs, align: ["center", "end"] as [Align, Align], spread: 0.45 };
              const lay = layoutRun(h.cards.length, { w, h: bh }, opts);
              const top = lay.pos.length ? Math.min(...lay.pos.map((q) => q.y)) : bh;
              return (
                <div key={h.id}>
                  <HandRun
                    cards={h.cards}
                    w={w}
                    h={bh}
                    {...opts}
                    animate={animate}
                    dealFrom={(k) => ({ x: W - 60 - left - k * 8, y: -colTop - bh })}
                    dim={h.lose}
                    active={n > 1 && h.active}
                    onOpen={() => setZoom(me.slug)}
                    style={{ position: "absolute", left, top: colTop + 20, zIndex: 2 }}
                  />
                  {/* Total (et résultat, au-dessus) juste au-dessus de la main */}
                  <div
                    className={`absolute flex -translate-x-1/2 items-center gap-1 ${n === 1 ? "flex-col-reverse" : ""}`}
                    style={{ left: left + w / 2, top: colTop + 20 + top - (n === 1 && (h.res || h.bust || h.natural) ? 42 : 22), zIndex: 5 }}
                  >
                    <TotalBadge cards={h.cards} blackjack={h.natural} size={n > 1 ? "md" : "lg"} />
                    {h.res ? (
                      <Tag tone={h.res.tone} small={n > 1}>
                        {h.res.text}
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
            <SpotCircle p={me} r={24} big deadlineTotal={deadlineTotal} style={{ left: cx, top: meY, zIndex: 3 }} />
            <div className="absolute -translate-x-1/2 text-center leading-tight" style={{ left: cx, top: meY + 31 }} data-name>
              <div className="text-[0.74rem] font-bold text-cyan">Toi{me.away ? " · absent" : ""}</div>
              <div className="text-[0.66rem] font-semibold text-white/75 tabular-nums">{me.sub}</div>
            </div>
          </div>
        )}
      </div>

      <HandZoom
        open={!!zoomPlace}
        onClose={close}
        name={zoomPlace ? (zoomPlace === me ? "Ta main" : zoomPlace.name) : ""}
        hands={(zoomPlace?.hands ?? []).map((h) => ({ cards: h.cards, bet: h.bet, doubled: h.doubled, natural: h.natural, res: h.res }))}
        deck="classic"
        unit={unit}
      />
    </>
  );
}

// Cercle de mise : jetons (Chill) ou gorgées (Soirée), chrono autour.
function SpotCircle({ p, r, big = false, deadlineTotal, style }: { p: ArcPlace; r: number; big?: boolean; deadlineTotal: number; style?: CSSProperties }) {
  return (
    <div
      className={`bv-spot absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full ${big ? "bv-spot-me" : ""} ${p.turn ? "tk-halo" : ""}`}
      style={{ width: r * 2, height: r * 2, ...style }}
      data-spot
    >
      {p.stake && p.stake.amount > 0 ? (
        p.stake.kind === "chips" ? (
          <ChipStack amount={p.stake.amount} scale={big ? 0.95 : 0.72} maxColumns={2} maxPerColumn={4} />
        ) : (
          <span className={`bv-spot-gulps ${big ? "bv-spot-gulps-big" : ""}`}>{p.stake.amount}🍺</span>
        )
      ) : null}
      {p.deadline && <TimerRing key={p.deadline} deadlineAt={p.deadline} totalMs={deadlineTotal} size={r * 2 + 10} stroke={3} />}
    </div>
  );
}

// Main du croupier (boîte fixe) avec son total à droite.
function DealerHand({ dealer, animate, style }: { dealer: ArcDealer; animate: boolean; style?: CSSProperties }) {
  const w = 118;
  const codes = dealer.cards.map((x) => x ?? "As");
  return (
    <div className="absolute" style={style} data-dealer>
      <HandRun
        cards={codes}
        w={w}
        h={60}
        maxCw={42}
        deck="classic"
        animate={animate}
        dealFrom={(i) => ({ x: 60 - i * 14, y: -30 })}
        faceDown={(i) => dealer.cards[i] === null}
      />
      {dealer.visible.length > 0 && (
        <div className="absolute top-1/2 -translate-y-1/2" style={{ left: w + 6 }}>
          <TotalBadge cards={dealer.visible} blackjack={dealer.blackjack} />
        </div>
      )}
      {dealer.line && <div className="bv-dealer-line absolute top-full left-1/2 mt-0.5 -translate-x-1/2 whitespace-nowrap">{dealer.line}</div>}
    </div>
  );
}

// Décor : sabot et défausse (SVG).
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
