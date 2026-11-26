import { cardValue, fromCodes, type CardCode } from "../casino/cards";
import { stackOf, totalCommitted } from "../chips/ledger";
import { bestHand } from "../game/evaluate";
import type { GameState } from "../game/types";
import { legalFor } from "./engine";
import type { PokerMove } from "./types";

export interface BotDecision {
  move: PokerMove;
  to?: number;
}

// Style propre à chaque bot (stable pour un slug) : plus ou moins serré,
// plus ou moins agressif. Les tables de bots ne jouent pas toutes pareil.
export function botStyle(slug: string): { tight: number; aggro: number } {
  let h = 2166136261;
  for (const ch of slug) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const u = ((h >>> 0) % 1000) / 1000;
  const v = ((h >>> 10) % 1000) / 1000;
  return { tight: 0.8 + u * 0.4, aggro: 0.7 + v * 0.6 };
}

// Score de Chen (force d'une main de départ, environ -1 à 20).
export function chenScore(hole: CardCode[]): number {
  const [a, b] = hole.map(cardValue).sort((x, y) => y - x);
  const base = (v: number) => (v === 14 ? 10 : v === 13 ? 8 : v === 12 ? 7 : v === 11 ? 6 : v / 2);
  let score = base(a);
  if (a === b) return Math.max(5, score * 2);
  if (hole[0][1] === hole[1][1]) score += 2;
  const gap = a - b - 1;
  score -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && a < 12) score += 1;
  return Math.ceil(score);
}

// Force postflop grossière (0 à 1) : main faite + tirages.
function postflopStrength(hole: CardCode[], board: CardCode[]): number {
  const all = [...hole, ...board];
  const bh = bestHand(fromCodes(all));
  const r = bh.eval.rank;
  const boardEval = bestHand(fromCodes(board)).eval;
  // La main vient-elle (au moins en partie) de nos cartes ?
  const usesHole = r > boardEval.rank || (r === boardEval.rank && bh.eval.tie[0] !== boardEval.tie[0]);
  let s: number;
  if (r >= 4) s = usesHole ? 0.92 : 0.5;
  else if (r === 3) s = usesHole ? 0.85 : 0.4;
  else if (r === 2) s = usesHole ? 0.72 : 0.35;
  else if (r === 1) {
    const pair = bh.eval.tie[0];
    const top = Math.max(...board.map(cardValue));
    if (!usesHole) s = 0.25;
    else if (pair >= top) s = 0.6 + (pair - 2) / 60;
    else s = 0.4;
  } else s = 0.12 + Math.max(...hole.map(cardValue)) / 140;
  // Tirages (seulement avant la river).
  if (board.length < 5 && r < 4) {
    const suits = new Map<string, number>();
    all.forEach((c) => suits.set(c[1], (suits.get(c[1]) ?? 0) + 1));
    if ([...suits.values()].some((n) => n === 4)) s = Math.max(s, 0.45);
    const vals = [...new Set(all.map(cardValue))].sort((x, y) => x - y);
    for (let i = 0; i + 3 < vals.length; i++) if (vals[i + 3] - vals[i] === 3) s = Math.max(s, 0.42);
  }
  return s;
}

const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);

function raiseTo(g: GameState, slug: string, target: number): BotDecision {
  const legal = legalFor(g, slug);
  if (!legal.canRaise) return legal.canCheck ? { move: "check" } : { move: "call" };
  const bb = g.poker!.blinds[1];
  let to = Math.max(legal.minRaiseTo, roundTo(target, Math.max(1, Math.floor(bb / 2))));
  // Si la relance engage presque tout le tapis, autant faire tapis.
  if (to > legal.maxRaiseTo * 0.7) to = legal.maxRaiseTo;
  to = Math.min(to, legal.maxRaiseTo);
  return { move: "raise", to };
}

export function pokerBotMove(g: GameState, slug: string): BotDecision {
  const p = g.poker!;
  const legal = legalFor(g, slug);
  const style = botStyle(slug);
  const stack = stackOf(g.chips!, slug);
  const bb = p.blinds[1];
  const pot = totalCommitted(g.chips!);
  const toCall = legal.callAmount;
  const passive = (): BotDecision => (legal.canCheck ? { move: "check" } : { move: "fold" });
  const call = (): BotDecision => (legal.canCheck ? { move: "check" } : { move: "call" });
  const hole = p.hole[slug];
  const bbs = (stack + (p.streetBet[slug] ?? 0)) / bb;

  if (p.board.length === 0) {
    const chen = chenScore(hole) / style.tight + (Math.random() - 0.5) * 2;
    // Tapis court : tapis ou couché.
    if (bbs <= 10) {
      const need = 7 - (10 - bbs) * 0.3 - (p.inHand.length <= 3 ? 1.5 : 0);
      if (chen >= need) return legal.canRaise ? { move: "raise", to: legal.maxRaiseTo } : call();
      return passive();
    }
    const facingRaise = p.currentBet > bb;
    if (chen >= 11 * style.tight) return raiseTo(g, slug, facingRaise ? p.currentBet * 3 : bb * 3 * style.aggro);
    if (chen >= 8) {
      if (!facingRaise) return raiseTo(g, slug, bb * (2.2 + style.aggro));
      return toCall <= stack * 0.15 ? call() : passive();
    }
    if (chen >= 6) return toCall <= bb * 1.01 || toCall <= stack * 0.05 ? call() : passive();
    if (legal.canCheck) return { move: "check" };
    // Défense de la BB contre une petite relance, de temps en temps.
    if (toCall <= bb && Math.random() < 0.2) return call();
    return { move: "fold" };
  }

  const s = postflopStrength(hole, p.board) + (Math.random() - 0.5) * 0.12;
  const potOdds = toCall / Math.max(1, pot + toCall);
  if (s >= 0.8) {
    if (legal.canRaise && Math.random() < 0.75 * style.aggro) return raiseTo(g, slug, p.currentBet + pot * (0.6 + Math.random() * 0.4));
    return call();
  }
  if (s >= 0.55) {
    if (legal.canCheck && legal.canRaise && Math.random() < 0.55 * style.aggro) return raiseTo(g, slug, pot * 0.55);
    return potOdds < 0.4 ? call() : passive();
  }
  if (s >= 0.4) {
    if (legal.canCheck) return Math.random() < 0.15 * style.aggro && legal.canRaise ? raiseTo(g, slug, pot * 0.5) : { move: "check" };
    return potOdds < 0.28 ? call() : passive();
  }
  // Main faible : bluff occasionnel quand personne n'a misé.
  if (legal.canCheck) return legal.canRaise && Math.random() < 0.1 * style.aggro ? raiseTo(g, slug, pot * 0.5) : { move: "check" };
  return potOdds < 0.12 ? call() : { move: "fold" };
}
