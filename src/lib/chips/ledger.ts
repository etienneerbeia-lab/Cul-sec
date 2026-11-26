// Module « jetons » partagé par tous les jeux casino (poker, blackjack, et
// plus tard roulette, course de chevaux, crash...). Il ne connaît aucune
// règle de jeu : il tient les soldes, les sommes engagées dans le coup en
// cours, et l'ordre d'élimination qui sert au classement final.
//
// Invariants (vérifiés par les tests) :
// - montants entiers, jamais négatifs ;
// - un joueur ne peut pas engager plus que son solde ;
// - en mode « table » (poker), un règlement redistribue exactement ce qui
//   a été engagé : le total des jetons ne change jamais.
// - en mode « banque » (blackjack, roulette...), la banque paie ou encaisse
//   la différence.

export interface ChipLedger {
  startingStack: number;
  stacks: Record<string, number>;
  // Engagé dans le coup en cours (mises, blindes...), pas encore réglé.
  committed: Record<string, number>;
  // Éliminations, dans l'ordre ; un groupe = éliminés au même règlement et
  // à égalité (ils partagent la même place).
  bustOrder: string[][];
}

export class ChipsError extends Error {}

function assertAmount(n: number): void {
  if (!Number.isInteger(n) || n < 0) throw new ChipsError(`Montant invalide : ${n}`);
}

export function createLedger(slugs: string[], startingStack: number): ChipLedger {
  assertAmount(startingStack);
  const stacks: Record<string, number> = {};
  slugs.forEach((s) => (stacks[s] = startingStack));
  return { startingStack, stacks, committed: {}, bustOrder: [] };
}

// Ajoute un joueur (arrivée en cours de partie) avec `amount` jetons.
export function seatPlayer(l: ChipLedger, slug: string, amount = l.startingStack): void {
  if (slug in l.stacks) throw new ChipsError(`${slug} a déjà un solde.`);
  assertAmount(amount);
  l.stacks[slug] = amount;
}

export function stackOf(l: ChipLedger, slug: string): number {
  return l.stacks[slug] ?? 0;
}

export function committedOf(l: ChipLedger, slug: string): number {
  return l.committed[slug] ?? 0;
}

export function isBusted(l: ChipLedger, slug: string): boolean {
  return l.bustOrder.some((g) => g.includes(slug));
}

// Engage exactement `amount` (erreur si le solde ne suffit pas).
export function commit(l: ChipLedger, slug: string, amount: number): void {
  assertAmount(amount);
  if (!(slug in l.stacks)) throw new ChipsError(`${slug} n'a pas de solde.`);
  if (amount > l.stacks[slug]) throw new ChipsError(`Solde insuffisant (${l.stacks[slug]} < ${amount}).`);
  l.stacks[slug] -= amount;
  l.committed[slug] = (l.committed[slug] ?? 0) + amount;
}

// Engage jusqu'à `amount`, plafonné au solde (tapis). Retourne le montant
// réellement engagé.
export function commitUpTo(l: ChipLedger, slug: string, amount: number): number {
  const n = Math.min(amount, stackOf(l, slug));
  commit(l, slug, n);
  return n;
}

// Rend au joueur une partie de ce qu'il a engagé (mise non suivie...).
export function release(l: ChipLedger, slug: string, amount: number): void {
  assertAmount(amount);
  if (amount > committedOf(l, slug)) throw new ChipsError("Rien à rendre.");
  l.committed[slug] -= amount;
  l.stacks[slug] += amount;
}

export function totalCommitted(l: ChipLedger): number {
  return Object.values(l.committed).reduce((s, n) => s + n, 0);
}

// Total des jetons (soldes + engagés).
export function totalChips(l: ChipLedger): number {
  return Object.values(l.stacks).reduce((s, n) => s + n, 0) + totalCommitted(l);
}

export type SettleMode = "table" | "house";

// Règle le coup : chaque joueur reçoit `payouts[slug]` (mise comprise),
// puis tout ce qui était engagé est soldé. En mode « table », la somme des
// gains doit égaler la somme engagée. Retourne le résultat net par joueur
// (gain - engagé), pratique pour l'affichage.
export function settle(l: ChipLedger, payouts: Record<string, number>, mode: SettleMode): Record<string, number> {
  const pot = totalCommitted(l);
  let paid = 0;
  for (const [slug, n] of Object.entries(payouts)) {
    assertAmount(n);
    if (!(slug in l.stacks)) throw new ChipsError(`${slug} n'a pas de solde.`);
    paid += n;
  }
  if (mode === "table" && paid !== pot) throw new ChipsError(`Règlement déséquilibré : ${paid} payé pour ${pot} engagé.`);
  const net: Record<string, number> = {};
  const slugs = new Set([...Object.keys(l.committed), ...Object.keys(payouts)]);
  slugs.forEach((slug) => {
    const gain = payouts[slug] ?? 0;
    net[slug] = gain - committedOf(l, slug);
    l.stacks[slug] += gain;
  });
  l.committed = {};
  return net;
}

// Élimine les joueurs dont le solde est passé sous `minStack` (1 par
// défaut : plus un jeton) et qui n'ont plus rien d'engagé. Plusieurs
// éliminés au même moment sont départagés par `tieBreak` (ex. le tapis
// qu'ils avaient au début du coup : le plus gros finit mieux classé) ; à
// égalité, ils partagent la place. Retourne les nouveaux éliminés.
export function markBusted(l: ChipLedger, minStack = 1, tieBreak: Record<string, number> = {}): string[] {
  const out = Object.keys(l.stacks).filter((s) => l.stacks[s] < minStack && committedOf(l, s) === 0 && !isBusted(l, s));
  // Du plus petit au plus gros départage : le plus petit sort en premier.
  const byKey = new Map<number, string[]>();
  out.forEach((s) => {
    const k = tieBreak[s] ?? 0;
    byKey.set(k, [...(byKey.get(k) ?? []), s]);
  });
  [...byKey.keys()].sort((a, b) => a - b).forEach((k) => l.bustOrder.push(byKey.get(k)!));
  return out;
}

export function activeSlugs(l: ChipLedger): string[] {
  return Object.keys(l.stacks).filter((s) => !isBusted(l, s));
}

export interface ChipRankEntry {
  slug: string;
  stack: number;
  rank: number; // 1 = premier ; les ex æquo partagent la place
  busted: boolean;
}

// Classement : les joueurs encore en jeu par solde décroissant, puis les
// éliminés du dernier sorti au premier. `order` départage l'affichage des
// ex æquo (ordre de la table).
export function ranking(l: ChipLedger, order: string[] = Object.keys(l.stacks)): ChipRankEntry[] {
  const pos = (s: string) => {
    const i = order.indexOf(s);
    return i < 0 ? order.length : i;
  };
  const alive = activeSlugs(l).sort((a, b) => stackOf(l, b) - stackOf(l, a) || pos(a) - pos(b));
  const out: ChipRankEntry[] = [];
  let rank = 0;
  alive.forEach((s, i) => {
    if (i === 0 || stackOf(l, s) !== stackOf(l, alive[i - 1])) rank = i + 1;
    out.push({ slug: s, stack: stackOf(l, s), rank, busted: false });
  });
  for (let gi = l.bustOrder.length - 1; gi >= 0; gi--) {
    const group = [...l.bustOrder[gi]].sort((a, b) => pos(a) - pos(b));
    const r = out.length + 1;
    group.forEach((s) => out.push({ slug: s, stack: stackOf(l, s), rank: r, busted: true }));
  }
  return out;
}
