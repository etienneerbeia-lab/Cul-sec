"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fromCode, fromCodes, type CardCode } from "@/lib/casino/cards";
import { formatChips } from "@/lib/chips/format";
import { serverNow } from "@/lib/clock";
import { bestHand, describeHand } from "@/lib/game/evaluate";
import { haptic } from "@/lib/haptics";
import { playSound } from "@/lib/sound";
import { ACTION_MS, blindsFor, levelAt } from "@/lib/poker/blinds";
import { legalFor } from "@/lib/poker/engine";
import { logText, potRaiseTo } from "@/lib/poker/format";
import type { PokerState } from "@/lib/poker/types";
import type { GameState } from "@/lib/game/types";
import { useGame } from "../GameContext";
import { Button } from "../ui/Button";
import { PlayingCardV2 } from "../ui/Cards";
import { TimerBar, Waiting } from "../ui/Feedback";
import { Kicker, Screen } from "../ui/Layout";
import { cleanName, isBotName, playerColor } from "../ui/Players";

// ---- Géométrie de la table (fixe, quel que soit le contenu des sièges) ----
const TABLE_H = 364;
const SEAT_W = 70;
const RX = 40; // rayon horizontal des sièges, en % de la largeur
const RY = 40; // rayon vertical, en % de la hauteur

// Angle (degrés, 90 = en bas) du k-ième siège à partir du mien.
const seatAngle = (k: number, n: number) => 90 + (k * 360) / n;
const polar = (deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { left: `${50 + RX * Math.cos(a)}%`, top: `${50 + RY * Math.sin(a)}%` };
};

const BETTING = ["preflop", "flop", "turn", "river"];

