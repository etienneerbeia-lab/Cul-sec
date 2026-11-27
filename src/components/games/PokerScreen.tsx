"use client";

import { useMemo } from "react";
import { toCode } from "@/lib/casino/cards";
import { bestHand, bestOf7, evaluate5, handLabel5 } from "@/lib/game/evaluate";
import { allowedActions, foldCost, POKER_MAX_BET } from "@/lib/games/poker";
import { useGame } from "../GameContext";
import { NeonPokerTable, type NeonSeat } from "../casino/table/NeonPokerTable";
import { Button } from "../ui/Button";
import { Verdict, Waiting } from "../ui/Feedback";
import { Kicker, Screen } from "../ui/Layout";
import { cleanName, isBotName } from "../ui/Players";
import { GulpList, NextRoundActions, sumGulps } from "../ui/Results";

// Poker Soirée sur la table « Néon » (la même que le Poker Chill) : on mise
// des gorgées, pas des jetons. Règles et actions inchangées.

const STREET_LABEL: Record<string, string> = {
  preflop: "Avant le flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
};

const POKER_TURN_MS = 40000;

export default function PokerScreen() {
  const { game, mySlug, busy, act, myHand, away } = useGame();
  const done = game.phase === "showdown";
  const r = done ? game.lastResults : undefined;
  const meIdx = game.playersPublic.findIndex((p) => p.slug === mySlug);
  const me = game.playersPublic[meIdx];
  const myTurn = !done && game.turnIdx === meIdx;
  const active = game.turnIdx !== undefined ? game.playersPublic[game.turnIdx] : null;
  const board = useMemo(() => game.community ?? [], [game.community]);
  const allowed = myTurn ? allowedActions(game) : [];
  const toCall = (game.currentBet ?? 0) - (me?.bet ?? 0);
  const deadline = game.timer?.deadlineAt ?? null;
  const myLabel =
    myHand && myHand.length === 2
      ? board.length >= 3
        ? handLabel5(board.length + 2 >= 5 ? bestOf7([...myHand, ...board]) : evaluate5([...myHand, ...board]))
        : myHand[0].value === myHand[1].value
          ? "Paire servie"
          : "Carte haute"
      : null;

  // Gorgées bues pendant cette main (couchés, perdants de l'abattage).
  const drunk = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of game.drinks ?? []) m.set(d.slug, (m.get(d.slug) ?? 0) + d.n);
    return m;
  }, [game.drinks]);

  // Les 5 cartes du (premier) gagnant, mises en avant à l'abattage.
  const winners = useMemo(() => new Set(r?.winners ?? []), [r]);
  const highlight = useMemo(() => {
    if (!r || r.soleSurvivor || !r.winners?.length) return null;
    const h = r.hands?.[r.winners[0]];
    if (!h || board.length < 5) return null;
    return new Set(bestHand([...h, ...board]).cards.map(toCode));
  }, [r, board]);
  const winnerLine = r && !r.soleSurvivor && r.winners?.length ? { label: r.handLabels?.[r.winners[0]] ?? "", split: r.winners.length > 1 } : null;

  // Joueurs servis, dans l'ordre de la table, ma place en bas.
  const dealt = [...(game.dealTargets ?? game.playersPublic.map((_, i) => i))].sort((a, b) => a - b);
  const myPos = dealt.indexOf(meIdx);
  const seated = myPos >= 0;
  const rotated = dealt.map((_, k) => dealt[(Math.max(0, myPos) + k) % dealt.length]);
  const seats: NeonSeat[] = rotated.map((i) => {
    const p = game.playersPublic[i];
    const shown = p.slug !== mySlug ? r?.hands?.[p.name] : undefined;
    const won = done && winners.has(p.name);
    const lost = drunk.get(p.slug) ?? 0;
    return {
      slug: p.slug,
      name: cleanName(p.name),
      bot: isBotName(p.name),
      line2: `${p.gulpsTotal} 🍺`,
      out: p.folded,
      holding: !p.folded && !shown,
      faces: !p.folded && shown ? shown.map(toCode) : undefined,
      won,
      bubble: won
        ? { tone: "win", text: "GAGNE" }
        : p.folded
          ? { tone: "fold", text: `COUCHÉ · ${p.foldCost ?? lost} 🍺` }
          : done && lost > 0
            ? { tone: "lose", text: `BOIT ${lost} 🍺` }
            : null,
      deadline: !done && game.turnIdx === i ? deadline : null,
      marks: [],
      away: away.includes(p.slug),
      bet: !done && p.bet > 0 ? { amount: p.bet, kind: "gulps" } : null,
    };
  });

  const actions = done ? (
    <NextRoundActions />
  ) : myTurn ? (
    allowed.includes("check") ? (
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => act({ type: "bet", action: "check" })}>
          Checker
        </Button>
        <Button size="sm" disabled={busy} onClick={() => act({ type: "bet", action: "bet" })}>
          Miser 1 🍺
        </Button>
      </div>
    ) : (
      <div className="grid grid-cols-3 gap-2">
        <Button variant="danger" size="sm" className="px-1!" disabled={busy} onClick={() => act({ type: "bet", action: "fold" })}>
          <span className="flex flex-col items-center leading-none">
            Se coucher<span className="mt-0.5 text-[0.62rem] font-semibold opacity-80">tu bois {foldCost(game, meIdx)} 🍺</span>
          </span>
        </Button>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => act({ type: "bet", action: "call" })}>
          Suivre +{toCall}
        </Button>
        <Button size="sm" disabled={busy || !allowed.includes("raise")} onClick={() => act({ type: "bet", action: "raise" })}>
          Relancer +{toCall + 1}
        </Button>
      </div>
    )
  ) : (
    <Waiting>{me?.folded ? "Tu t'es couché." : active ? `${cleanName(active.name)} parle…` : "…"}</Waiting>
  );

  return (
    <Screen actions={actions}>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <Kicker>{done ? "Abattage" : STREET_LABEL[game.street ?? "preflop"]}</Kicker>
          <div className="font-display text-xl leading-tight font-extrabold">
            {done ? `Pot ${r?.potAtEnd ?? game.pot} 🍺` : game.currentBet ? `Mise à suivre : ${game.currentBet} 🍺` : "Personne n'a misé"}
          </div>
        </div>
        {!done && <div className="shrink-0 text-right text-[0.7rem] text-mute">Mises de 1 · {POKER_MAX_BET - 1} relances max</div>}
      </div>

      <NeonPokerTable
        seats={seats}
        me={
          seated && me
            ? {
                ...seats[0],
                hole: myHand?.map(toCode),
                label: me.folded ? `Couché · tu as bu ${me.foldCost ?? 0} 🍺` : myLabel,
                folded: me.folded,
                deadline: myTurn ? deadline : null,
              }
            : null
        }
        board={board.map(toCode)}
        highlight={highlight}
        pot={done ? null : { amount: game.pot ?? 0, kind: "gulps" }}
        winnerLine={winnerLine}
        deadlineTotal={POKER_TURN_MS}
        spectator={<p className="mt-8 text-center text-xs text-mute">Tu regardes cette main.</p>}
      />

      {done && r && (
        <div className="mt-4">
          <Verdict tone="neutral">
            {r.soleSurvivor
              ? `${cleanName(r.winners![0])} remporte le pot, tout le monde s'est couché`
              : `${r.winners!.map(cleanName).join(" & ")} gagne${r.winners!.length > 1 ? "nt" : ""}`}
          </Verdict>
        </div>
      )}
      {done && (
        <div className="mt-4">
          <GulpList
            rows={sumGulps(
              game,
              (game.drinks ?? []).map((d) => ({ slug: d.slug, gulps: d.n })),
            )}
          />
        </div>
      )}
    </Screen>
  );
}
