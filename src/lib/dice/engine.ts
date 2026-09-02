import type { DiceRoll, GameState } from "../game/types";

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

// Rolls for whoever's turn it currently is (server-generated, same as
// every other random draw in the app — the client only ever triggers the
// roll, it never picks the numbers). Advances to the next player, or
// resolves the round once the whole table has gone.
export function rollDice(g: GameState): void {
  const d = g.dice!;
  const player = g.playersPublic[d.playerIdx];
  const d1 = 1 + Math.floor(Math.random() * 6);
  const d2 = 1 + Math.floor(Math.random() * 6);
  const roll: DiceRoll = { slug: player.slug, name: player.name, d1, d2, sum: d1 + d2 };
  d.rolls.push(roll);

  if (d.turnPointer + 1 >= d.turnOrder.length) {
    resolveDiceRound(g);
  } else {
    d.turnPointer += 1;
    d.playerIdx = d.turnOrder[d.turnPointer];
  }
}

function resolveDiceRound(g: GameState): void {
  const d = g.dice!;
  const byslug = new Map(g.playersPublic.map((p) => [p.slug, p]));

  const minSum = Math.min(...d.rolls.map((r) => r.sum));
  const losers = d.rolls.filter((r) => r.sum === minSum);
  losers.forEach((r) => {
    byslug.get(r.slug)!.gulpsTotal += 2;
  });

  const sorted = [...d.rolls].sort((a, b) => b.sum - a.sum);

  g.lastResults = {
    type: "dice",
    diceRolls: sorted,
    diceLowest: losers.map((r) => r.name),
  };
  g.phase = "showdown";
}
