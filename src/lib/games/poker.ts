import { roundTypeById } from "../game/roundTypes";
import { makeShuffledDeck } from "../game/cards";
import { bestOf7, compareHand, evaluate5, handLabel5 } from "../game/evaluate";
import { fail, notNow } from "../errors";
import { chance, drink, type GameModule, MAX_GULPS, rand } from "../game/module";
import type { Card, GameState } from "../game/types";

// Texas Hold'em à boire.
// - Pot de départ : 2 gorgées (la « mise de la maison »).
// - À chaque tour d'enchères : checker ou miser 1 ; face à une mise :
//   suivre, relancer de 1 (2 relances max par tour) ou se coucher.
// - Se coucher : on boit le pot tel qu'il est à ce moment-là, sans
//   compter les mises qu'on refuse de suivre (règle « tu bois ce que tu
//   as laissé sur la table »). Se coucher avant toute mise coûte donc le
//   pot de départ.
// - Abattage : chaque perdant boit le pot (plafonné à 10 = cul sec), le ou
//   les gagnants ne boivent rien.
export const POKER_START_POT = 2;
export const POKER_MAX_BET = 3; // mise + 2 relances

type BetAction = "fold" | "call" | "raise" | "check" | "bet";
const STREETS = ["preflop", "flop", "turn", "river"] as const;
const REVEALED = { preflop: 0, flop: 3, turn: 4, river: 5 } as const;

function hand(g: GameState, idx: number): Card[] {
  return g.hands?.[g.playersPublic[idx].slug] ?? [];
}

function active(g: GameState): number[] {
  return g.dealTargets!.filter((i) => !g.playersPublic[i].folded);
}

function orderFrom(g: GameState, idxs: number[]): number[] {
  const n = g.playersPublic.length;
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const i = (g.startIndex + k) % n;
    if (idxs.includes(i)) out.push(i);
  }
  return out;
}

// Pot « vu » par un joueur : le pot du début du tour d'enchères + ce que
// chacun a misé dans ce tour, plafonné à ce que lui-même a mis.
export function foldCost(g: GameState, idx: number): number {
  const mine = g.playersPublic[idx].bet;
  const street = g.dealTargets!.reduce((s, i) => s + Math.min(g.playersPublic[i].bet, mine), 0);
  return (g.foldReferencePot ?? 0) + street;
}

function startStreet(g: GameState): void {
  g.currentBet = 0;
  g.foldReferencePot = g.pot;
  g.dealTargets!.forEach((i) => (g.playersPublic[i].bet = 0));
  g.turnOrder = orderFrom(g, active(g));
  g.needsToAct = g.turnOrder.slice();
  g.turnPointer = 0;
  g.communityRevealed = REVEALED[g.street as keyof typeof REVEALED];
  nextTurn(g);
}

function nextTurn(g: GameState): void {
  if (active(g).length <= 1) return finish(g);
  if (g.needsToAct!.length === 0) {
    const i = STREETS.indexOf(g.street as (typeof STREETS)[number]);
    if (i === STREETS.length - 1) return finish(g);
    g.street = STREETS[i + 1];
    return startStreet(g);
  }
  // Prochain joueur (dans l'ordre de la table) qui doit encore parler.
  for (let k = 0; k < g.turnOrder!.length; k++) {
    const idx = g.turnOrder![(g.turnPointer! + k) % g.turnOrder!.length];
    if (g.needsToAct!.includes(idx) && !g.playersPublic[idx].folded) {
      g.turnPointer = (g.turnPointer! + k) % g.turnOrder!.length;
      g.turnIdx = idx;
      g.phase = "betting";
      return;
    }
  }
  finish(g);
}

export function allowedActions(g: GameState): BetAction[] {
  if (g.currentBet === 0) return ["check", "bet", "fold"];
  const acts: BetAction[] = ["fold", "call"];
  if (g.currentBet! < POKER_MAX_BET) acts.push("raise");
  return acts;
}

function apply(g: GameState, action: BetAction): void {
  const idx = g.turnIdx!;
  const me = g.playersPublic[idx];
  const others = () => g.turnOrder!.filter((i) => i !== idx && !g.playersPublic[i].folded);
  if (action === "fold") {
    const cost = foldCost(g, idx);
    me.folded = true;
    me.foldCost = cost;
    drink(g, me.slug, cost, "S'est couché");
    g.needsToAct = g.needsToAct!.filter((i) => i !== idx);
  } else if (action === "check") {
    g.needsToAct = g.needsToAct!.filter((i) => i !== idx);
  } else if (action === "call") {
    g.pot! += g.currentBet! - me.bet;
    me.bet = g.currentBet!;
    g.needsToAct = g.needsToAct!.filter((i) => i !== idx);
  } else {
    // bet (de 0 à 1) ou raise (+1) : tous les autres doivent reparler.
    const newBet = g.currentBet! + 1;
    g.pot! += newBet - me.bet;
    me.bet = newBet;
    g.currentBet = newBet;
    g.needsToAct = others();
  }
  g.turnPointer = (g.turnPointer! + 1) % g.turnOrder!.length;
  nextTurn(g);
}