export default function PokerScreen() {
  const { game, mySlug, busy, act, away } = useGame();
  const p = game.poker!;
  const chips = game.chips!;
  const names = useMemo(() => new Map(game.playersPublic.map((pl) => [pl.slug, pl.name])), [game.playersPublic]);
  const nameOf = (s: string) => cleanName(names.get(s) ?? s);
  const seated = p.seats.includes(mySlug);
  const busted = seated && chips.bustOrder.some((g) => g.includes(mySlug));
  const myTurn = p.toAct === mySlug && BETTING.includes(p.stage);
  const pot = Object.values(chips.committed).reduce((a, b) => a + b, 0);
  const result = p.stage === "handEnd" ? p.result : undefined;

  // Petit signal quand c'est à moi de jouer.
  const turnKey = myTurn ? `${p.handNo}:${p.actSeq}` : "";
  useEffect(() => {
    if (!turnKey) return;
    haptic("tap");
    playSound("tap");
  }, [turnKey]);

  // Cartes à mettre en avant à l'abattage : la main gagnante du pot principal.
  const highlight = useMemo(() => {
    if (!result || result.uncontested) return null;
    const w = result.pots[0]?.winners[0];
    return w ? new Set(result.best[w] ?? []) : null;
  }, [result]);

  // Mes cartes et le nom de ma main en cours.
  const myHole = p.hole[mySlug];
  const myHandLabel = useMemo(() => {
    if (!myHole) return null;
    if (p.board.length === 0) {
      const [a, b] = fromCodes(myHole);
      return a.value === b.value ? describeHand(bestHand([a, b]).eval) : "Préflop";
    }
    return describeHand(bestHand(fromCodes([...myHole, ...p.board])).eval);
  }, [myHole, p.board]);

  // Sièges dans l'ordre de la table, le mien en bas (spectateur : le 1er).
  const meIdx = Math.max(0, p.seats.indexOf(mySlug));
  const rotated = p.seats.map((_, k) => p.seats[(meIdx + k) % p.seats.length]);
  const buttonSlug = p.seats[p.button];

  return (
    <Screen actions={<ActionBar game={game} p={p} myTurn={myTurn} seated={seated} busted={busted} busy={busy} act={act} pot={pot} nameOf={nameOf} />}>
      <LevelBar game={game} p={p} />

      <div className="relative mt-2 w-full" style={{ height: TABLE_H }}>
        {/* Tapis ovale */}
        <div
          className="absolute rounded-[50%] border-[6px] border-[#3a2412] shadow-[inset_0_0_50px_rgba(0,0,0,0.55),0_20px_40px_-20px_rgba(0,0,0,0.9)]"
          style={{
            left: "9%",
            right: "9%",
            top: "13%",
            bottom: "13%",
            background: "radial-gradient(ellipse at center, #1f7a57 0%, #145a40 55%, #0d3d2c 100%)",
          }}
        />

        {/* Pot + board au centre */}
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5">
          <div className="rounded-full bg-black/35 px-3 py-0.5 font-display text-sm font-extrabold tabular-nums text-beer">
            Pot {formatChips(result ? result.pots.reduce((a, x) => a + x.amount, 0) : pot)}
          </div>
          <div className="flex gap-[3px]" data-board>
            {[0, 1, 2, 3, 4].map((i) => {
              const code = p.board[i];
              const lit = !!code && !!highlight?.has(code);
              return code ? (
                <PlayingCardV2
                  key={i}
                  card={fromCode(code)}
                  size="2xs"
                  dim={!!highlight && !lit}
                  className={lit ? "-translate-y-1 shadow-[0_0_0_2px_var(--color-beer),0_0_16px_rgba(255,201,77,0.7)]" : ""}
                />
              ) : (
                <div key={i} className="h-[48px] w-[34px] rounded-[6px] border border-dashed border-white/15" />
              );
            })}
          </div>
          <div className="h-4 font-display text-[0.7rem] font-bold uppercase tracking-widest text-white/60">
            {p.stage === "runout" ? "Tapis !" : p.stage === "handEnd" ? "" : p.stage === "preflop" ? "" : p.stage}
          </div>
        </div>

        {rotated.map((slug, k) => {
          const angle = seatAngle(k, rotated.length);
          return (
            <Seat
              key={slug}
              slug={slug}
              name={names.get(slug) ?? slug}
              me={slug === mySlug}
              stack={chips.stacks[slug] ?? 0}
              bet={p.streetBet[slug] ?? 0}
              p={p}
              angle={angle}
              isButton={slug === buttonSlug}
              away={away.includes(slug)}
              busted={chips.bustOrder.some((g) => g.includes(slug))}
              highlight={highlight}
              net={result?.net[slug]}
            />
          );
        })}
      </div>

      <ResultBanner p={p} nameOf={nameOf} />

      <div className="mt-2 flex min-h-[92px] gap-3">
        {myHole && (
          <div className="flex shrink-0 flex-col items-center gap-1">
            <div className="flex -space-x-5">
              {myHole.map((c, i) => {
                const lit = !!highlight?.has(c);
                return (
                  <PlayingCardV2
                    key={c}
                    card={fromCode(c)}
                    size="sm"
                    dim={p.folded.includes(mySlug) || (!!highlight && !lit)}
                    className={`${i === 0 ? "-rotate-6" : "rotate-6"} ${lit ? "shadow-[0_0_0_2px_var(--color-beer),0_0_16px_rgba(255,201,77,0.7)]" : ""}`}
                  />
                );
              })}
            </div>
            <div className="max-w-[104px] truncate text-center font-display text-[0.8rem] font-bold text-ink-2">{myHandLabel}</div>
          </div>
        )}
        <HandLog p={p} nameOf={nameOf} />
      </div>
    </Screen>
  );
}

