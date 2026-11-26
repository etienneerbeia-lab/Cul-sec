import { basicStrategyMove } from "../blackjack/rules";
import { fromCode } from "../casino/cards";
import { stackOf } from "../chips/ledger";
import { fail, notNow } from "../errors";
import type { Action, GameModule } from "../game/module";
import type { GameState } from "../game/types";
import { BJT_RULES as R } from "../bjtable/config";
import {
  activePlayers,
  admitPlayers,
  afterRoundEnd,
  bjtOf,
  closeBetting,
  closeInsurance,
  currentSeat,
  decideInsurance,
  legalFor,
  placeBet,
  points,
  total,
  playMove,
  replayMs,
  startBjTable,
  type BjtMove,
} from "../bjtable/engine";
import { botStyle } from "../poker/bot";

const MOVES: BjtMove[] = ["hit", "stand", "double", "split"];

// Temps de rejeu des cartes encore en train d'apparaître côté client.
const pendingReplay = (g: GameState) => {
  const t = bjtOf(g);
  return replayMs(t.log.slice(t.replayFrom));
};

// Mise d'un bot : quelques pourcents de son solde, en jetons de 5.
export function botBet(g: GameState, slug: string): number {
  const stack = stackOf(g.chips!, slug);
  const { aggro } = botStyle(slug);
  const raw = stack * (0.03 + 0.05 * aggro * Math.random());
  const n = Math.max(R.minBet, Math.round(raw / 5) * 5);
  return Math.min(stack, n);
}

function botMove(g: GameState, slug: string): BjtMove {
  const t = bjtOf(g);
  const legal = legalFor(g, slug)!;
  const seat = currentSeat(t)!;
  const hand = seat.hands[seat.active];
  const m = basicStrategyMove(hand.cards.map(fromCode), fromCode(t.dealer.cards[0]));
  // Coup refusé par les règles (split au-delà de 4 mains, double sans
  // fonds...) : on joue le total tel quel.
  if ((m === "split" && !legal.canSplit) || (m === "double" && !legal.canDouble)) {
    const v = total(hand.cards);
    return v >= 17 || (v >= 13 && points(t.dealer.cards[0]) <= 6) ? "stand" : "hit";
  }
  return m;
}

// Blackjack Table : toute la table contre le croupier (univers Chill).
export const bjTableModule: GameModule = {
  id: "bjtable",
  minPlayers: 1,
  start: (g) => startBjTable(g),
  act(g, slug, a: Action) {
    if (g.phase !== "bjtable" || !g.bjt) notNow();
    if (a.type !== "bjt") fail(400, "Action inconnue.");
    if (a.op === "bet") placeBet(g, slug, a.amount as number);
    else if (a.op === "insurance") decideInsurance(g, slug, a.take === true);
    else if (MOVES.includes(a.op as BjtMove)) playMove(g, slug, a.op as BjtMove);
    else fail(400, "Action inconnue.");
  },
  pending(g) {
    const t = g.bjt;
    if (!t || g.phase !== "bjtable") return null;
    if (t.stage === "betting") {
      const actors = activePlayers(g).filter((s) => !t.betDone.includes(s));
      return { key: `tb:${t.round}`, actors, timeoutMs: R.betMs };
    }
    if (t.stage === "insurance") {
      const actors = t.seats.filter((s) => s.insurance === undefined).map((s) => s.slug);
      return { key: `ti:${t.round}`, actors, timeoutMs: R.insuranceMs + pendingReplay(g) };
    }
    if (t.stage === "playerTurns") {
      const seat = currentSeat(t);
      if (!seat) return null;
      return { key: `tp:${t.round}:${t.actSeq}`, actors: [seat.slug], timeoutMs: R.actionMs + pendingReplay(g) };
    }
    // Fin de manche : le temps de voir le croupier jouer et les résultats.
    return { key: `te:${t.round}`, actors: [], timeoutMs: R.roundEndMs + pendingReplay(g) };
  },
  auto(g, slug, _ctx, { bot }) {
    const t = g.bjt;
    if (!t) return null;
    if (t.stage === "betting") return { type: "bjt", op: "bet", amount: bot ? botBet(g, slug) : 0 };
    // Les bots ne prennent jamais l'assurance (stratégie de base).
    if (t.stage === "insurance") return { type: "bjt", op: "insurance", take: false };
    if (t.stage === "playerTurns" && currentSeat(t)?.slug === slug) return { type: "bjt", op: bot ? botMove(g, slug) : "stand" };
    return null;
  },
  botDelay(g) {
    const extra = g.bjt ? pendingReplay(g) : 0;
    return g.bjt?.stage === "betting" ? [900, 3500] : [900 + extra, 2400 + extra];
  },
  onDeadline(g, ctx) {
    const t = g.bjt;
    if (!t) return;
    if (t.stage === "betting") closeBetting(g);
    else if (t.stage === "insurance") closeInsurance(g);
    else if (t.stage === "playerTurns") {
      const seat = currentSeat(t);
      if (seat) playMove(g, seat.slug, "stand");
    } else if (t.stage === "roundEnd") afterRoundEnd(g, ctx.now);
  },
  redact(g) {
    const t = g.bjt;
    if (!t) return g;
    return { ...g, bjt: { ...t, shoe: "", dealer: { ...t.dealer, hole: null } } } as GameState;
  },
  admit: (g, waiting) => admitPlayers(g, waiting),
};
