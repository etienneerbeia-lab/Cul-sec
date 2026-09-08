"use client";

import { useMemo, useState } from "react";
import type { BlackjackAction } from "@/lib/api-client";
import { handValue } from "@/lib/blackjack/engine";
import type { BlackjackHand, GameState } from "@/lib/game/types";
import PlayingCard from "../PlayingCard";

const STATUS_LABEL: Record<string, string> = {
  playing: "En cours",
  stand: "Reste",
  bust: "Sauté",
  blackjack: "Blackjack !",
};

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

  const activePlayer = bj.stage === "playerTurns" ? bj.players[bj.turnPointer] : null;
  const activeHand = activePlayer ? activePlayer.hands[activePlayer.activeHandIdx] : null;
  const isMyTurn = activePlayer?.slug === mySlug;

  // The dealer's hole card is only ever present in `dealer.cards` (as a
  // second entry) once actually revealed — see the state route's redaction.
  const dealerRevealed = bj.dealer.cards.length > 1;
  const dealerTotal = handValue(bj.dealer.cards);

  const pendingDistribution = bj.distributionQueue[0];
  const isMyDistribution = pendingDistribution?.slug === mySlug;

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

      <div className="mode-label">Croupier</div>
      <div className="poker-community" style={{ marginTop: 0 }}>
        {bj.dealer.cards.map((c, i) => (
          <PlayingCard key={i} card={c} small />
        ))}
        {!dealerRevealed && (
          <div className="poker-card-slot">
            <div className="poker-card-flip">
              <div className="poker-card-face back">
                <div className="poker-card-back-mini" />
              </div>
            </div>
          </div>
        )}
      </div>
      {dealerRevealed && (
        <div className="hint" style={{ marginTop: -6 }}>
          Total : {dealerTotal}
          {dealerTotal > 21 ? " — Sauté !" : ""}
        </div>
      )}

      {bj.stage === "betting" && <BettingArea bj={bj} mySlug={mySlug} busy={busy} onBet={onBet} />}

      <h3>Joueurs</h3>
      <div className="players-list">
        {bj.players.flatMap((p) =>
          p.hands.map((hand, handIdx) => {
            const isTurn = activePlayer?.slug === p.slug && activePlayer.activeHandIdx === handIdx;
            const result = resolved
              ? game.lastResults?.blackjackResults?.find((r) => r.slug === p.slug && r.handIdx === handIdx)
              : undefined;
            return (
              <div className={`player-chip${isTurn ? " active-turn" : ""}`} key={`${p.slug}-${handIdx}`}>
                <div style={{ width: "100%" }}>
                  <div className="pname">
                    {p.name}
                    {p.hands.length > 1 ? ` — main ${handIdx + 1}` : ""}
                  </div>
                  <div className="community-row" style={{ margin: "6px 0" }}>
                    {hand.cards.map((c, i) => (
                      <PlayingCard key={i} card={c} small />
                    ))}
                  </div>
                  <div className="pmeta">
                    Total {handValue(hand.cards)} — Mise {hand.bet} 🥃
                    {bj.stage !== "betting" && ` — ${STATUS_LABEL[hand.status]}`}
                  </div>
                  {result && (
                    <div className="pmeta">
                      {result.outcome === "push"
                        ? "Égalité — personne ne boit"
                        : result.outcome === "lose"
                          ? `Boit ${result.amount} 🥃`
                          : result.distributedTo
                            ? `Fait distribuer ${result.amount} 🥃 : ` +
                              result.distributedTo.map((d) => `${d.name} (${d.amount})`).join(", ")
                            : `Distribue ${result.amount} 🥃...`}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {bj.stage === "playerTurns" &&
        activePlayer &&
        activeHand &&
        (isMyTurn ? (
          <ActionBar hand={activeHand} onAct={onAct} busy={busy} />
        ) : (
          <div className="hint">Au tour de {activePlayer.name}...</div>
        ))}

      {bj.stage === "distributing" &&
        pendingDistribution &&
        (isMyDistribution ? (
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
        ))}

      {resolved && (
        <>
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
