import { roundTypeById } from "../game/roundTypes";
import { fail, notNow } from "../errors";
import { drink, type GameModule, nameOf, slugsInOrder } from "../game/module";
import type { Dice421Roll, GameState } from "../game/types";

// 421 : chacun son tour, 3 dés et jusqu'à 3 lancers ; entre deux lancers
// on garde les dés qu'on veut. Classement : 421 > brelan d'as > brelans
// (666 … 222) > suites (654 … 321) > le reste, du plus fort au plus faible.
export const DICE421_MAX_THROWS = 3;

const sortDesc = (d: number[]) => [...d].sort((a, b) => b - a);

export function score421(dice: number[]): number {
  const [a, b, c] = sortDesc(dice);
  if (a === 4 && b === 2 && c === 1) return 1000;
  if (a === 1 && b === 1 && c === 1) return 900;
  if (a === b && b === c) return 800 + a;
  if (a === b + 1 && b === c + 1) return 700 + a;
  return a * 100 + b * 10 + c;
}

export function label421(dice: number[]): string {
  const s = score421(dice);
  const [a, b, c] = sortDesc(dice);
  if (s === 1000) return "421 !";
  if (s === 900) return "Brelan d'as";
  if (s >= 800) return `Brelan de ${a}`;
  if (s >= 700) return `Suite ${a}${b}${c}`;
  return `${a}-${b}-${c}`;
}

const d6 = () => 1 + Math.floor(Math.random() * 6);

function startTurn(g: GameState): void {
  const d = g.dice421!;
  const slug = d.order[d.pointer];
  d.current = { slug, name: nameOf(g, slug), dice: [0, 0, 0], throws: 0 };
}

function endTurn(g: GameState): void {
  const d = g.dice421!;
  d.finished = [...d.finished, d.current!];
  d.current = null;
  d.pointer += 1;
  if (d.pointer < d.order.length) return startTurn(g);
  resolve(g);
}

function resolve(g: GameState): void {
  const d = g.dice421!;
  const scores = d.finished.map((r) => ({ r, s: score421(r.dice) }));
  const min = Math.min(...scores.map((x) => x.s));
  const lowest = scores.filter((x) => x.s === min);
  if (lowest.length === scores.length && scores.length > 1) {
    scores.forEach((x) => drink(g, x.r.slug, 1, "Égalité générale"));
  } else if (scores.length > 1) {
    lowest.forEach((x) => drink(g, x.r.slug, 2, `Plus petit score (${label421(x.r.dice)})`));
  } else if (min < 700) {
    // En solo : pas d'adversaire, on boit si on ne fait pas mieux qu'un
    // simple « rien ».
    drink(g, scores[0].r.slug, 2, "Pas de combinaison");
  }
  scores
    .filter((x) => x.s === 1000)
    .forEach((x) => g.playersPublic.forEach((p) => p.slug !== x.r.slug && drink(g, p.slug, 1, `421 de ${x.r.name}`)));
  g.lastResults = { type: "dice" };
  g.phase = "showdown";
}

function roll(g: GameState, hold: boolean[]): void {
  const cur = g.dice421!.current!;
  cur.dice = cur.dice.map((v, i) => (cur.throws > 0 && hold[i] ? v : d6()));
  cur.held = cur.throws > 0 ? hold : [false, false, false];
  cur.throws += 1;
  if (cur.throws >= DICE421_MAX_THROWS || score421(cur.dice) === 1000) endTurn(g);
}

// Stratégie d'un joueur raisonnable : on garde ce qui rapproche du 421 ou
// d'un brelan, on s'arrête sur une belle combinaison.
function botMove(r: Dice421Roll): { type: string; hold?: boolean[] } {
  if (r.throws === 0) return { type: "d421Roll" };
  const s = score421(r.dice);
  if (s >= 700 || (s >= 640 && r.throws === 2)) return { type: "d421Stop" };
  const hold = [false, false, false];
  const need = [4, 2, 1];
  const used = new Set<number>();
  r.dice.forEach((v, i) => {
    if (need.includes(v) && !used.has(v)) {
      hold[i] = true;
      used.add(v);
    }
  });
  // Paire : on la garde plutôt (chasse au brelan) si elle vaut mieux.
  const counts = new Map<number, number[]>();
  r.dice.forEach((v, i) => counts.set(v, [...(counts.get(v) ?? []), i]));
  const pair = [...counts.entries()].find(([, idx]) => idx.length === 2);
  if (pair && used.size < 2) {
    hold.fill(false);
    pair[1].forEach((i) => (hold[i] = true));
  }
  if (!hold.some(Boolean)) hold[r.dice.indexOf(Math.max(...r.dice))] = true;
  return { type: "d421Roll", hold };
}

export const dice421Module: GameModule = {
  id: "dice",
  minPlayers: roundTypeById("dice").minPlayers,
  start(g) {
    g.dice421 = { order: slugsInOrder(g), pointer: 0, current: null, finished: [] };
    startTurn(g);
    g.phase = "dice421";
  },
  act(g, slug, a) {
    const d = g.dice421;
    if (g.phase !== "dice421" || !d?.current) notNow();
    if (d.current.slug !== slug) fail(403, "Ce n'est pas ton tour.");
    if (a.type === "d421Roll") {
      const hold = Array.isArray(a.hold) ? [0, 1, 2].map((i) => (a.hold as unknown[])[i] === true) : [false, false, false];
      if (d.current.throws > 0 && hold.every(Boolean)) fail(400, "Relâche au moins un dé pour relancer.");
      roll(g, hold);
    } else if (a.type === "d421Stop") {
      if (d.current.throws === 0) fail(400, "Lance d'abord les dés.");
      endTurn(g);
    } else fail(400, "Action inconnue.");
  },
  pending(g) {
    const d = g.dice421;
    if (g.phase !== "dice421" || !d?.current) return null;
    return { key: `d421:${g.seq ?? 0}`, actors: [d.current.slug], timeoutMs: 30000 };
  },
  auto(g, _slug, _ctx, { bot }) {
    const cur = g.dice421!.current!;
    if (!bot) return cur.throws === 0 ? { type: "d421Roll" } : { type: "d421Stop" };
    return botMove(cur);
  },
  // Le lancer s'anime ~1 s chez chaque joueur.
  botDelay: () => [1700, 2800],
};
