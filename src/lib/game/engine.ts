import { makeShuffledDeck, shuffleArr } from "./cards";
import { bestOf7, compareHand, evaluate3 } from "./evaluate";
import { ROUND_TYPES, roundTypeById } from "./roundTypes";
import type {
  BettingOpts,
  Card,
  GameState,
  Player,
  PlayerPublic,
} from "./types";

export interface HandStore {
  getHand(round: number, slug: string): Promise<Card[]>;
  setHand(round: number, slug: string, cards: Card[]): Promise<void>;
}

export function slugify(name: string): string {
  return (
    (name || "")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/['"/\\]/g, "")
      .slice(0, 40) || "joueur"
  );
}

export function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

function roundTypeObjFrom(g: GameState) {
  return roundTypeById(g.roundTypeId as string);
}

export function setupRoundType(g: GameState): void {
  const pool = ROUND_TYPES.filter((t) => !g.lastRoundTypeId || t.id !== g.lastRoundTypeId);
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  g.lastRoundTypeId = chosen.id;
  g.roundTypeId = chosen.id;
  if (chosen.id === "duel") {
    const idxs = [...Array(g.playersPublic.length).keys()];
    shuffleArr(idxs);
    g.duelists = [idxs[0], idxs[1]];
  } else {
    g.duelists = null;
  }
}

export function launchGame(players: Player[]): GameState {
  const playersPublic: PlayerPublic[] = players.map((p) => ({
    name: p.name,
    slug: p.slug,
    gulpsTotal: 0,
    folded: false,
    bet: 0,
    foldCost: null,
  }));
  const g: GameState = {
    phase: "roundIntro",
    round: 1,
    startIndex: 0,
    lastRoundTypeId: null,
    playersPublic,
  };
  setupRoundType(g);
  return g;
}

export async function confirmRoundIntro(g: GameState, hands: HandStore): Promise<void> {
  const rt = roundTypeObjFrom(g);
  const dealTargets = rt.id === "duel" ? g.duelists!.slice() : g.playersPublic.map((_, i) => i);
  g.dealTargets = dealTargets;

  const deck = makeShuffledDeck();
  let ptr = 0;
  const writes: Promise<void>[] = [];
  dealTargets.forEach((i) => {
    const p = g.playersPublic[i];
    const cards: Card[] = [];
    for (let k = 0; k < rt.cards; k++) cards.push(deck[ptr++]);
    writes.push(hands.setHand(g.round, p.slug, cards));
  });
  await Promise.all(writes);

  if (rt.id === "holdem") {
    g.community = [deck[ptr++], deck[ptr++], deck[ptr++], deck[ptr++], deck[ptr++]];
    g.communityRevealed = 0;
  } else {
    g.community = [];
    g.communityRevealed = 0;
  }

  if (rt.id === "duel") {
    const [i1, i2] = g.duelists!;
    const c1 = (await hands.getHand(g.round, g.playersPublic[i1].slug))[0];
    const c2 = (await hands.getHand(g.round, g.playersPublic[i2].slug))[0];
    resolveDuelState(g, i1, c1, i2, c2);
    return;
  }

  g.pot = 0;
  if (rt.id === "holdem") {
    dealTargets.forEach(() => {
      g.pot! += 1;
    });
    g.street = "preflop";
    await startBettingStreet(g, { mode: "check-or-bet", foldCost: "pot" }, hands);
  } else {
    g.street = "single";
    const foldCost = rt.id === "teenpatti" ? "pot" : "flat";
    await startBettingStreet(g, { mode: "always-bet", foldCost }, hands);
  }
}

// ---------- Betting engine ----------
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

async function startBettingStreet(g: GameState, opts: BettingOpts, hands: HandStore): Promise<void> {
  g.bettingOpts = opts;
  g.currentBet = opts.mode === "check-or-bet" ? 0 : 1;
  g.dealTargets!.forEach((i) => {
    if (!g.playersPublic[i].folded) g.playersPublic[i].bet = 0;
  });
  const active = g.dealTargets!.filter((i) => !g.playersPublic[i].folded);
  g.turnOrder = orderFrom(g, g.startIndex, active);
  g.turnPointer = 0;
  g.needsToAct = g.turnOrder.slice();
  const result = advanceTurn(g);
  if (result.complete) {
    if (result.soleSurvivor) finishNoShowdown(g);
    else await streetComplete(g, hands);
  }
}

function removeFromNeedsToAct(g: GameState, idx: number): void {
  const pos = g.needsToAct!.indexOf(idx);
  if (pos >= 0) g.needsToAct!.splice(pos, 1);
}

async function advanceAfterAction(g: GameState, hands: HandStore): Promise<void> {
  g.turnPointer = (g.turnPointer! + 1) % g.turnOrder!.length;
  const result = advanceTurn(g);
  if (result.complete) {
    if (result.soleSurvivor) finishNoShowdown(g);
    else await streetComplete(g, hands);
  }
}

export async function actFold(g: GameState, hands: HandStore): Promise<void> {
  const idx = g.turnIdx!;
  const cost = g.bettingOpts!.foldCost === "pot" ? 1 + g.pot! : 1;
  g.playersPublic[idx].folded = true;
  g.playersPublic[idx].gulpsTotal += cost;
  g.playersPublic[idx].foldCost = cost;
  removeFromNeedsToAct(g, idx);
  await advanceAfterAction(g, hands);
}

export async function actCall(g: GameState, hands: HandStore): Promise<void> {
  const idx = g.turnIdx!;
  const delta = g.currentBet! - g.playersPublic[idx].bet;
  g.pot! += delta;
  g.playersPublic[idx].bet = g.currentBet!;
  removeFromNeedsToAct(g, idx);
  await advanceAfterAction(g, hands);
}

export async function actRaise(g: GameState, hands: HandStore): Promise<void> {
  const idx = g.turnIdx!;
  const newBet = g.currentBet! + 1;
  const delta = newBet - g.playersPublic[idx].bet;
  g.pot! += delta;
  g.playersPublic[idx].bet = newBet;
  g.currentBet = newBet;
  g.needsToAct = g.turnOrder!.filter((i) => i !== idx && !g.playersPublic[i].folded);
  await advanceAfterAction(g, hands);
}

export async function actCheck(g: GameState, hands: HandStore): Promise<void> {
  removeFromNeedsToAct(g, g.turnIdx!);
  await advanceAfterAction(g, hands);
}

export async function actBet(g: GameState, hands: HandStore): Promise<void> {
  const idx = g.turnIdx!;
  g.currentBet = 1;
  const delta = 1 - g.playersPublic[idx].bet;
  g.pot! += delta;
  g.playersPublic[idx].bet = 1;
  g.needsToAct = g.turnOrder!.filter((i) => i !== idx && !g.playersPublic[i].folded);
  await advanceAfterAction(g, hands);
}

export async function continueAfterCommunity(g: GameState, hands: HandStore): Promise<void> {
  await startBettingStreet(g, { mode: "check-or-bet", foldCost: "pot" }, hands);
}

// ---------- Resolution ----------
function finishNoShowdown(g: GameState): void {
  const activeIdx = g.dealTargets!.filter((i) => !g.playersPublic[i].folded);
  const winner = g.playersPublic[activeIdx[0]];
  g.lastResults = { type: roundTypeObjFrom(g).id, soleSurvivor: true, winners: [winner.name] };
  g.phase = "showdown";
}

async function streetComplete(g: GameState, hands: HandStore): Promise<void> {
  const rt = roundTypeObjFrom(g);
  if (rt.id === "holdem") {
    if (g.street === "preflop") {
      g.communityRevealed = 3;
      g.street = "flop";
      g.phase = "communityReveal";
    } else if (g.street === "flop") {
      g.communityRevealed = 4;
      g.street = "turn";
      g.phase = "communityReveal";
    } else if (g.street === "turn") {
      g.communityRevealed = 5;
      g.street = "river";
      g.phase = "communityReveal";
    } else {
      await resolveHoldem(g, hands);
    }
  } else {
    await resolveSimple(g, hands);
  }
}

function mapNamesToHands(g: GameState, handsByIdx: Record<number, Card[]>): Record<string, Card[]> {
  const out: Record<string, Card[]> = {};
  Object.keys(handsByIdx).forEach((k) => {
    out[g.playersPublic[Number(k)].name] = handsByIdx[Number(k)];
  });
  return out;
}

async function resolveSimple(g: GameState, hands: HandStore): Promise<void> {
  const rt = roundTypeObjFrom(g);
  const activeIdx = g.dealTargets!.filter((i) => !g.playersPublic[i].folded);
  const handMap: Record<number, Card[]> = {};
  await Promise.all(
    activeIdx.map(async (i) => {
      const p = g.playersPublic[i];
      handMap[i] = await hands.getHand(g.round, p.slug);
    })
  );

  const winners: string[] = [];
  const losers: string[] = [];
  if (rt.id === "teenpatti") {
    const evals = activeIdx.map((i) => ({ i, e: evaluate3(handMap[i]) }));
    evals.sort((a, b) => compareHand(a.e, b.e));
    const bestE = evals[0].e;
    evals.forEach(({ i, e }) => {
      if (compareHand(e, bestE) === 0) winners.push(g.playersPublic[i].name);
      else {
        losers.push(g.playersPublic[i].name);
        g.playersPublic[i].gulpsTotal += g.currentBet!;
      }
    });
  } else {
    const cmp = rt.id === "low" ? (a: number, b: number) => a - b : (a: number, b: number) => b - a;
    const sorted = [...activeIdx].sort((x, y) => cmp(handMap[x][0].value, handMap[y][0].value));
    const bestVal = handMap[sorted[0]][0].value;
    activeIdx.forEach((i) => {
      if (handMap[i][0].value === bestVal) winners.push(g.playersPublic[i].name);
      else {
        losers.push(g.playersPublic[i].name);
        g.playersPublic[i].gulpsTotal += g.currentBet!;
      }
    });
  }
  g.lastResults = {
    type: rt.id,
    soleSurvivor: false,
    winners,
    losers,
    betAmount: g.currentBet,
    hands: mapNamesToHands(g, handMap),
  };
  g.phase = "showdown";
}

async function resolveHoldem(g: GameState, hands: HandStore): Promise<void> {
  const activeIdx = g.dealTargets!.filter((i) => !g.playersPublic[i].folded);
  const handMap: Record<number, Card[]> = {};
  await Promise.all(
    activeIdx.map(async (i) => {
      const p = g.playersPublic[i];
      handMap[i] = await hands.getHand(g.round, p.slug);
    })
  );
  const community = g.community!;
  const evals = activeIdx.map((i) => ({ i, e: bestOf7([...handMap[i], ...community]) }));
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
    hands: mapNamesToHands(g, handMap),
  };
  g.phase = "showdown";
}

