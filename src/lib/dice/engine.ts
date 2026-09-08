import type { DiceRoll, DiceTieBreakState, GameState, PlayerPublic } from "../game/types";

const BASE_DICE_GULPS = 2;

function orderAllPlayers(g: GameState): number[] {
  const n = g.playersPublic.length;
  const order: number[] = [];
  for (let i = 0; i < n; i++) order.push((g.startIndex + i) % n);
  return order;
}

export function startDiceRound(g: GameState): void {
  const order = orderAllPlayers(g);
  g.dice = {
    turnOrder: order,
    turnPointer: 0,
    playerIdx: order[0],
    rolls: [],
  };
  g.phase = "dice";
}

// Whoever's turn it is right now — a live tie-break level (if one is
// active) always takes priority over the main round, since it's a fully
// separate mini-turn-order layered on top of it.
export function diceActiveSlug(g: GameState): string {
  const d = g.dice!;
  const idx = d.tieBreak ? d.tieBreak.playerIdx : d.playerIdx;
  return g.playersPublic[idx].slug;
}

function makeRoll(player: PlayerPublic): DiceRoll {
  const d1 = 1 + Math.floor(Math.random() * 6);
  const d2 = 1 + Math.floor(Math.random() * 6);
  return { slug: player.slug, name: player.name, d1, d2, sum: d1 + d2 };
}

// Rolls for whoever's turn it currently is (server-generated, same as
// every other random draw in the app — the client only ever triggers the
// roll, it never picks the numbers). Routes to the active tie-break level
// if one is in progress, otherwise the main round.
export function rollDice(g: GameState): void {
  const d = g.dice!;
  if (d.tieBreak) {
    rollForTieBreak(g, d.tieBreak);
    return;
  }

  const player = g.playersPublic[d.playerIdx];
  d.rolls.push(makeRoll(player));

  if (d.turnPointer + 1 >= d.turnOrder.length) {
    resolveMainRound(g);
  } else {
    d.turnPointer += 1;
    d.playerIdx = d.turnOrder[d.turnPointer];
  }
}

function resolveMainRound(g: GameState): void {
  const d = g.dice!;
  const minSum = Math.min(...d.rolls.map((r) => r.sum));
  const losers = d.rolls.filter((r) => r.sum === minSum);

  if (losers.length === 1) {
    finishDiceRound(g, losers[0].slug, losers[0].name, BASE_DICE_GULPS);
    return;
  }

  startTieBreak(g, losers, minSum, d.turnOrder, 1, BASE_DICE_GULPS * 2);
}

function rollForTieBreak(g: GameState, tb: DiceTieBreakState): void {
  const player = g.playersPublic[tb.playerIdx];
  tb.rolls.push(makeRoll(player));

  if (tb.turnPointer + 1 < tb.turnOrder.length) {
    tb.turnPointer += 1;
    tb.playerIdx = tb.turnOrder[tb.turnPointer];
    return;
  }

  // Everyone contesting this level has rolled — see if it's decisive.
  const minSum = Math.min(...tb.rolls.map((r) => r.sum));
  const losers = tb.rolls.filter((r) => r.sum === minSum);

  const d = g.dice!;
  d.tieBreakHistory = [...(d.tieBreakHistory ?? []), tb];

  if (losers.length === 1) {
    d.tieBreak = undefined;
    finishDiceRound(g, losers[0].slug, losers[0].name, tb.amount);
    return;
  }

  startTieBreak(g, losers, minSum, tb.turnOrder, tb.level + 1, tb.amount * 2);
}

// Opens a new tie-break level for exactly the players who just tied,
// preserving their relative order from whichever turn order they were
// just rolling in (the main round's, or the previous level's) rather
// than the order they happen to appear in `tiedRolls`.
function startTieBreak(
  g: GameState,
  tiedRolls: DiceRoll[],
  tiedSum: number,
  previousOrder: number[],
  level: number,
  amount: number
): void {
  const d = g.dice!;
  const tiedSlugs = new Set(tiedRolls.map((r) => r.slug));
  const turnOrder = previousOrder.filter((idx) => tiedSlugs.has(g.playersPublic[idx].slug));
  const participantSlugs = turnOrder.map((idx) => g.playersPublic[idx].slug);
  const participantNames = turnOrder.map((idx) => g.playersPublic[idx].name);

  d.tieBreak = {
    level,
    amount,
    tiedSum,
    participantSlugs,
    participantNames,
    turnOrder,
    turnPointer: 0,
    playerIdx: turnOrder[0],
    rolls: [],
  };
}

function finishDiceRound(g: GameState, loserSlug: string, loserName: string, amount: number): void {
  const d = g.dice!;
  const byslug = new Map(g.playersPublic.map((p) => [p.slug, p]));
  byslug.get(loserSlug)!.gulpsTotal += amount;

  const sorted = [...d.rolls].sort((a, b) => b.sum - a.sum);

  g.lastResults = {
    type: "dice",
    diceRolls: sorted,
    diceLowest: [loserName],
    diceLowestAmount: amount,
    diceTieBreaks: (d.tieBreakHistory ?? []).map((tb) => ({
      level: tb.level,
      amount: tb.amount,
      tiedSum: tb.tiedSum,
      participantSlugs: tb.participantSlugs,
      participantNames: tb.participantNames,
      rolls: tb.rolls,
    })),
  };
  g.phase = "showdown";
}
