import { roundTypeById } from "../game/roundTypes";
import { fail, notNow } from "../errors";
import { type GameModule, pick, rand } from "../game/module";
import {
  applyBlackjackBet,
  applyBlackjackDistribution,
  blackjackDouble,
  blackjackHit,
  blackjackSplit,
  blackjackStand,
  dealEventDelay,
  startBlackjackRound,
} from "../blackjack/engine";
import { basicStrategyMove } from "../blackjack/rules";
import { applyArcheryShot, archeryActiveSlug, startArcheryRound } from "../archery/engine";
import { ARCHERY_CENTER, ARCHERY_LAUNCH_POINT, ARCHERY_MAX_DEVIATION, WIND_VECTORS } from "../archery/physics";
import type { ArcheryPoint, GameState } from "../game/types";

function isPoint(v: unknown): v is ArcheryPoint {
  const p = v as ArcheryPoint;
  return !!p && typeof p === "object" && Number.isFinite(p.x) && Number.isFinite(p.y);
}

// ---------- Blackjack ----------
// Stratégie de base simplifiée (ce que ferait un joueur correct), commune
// avec le Blackjack Table (lib/blackjack/rules.ts).
function blackjackBotMove(g: GameState): string {
  const bj = g.blackjack!;
  const player = bj.players[bj.turnPointer];
  const hand = player.hands[player.activeHandIdx];
  return basicStrategyMove(hand.cards, bj.dealer.cards[0]);
}

const BJ_ACTIONS = { hit: blackjackHit, stand: blackjackStand, double: blackjackDouble, split: blackjackSplit };

export const blackjackModule: GameModule = {
  id: "blackjack",
  minPlayers: roundTypeById("blackjack").minPlayers,
  start: (g) => startBlackjackRound(g),
  act(g, slug, a) {
    const bj = g.blackjack;
    if (g.phase !== "blackjack" || !bj) notNow();
    if (a.type === "bjBet") {
      if (bj.stage !== "betting") notNow();
      if (!bj.players.some((p) => p.slug === slug)) fail(403, "Tu ne participes pas à cette manche.");
      if (bj.betResponded.includes(slug)) fail(409, "Tu as déjà misé.");
      const amount = a.amount as number;
      if (!Number.isInteger(amount) || amount < 1 || amount > 5) fail(400, "Mise invalide (1 à 5 gorgées).");
      applyBlackjackBet(g, slug, amount);
    } else if (a.type === "bjAct") {
      if (bj.stage !== "playerTurns") notNow();
      const player = bj.players[bj.turnPointer];
      if (player.slug !== slug) fail(403, "Ce n'est pas ton tour.");
      const hand = player.hands[player.activeHandIdx];
      if (!hand || hand.status !== "playing") fail(409, "Cette main n'est plus jouable.");
      const name = a.action as keyof typeof BJ_ACTIONS;
      if (!(name in BJ_ACTIONS)) fail(400, "Action inconnue.");
      if (name === "double" && hand.cards.length !== 2) fail(400, "Doubler n'est possible qu'en début de main.");
      if (name === "split" && !(hand.cards.length === 2 && hand.cards[0].value === hand.cards[1].value))
        fail(400, "Split impossible : les deux cartes doivent être identiques.");
      BJ_ACTIONS[name](g);
    } else if (a.type === "bjDistribute") {
      if (bj.stage !== "distributing") notNow();
      const pending = bj.distributionQueue[0];
      if (!pending || pending.slug !== slug) fail(403, "Ce n'est pas ton tour de distribuer.");
      const target = a.targetSlug;
      if (typeof target !== "string" || target === slug || !g.playersPublic.some((p) => p.slug === target))
        fail(400, "Choisis qui boit.");
      applyBlackjackDistribution(g, target);
    } else fail(400, "Action inconnue.");
  },
  pending(g) {
    const bj = g.blackjack;
    if (g.phase !== "blackjack" || !bj) return null;
    if (bj.stage === "betting") {
      const actors = bj.players.filter((p) => !bj.betResponded.includes(p.slug)).map((p) => p.slug);
      return { key: `bj:bet:${g.round}`, actors, timeoutMs: 25000 };
    }
    if (bj.stage === "playerTurns")
      return { key: `bj:${g.seq ?? 0}`, actors: [bj.players[bj.turnPointer].slug], timeoutMs: 30000 };
    if (bj.stage === "distributing")
      return {
        key: `bj:dist:${bj.distributionQueue.length}`,
        actors: [bj.distributionQueue[0].slug],
        timeoutMs: 30000,
      };
    return null;
  },
  auto(g, slug, _ctx, { bot }) {
    const bj = g.blackjack!;
    if (bj.stage === "betting") return { type: "bjBet", amount: bot ? 1 + Math.floor(Math.random() * 3) : 1 };
    if (bj.stage === "playerTurns") return { type: "bjAct", action: bot ? blackjackBotMove(g) : "stand" };
    if (bj.stage === "distributing")
      return { type: "bjDistribute", targetSlug: pick(g.playersPublic.filter((p) => p.slug !== slug)).slug };
    return null;
  },
  botDelay(g) {
    const bj = g.blackjack!;
    // Laisse le temps aux cartes de la distribution initiale d'apparaître
    // côté client avant que le premier bot ne joue…
    const firstTurn = bj.stage === "playerTurns" && bj.players.every((p) => p.hands.every((h) => h.cards.length <= 2));
    let extra = firstTurn ? bj.dealLog.reduce((t, e) => t + dealEventDelay(e), 0) : 0;
    // …et à la banque de finir de jouer avant la première distribution.
    if (bj.stage === "distributing" && !bj.results?.some((r) => r.distributedTo)) {
      const i = bj.dealLog.findIndex((e) => e.target === "dealer-reveal");
      if (i >= 0) extra = bj.dealLog.slice(i).reduce((t, e) => t + dealEventDelay(e), 0);
    }
    return [1500 + extra, 3200 + extra];
  },
};

