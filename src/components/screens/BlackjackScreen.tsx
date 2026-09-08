"use client";

import { useEffect, useMemo, useState } from "react";
import type { BlackjackAction } from "@/lib/api-client";
import { handValue, revealedCount } from "@/lib/blackjack/engine";
import type { BlackjackHand, GameState } from "@/lib/game/types";
import PlayingCard from "../PlayingCard";

const STATUS_LABEL: Record<string, string> = {
  playing: "En cours",
  stand: "Reste",
  bust: "Sauté",
  blackjack: "Blackjack !",
};

// How long each card sits before the next one in `dealLog` appears —
// applies uniformly to the initial deal, a hit, a double, a split, and
// every dealer draw, so the table always deals one card at a time in
// front of everyone instead of an action's whole result landing at once.
const CARD_REVEAL_MS = 500;

// One persistent screen for the whole round — betting, dealing, every
// player's turn, the dealer's turn, and the win distributions all happen
// here without ever cutting away, same idea as the duel and dice screens.
// Every hand is public to everyone at all times (per the mode's own
// design); the only thing ever hidden is the dealer's hole card, which the
// state API already strips until it's revealed.
export default function BlackjackScreen({
  game,
  mySlug,
  isHost,
  busy,
  onBet,
  onAct,
  onDistribute,
  onNextRound,
  onEndNight,
}: {
  game: GameState;
  mySlug: string;
  isHost: boolean;
  busy: boolean;
  onBet: (amount: number) => void;
  onAct: (action: BlackjackAction) => void;
  onDistribute: (targets: { slug: string; amount: number }[]) => void;
  onNextRound: () => void;
  onEndNight: () => void;
}) {
  const bj = game.blackjack!;
  const resolved = game.phase === "showdown";

  // Starts at whatever's already been dealt at mount time (a fresh page
  // load mid-round catches up to "now", it doesn't replay the round from
  // card one) then only ever advances one entry at a time, on a timer —
  // exactly the dice screen's roll-replay pattern, applied to individual
  // cards instead of whole rolls.
  const [shownCount, setShownCount] = useState(() => bj.dealLog.length);
  useEffect(() => {
    if (shownCount >= bj.dealLog.length) return;
    const t = setTimeout(() => setShownCount((n) => n + 1), CARD_REVEAL_MS);
    return () => clearTimeout(t);
  }, [shownCount, bj.dealLog.length]);

  const dealingCaughtUp = shownCount >= bj.dealLog.length;
  const visibleLog = useMemo(() => bj.dealLog.slice(0, shownCount), [bj.dealLog, shownCount]);

  const activePlayer = dealingCaughtUp && bj.stage === "playerTurns" ? bj.players[bj.turnPointer] : null;
  const activeHand = activePlayer ? activePlayer.hands[activePlayer.activeHandIdx] : null;
  const isMyTurn = activePlayer?.slug === mySlug;

  const dealerUpShown = revealedCount(visibleLog, "dealer-up") >= 1;
  const dealerHiddenShown = revealedCount(visibleLog, "dealer-hidden") >= 1;
  const dealerHitShown = revealedCount(visibleLog, "dealer-hit");
  const holeRevealed = bj.dealer.cards.length > 1;
  const dealerVisibleCards = [
    ...(dealerUpShown ? [bj.dealer.cards[0]] : []),
    ...(dealerHiddenShown && holeRevealed ? [bj.dealer.cards[1]] : []),
    ...bj.dealer.cards.slice(2, 2 + dealerHitShown),
  ];
  const dealerTotal = handValue(dealerVisibleCards);

  const pendingDistribution = dealingCaughtUp ? bj.distributionQueue[0] : undefined;
  const isMyDistribution = pendingDistribution?.slug === mySlug;

  // How many gorgées each player actually drinks this round: whatever they
  // lost on a hand (bust or a low total) plus whatever anyone else's win
  // distributed onto them — a winner who wasn't also a distribution target
  // ends up at 0 here even though they "handled" gorgées, which is exactly
  // the point (they gave them away, they didn't drink them).
  const totalsBySlug = useMemo(() => {
    const totals: Record<string, number> = {};
    game.playersPublic.forEach((p) => {
      totals[p.slug] = 0;
    });
    (game.lastResults?.blackjackResults ?? []).forEach((r) => {
      if (r.outcome === "lose") totals[r.slug] = (totals[r.slug] ?? 0) + r.amount;
      (r.distributedTo ?? []).forEach((d) => {
        totals[d.slug] = (totals[d.slug] ?? 0) + d.amount;
      });
    });
    return totals;
  }, [game.lastResults, game.playersPublic]);

  return (
    <>
      <div className="table-status">
        <div>
          <div className="label">Manche</div>
          <div className="value">
            {game.round}
            {game.totalRounds ? `/${game.totalRounds}` : ""}
          </div>
        </div>
        <div>
          <div className="label">Blackjack</div>
          <div className="value">🎰</div>
        </div>
      </div>

      <div className="bj-table">
        <div className="bj-dealer-zone">
          <div className="bj-dealer-label">Croupier</div>
          <div className="bj-cards-row">
            {dealerUpShown && (
              <div className="bj-card-in" key="up">
                <PlayingCard card={bj.dealer.cards[0]} small />
              </div>
            )}
            {dealerHiddenShown &&
              (holeRevealed ? (
                <div className="bj-card-in" key="hole">
                  <PlayingCard card={bj.dealer.cards[1]} small />
                </div>
              ) : (
                <div className="poker-card-slot bj-card-in" key="hole-back">
                  <div className="poker-card-flip">
                    <div className="poker-card-face back">
                      <div className="poker-card-back-mini" />
                    </div>
                  </div>
                </div>
              ))}
            {bj.dealer.cards.slice(2, 2 + dealerHitShown).map((c, i) => (
              <div className="bj-card-in" key={`hit-${i}`}>
                <PlayingCard card={c} small />
              </div>
            ))}
          </div>
          <div className="bj-dealer-total">
            {dealerVisibleCards.length > 0 &&
              `Total : ${dealerTotal}${dealerTotal > 21 ? " — Sauté !" : ""}`}
          </div>
        </div>

        <div className="bj-seats">
          {bj.players.map((p) => {
            const isActiveSeat = dealingCaughtUp && activePlayer?.slug === p.slug;
            const isDistribSeat = dealingCaughtUp && pendingDistribution?.slug === p.slug;
            return (
              <div className={`bj-seat${isActiveSeat || isDistribSeat ? " active" : ""}`} key={p.slug}>
                <div className="bj-seat-name">{p.name}</div>
                {p.hands.length === 0 ? (
                  <div className="bj-seat-waiting">
                    {bj.betResponded.includes(p.slug) ? `${bj.bets[p.slug]} 🥃` : "..."}
                  </div>
                ) : (
                  p.hands.map((hand) => {
                    const visibleCount = revealedCount(visibleLog, "player", p.slug, hand.id);
                    const cards = hand.cards.slice(0, visibleCount);
                    const isActiveHand = isActiveSeat && activePlayer!.hands[activePlayer!.activeHandIdx]?.id === hand.id;
                    return (
                      <div className={`bj-seat-hand${isActiveHand ? " active-hand" : ""}`} key={hand.id}>
                        <div className="bj-cards-row">
                          {cards.map((c, ci) => (
                            <div className="bj-card-in" key={ci}>
                              <PlayingCard card={c} small />
                            </div>
                          ))}
                        </div>
                        <div className="bj-seat-meta">
                          Total {handValue(cards)} · <strong>{hand.bet} 🥃</strong>
                          {dealingCaughtUp && bj.stage !== "betting" && ` · ${STATUS_LABEL[hand.status]}`}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!dealingCaughtUp ? (
        <div className="hint">Distribution en cours...</div>
      ) : bj.stage === "betting" ? (
        <BettingArea bj={bj} mySlug={mySlug} busy={busy} onBet={onBet} />
      ) : bj.stage === "playerTurns" && activePlayer && activeHand ? (
        isMyTurn ? (
          <ActionBar hand={activeHand} onAct={onAct} busy={busy} />
        ) : (
          <div className="hint">Au tour de {activePlayer.name}...</div>
        )
      ) : bj.stage === "distributing" && pendingDistribution ? (
        isMyDistribution ? (
          <DistributeForm
            players={game.playersPublic}
            mySlug={mySlug}
            amount={pendingDistribution.amount}
            onConfirm={onDistribute}
            busy={busy}
          />
        ) : (
          <div className="hint">
            {pendingDistribution.name} distribue {pendingDistribution.amount} 🥃...
          </div>
        )
      ) : null}

      {resolved && dealingCaughtUp && (
        <>
          <h3>Total des gorgées</h3>
          <div className="players-list">
            {game.playersPublic.map((p) => (
              <div className="player-chip" key={p.slug}>
                <span className="pname">{p.name}</span>
                <span className="pmeta">
                  <strong>{totalsBySlug[p.slug] ?? 0} 🥃</strong>
                </span>
              </div>
            ))}
          </div>

          <h3>Résultats</h3>
          <div className="players-list">
            {(game.lastResults?.blackjackResults ?? []).map((r) => {
              const multiHand = bj.players.find((p) => p.slug === r.slug)!.hands.length > 1;
              const plural = r.amount > 1 ? "s" : "";
              return (
                <div className="player-chip" key={`${r.slug}-${r.handIdx}`}>
                  <span className="pname">
                    {r.name}
                    {multiHand ? ` — main ${r.handIdx + 1}` : ""}
                  </span>
                  <span className="pmeta">
                    {r.outcome === "push"
                      ? `${r.name} : égalité, personne ne boit`
                      : r.outcome === "lose"
                        ? `${r.name} boit ${r.amount} gorgée${plural}`
                        : r.distributedTo && r.distributedTo.length > 0
                          ? `${r.name} distribue ${r.amount} gorgée${plural} à ` +
                            (r.distributedTo.length === 1
                              ? r.distributedTo[0].name
                              : r.distributedTo.map((d) => `${d.name} (${d.amount})`).join(", "))
                          : `${r.name} distribue ${r.amount} gorgée${plural}...`}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="spacer" />
          {isHost ? (
            <>
              <button className="btn-primary" disabled={busy} onClick={onNextRound}>
                Manche suivante
              </button>
              <button className="btn-ghost" style={{ marginTop: 12 }} disabled={busy} onClick={onEndNight}>
                Terminer la soirée
              </button>
            </>
          ) : (
            <div className="hint">En attente de l&apos;hôte pour continuer...</div>
          )}
        </>
      )}
    </>
  );
}

function BettingArea({
  bj,
  mySlug,
  busy,
  onBet,
}: {
  bj: NonNullable<GameState["blackjack"]>;
  mySlug: string;
  busy: boolean;
  onBet: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(1);
  const already = bj.betResponded.includes(mySlug);
  const waitingOn = bj.players.filter((p) => !bj.betResponded.includes(p.slug)).map((p) => p.name);

  if (already) {
    return (
      <div className="hint">
        {waitingOn.length > 0 ? `En attente de ${waitingOn.join(", ")}...` : "Distribution des cartes..."}
      </div>
    );
  }

  return (
    <div style={{ margin: "14px 0" }}>
      <div className="hint">Choisis ta mise (1 à 5 gorgées).</div>
      <div className="stepper" style={{ justifyContent: "center", margin: "10px 0" }}>
        <button
          className="btn-ghost"
          style={{ padding: "6px 12px" }}
          onClick={() => setAmount((n) => Math.max(1, n - 1))}
          disabled={amount <= 1}
        >
          −
        </button>
        <span className="stepper-value">{amount}</span>
        <button
          className="btn-ghost"
          style={{ padding: "6px 12px" }}
          onClick={() => setAmount((n) => Math.min(5, n + 1))}
          disabled={amount >= 5}
        >
          +
        </button>
      </div>
      <button className="btn-primary" disabled={busy} onClick={() => onBet(amount)}>
        Miser {amount} 🥃
      </button>
    </div>
  );
}

function ActionBar({
  hand,
  onAct,
  busy,
}: {
  hand: BlackjackHand;
  onAct: (action: BlackjackAction) => void;
  busy: boolean;
}) {
  const canDouble = hand.cards.length === 2;
  const canSplit = hand.cards.length === 2 && hand.cards[0].value === hand.cards[1].value;
  return (
    <div className="bet-actions">
      <button className="btn-ghost" disabled={busy} onClick={() => onAct("stand")}>
        Rester
      </button>
      <button className="btn-primary" disabled={busy} onClick={() => onAct("hit")}>
        Tirer
      </button>
      {canDouble && (
        <button className="btn-ghost" disabled={busy} onClick={() => onAct("double")}>
          Doubler
        </button>
      )}
      {canSplit && (
        <button className="btn-ghost" disabled={busy} onClick={() => onAct("split")}>
          Split
        </button>
      )}
    </div>
  );
}

function DistributeForm({
  players,
  mySlug,
  amount,
  onConfirm,
  busy,
}: {
  players: GameState["playersPublic"];
  mySlug: string;
  amount: number;
  onConfirm: (targets: { slug: string; amount: number }[]) => void;
  busy: boolean;
}) {
  const others = useMemo(() => players.filter((p) => p.slug !== mySlug), [players, mySlug]);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const total = Object.values(amounts).reduce((s, n) => s + n, 0);

  function bump(slug: string, delta: number) {
    setAmounts((prev) => {
      const next = Math.max(0, (prev[slug] ?? 0) + delta);
      if (delta > 0 && total >= amount) return prev;
      return { ...prev, [slug]: next };
    });
  }

  return (
    <div>
      <div className="hint">
        Distribue {amount} gorgée{amount > 1 ? "s" : ""} comme tu veux.
      </div>
      <div className="players-list">
        {others.map((p) => {
          const a = amounts[p.slug] ?? 0;
          return (
            <div className="player-chip" key={p.slug}>
              <span className="pname">{p.name}</span>
              <div className="stepper">
                <button
                  className="btn-ghost"
                  style={{ padding: "6px 12px" }}
                  onClick={() => bump(p.slug, -1)}
                  disabled={a === 0}
                >
                  −
                </button>
                <span className="stepper-value">{a}</span>
                <button
                  className="btn-ghost"
                  style={{ padding: "6px 12px" }}
                  onClick={() => bump(p.slug, 1)}
                  disabled={total >= amount}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="hint">
        Distribué : {total}/{amount}
      </div>
      <button
        className="btn-primary"
        disabled={busy || total !== amount}
        onClick={() =>
          onConfirm(
            Object.entries(amounts)
              .filter(([, amt]) => amt > 0)
              .map(([slug, amt]) => ({ slug, amount: amt }))
          )
        }
      >
        Confirmer
      </button>
    </div>
  );
}
