"use client";

import { useEffect, useMemo, useState } from "react";
import { fromCode, fromCodes, type CardCode } from "@/lib/casino/cards";
import { formatChips } from "@/lib/chips/format";
import { serverNow } from "@/lib/clock";
import { bestHand, describeHand } from "@/lib/game/evaluate";
import { haptic } from "@/lib/haptics";
import { playSound } from "@/lib/sound";
import { ACTION_MS, blindsFor, levelAt } from "@/lib/poker/blinds";
import { legalFor } from "@/lib/poker/engine";
import { potRaiseTo } from "@/lib/poker/format";
import type { PokerLogEntry, PokerState } from "@/lib/poker/types";
import type { GameState } from "@/lib/game/types";
import { useGame } from "../GameContext";
import { Button } from "../ui/Button";
import { Kicker, Screen } from "../ui/Layout";
import { cleanName, isBotName, playerColor } from "../ui/Players";
import { CasinoCard } from "./CasinoCard";
import { BlindChip, ChipStack, DealerButton } from "./Chips";
import { Tag, type TagTone, TimerRing, useAfterFirstPaint, useWidth } from "./TableKit";

export const BETTING = ["preflop", "flop", "turn", "river"];
const AVATAR = 40;
const PLATE_W = 76;

// ---- Géométrie : tout est calculé en px à partir de la largeur mesurée ----
function geometry(W: number) {
  const H = Math.round(Math.min(470, Math.max(400, W * 1.25)));
  const cx = W / 2;
  const cy = H / 2;
  // Les sièges sont posés sur le rail : assez loin du bord pour que la
  // plaque (76 px) ne sorte jamais de l'écran.
  const rx = W / 2 - PLATE_W / 2 - 2;
  const ry = H / 2 - 48;
  const cardW = Math.min(34, Math.floor((W * 0.5 - 16) / 5));
  // Pot au-dessus du board : le dessous reste libre pour les mises des
  // sièges du bas.
  return { W, H, cx, cy, rx, ry, cardW, boardY: cy, potY: cy - cardW * 0.7 - 26 };
}
type Geo = ReturnType<typeof geometry>;

// Angle (degrés, 90 = en bas) du k-ième siège à partir du mien.
const seatAngle = (k: number, n: number) => 90 + (k * 360) / n;
const rad = (d: number) => (d * Math.PI) / 180;

function seatPos(g: Geo, angle: number) {
  return { x: g.cx + g.rx * Math.cos(rad(angle)), y: g.cy + g.ry * Math.sin(rad(angle)) };
}

interface Rect {
  l: number;
  r: number;
  t: number;
  b: number;
}
const rectAt = (x: number, y: number, w: number, h: number): Rect => ({ l: x - w / 2, r: x + w / 2, t: y - h / 2, b: y + h / 2 });

// Emprise d'un siège adverse : avatar + plaque, et la bulle au-dessus.
function seatRects(g: Geo, angle: number): Rect[] {
  const s = seatPos(g, angle);
  return [
    { l: s.x - PLATE_W / 2 - 2, r: s.x + PLATE_W / 2 + 2, t: s.y - AVATAR / 2 - 2, b: s.y + 66 },
    { l: s.x - 42, r: s.x + 42, t: s.y - AVATAR / 2 - 30, b: s.y - AVATAR / 2 },
  ];
}