function resolveDuelState(g: GameState, i1: number, card1: Card, i2: number, card2: Card): void {
  const p1 = g.playersPublic[i1];
  const p2 = g.playersPublic[i2];
  if (card1.value === card2.value) {
    p1.gulpsTotal += 1;
    p2.gulpsTotal += 1;
    g.lastResults = {
      type: "duel",
      tie: true,
      names: [p1.name, p2.name],
      cards: { [p1.name]: card1, [p2.name]: card2 },
    };
  } else {
    const winner = card1.value > card2.value ? p1 : p2;
    const loser = card1.value > card2.value ? p2 : p1;
    loser.gulpsTotal += 2;
    g.lastResults = {
      type: "duel",
      tie: false,
      winner: winner.name,
      loser: loser.name,
      cards: { [p1.name]: card1, [p2.name]: card2 },
    };
  }
  g.phase = "showdown";
}

export function nextRound(g: GameState): void {
  g.round += 1;
  g.startIndex = (g.startIndex + 1) % g.playersPublic.length;
  g.playersPublic.forEach((p) => {
    p.folded = false;
    p.bet = 0;
    p.foldCost = null;
  });
  setupRoundType(g);
  g.phase = "roundIntro";
}

export function endNight(g: GameState): void {
  g.phase = "final";
}