function finish(g: GameState): void {
  const live = active(g);
  if (live.length === 1) {
    g.lastResults = { type: "holdem", soleSurvivor: true, winners: [g.playersPublic[live[0]].name], potAtEnd: g.pot };
    g.phase = "showdown";
    return;
  }
  g.communityRevealed = 5;
  const evals = live.map((i) => ({ i, e: bestOf7([...hand(g, i), ...g.community!]) }));
  evals.sort((a, b) => compareHand(a.e, b.e));
  const best = evals[0].e;
  const winners: string[] = [];
  const losers: string[] = [];
  const labels: Record<string, string> = {};
  evals.forEach(({ i, e }) => {
    const p = g.playersPublic[i];
    labels[p.name] = handLabel5(e);
    if (compareHand(e, best) === 0) winners.push(p.name);
    else {
      losers.push(p.name);
      drink(g, p.slug, Math.min(MAX_GULPS, g.pot!), "Perdu à l'abattage");
    }
  });
  const hands: Record<string, Card[]> = {};
  live.forEach((i) => (hands[g.playersPublic[i].name] = hand(g, i)));
  g.lastResults = {
    type: "holdem",
    soleSurvivor: false,
    winners,
    losers,
    potAtEnd: g.pot,
    hands,
    handLabels: labels,
  };
  g.phase = "showdown";
}

// Force d'une main entre 0 et 1 (décisions des bots).
function strength(g: GameState, idx: number): number {
  const cards = hand(g, idx);
  const board = (g.community ?? []).slice(0, g.communityRevealed ?? 0);
  if (board.length === 0) {
    const [a, b] = cards;
    let s = (a.value + b.value - 4) / 26;
    if (a.value === b.value) s = 0.55 + a.value / 40;
    if (a.suit.sym === b.suit.sym) s += 0.05;
    return Math.min(1, s);
  }
  const all = [...cards, ...board];
  const e = all.length >= 5 ? bestOf7(all) : evaluate5(all);
  return Math.min(1, e.rank / 4 + (e.tie[0] ?? 0) / 60);
}

export const holdemModule: GameModule = {
  id: "holdem",
  minPlayers: roundTypeById("holdem").minPlayers,
  start(g) {
    const deck = makeShuffledDeck();
    g.dealTargets = g.playersPublic.map((_, i) => i);
    g.hands = {};
    g.playersPublic.forEach((p) => {
      p.folded = false;
      p.foldCost = null;
      g.hands![p.slug] = deck.splice(0, 2);
    });
    g.community = deck.splice(0, 5);
    g.pot = POKER_START_POT;
    g.street = "preflop";
    g.bettingOpts = { mode: "check-or-bet", foldCost: "pot" };
    startStreet(g);
  },
  act(g, slug, a) {
    if (g.phase !== "betting" || a.type !== "bet") notNow();
    const idx = g.playersPublic.findIndex((p) => p.slug === slug);
    if (idx !== g.turnIdx) fail(403, "Ce n'est pas ton tour.");
    const action = a.action as BetAction;
    if (!allowedActions(g).includes(action)) fail(400, "Action impossible maintenant.");
    apply(g, action);
  },
  pending(g) {
    if (g.phase !== "betting") return null;
    return { key: `poker:${g.seq ?? 0}`, actors: [g.playersPublic[g.turnIdx!].slug], timeoutMs: 40000 };
  },
  auto(g, _slug, _ctx, { bot }) {
    const allowed = allowedActions(g);
    if (!bot) return { type: "bet", action: allowed.includes("check") ? "check" : "fold" };
    const s = strength(g, g.turnIdx!) + rand(-0.12, 0.12);
    let action: BetAction;
    if (allowed.includes("check")) action = s > 0.6 && chance(0.7) ? "bet" : "check";
    else if (s < 0.28 && chance(0.65)) action = "fold";
    else if (s > 0.75 && allowed.includes("raise") && chance(0.5)) action = "raise";
    else action = "call";
    return { type: "bet", action };
  },
  botDelay: () => [1500, 3500],
};