// ---- Niveau de blindes et compte à rebours ----
function LevelBar({ game, p }: { game: GameState; p: PokerState }) {
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

// ---- Un siège ----
function Seat({
  slug,
  name,
  me,
  stack,
  bet,
  p,
  angle,
  isButton,
  away,
  busted,
  highlight,
  net,
}: {
  slug: string;
  name: string;
  me: boolean;
  stack: number;
  bet: number;
  p: PokerState;
  angle: number;
  isButton: boolean;
  away: boolean;
  busted: boolean;
  highlight: Set<CardCode> | null;
  net?: number;
}) {
  const inHand = p.inHand.includes(slug);
  const folded = p.folded.includes(slug);
  const allIn = p.allIn.includes(slug);
  const active = p.toAct === slug && BETTING.includes(p.stage);
  const hole = p.hole[slug];
  const isSb = p.sbSlug === slug && inHand;
  const isBb = p.bbSlug === slug && inHand;
  const tags = [isButton && "D", isSb && "SB", isBb && "BB"].filter(Boolean) as string[];
  const pos = polar(angle);
  const won = net !== undefined && net > 0;
  // Moitié basse de la table : la mise est posée au-dessus du siège (vers
  // le centre) et les badges D/SB/BB en dessous ; moitié haute : l'inverse.
  // La mise reste ainsi dans la largeur du siège et ne touche jamais le board.
  const lower = Math.sin((angle * Math.PI) / 180) > 0.05;
  const chip = bet > 0 || won ? (won ? `+${formatChips(net!)}` : `● ${formatChips(bet)}`) : null;

  let status: string | null = null;
  if (busted) status = "Éliminé";
  else if (folded) status = "Couché";
  else if (allIn) status = "Tapis";

  return (
    <>
      <div
        className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-2xl border px-1 pb-1 pt-1.5 text-center transition ${
          active
            ? "border-cyan bg-night-700 shadow-[0_0_0_2px_var(--color-cyan),0_0_22px_rgba(69,227,255,0.45)]"
            : won
              ? "border-beer/80 bg-night-700 shadow-[0_0_18px_rgba(255,201,77,0.45)]"
              : "border-white/12 bg-night-900/90"
        } ${busted || folded ? "opacity-50" : ""}`}
        style={{ ...pos, width: SEAT_W }}
        data-seat={slug}
      >
        {/* Bouton / blindes */}
        {tags.length > 0 && (
          <div className={`absolute left-1/2 flex -translate-x-1/2 gap-0.5 ${lower ? "-bottom-2" : "-top-2"}`}>
            {tags.map((t) => (
              <span
                key={t}
                className={`rounded-full px-1.5 text-[0.6rem] font-black leading-[1.35] ${
                  t === "D" ? "bg-white text-night-950" : t === "SB" ? "bg-violet text-white" : "bg-neon text-white"
                }`}
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {away && (
          <span className="absolute -right-1.5 -top-2 rounded-full bg-amber px-1 text-[0.55rem] font-black uppercase leading-[1.4] text-night-950">
            absent
          </span>
        )}
        {/* Cartes : dos, ou retournées (tapis / abattage) */}
        <div className="flex h-[34px] items-center justify-center gap-0.5">
          {inHand && !folded && hole
            ? hole.map((c) => {
                const lit = !!highlight?.has(c);
                return (
                  <PlayingCardV2
                    key={c}
                    card={fromCode(c)}
                    size="3xs"
                    dim={!!highlight && !lit}
                    className={lit ? "shadow-[0_0_0_2px_var(--color-beer)]" : ""}
                  />
                );
              })
            : inHand && !folded
              ? [0, 1].map((i) => <PlayingCardV2 key={i} faceDown size="3xs" />)
              : (
                  <span className="grid h-7 w-7 place-items-center rounded-full text-[0.8rem] font-black text-white" style={{ background: playerColor(slug) }}>
                    {isBotName(name) ? "🤖" : cleanName(name).charAt(0).toUpperCase()}
                  </span>
                )}
        </div>
        <div className={`mt-0.5 w-full truncate text-[0.7rem] font-semibold leading-tight ${me ? "text-cyan" : "text-ink"}`}>
          {me ? "Toi" : cleanName(name)}
        </div>
        <div className="w-full truncate font-display text-[0.78rem] font-extrabold tabular-nums leading-tight">
          {status && !won ? <span className="text-mute">{status}</span> : formatChips(stack)}
        </div>
        {/* Mise en cours, posée côté centre de la table */}
        {chip && (
          <div
            className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 font-display text-[0.7rem] font-extrabold leading-[1.45] tabular-nums shadow ${
              lower ? "-top-2.5" : "-bottom-2.5"
            } ${won ? "bg-beer text-night-950" : "bg-black/80 text-white ring-1 ring-white/25"}`}
            data-bet
          >
            {chip}
          </div>
        )}
      </div>
    </>
  );
}

