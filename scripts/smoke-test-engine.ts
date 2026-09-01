// Sanity check for the ported game engine — no Redis needed, an in-memory
// HandStore stands in for the real Redis-backed one. Run with: npx tsx scripts/smoke-test-engine.ts
import {
  actBet,
  actCall,
  actCheck,
  actFold,
  actRaise,
  confirmRoundIntro,
  endNight,
  launchGame,
  nextRound,
} from "../src/lib/game/engine";
import type { Card, GameState } from "../src/lib/game/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("ok:", msg);
}

function makeHandStore() {
  const hands = new Map<string, Card[]>();
  return {
    store: hands,
    getHand: async (round: number, slug: string) => hands.get(`${round}:${slug}`) || [],
    setHand: async (round: number, slug: string, cards: Card[]) => {
      hands.set(`${round}:${slug}`, cards);
    },
  };
}

async function run() {
  const players = [
    { name: "Alice", slug: "alice" },
    { name: "Bob", slug: "bob" },
    { name: "Cleo", slug: "cleo" },
  ];

  let g: GameState = launchGame(players);
  assert(g.phase === "roundIntro", "launchGame sets roundIntro phase");
  assert(g.playersPublic.length === 3, "3 players tracked");

  // Force a deterministic round type to exercise the full betting loop.
  g.roundTypeId = "high";
  g.lastRoundTypeId = "high";
  g.duelists = null;

  const hs = makeHandStore();
  await confirmRoundIntro(g, hs);
  assert(g.phase === "betting" || g.phase === "showdown", "confirmRoundIntro deals and starts betting");
  assert(hs.store.size === 3, "each player got a hand written to storage");

  if (g.phase === "betting") {
    // Everyone still in: bet, call, call should reach showdown.
    let guard = 0;
    while (g.phase === "betting" && guard < 20) {
      const opts = g.bettingOpts!;
      const isCheckOrBet = opts.mode === "check-or-bet" && g.currentBet === 0;
      if (isCheckOrBet) await actBet(g, hs);
      else await actCall(g, hs);
      guard++;
    }
    assert(g.phase === "showdown", "betting loop resolves to showdown");
    assert(!!g.lastResults, "lastResults populated at showdown");
    assert(g.lastResults!.winners!.length >= 1, "at least one winner declared");
  }

  const totalGulpsAfterR1 = g.playersPublic.reduce((s, p) => s + p.gulpsTotal, 0);
  assert(totalGulpsAfterR1 > 0, "someone drank after round 1");

  nextRound(g);
  assert(g.phase === "roundIntro" && g.round === 2, "nextRound advances round counter");

  // Exercise fold + check paths too, forcing teenpatti (pot fold-cost).
  g.roundTypeId = "teenpatti";
  g.lastRoundTypeId = "teenpatti";
  await confirmRoundIntro(g, hs);
  assert(g.phase === "betting", "teenpatti always has a betting street");
  await actFold(g, hs);
  assert(g.playersPublic.some((p) => p.folded), "fold marks player as folded");

  // Drain remaining turns.
  let guard2 = 0;
  while (g.phase === "betting" && guard2 < 20) {
    const opts = g.bettingOpts!;
    const isCheckOrBet = opts.mode === "check-or-bet" && g.currentBet === 0;
    if (isCheckOrBet) await actCheck(g, hs);
    else await actCall(g, hs);
    guard2++;
  }
  assert(g.phase === "showdown", "teenpatti round resolves to showdown after fold+calls");

  endNight(g);
  assert(g.phase === "final", "endNight sets final phase");

  // actRaise sanity in isolation (separate mini game, 2 players betting).
  const g2: GameState = launchGame(players);
  g2.roundTypeId = "high";
  g2.lastRoundTypeId = "high";
  g2.duelists = null;
  const hs2 = makeHandStore();
  await confirmRoundIntro(g2, hs2);
  if (g2.phase === "betting") {
    const firstTurn = g2.turnIdx;
    await actRaise(g2, hs2);
    assert(g2.currentBet === 2, "raise bumps currentBet to 2");
    assert(g2.turnIdx !== firstTurn, "turn advances after raise");
  }

  console.log("\nAll engine smoke checks passed.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
