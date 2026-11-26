import { compareHand, type HandEval } from "../game/evaluate";

export interface Pot {
  amount: number;
  // Joueurs qui peuvent gagner ce pot (encore en main, mise suffisante).
  eligible: string[];
}

// Découpe ce que chacun a mis dans la main en pot principal + side pots.
// `contrib` : total engagé par joueur sur toute la main (couchés compris) ;
// `live` : joueurs encore en main. Chaque palier correspond au tapis d'un
// joueur à tapis ; l'argent d'un couché va dans les pots auxquels il a
// contribué, mais il ne peut en gagner aucun. Un palier sans aucun joueur
// éligible (argent mort au-dessus de toutes les mises encore en jeu) est
// versé au pot précédent.
export function buildPots(contrib: Record<string, number>, live: string[]): Pot[] {
  const liveSet = new Set(live);
  const levels = [...new Set(live.map((s) => contrib[s] ?? 0).filter((n) => n > 0))].sort((a, b) => a - b);
  const maxAll = Math.max(0, ...Object.values(contrib));
  if (levels.length === 0 || levels[levels.length - 1] < maxAll) levels.push(maxAll);
  const pots: Pot[] = [];
  let prev = 0;
  for (const level of levels) {
    if (level <= prev) continue;
    let amount = 0;
    for (const n of Object.values(contrib)) amount += Math.max(0, Math.min(n, level) - prev);
    const eligible = live.filter((s) => (contrib[s] ?? 0) >= level && liveSet.has(s));
    if (amount > 0) {
      if (eligible.length === 0 && pots.length > 0) pots[pots.length - 1].amount += amount;
      else if (eligible.length > 0) {
        // Deux paliers avec exactement les mêmes éligibles : un seul pot.
        const last = pots[pots.length - 1];
        if (last && last.eligible.length === eligible.length && last.eligible.every((s) => eligible.includes(s)))
          last.amount += amount;
        else pots.push({ amount, eligible });
      } else pots.push({ amount, eligible: live.slice() });
    }
    prev = level;
  }
  return pots;
}

export interface PotResult {
  amount: number;
  eligible: string[];
  winners: string[];
  // Part de chacun (le jeton indivisible va au premier gagnant après le bouton).
  shares: Record<string, number>;
}

// Attribue chaque pot à la meilleure main parmi ses éligibles ; partage en
// cas d'égalité. `order` : joueurs dans l'ordre de la table à partir de la
// gauche du bouton (reçoivent les jetons indivisibles en premier).
export function awardPots(
  pots: Pot[],
  evals: Record<string, HandEval>,
  order: string[]
): { results: PotResult[]; payouts: Record<string, number> } {
  const payouts: Record<string, number> = {};
  const results = pots.map((pot) => {
    let winners: string[] = [];
    for (const s of pot.eligible) {
      if (!evals[s]) continue;
      if (winners.length === 0) winners = [s];
      else {
        const c = compareHand(evals[s], evals[winners[0]]);
        if (c < 0) winners = [s];
        else if (c === 0) winners.push(s);
      }
    }
    // Personne d'évalué (ne devrait pas arriver) : premier éligible.
    if (winners.length === 0) winners = [pot.eligible[0]];
    const sorted = [...winners].sort((a, b) => idx(order, a) - idx(order, b));
    const base = Math.floor(pot.amount / sorted.length);
    let rest = pot.amount - base * sorted.length;
    const shares: Record<string, number> = {};
    for (const s of sorted) {
      shares[s] = base + (rest > 0 ? 1 : 0);
      if (rest > 0) rest--;
      payouts[s] = (payouts[s] ?? 0) + shares[s];
    }
    return { amount: pot.amount, eligible: pot.eligible, winners: sorted, shares };
  });
  return { results, payouts };
}

function idx(order: string[], s: string): number {
  const i = order.indexOf(s);
  return i < 0 ? order.length : i;
}