// ---- Résultat de la main ----
function ResultBanner({ p, nameOf }: { p: PokerState; nameOf: (s: string) => string }) {
  const r = p.stage === "handEnd" ? p.result : undefined;
  if (!r) return <div className="h-0" />;
  const lines = r.pots.map((pot, i) => {
    const who = pot.winners.map(nameOf).join(" & ");
    const label = r.uncontested ? "" : r.labels[pot.winners[0]];
    const potName = r.pots.length > 1 ? (i === 0 ? "Pot principal" : `Side pot ${i}`) : null;
    const split = pot.winners.length > 1;
    return { key: i, potName, who, label, amount: pot.amount, split };
  });
  return (
    <div className="animate-pop mt-1 rounded-2xl border border-beer/40 bg-beer/[0.08] px-3 py-2 text-center">
      {lines.map((l) => (
        <div key={l.key} className="leading-snug">
          {l.potName && <span className="mr-1 text-[0.7rem] font-bold uppercase tracking-wider text-mute">{l.potName} ·</span>}
          <span className="font-display font-extrabold">
            🏆 {l.who} {l.split ? "partagent" : "remporte"} {formatChips(l.amount)}
          </span>
          {l.label && <div className="font-display text-[1.05rem] font-bold text-beer">{l.label}</div>}
        </div>
      ))}
      {r.uncontested && <div className="text-[0.8rem] text-ink-2">Tout le monde s&apos;est couché.</div>}
      {r.busted.length > 0 && <div className="text-[0.8rem] text-danger">Éliminé : {r.busted.map(nameOf).join(", ")}</div>}
    </div>
  );
}

// ---- Mini historique de la main ----
function HandLog({ p, nameOf }: { p: PokerState; nameOf: (s: string) => string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [p.log.length]);
  return (
    <div
      ref={ref}
      className="h-[92px] min-w-0 flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[0.78rem] leading-[1.35]"
      aria-label="Historique de la main"
    >
      {p.log.map((e, i) =>
        e.k === "street" ? (
          <div key={i} className="my-0.5 font-display text-[0.68rem] font-bold uppercase tracking-widest text-cyan">
            — {logText(e, nameOf)} —
          </div>
        ) : (
          <div key={i} className={`truncate ${e.k === "win" ? "font-bold text-beer" : i === p.log.length - 1 ? "text-ink" : "text-ink-2"}`}>
            {logText(e, nameOf)}
          </div>
        )
      )}
    </div>
  );
}

// ---- Barre d'actions ----
function ActionBar({
  game,
  p,
  myTurn,
  seated,
  busted,
  busy,
  act,
  pot,
  nameOf,
}: {
  game: GameState;
  p: PokerState;
  myTurn: boolean;
  seated: boolean;
  busted: boolean;
  busy: boolean;
  act: (a: { type: string; [k: string]: unknown }) => void;
  pot: number;
  nameOf: (s: string) => string;
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

  const timer = <TimerBar deadlineAt={game.timer?.deadlineAt} totalMs={ACTION_MS} />;

  if (!myTurn || !legal) {
    let msg: string;
    if (!seated) msg = "Tu regardes la partie (table complète)";
    else if (busted) msg = "Éliminé · tu regardes la fin du tournoi";
    else if (p.stage === "handEnd") msg = p.over ? "Fin du tournoi…" : "Main suivante…";
    else if (p.stage === "runout") msg = "Tapis ! On retourne les cartes…";
    else if (p.folded.includes(mySlug)) msg = `Couché · ${p.toAct ? `${nameOf(p.toAct)} réfléchit…` : "…"}`;
    else msg = p.toAct ? `${nameOf(p.toAct)} réfléchit…` : "…";
    return (
      <>
        {BETTING.includes(p.stage) && p.toAct && timer}
        <Waiting>{msg}</Waiting>
      </>
    );
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
        {timer}
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
    <>
      {timer}
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
    </>
  );
}
