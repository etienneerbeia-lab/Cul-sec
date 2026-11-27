"use client";

import { useEffect, useMemo, useState } from "react";
import { fromCodes } from "@/lib/casino/cards";
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
import { cleanName, isBotName } from "../ui/Players";
import type { TagTone } from "./TableKit";
import { NeonPokerTable, type Mark, type NeonSeat } from "./table/NeonPokerTable";

export const BETTING = ["preflop", "flop", "turn", "river"];

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
  const names = useMemo(() => new Map(game.playersPublic.map((pl) => [pl.slug, pl.name])), [game.playersPublic]);
  const seated = p.seats.includes(mySlug);
  const isBusted = (s: string) => chips.bustOrder.some((grp) => grp.includes(s));
  const busted = seated && isBusted(mySlug);
  const myTurn = p.toAct === mySlug && BETTING.includes(p.stage);
  const pot = Object.values(chips.committed).reduce((a, b) => a + b, 0);
  const result = p.stage === "handEnd" ? p.result : undefined;
  const handOver = p.stage === "handEnd";
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
  const buttonSlug = p.seats[p.button];
  const seatOf = (slug: string): NeonSeat => {
    const inHand = p.inHand.includes(slug);
    const folded = p.folded.includes(slug);
    const out = isBusted(slug);
    const marks: Mark[] = [];
    if (slug === buttonSlug) marks.push("D");
    if (inHand && slug === p.sbSlug) marks.push("SB");
    if (inHand && slug === p.bbSlug) marks.push("BB");
    const name = names.get(slug) ?? slug;
    const hole = slug === mySlug ? undefined : p.hole[slug];
    const bet = p.streetBet[slug] ?? 0;
    return {
      slug,
      name: cleanName(name),
      bot: isBotName(name),
      line2: out ? <span className="pv-busted">Éliminé</span> : formatChips(chips.stacks[slug] ?? 0),
      out: out || folded || !inHand,
      holding: inHand && !folded && !hole,
      faces: inHand && !folded && hole ? hole : undefined,
      won: handOver && (p.result?.net[slug] ?? 0) > 0,
      bubble: bubbleFor(p, slug, last[slug]),
      deadline: p.toAct === slug && BETTING.includes(p.stage) ? deadline : null,
      marks,
      away: away.includes(slug),
      bet: bet > 0 && !handOver ? { amount: bet, kind: "chips" } : null,
    };
  };
  const seats = rotated.map(seatOf);
  const folded = p.folded.includes(mySlug);

  return (
    <Screen
      actions={myTurn || busted ? <ActionBar game={game} p={p} myTurn={myTurn} seated={seated} busted={busted} busy={busy} act={act} pot={pot} /> : undefined}
    >
      <LevelBar game={game} p={p} />
      <NeonPokerTable
        seats={seats}
        me={
          seated
            ? {
                ...seats[0],
                hole: busted ? undefined : myHole,
                label: folded ? "Couché" : myHandLabel,
                folded,
                out: folded || busted,
                deadline: myTurn ? deadline : null,
              }
            : null
        }
        board={p.board}
        highlight={highlight}
        pot={!handOver ? { amount: result ? result.pots.reduce((a, x) => a + x.amount, 0) : pot, kind: "chips" } : null}
        winnerLine={winnerLine}
        deadlineTotal={ACTION_MS}
        spectator={<p className="mt-8 text-center text-xs text-mute">Table complète : tu regardes la partie.</p>}
      />
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
          <Kicker>
            {isBet ? "Mise" : "Relance"} · min {formatChips(legal.minRaiseTo)}
          </Kicker>
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