// Place les mises sur le tapis : pour chaque siège, des positions candidates
// vers le centre (à distance croissante, puis décalées sur les côtés) ; on
// garde la première qui ne touche ni le board, ni le pot, ni un siège, ni
// une bulle, ni une mise déjà posée.
const overlapArea = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
function layoutBets(g: Geo, angles: Map<string, number>, mySlug: string, withBet: string[]): Map<string, { x: number; y: number }> {
  // Tables de 7-8 : jetons un peu plus serrés.
  const BET_W = angles.size >= 7 ? 44 : 50;
  const BET_H = angles.size >= 7 ? 32 : 36;
  const obstacles: Rect[] = [
    rectAt(g.cx, g.boardY, g.cardW * 5 + 16 + 10, g.cardW * 1.4 + 10),
    rectAt(g.cx, g.potY, 100, 42),
  ];
  for (const [slug, a] of angles) if (slug !== mySlug) obstacles.push(...seatRects(g, a));
  const placed = new Map<string, { x: number; y: number }>();
  for (const slug of withBet) {
    const a = angles.get(slug)!;
    const s = seatPos(g, a);
    const dx = g.cx - s.x;
    const dy = g.cy - s.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    // Première position libre ; à défaut (table très chargée), celle qui
    // chevauche le moins.
    let best: { x: number; y: number; cost: number } | null = null;
    search: for (let d = 34; d <= 200; d += 6) {
      for (const off of [0, 24, -24, 48, -48, 72, -72, 96, -96]) {
        // Décalage perpendiculaire à l'axe siège → centre.
        const x = s.x + ux * d - uy * off;
        const y = s.y + uy * d + ux * off;
        const r = rectAt(x, y, BET_W, BET_H);
        if (r.l < 4 || r.r > g.W - 4 || r.t < 4 || r.b > g.H - 4) continue;
        const cost = obstacles.reduce((sum, o) => sum + overlapArea(o, r), 0) + d * 0.01;
        if (!best || cost < best.cost) best = { x, y, cost };
        if (cost < 3) break search;
      }
    }
    const p = best ?? { x: s.x + ux * 70, y: s.y + uy * 70 };
    placed.set(slug, p);
    obstacles.push(rectAt(p.x, p.y, BET_W, BET_H));
  }
  return placed;
}

// Dernière action de chaque joueur sur la rue en cours (bulle au-dessus de
// son avatar).
export function lastActions(p: PokerState): Record<string, PokerLogEntry> {
  const out: Record<string, PokerLogEntry> = {};
  for (const e of p.log) {
    if (e.k === "street") for (const k of Object.keys(out)) delete out[k];
    else if (e.s && ["fold", "check", "call", "bet", "raise", "allin"].includes(e.k)) out[e.s] = e;
  }
  return out;
}

export function bubbleFor(p: PokerState, slug: string, last: PokerLogEntry | undefined): { tone: TagTone; text: string } | null {
  if (p.stage === "handEnd") {
    const net = p.result?.net[slug] ?? 0;
    return net > 0 ? { tone: "win", text: `GAGNE +${formatChips(net)}` } : null;
  }
  if (p.allIn.includes(slug) && p.inHand.includes(slug)) return { tone: "allin", text: "ALL-IN" };
  if (!last) return null;
  switch (last.k) {
    case "fold":
      return { tone: "fold", text: "FOLD" };
    case "check":
      return { tone: "check", text: "CHECK" };
    case "call":
      return { tone: "check", text: "CALL" };
    case "bet":
      return { tone: "bet", text: `BET ${formatChips(last.n ?? 0)}` };
    case "raise":
      return { tone: "bet", text: `RAISE ${formatChips(last.n ?? 0)}` };
    case "allin":
      return { tone: "allin", text: "ALL-IN" };
  }
  return null;
}

