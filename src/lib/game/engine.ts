import { makeShuffledDeck, shuffleArr } from "./cards";
import { bestOf7, compareHand } from "./evaluate";
import { ROUND_TYPES, roundTypeById } from "./roundTypes";
import { advanceQuizTurn, startQuizRound } from "../quiz/engine";
import { startVoteRound } from "../vote/engine";
import { startMemeRound } from "../meme/engine";
import { startDiceRound } from "../dice/engine";
import { startUndercoverRound } from "../undercover/engine";
import type {
  BettingOpts,
  Card,
  CulSecRule,
  GameState,
  Player,
  PlayerPublic,
  RoundTypeId,
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
  const enabled = g.enabledRoundTypeIds ?? ROUND_TYPES.map((t) => t.id);
  const available = ROUND_TYPES.filter((t) => enabled.includes(t.id));
  const pool = available.filter((t) => !g.lastRoundTypeId || t.id !== g.lastRoundTypeId);
  // If disabling everything but one type down to just that type left it
  // alone against lastRoundTypeId, fall back to the full enabled set so a
  // 2-type lobby can still alternate rather than crash on an empty pool.
  const drawFrom = pool.length > 0 ? pool : available;
  const chosen = drawFrom[Math.floor(Math.random() * drawFrom.length)];
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

export function launchGame(
  players: Player[],
  totalRounds: number,
  culSecRule: CulSecRule,
  enabledRoundTypeIds: RoundTypeId[]
): GameState {
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
    totalRounds,
    enabledRoundTypeIds,
    culSecRule,
  };
  setupRoundType(g);
  return g;
}

export async function confirmRoundIntro(g: GameState, hands: HandStore): Promise<void> {
  const rt = roundTypeObjFrom(g);

  if (rt.id === "quiz") {
    startQuizRound(g);
    return;
  }

  if (rt.id === "vote") {
    startVoteRound(g);
    return;
  }

  if (rt.id === "meme") {
    startMemeRound(g);
    return;
  }

  if (rt.id === "dice") {
    startDiceRound(g);
    return;
  }

  if (rt.id === "undercover") {
    startUndercoverRound(g);
    return;
  }

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
    g.duelReveal = { revealed: [false, false], revealedCards: [null, null] };
    g.phase = "duelReveal";
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
    await startBettingStreet(g, { mode: "always-bet", foldCost: "flat" }, hands);
  }
}

// Called once a duelist presses "reveal" on their own screen. Publishes
// that card into revealedCards immediately — every client (both duelists,
// every spectator) sees it flip face-up on the next poll, live, whether or
// not the other duelist has gone yet. Resolves (and moves to showdown)
// only once both have revealed — until then the other stays a private
// hand, same as any other card.
export async function revealDuelCard(g: GameState, playerIdx: number, hands: HandStore): Promise<void> {
  const [i1, i2] = g.duelists!;
  const pos = playerIdx === i1 ? 0 : 1;
  const card = (await hands.getHand(g.round, g.playersPublic[playerIdx].slug))[0];
  g.duelReveal!.revealed[pos] = true;
  g.duelReveal!.revealedCards[pos] = card;
  if (g.duelReveal!.revealed[0] && g.duelReveal!.revealed[1]) {
    const [c1, c2] = g.duelReveal!.revealedCards;
    resolveDuelState(g, i1, c1!, i2, c2!);
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
  // Nothing's been bet on this street yet — a fold right now (or in
  // response to a check) charges against the pot as it stands here.
  g.foldReferencePot = g.pot;
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
  // 1 + the pot as it stood before the bet/raise being declined — never
  // the live pot, which would double-count that wager. See
  // foldReferencePot's own comment in types.ts.
  const cost = g.bettingOpts!.foldCost === "pot" ? 1 + (g.foldReferencePot ?? g.pot!) : 1;
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
  // Snapshot before this raise's own contribution lands in the pot — a
  // fold facing this raise charges against the table as it stood before
  // it, not including it.
  g.foldReferencePot = g.pot!;
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
  // Same idea as actRaise: snapshot before this opening bet is added, so a
  // fold facing it doesn't double-count the very wager it's declining.
  g.foldReferencePot = g.pot!;
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
  const sorted = [...activeIdx].sort((x, y) => handMap[y][0].value - handMap[x][0].value);
  const bestVal = handMap[sorted[0]][0].value;
  activeIdx.forEach((i) => {
    if (handMap[i][0].value === bestVal) winners.push(g.playersPublic[i].name);
    else {
      losers.push(g.playersPublic[i].name);
      g.playersPublic[i].gulpsTotal += g.currentBet!;
    }
  });
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
  if (g.totalRounds && g.round >= g.totalRounds) {
    g.phase = "final";
    return;
  }
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

// culSecRule "last": whoever drank the most does a cul sec — determined
// automatically, no interaction needed. culSecRule "first": whoever drank
// the least picks who among the others does the cul sec.
export function culSecWinnerSlug(g: GameState): string | null {
  if (g.playersPublic.length === 0) return null;
  const sorted = [...g.playersPublic].sort((a, b) => a.gulpsTotal - b.gulpsTotal);
  return sorted[0].slug;
}

export function assignCulSec(g: GameState, targetSlug: string): void {
  g.culSecTargetSlug = targetSlug;
}

// Advances to the next player's quiz question, or — once the whole table
// has had a turn — shows the recap of everyone's answers before the next
// Manche (which may pick quiz again or a card round type).
export function quizAdvance(g: GameState): void {
  const roundOver = advanceQuizTurn(g);
  if (roundOver) g.phase = "quizRecap";
}

export function quizRecapContinue(g: GameState): void {
  nextRound(g);
}