// ---------- Tir à l'arc ----------
export const archeryModule: GameModule = {
  id: "archery",
  minPlayers: roundTypeById("archery").minPlayers,
  start: (g) => startArcheryRound(g),
  act(g, slug, a) {
    if (g.phase !== "archery" || !g.archery || a.type !== "archeryShot") notNow();
    if (archeryActiveSlug(g) !== slug) fail(403, "Ce n'est pas ton tour.");
    if (!isPoint(a.aim) || typeof a.power !== "number" || !Number.isFinite(a.power)) fail(400, "Tir invalide.");
    applyArcheryShot(g, slug, a.aim as ArcheryPoint, a.power as number);
  },
  pending(g) {
    if (g.phase !== "archery" || !g.archery) return null;
    return { key: `arch:${g.archery.shots.length}`, actors: [archeryActiveSlug(g)], timeoutMs: 40000 };
  },
  auto(g, _slug, _ctx, { bot }) {
    const wind = g.archery!.wind;
    if (!bot) return { type: "archeryShot", aim: ARCHERY_CENTER, power: 0.5 };
    // Compense le vent et la puissance, avec une erreur d'appréciation
    // réaliste : impact = départ + (visée - départ)·p + vent·p.
    const dir = WIND_VECTORS[wind.direction];
    const power = rand(0.88, 1);
    const drift = wind.intensity * ARCHERY_MAX_DEVIATION * power * rand(0.55, 1.4);
    const target = { x: ARCHERY_CENTER.x + rand(-38, 38) - dir.x * drift, y: ARCHERY_CENTER.y + rand(-38, 38) - dir.y * drift };
    const aim = {
      x: ARCHERY_LAUNCH_POINT.x + (target.x - ARCHERY_LAUNCH_POINT.x) / power,
      y: ARCHERY_LAUNCH_POINT.y + (target.y - ARCHERY_LAUNCH_POINT.y) / power,
    };
    return { type: "archeryShot", aim, power };
  },
  botDelay: (g) => (g.archery!.shots.length ? [3800, 5500] : [1500, 3000]),
};