export default function PokerScreen() {
  const { game, mySlug, busy, act, away } = useGame();
  const p = game.poker!;
  const chips = game.chips!;
  const [ref, W] = useWidth<HTMLDivElement>(343);
  const g = geometry(W);
  const animate = useAfterFirstPaint();
  const names = useMemo(() => new Map(game.playersPublic.map((pl) => [pl.slug, pl.name])), [game.playersPublic]);
  const nameOf = (s: string) => cleanName(names.get(s) ?? s);
  const seated = p.seats.includes(mySlug);
  const isBusted = (s: string) => chips.bustOrder.some((grp) => grp.includes(s));
  const busted = seated && isBusted(mySlug);
  const myTurn = p.toAct === mySlug && BETTING.includes(p.stage);
  const pot = Object.values(chips.committed).reduce((a, b) => a + b, 0);
  const result = p.stage === "handEnd" ? p.result : undefined;
  const last = lastActions(p);
  const deadline = game.timer?.deadlineAt ?? null;

  // Petit signal quand c'est à moi de jouer.
  const turnKey = myTurn ? `${p.handNo}:${p.actSeq}` : "";
  useEffect(() => {
    if (!turnKey) return;
    haptic("tap");
    playSound("tap");
  }, [turnKey]);

  // Main gagnante du pot principal : ses cartes sont mises en avant.
  const highlight = useMemo(() => {
    if (!result || result.uncontested) return null;
    const w = result.pots[0]?.winners[0];
    return w ? new Set(result.best[w] ?? []) : null;
  }, [result]);
  const winnerLine = useMemo(() => {
    if (!result || result.uncontested) return null;
    const main = result.pots[0];
    if (!main) return null;
    return {
      label: result.labels[main.winners[0]] ?? "",
      who: main.winners.map(nameOf).join(" & "),
      split: main.winners.length > 1,
    };
    // nameOf dépend de names
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, names]);

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
  const angles = new Map(rotated.map((s, k) => [s, seatAngle(k, rotated.length)]));
  const buttonSlug = p.seats[p.button];
  // Jetons D / SB / BB de chaque joueur (posés à côté de son avatar).
  const marksOf = (slug: string) => {
    const inHand = p.inHand.includes(slug);
    const m: Mark[] = [];
    if (slug === buttonSlug) m.push("D");
    if (inHand && slug === p.sbSlug) m.push("SB");
    if (inHand && slug === p.bbSlug) m.push("BB");
    return m;
  };
  const showPot = result ? result.pots.reduce((a, x) => a + x.amount, 0) : pot;
  const betSpots = layoutBets(
    g,
    angles,
    mySlug,
    rotated.filter((s) => (p.streetBet[s] ?? 0) > 0)
  );
  const handOver = p.stage === "handEnd";

  return (
    <Screen
      actions={
        myTurn || busted ? (
          <ActionBar game={game} p={p} myTurn={myTurn} seated={seated} busted={busted} busy={busy} act={act} pot={pot} />
        ) : undefined
      }
    >
      <LevelBar game={game} p={p} />

      <div ref={ref} className="relative mt-2 w-full select-none" style={{ height: g.H }} data-table>
        {/* Rail en cuir, feutre, ligne de mise dorée */}
        <div className="tb-rail absolute rounded-[50%]" style={{ left: 4, right: 4, top: g.H * 0.075, bottom: g.H * 0.075 }} />
        <div className="tb-felt absolute rounded-[50%]" style={{ left: 17, right: 17, top: g.H * 0.075 + 13, bottom: g.H * 0.075 + 13 }} />
        <div className="tb-line absolute rounded-[50%]" style={{ left: 40, right: 40, top: g.H * 0.075 + 34, bottom: g.H * 0.075 + 34 }} />

        {/* Logo du tournoi, en filigrane */}
        {(
          <svg className="pointer-events-none absolute left-1/2 -translate-x-1/2" style={{ top: g.cy + g.H * 0.22 }} width={180} height={44} viewBox="0 0 180 44" aria-hidden>
            <text x="90" y="18" textAnchor="middle" className="tb-print" fontSize="15" fontWeight="700" opacity="0.38">
              ♠ CUL·SEC ♠
            </text>
            <text x="90" y="36" textAnchor="middle" className="tb-print" fontSize="8.5" opacity="0.32">
              CHILL POKER TOUR
            </text>
          </svg>
        )}

        {/* Board : 5 emplacements dessinés */}
        <div
          className="absolute flex -translate-x-1/2 -translate-y-1/2 gap-1"
          style={{ left: g.cx, top: g.boardY }}
          data-board
        >
          {[0, 1, 2, 3, 4].map((i) => {
            const code = p.board[i];
            const lit = !!code && !!highlight?.has(code);
            return (
              <div
                key={i}
                className="relative rounded-[5px] border border-[rgba(219,180,96,0.4)] bg-black/10"
                style={{ width: g.cardW, height: Math.round(g.cardW * 1.4) }}
              >
                {code && (
                  <CasinoCard
                    card={fromCode(code)}
                    width={g.cardW}
                    flipIn
                    animate={animate}
                    delayMs={p.board.length === 3 && i < 3 ? i * 120 : 0}
                    dealFrom={{ x: 0, y: -20 }}
                    highlight={lit}
                    dim={!!highlight && !lit}
                    className="absolute left-0 top-0"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Pot */}
        {showPot > 0 && !handOver && (
          <div className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5" style={{ left: g.cx, top: g.potY }} data-pot>
            <ChipStack amount={showPot} maxColumns={4} maxPerColumn={7} />
            <span className="rounded-full bg-black/45 px-2 font-display text-[0.78rem] font-extrabold tabular-nums leading-[1.5] text-beer">
              Pot {formatChips(showPot)}
            </span>
          </div>
        )}

        {/* Main gagnante, imprimée sur le tapis juste sous le board (le
            gagnant est indiqué par sa bulle « GAGNE »). */}
        {winnerLine && (
          <div
            className="animate-pop pointer-events-none absolute left-1/2 max-w-[60%] -translate-x-1/2 whitespace-nowrap text-center"
            style={{ top: g.boardY + g.cardW * 0.7 + 5 }}
            data-winner
          >
            <span
              className={`font-[Georgia,serif] font-bold leading-tight text-[#f3d27a] drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] ${
                winnerLine.label.length > 15 ? "text-[0.8rem]" : "text-[0.95rem]"
              }`}
            >
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
            <div key={`bet-${slug}`} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: b.x, top: b.y }} data-bet>
              <ChipStack amount={bet} maxColumns={2} maxPerColumn={6} />
              <span className="font-display text-[0.68rem] font-extrabold tabular-nums leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                {formatChips(bet)}
              </span>
            </div>
          );
        })}

        {/* Sièges (le mien est sous la table, avec mes cartes en main) */}
        {rotated.map((slug) => {
          if (slug === mySlug) return null;
          const pos = seatPos(g, angles.get(slug)!);
          return (
            <Seat
              key={slug}
              slug={slug}
              name={names.get(slug) ?? slug}
              stack={chips.stacks[slug] ?? 0}
              p={p}
              x={pos.x}
              y={pos.y}
              from={{ x: g.cx - pos.x, y: g.cy - pos.y }}
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

      {/* Ma place : avatar et tapis, cartes tenues en main */}
      {seated ? (
        <MyHand
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
        />
      ) : (
        <p className="mt-2 text-center text-xs text-mute">Table complète : tu regardes la partie.</p>
      )}
    </Screen>
  );
}

// ---- Niveau de blindes et compte à rebours ----
export function LevelBar({ game, p }: { game: GameState; p: PokerState }) {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 500);
    return () => clearInterval(id);
  }, []);
  const s = { levelMs: p.levelMs, start: p.startBlinds };
  const start = game.casinoStartedAt ?? now;
  const timeLevel = levelAt(s, now - start);
  const nextAt = start + (timeLevel + 1) * p.levelMs;
  const remaining = Math.max(0, nextAt - now);
  const pending = timeLevel > p.level;
  const [nsb, nbb] = blindsFor(s, pending ? timeLevel : timeLevel + 1);
  const mmss = `${Math.floor(remaining / 60000)}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")}`;
  return (
    <div className="flex items-end justify-between gap-2">
      <div className="min-w-0">
        <Kicker>
          Niveau {p.level + 1} · Main {p.handNo}
        </Kicker>
        <div className="font-display text-xl font-extrabold tabular-nums leading-tight">
          Blindes {formatChips(p.blinds[0])}/{formatChips(p.blinds[1])}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <Kicker>{pending ? "Main suivante" : `Dans ${mmss}`}</Kicker>
        <div className={`font-display text-base font-bold tabular-nums ${pending || remaining < 15000 ? "text-amber" : "text-ink-2"}`}>
          ↑ {formatChips(nsb)}/{formatChips(nbb)}
        </div>
      </div>
    </div>
  );
}

type Mark = "D" | "SB" | "BB";

// Jetons D / SB / BB, empilés à côté de l'avatar.
function Marks({ marks, className = "", style }: { marks: Mark[]; className?: string; style?: React.CSSProperties }) {
  if (!marks.length) return null;
  return (
    <div className={`flex flex-col items-center gap-0.5 ${className}`} style={style} data-marker>
      {marks.map((k) => (k === "D" ? <DealerButton key={k} size={20} /> : <BlindChip key={k} kind={k} size={18} />))}
    </div>
  );
}

function Avatar({ name, slug, size, deadline, dim }: { name: string; slug: string; size: number; deadline: number | null; dim?: boolean }) {
  return (
    <div className={`relative grid shrink-0 place-items-center rounded-full ${deadline ? "tk-halo" : ""}`} style={{ width: size, height: size }}>
      <span
        className={`grid h-full w-full place-items-center rounded-full border-2 border-white/15 font-display font-black text-white shadow-[0_4px_10px_rgba(0,0,0,0.5)] ${dim ? "grayscale" : ""}`}
        style={{ background: `radial-gradient(circle at 35% 30%, ${playerColor(slug)}, #1a1030 120%)`, fontSize: size * 0.42 }}
      >
        {isBotName(name) ? "🤖" : cleanName(name).charAt(0).toUpperCase()}
      </span>
      {deadline && <TimerRing key={deadline} deadlineAt={deadline} totalMs={ACTION_MS} size={size + 10} stroke={3.5} />}
    </div>
  );
}

// ---- Un siège adverse, posé sur le rail ----
function Seat({
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
  marks: Mark[];
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
}) {
  const inHand = p.inHand.includes(slug);
  const folded = p.folded.includes(slug);
  const hole = p.hole[slug];
  const out = busted || folded || !inHand;
  const showFaces = inHand && !folded && !!hole;
  const won = (p.result?.net[slug] ?? 0) > 0 && p.stage === "handEnd";
  return (
    <div className="absolute" style={{ left: x, top: y, width: 0, height: 0 }} data-seat={slug}>
      {/* Bulle d'action */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: -AVATAR / 2 - (showFaces ? 42 : 22), zIndex: 5 }} data-bubble>
        {bubble && <Tag tone={bubble.tone}>{bubble.text}</Tag>}
      </div>
      {/* Cartes : dos à côté de l'avatar, faces retournées au-dessus */}
      {inHand && !folded && (
        <div
          className="absolute flex"
          style={showFaces ? { left: -27, top: -AVATAR / 2 - 14, gap: 2, zIndex: 3 } : { left: 6, top: -AVATAR / 2 - 6, zIndex: 0 }}
        >
          {showFaces
            ? hole.map((c, i) => {
                const lit = !!highlight?.has(c);
                return <CasinoCard key={i} card={fromCode(c)} width={26} flipIn animate={animate} highlight={lit} dim={!!highlight && !lit} />;
              })
            : [0, 1].map((i) => (
                <CasinoCard
                  key={i}
                  faceDown
                  width={20}
                  back="navy"
                  animate={animate}
                  dealFrom={from}
                  delayMs={i * 140}
                  style={{ transform: `rotate(${i ? 14 : -4}deg)`, marginLeft: i ? -10 : 0 }}
                />
              ))}
        </div>
      )}
      {/* Avatar + plaque */}
      <div className={`absolute flex flex-col items-center transition-opacity ${out ? "opacity-45" : ""}`} style={{ left: -PLATE_W / 2, top: -AVATAR / 2, width: PLATE_W, zIndex: 2 }} data-plate>
        <Avatar name={name} slug={slug} size={AVATAR} deadline={deadline} dim={out} />
        {/* Un jeton à gauche de l'avatar ; un second (heads-up : D + SB) à droite. */}
        <Marks marks={marks.slice(0, 1)} className="absolute -translate-y-1/2" style={{ left: 2, top: AVATAR / 2 + 4 }} />
        <Marks marks={marks.slice(1)} className="absolute -translate-y-1/2" style={{ right: 2, top: AVATAR / 2 + 10 }} />
        <div
          className={`-mt-1 w-full rounded-lg border px-1 pb-0.5 pt-1.5 text-center shadow-[0_4px_10px_rgba(0,0,0,0.55)] ${
            won ? "border-beer/70 bg-[#2a1d08]" : "border-white/10 bg-[linear-gradient(180deg,#1d1530,#0e0a18)]"
          }`}
        >
          <div className="truncate text-[0.66rem] font-semibold leading-tight text-ink-2">{cleanName(name)}</div>
          <div className="truncate font-display text-[0.76rem] font-extrabold tabular-nums leading-tight text-white">
            {busted ? <span className="text-mute">Éliminé</span> : formatChips(stack)}
          </div>
        </div>
        {away && (
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-amber px-1 text-[0.52rem] font-black uppercase leading-[1.4] text-night-950">
            absent
          </span>
        )}
      </div>
    </div>
  );
}

// ---- Ma place : cartes tenues en main ----
function MyHand({
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
}: {
  marks: Mark[];
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
}) {
  return (
    <div className="relative -mt-9 flex items-end justify-center gap-3 px-1" data-seat={slug} data-me>
      <div className="relative flex w-[84px] shrink-0 flex-col items-center">
        <div className="mb-1 h-[18px]">{bubble && <Tag tone={bubble.tone}>{bubble.text}</Tag>}</div>
        <Marks marks={marks} className="absolute -translate-y-1/2" style={{ left: 0, top: 23 + 22 }} />
        <Avatar name={name} slug={slug} size={44} deadline={deadline} dim={folded || busted} />
        <div className="-mt-1 w-full rounded-lg border border-white/10 bg-[linear-gradient(180deg,#1d1530,#0e0a18)] px-1 pb-0.5 pt-2 text-center shadow-[0_4px_10px_rgba(0,0,0,0.55)]">
          <div className="truncate text-[0.66rem] font-semibold leading-tight text-cyan">Toi{away ? " · absent" : ""}</div>
          <div className="truncate font-display text-[0.8rem] font-extrabold tabular-nums leading-tight">{busted ? "Éliminé" : formatChips(stack)}</div>
        </div>
      </div>
      <div className="flex min-w-0 flex-col items-center">
        <div className="flex h-[112px] items-end">
          {hole && !busted
            ? hole.map((c, i) => {
                const lit = !!highlight?.has(c);
                return (
                  <div key={i} style={{ transform: `rotate(${i ? 7 : -7}deg) translateY(${i ? 2 : 0}px)`, marginLeft: i ? -22 : 0, transformOrigin: "bottom center" }}>
                    <CasinoCard
                      card={fromCode(c)}
                      width={76}
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
        <div className="mt-1 h-4 max-w-[160px] truncate text-center font-[Georgia,serif] text-[0.85rem] font-bold text-[#f3d27a]">
          {folded ? <span className="font-sans text-xs font-semibold text-mute">Couché</span> : label}
        </div>
      </div>
    </div>
  );
}

// ---- Barre d'actions (seulement quand c'est à moi) ----
export function ActionBar({
  game,
  p,
  myTurn,
  seated,
  busted,
  busy,
  act,
  pot,
}: {
  game: GameState;
  p: PokerState;
  myTurn: boolean;
  seated: boolean;
  busted: boolean;
  busy: boolean;
  act: (a: { type: string; [k: string]: unknown }) => void;
  pot: number;
}) {
  const { mySlug } = useGame();
  const legal = myTurn ? legalFor(game, mySlug) : null;
  const [amount, setAmount] = useState(0);
  // Le panneau de relance est lié au tour en cours : il se referme tout
  // seul au coup suivant.
  const turnKey = `${p.handNo}:${p.actSeq}`;
  const [raisingKey, setRaisingKey] = useState<string | null>(null);
  const raising = raisingKey === turnKey;
  const setRaising = (on: boolean) => setRaisingKey(on ? turnKey : null);

  // Pas mon tour : aucun texte (l'anneau autour de l'avatar suffit), sauf
  // une mention discrète pour l'éliminé.
  if (!myTurn || !legal) {
    if (seated && busted) return <p className="text-center text-xs text-mute">Éliminé · tu regardes la fin du tournoi</p>;
    return null;
  }

  const mine = p.streetBet[mySlug] ?? 0;
  const isBet = p.currentBet === 0;
  const send = (move: string, to?: number) => {
    setRaising(false);
    act({ type: "poker", move, ...(to !== undefined ? { to } : {}) });
  };
  const clamp = (n: number) => Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, n));
  const step = Math.max(1, p.blinds[0]);
  const shortcut = (f: number) => potRaiseTo({ pot, currentBet: p.currentBet, myStreetBet: mine, fraction: f, min: legal.minRaiseTo, max: legal.maxRaiseTo });
  const value = clamp(amount || legal.minRaiseTo);
  const allIn = value >= legal.maxRaiseTo;
  const raiseLabel = allIn ? `Tapis ${formatChips(legal.maxRaiseTo)}` : isBet ? `Miser ${formatChips(value)}` : `Relancer à ${formatChips(value)}`;

  if (raising) {
    return (
      <>
        <div className="flex items-center justify-between">
          <Kicker>{isBet ? "Mise" : "Relance"} · min {formatChips(legal.minRaiseTo)}</Kicker>
          <span className="font-display text-2xl font-extrabold tabular-nums">{formatChips(value)}</span>
        </div>
        <input
          type="range"
          aria-label="Montant"
          min={legal.minRaiseTo}
          max={legal.maxRaiseTo}
          step={1}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            // Arrondi à la petite blinde, sauf aux extrémités (min, tapis).
            setAmount(v >= legal.maxRaiseTo || v <= legal.minRaiseTo ? v : clamp(Math.round(v / step) * step));
          }}
          className="cs-range w-full"
        />
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: "Min", v: legal.minRaiseTo },
            { label: "½ pot", v: shortcut(0.5) },
            { label: "Pot", v: shortcut(1) },
            { label: "Tapis", v: legal.maxRaiseTo },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              className="cs-chip"
              aria-pressed={value === o.v}
              onClick={() => {
                haptic("select");
                setAmount(o.v);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button variant="ghost" onClick={() => setRaising(false)}>
            Retour
          </Button>
          <Button disabled={busy} onClick={() => send("raise", value)}>
            {raiseLabel}
          </Button>
        </div>
      </>
    );
  }

  const callAllIn = !legal.canCheck && legal.callAmount >= (game.chips!.stacks[mySlug] ?? 0);
  return (
    <div className="grid grid-cols-3 gap-2">
      <Button variant="danger" size="sm" disabled={busy} onClick={() => send("fold")}>
        Se coucher
      </Button>
      {legal.canCheck ? (
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => send("check")}>
          Checker
        </Button>
      ) : (
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => send("call")}>
          {callAllIn ? `Tapis ${formatChips(legal.callAmount)}` : `Suivre ${formatChips(legal.callAmount)}`}
        </Button>
      )}
      <Button
        size="sm"
        disabled={busy || !legal.canRaise}
        onClick={() => {
          setAmount(legal.minRaiseTo);
          setRaising(true);
        }}
      >
        {isBet ? "Miser…" : "Relancer…"}
      </Button>
    </div>
  );
}
