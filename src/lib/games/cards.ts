import { roundTypeById } from "../game/roundTypes";
import { makeShuffledDeck, shuffleArr } from "../game/cards";
import { bestOf7, compareHand, evaluate5 } from "../game/evaluate";
import { fail, notNow } from "../errors";
import { chance, type GameModule, rand } from "../game/module";
import type { BettingOpts, Card, GameState } from "../game/types";

// ---------- Moteur de mises (carte la plus haute + poker) ----------

type BetAction = "fold" | "call" | "raise" | "check" | "bet";

function hand(g: GameState, idx: number): Card[] {
  return g.hands?.[g.playersPublic[idx].slug] ?? [];
}

function orderFrom(g: GameState, start: number, activeIdxs: number[]): number[] {
  const n = g.playersPublic.length;
  const order: number[] = [];
  for (let i = 0; i < n; i++) {
    const idx = (start + i) % n;
    if (activeIdxs.includes(idx)) order.push(idx);
  }
  return order;
}

function advanceTurn(g: GameState): { complete: boolean; soleSurvivor?: boolean } {
  const active = g.dealTargets!.filter((i) => !g.playersPublic[i].folded);
  if (active.length <= 1) return { complete: true, soleSurvivor: true };
  if (g.needsToAct!.length === 0) return { complete: true, soleSurvivor: false };
  let tries = 0;
  while (tries < g.turnOrder!.length) {
    const idx = g.turnOrder![g.turnPointer!];
    if (!g.playersPublic[idx].folded && g.needsToAct!.includes(idx)) {
      g.phase = "betting";
      g.turnIdx = idx;
      return { complete: false };
    }
    g.turnPointer = (g.turnPointer! + 1) % g.turnOrder!.length;
    tries++;
  }
  return { complete: true, soleSurvivor: false };
}

function startBettingStreet(g: GameState, opts: BettingOpts): void {
  g.bettingOpts = opts;
  g.currentBet = opts.mode === "check-or-bet" ? 0 : 1;
  g.foldReferencePot = g.pot;
  g.dealTargets!.forEach((i) => {
    if (!g.playersPublic[i].folded) g.playersPublic[i].bet = 0;
  });
  const active = g.dealTargets!.filter((i) => !g.playersPublic[i].folded);
  g.turnOrder = orderFrom(g, g.startIndex, active);
  g.turnPointer = 0;
  g.needsToAct = g.turnOrder.slice();
  afterTurn(g, advanceTurn(g));
}

function afterTurn(g: GameState, result: { complete: boolean; soleSurvivor?: boolean }) {
  if (!result.complete) return;
  if (result.soleSurvivor) finishNoShowdown(g);
  else streetComplete(g);
}

function removeFromNeedsToAct(g: GameState, idx: number): void {
  const pos = g.needsToAct!.indexOf(idx);
  if (pos >= 0) g.needsToAct!.splice(pos, 1);
}

function advanceAfterAction(g: GameState): void {
  g.turnPointer = (g.turnPointer! + 1) % g.turnOrder!.length;
  afterTurn(g, advanceTurn(g));
}

function applyBet(g: GameState, action: BetAction): void {
  const idx = g.turnIdx!;
  const me = g.playersPublic[idx];
  if (action === "fold") {
    const cost = g.bettingOpts!.foldCost === "pot" ? 1 + (g.foldReferencePot ?? g.pot!) : 1;
    me.folded = true;
    me.gulpsTotal += cost;
    me.foldCost = cost;
    removeFromNeedsToAct(g, idx);
  } else if (action === "call") {
    g.pot! += g.currentBet! - me.bet;
    me.bet = g.currentBet!;
    removeFromNeedsToAct(g, idx);
  } else if (action === "raise") {
    const newBet = g.currentBet! + 1;
    g.foldReferencePot = g.pot!;
    g.pot! += newBet - me.bet;
    me.bet = newBet;
    g.currentBet = newBet;
    g.needsToAct = g.turnOrder!.filter((i) => i !== idx && !g.playersPublic[i].folded);
  } else if (action === "check") {
    removeFromNeedsToAct(g, idx);
  } else {
    g.currentBet = 1;
    g.foldReferencePot = g.pot!;
    g.pot! += 1 - me.bet;
    me.bet = 1;
    g.needsToAct = g.turnOrder!.filter((i) => i !== idx && !g.playersPublic[i].folded);
  }
  advanceAfterAction(g);
}

function allowedActions(g: GameState): BetAction[] {
  const checkPhase = g.bettingOpts?.mode === "check-or-bet" && g.currentBet === 0;
  return checkPhase ? ["check", "bet"] : ["fold", "call", "raise"];
}

