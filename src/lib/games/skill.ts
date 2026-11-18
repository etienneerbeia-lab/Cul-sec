import { roundTypeById } from "../game/roundTypes";
import { fail, notNow } from "../errors";
import { type GameModule, rand } from "../game/module";
import {
  applyBlackjackBet,
  applyBlackjackDistribution,
  blackjackDouble,
  blackjackHit,
  blackjackSplit,
  blackjackStand,
  handValue,
  startBlackjackRound,
} from "../blackjack/engine";
import { applyGolfShot, golfActiveSlug, startGolfRound } from "../golf/engine";
import { golfCourseById } from "../golf/courses";
import { GOLF_MAX_SPEED, GOLF_STEP_DT, simulateShot } from "../golf/physics";
import { applyArcheryShot, archeryActiveSlug, startArcheryRound } from "../archery/engine";
import { ARCHERY_CENTER, ARCHERY_LAUNCH_POINT, ARCHERY_MAX_DEVIATION, WIND_VECTORS } from "../archery/physics";
import type { Card, GameState, GolfPoint } from "../game/types";
import { parseTargets, randomDistribution } from "./party";

function isPoint(v: unknown): v is GolfPoint {
  const p = v as GolfPoint;
  return !!p && typeof p === "object" && Number.isFinite(p.x) && Number.isFinite(p.y);
}

// ---------- Blackjack ----------
function cardPoints(c: Card): number {
  return c.value === 14 ? 11 : Math.min(10, c.value);
}

function isSoft(cards: Card[]): boolean {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardPoints(c);
    if (c.value === 14) aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return aces > 0;
}

// Stratégie de base simplifiée (ce que ferait un joueur correct).
function blackjackBotMove(g: GameState): string {
  const bj = g.blackjack!;
  const player = bj.players[bj.turnPointer];
  const hand = player.hands[player.activeHandIdx];
  const up = cardPoints(bj.dealer.cards[0]);
  const total = handValue(hand.cards);
  const two = hand.cards.length === 2;
  if (two && hand.cards[0].value === hand.cards[1].value) {
    const v = hand.cards[0].value;
    if (v === 14 || v === 8) return "split";
    if ([2, 3, 6, 7, 9].includes(v) && up <= 6) return "split";
  }
  if (two && (total === 11 || (total === 10 && up <= 9))) return "double";
  if (isSoft(hand.cards)) return total >= 19 || (total === 18 && up <= 8) ? "stand" : "hit";
  if (total >= 17) return "stand";
  if (total >= 13 && up <= 6) return "stand";
  if (total === 12 && up >= 4 && up <= 6) return "stand";
  return "hit";
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
      applyBlackjackDistribution(g, parseTargets(g, slug, a.targets, pending.amount));
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
      return { type: "bjDistribute", targets: randomDistribution(g, slug, bj.distributionQueue[0].amount) };
    return null;
  },
  botDelay(g) {
    const bj = g.blackjack!;
    // Laisse le temps aux cartes de la distribution initiale d'apparaître
    // (500 ms chacune côté client) avant que le premier bot ne joue.
    const firstTurn = bj.stage === "playerTurns" && bj.players.every((p) => p.hands.every((h) => h.cards.length <= 2));
    const extra = firstTurn ? bj.dealLog.length * 500 : 0;
    return [1500 + extra, 3200 + extra];
  },
};

// ---------- Mini-golf ----------
function golfShotFor(g: GameState, slug: string, velocity: GolfPoint) {
  const gl = g.golf!;
  const course = golfCourseById(gl.courseId);
  const otherBalls = g.playersPublic
    .filter((p) => p.slug !== slug && !gl.finishedSlugs.includes(p.slug))
    .map((p) => ({ slug: p.slug, pos: gl.positions[p.slug] ?? course.start }));
  return simulateShot(course, gl.positions[slug] ?? course.start, velocity, gl.destroyedObstacles, otherBalls);
}

function golfBotVelocity(g: GameState, slug: string, skilled: boolean): GolfPoint {
  const gl = g.golf!;
  const course = golfCourseById(gl.courseId);
  const pos = gl.positions[slug] ?? course.start;
  const base = Math.atan2(course.hole.y - pos.y, course.hole.x - pos.x);
  // Cherche parmi des coups au hasard celui qui finit le plus près du
  // trou, puis l'exécute avec une petite imprécision humaine.
  let best: { v: GolfPoint; d: number } | null = null;
  const tries = skilled ? 70 : 12;
  for (let i = 0; i < tries; i++) {
    const angle = i < tries / 2 ? base + rand(-0.5, 0.5) : rand(-Math.PI, Math.PI);
    const speed = rand(0.25, 1) * GOLF_MAX_SPEED;
    const v = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
    const r = golfShotFor(g, slug, v);
    const d = r.sunk ? 0 : r.wentInWater ? 1e6 : Math.hypot(r.finalPos.x - course.hole.x, r.finalPos.y - course.hole.y);
    if (!best || d < best.d) best = { v, d };
  }
  const v = best!.v;
  const a = Math.atan2(v.y, v.x) + rand(-0.05, 0.05);
  const s = Math.hypot(v.x, v.y) * rand(0.93, 1.07);
  return { x: Math.cos(a) * s, y: Math.sin(a) * s };
}

export const golfModule: GameModule = {
  id: "golf",
  minPlayers: roundTypeById("golf").minPlayers,
  start: (g) => startGolfRound(g),
  act(g, slug, a) {
    if (g.phase !== "golf" || !g.golf || a.type !== "golfShot") notNow();
    if (golfActiveSlug(g) !== slug) fail(403, "Ce n'est pas ton tour.");
    if (!isPoint(a.velocity)) fail(400, "Coup invalide.");
    const v = a.velocity as GolfPoint;
    const speed = Math.hypot(v.x, v.y);
    const k = speed > GOLF_MAX_SPEED ? GOLF_MAX_SPEED / speed : 1;
    const r = golfShotFor(g, slug, { x: v.x * k, y: v.y * k });
    applyGolfShot(g, slug, r.path, r.finalPos, r.sunk, r.wentInWater, r.destroyedObstacle, r.struckBalls);
  },
  pending(g) {
    if (g.phase !== "golf" || !g.golf) return null;
    return { key: `golf:${g.golf.shots.length}`, actors: [golfActiveSlug(g)], timeoutMs: 45000 };
  },
  auto: (g, slug, _ctx, { bot }) => ({ type: "golfShot", velocity: golfBotVelocity(g, slug, bot) }),
  botDelay(g) {
    // Attend la fin du replay du coup précédent chez les joueurs.
    const last = g.golf!.shots[g.golf!.shots.length - 1];
    const anim = last ? last.path.length * GOLF_STEP_DT * 1000 + 1500 : 0;
    return [anim + 1200, anim + 2800];
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
    applyArcheryShot(g, slug, a.aim as GolfPoint, a.power as number);
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
    const drift = wind.intensity * ARCHERY_MAX_DEVIATION * power * rand(0.7, 1.25);
    const target = { x: ARCHERY_CENTER.x + rand(-24, 24) - dir.x * drift, y: ARCHERY_CENTER.y + rand(-24, 24) - dir.y * drift };
    const aim = {
      x: ARCHERY_LAUNCH_POINT.x + (target.x - ARCHERY_LAUNCH_POINT.x) / power,
      y: ARCHERY_LAUNCH_POINT.y + (target.y - ARCHERY_LAUNCH_POINT.y) / power,
    };
    return { type: "archeryShot", aim, power };
  },
  botDelay: (g) => (g.archery!.shots.length ? [3800, 5500] : [1500, 3000]),
};
