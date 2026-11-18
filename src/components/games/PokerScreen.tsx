"use client";

import { bestOf7, evaluate5, handLabel5 } from "@/lib/game/evaluate";
import { allowedActions, foldCost, POKER_MAX_BET } from "@/lib/games/poker";
import { useGame } from "../GameContext";
import { Button } from "../ui/Button";
import { PlayingCardV2 } from "../ui/Cards";
import { Gulps, TimerBar, Verdict, Waiting } from "../ui/Feedback";
import { Card, Kicker, Screen } from "../ui/Layout";
import { Avatar, cleanName, PlayerName } from "../ui/Players";
import { GulpList, NextRoundActions, sumGulps } from "../ui/Results";

const STREET_LABEL: Record<string, string> = {
  preflop: "Avant le flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
};

export default function PokerScreen() {
  const { game, mySlug, busy, act, myHand } = useGame();
  const done = game.phase === "showdown";
  const r = done ? game.lastResults : undefined;
  const meIdx = game.playersPublic.findIndex((p) => p.slug === mySlug);
  const me = game.playersPublic[meIdx];
  const myTurn = !done && game.turnIdx === meIdx;
  const active = game.turnIdx !== undefined ? game.playersPublic[game.turnIdx] : null;
  const board = game.community ?? [];
  const allowed = myTurn ? allowedActions(game) : [];
  const toCall = (game.currentBet ?? 0) - (me?.bet ?? 0);
  const myLabel =
    myHand && myHand.length === 2
      ? board.length >= 3
        ? handLabel5(board.length + 2 >= 5 ? bestOf7([...myHand, ...board]) : evaluate5([...myHand, ...board]))
        : myHand[0].value === myHand[1].value
          ? "Paire servie"
          : "Carte haute"
      : null;

  const actions = done ? (
    <NextRoundActions />
  ) : myTurn ? (
    allowed.includes("check") ? (
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" disabled={busy} onClick={() => act({ type: "bet", action: "check" })}>
          Checker
        </Button>
        <Button disabled={busy} onClick={() => act({ type: "bet", action: "bet" })}>
          Miser 1 🍺
        </Button>
      </div>
    ) : (
      <>
        <div className="grid grid-cols-2 gap-3">
          <Button disabled={busy} onClick={() => act({ type: "bet", action: "call" })}>
            Suivre +{toCall}
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !allowed.includes("raise")}
            onClick={() => act({ type: "bet", action: "raise" })}
          >
            Relancer +{toCall + 1}
          </Button>
        </div>
        <Button variant="danger" size="sm" disabled={busy} onClick={() => act({ type: "bet", action: "fold" })}>
          Me coucher · je bois {foldCost(game, meIdx)} 🍺
        </Button>
      </>
    )
  ) : (
    <Waiting>{me?.folded ? "Tu t'es couché." : active ? `${cleanName(active.name)} parle…` : "…"}</Waiting>
  );

  return (
    <Screen actions={actions}>
      <div className="flex items-end justify-between">
        <div>
          <Kicker>{done ? "Abattage" : STREET_LABEL[game.street ?? "preflop"]}</Kicker>
          <div className="font-display text-lg font-bold text-ink-2">
            {done ? "" : game.currentBet ? `Mise à suivre : ${game.currentBet}` : "Personne n'a misé"}
          </div>
        </div>
        <div className="text-right">
          <Kicker>Pot</Kicker>
          <div key={game.pot} className="animate-pop font-display text-3xl font-extrabold text-beer">
            {game.pot} 🍺
          </div>
        </div>
      </div>
      {!done && <div className="mt-2"><TimerBar deadlineAt={game.timer?.deadlineAt} totalMs={40000} /></div>}

      <div className="relative mt-4 flex justify-center gap-1.5 rounded-[26px] border border-white/10 bg-[radial-gradient(ellipse_at_center,#1f6b4f_0%,#123f31_70%)] px-2 py-5 shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]">
        {[0, 1, 2, 3, 4].map((i) => (
          <PlayingCardV2 key={i} card={board[i]} faceDown={!board[i]} size="xs" />
        ))}
      </div>

      {done && r && (
        <div className="mt-4">
          <Verdict tone="neutral">
            {r.soleSurvivor
              ? `${cleanName(r.winners![0])} remporte le pot, tout le monde s'est couché`
              : `${r.winners!.map(cleanName).join(" & ")} gagne${r.winners!.length > 1 ? "nt" : ""}`}
          </Verdict>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {game.dealTargets?.map((i) => {
          const p = game.playersPublic[i];
          const isActive = !done && game.turnIdx === i;
          const shown = done ? r?.hands?.[p.name] : undefined;
          return (
            <div
              key={p.slug}
              className={`cs-row min-h-0! flex-col items-stretch! gap-1.5! p-2.5! ${p.folded ? "opacity-45" : ""}`}
              data-active={isActive}
            >
              <div className="flex items-center gap-2">
                <Avatar name={p.name} slug={p.slug} size={30} />
                <div className="min-w-0 flex-1">
                  <PlayerName name={p.name} me={p.slug === mySlug} />
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                {shown ? (
                  <span className="flex gap-1">
                    {shown.map((c, k) => (
                      <PlayingCardV2 key={k} card={c} size="xs" />
                    ))}
                  </span>
                ) : (
                  <span className="text-mute">
                    {p.folded ? `Couché` : p.bet > 0 ? `Mise ${p.bet}` : isActive ? "Parle…" : "—"}
                  </span>
                )}
                {done && r?.handLabels?.[p.name] && <span className="text-xs font-bold text-ink-2">{r.handLabels[p.name]}</span>}
                {p.folded && <Gulps n={p.foldCost ?? 0} />}
              </div>
            </div>
          );
        })}
      </div>

      {!done && myHand && (
        <Card className="mt-4 flex items-center gap-4">
          <div className="flex -space-x-6">
            {myHand.map((c, k) => (
              <PlayingCardV2 key={k} card={c} size="md" className={k === 1 ? "rotate-6" : "-rotate-6"} />
            ))}
          </div>
          <div>
            <Kicker>Ta main</Kicker>
            <div className="font-display text-xl font-extrabold">{myLabel}</div>
            {!me?.folded && <div className="text-sm text-mute">Te coucher maintenant : {foldCost(game, meIdx)} 🍺</div>}
          </div>
        </Card>
      )}

      {!done && <p className="mt-3 text-center text-xs text-mute">Mises de 1, {POKER_MAX_BET - 1} relances max par tour.</p>}

      {done && (
        <div className="mt-4">
          <GulpList rows={sumGulps(game, (game.drinks ?? []).map((d) => ({ slug: d.slug, gulps: d.n })))} />
        </div>
      )}
    </Screen>
  );
}