function finishNoShowdown(g: GameState): void {
  const activeIdx = g.dealTargets!.filter((i) => !g.playersPublic[i].folded);
  const winner = g.playersPublic[activeIdx[0]];
  g.lastResults = { type: g.roundTypeId!, soleSurvivor: true, winners: [winner.name] };
  g.phase = "showdown";
}

function streetComplete(g: GameState): void {
  if (g.roundTypeId !== "holdem") return resolveSimple(g);
  const next = { preflop: ["flop", 3], flop: ["turn", 4], turn: ["river", 5] } as const;
  const step = next[g.street as keyof typeof next];
  if (!step) return resolveHoldem(g);
  g.communityRevealed = step[1];
  g.street = step[0];
  startBettingStreet(g, { mode: "check-or-bet", foldCost: "pot" });
}

function handsByName(g: GameState, idxs: number[]): Record<string, Card[]> {
  const out: Record<string, Card[]> = {};
  idxs.forEach((i) => (out[g.playersPublic[i].name] = hand(g, i)));
  return out;
}

function resolveSimple(g: GameState): void {
  const activeIdx = g.dealTargets!.filter((i) => !g.playersPublic[i].folded);
  const best = Math.max(...activeIdx.map((i) => hand(g, i)[0].value));
  const winners: string[] = [];
  const losers: string[] = [];
  activeIdx.forEach((i) => {
    const p = g.playersPublic[i];
    if (hand(g, i)[0].value === best) winners.push(p.name);
    else {
      losers.push(p.name);
      p.gulpsTotal += g.currentBet!;
    }
  });
  g.lastResults = {
    type: g.roundTypeId!,
    soleSurvivor: false,
    winners,
    losers,
    betAmount: g.currentBet,
    hands: handsByName(g, activeIdx),
  };
  g.phase = "showdown";
}

function resolveHoldem(g: GameState): void {
  const activeIdx = g.dealTargets!.filter((i) => !g.playersPublic[i].folded);
  const evals = activeIdx.map((i) => ({ i, e: bestOf7([...hand(g, i), ...g.community!]) }));
  evals.sort((a, b) => compareHand(a.e, b.e));
  const bestE = evals[0].e;
  const winners: string[] = [];
  const losers: number[] = [];
  evals.forEach(({ i, e }) => {
    if (compareHand(e, bestE) === 0) winners.push(g.playersPublic[i].name);
    else losers.push(i);
  });
  const share = losers.length ? Math.ceil(g.pot! / losers.length) : 0;
  losers.forEach((i) => (g.playersPublic[i].gulpsTotal += share));
  g.lastResults = {
    type: "holdem",
    soleSurvivor: false,
    winners,
    losers: losers.map((i) => g.playersPublic[i].name),
    potAtEnd: g.pot,
    share,
    hands: handsByName(g, activeIdx),
  };
  g.phase = "showdown";
}

function deal(g: GameState, targets: number[], perPlayer: number): Card[] {
  const deck = makeShuffledDeck();
  g.dealTargets = targets;
  g.hands = {};
  targets.forEach((i) => {
    g.hands![g.playersPublic[i].slug] = deck.splice(0, perPlayer);
  });
  return deck;
}

// Force d'une main entre 0 et 1, pour les décisions des bots.
function strength(g: GameState, idx: number): number {
  const cards = hand(g, idx);
  if (g.roundTypeId !== "holdem") return (cards[0].value - 2) / 12;
  const board = (g.community ?? []).slice(0, g.communityRevealed ?? 0);
  if (board.length === 0) {
    const [a, b] = cards;
    let s = (a.value + b.value - 4) / 24;
    if (a.value === b.value) s = 0.55 + a.value / 40;
    if (a.suit.sym === b.suit.sym) s += 0.05;
    return Math.min(1, s);
  }
  const all = [...cards, ...board];
  const e = all.length >= 5 ? bestOf7(all) : evaluate5(all);
  return Math.min(1, e.rank / 4 + (e.tie[0] ?? 0) / 60);
}

function bettingAuto(g: GameState, opts: { bot: boolean }): { type: string; action: BetAction } {
  const allowed = allowedActions(g);
  if (!opts.bot) return { type: "bet", action: allowed.includes("check") ? "check" : "fold" };
  const s = strength(g, g.turnIdx!) + rand(-0.12, 0.12);
  let action: BetAction;
  if (allowed.includes("check")) action = s > 0.62 && chance(0.7) ? "bet" : "check";
  else if (s < 0.25 && chance(0.7)) action = "fold";
  else if (s > 0.78 && g.currentBet! < 3 && chance(0.6)) action = "raise";
  else action = "call";
  return { type: "bet", action };
}

function bettingAct(g: GameState, slug: string, action: { type: string; action?: unknown }) {
  if (g.phase !== "betting" || action.type !== "bet") notNow();
  const meIdx = g.playersPublic.findIndex((p) => p.slug === slug);
  if (meIdx === -1 || g.turnIdx !== meIdx) fail(403, "Ce n'est pas ton tour.");
  const a = action.action as BetAction;
  if (!allowedActions(g).includes(a)) fail(400, "Action invalide dans ce contexte.");
  applyBet(g, a);
}

function bettingPending(g: GameState) {
  if (g.phase !== "betting") return null;
  return { key: `bet:${g.seq ?? 0}`, actors: [g.playersPublic[g.turnIdx!].slug], timeoutMs: 40000 };
}

export const highModule: GameModule = {
  id: "high",
  minPlayers: roundTypeById("high").minPlayers,
  start(g) {
    deal(
      g,
      g.playersPublic.map((_, i) => i),
      1
    );
    g.community = [];
    g.communityRevealed = 0;
    g.pot = 0;
    g.street = "single";
    startBettingStreet(g, { mode: "always-bet", foldCost: "flat" });
  },
  act: bettingAct,
  pending: bettingPending,
  auto: (g, _slug, _ctx, opts) => bettingAuto(g, opts),
  botDelay: () => [1200, 3200],
};

export const holdemModule: GameModule = {
  id: "holdem",
  minPlayers: roundTypeById("holdem").minPlayers,
  start(g) {
    const deck = deal(
      g,
      g.playersPublic.map((_, i) => i),
      2
    );
    g.community = deck.splice(0, 5);
    g.communityRevealed = 0;
    g.pot = g.dealTargets!.length;
    g.street = "preflop";
    startBettingStreet(g, { mode: "check-or-bet", foldCost: "pot" });
  },
  act: bettingAct,
  pending: bettingPending,
  auto: (g, _slug, _ctx, opts) => bettingAuto(g, opts),
  botDelay: () => [1500, 3800],
};

// ---------- Bataille ----------

function duelResolve(g: GameState): void {
  const [i1, i2] = g.duelists!;
  const [c1, c2] = g.duelReveal!.revealedCards as [Card, Card];
  const p1 = g.playersPublic[i1];
  const p2 = g.playersPublic[i2];
  if (c1.value === c2.value) {
    p1.gulpsTotal += 1;
    p2.gulpsTotal += 1;
    g.lastResults = { type: "duel", tie: true, names: [p1.name, p2.name], cards: { [p1.name]: c1, [p2.name]: c2 } };
  } else {
    const [winner, loser] = c1.value > c2.value ? [p1, p2] : [p2, p1];
    loser.gulpsTotal += 2;
    g.lastResults = {
      type: "duel",
      tie: false,
      winner: winner.name,
      loser: loser.name,
      cards: { [p1.name]: c1, [p2.name]: c2 },
    };
  }
  g.phase = "showdown";
}

export function pickDuelists(g: GameState): void {
  const idxs = [...Array(g.playersPublic.length).keys()];
  shuffleArr(idxs);
  g.duelists = [idxs[0], idxs[1]];
}

export const duelModule: GameModule = {
  id: "duel",
  minPlayers: roundTypeById("duel").minPlayers,
  start(g) {
    if (!g.duelists) pickDuelists(g);
    deal(g, g.duelists!.slice(), 1);
    g.duelReveal = { revealed: [false, false], revealedCards: [null, null] };
    g.phase = "duelReveal";
  },
  act(g, slug, action) {
    if (g.phase !== "duelReveal" || action.type !== "duelReveal") notNow();
    const meIdx = g.playersPublic.findIndex((p) => p.slug === slug);
    const pos = g.duelists!.indexOf(meIdx);
    if (pos < 0) fail(403, "Tu ne participes pas à ce duel.");
    if (g.duelReveal!.revealed[pos]) fail(409, "Déjà révélé.");
    g.duelReveal!.revealed[pos] = true;
    g.duelReveal!.revealedCards[pos] = hand(g, meIdx)[0];
    if (g.duelReveal!.revealed.every(Boolean)) duelResolve(g);
  },
  pending(g) {
    if (g.phase !== "duelReveal") return null;
    const actors = g.duelists!.filter((_, pos) => !g.duelReveal!.revealed[pos]).map((i) => g.playersPublic[i].slug);
    return { key: `duel:${g.round}`, actors, timeoutMs: 30000 };
  },
  auto: () => ({ type: "duelReveal" }),
  botDelay: () => [1500, 4000],
};
