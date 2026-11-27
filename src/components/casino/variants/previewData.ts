import { fromCodes, toCode, type CardCode } from "@/lib/casino/cards";
import type { BjtDealEvent, BjtHand, BjtSeat, BjtState } from "@/lib/bjtable/types";
import { bestHand, describeHand } from "@/lib/game/evaluate";
import type { GameState, PlayerPublic } from "@/lib/game/types";
import type { PokerState } from "@/lib/poker/types";

// Données fictives (mais cohérentes avec les moteurs) pour la page
// /preview/tables : aucune requête serveur, aucun Redis.

export const ME = "moi";

const NAMES: Record<string, string> = {
  [ME]: "Étienne",
  gege: "Gégé 🤖",
  jacky: "Jacky 🤖",
  momo: "Momo",
  lulu: "Lulu",
  dede: "Dédé 🤖",
  nana: "Nana",
  bibi: "Bibi 🤖",
};

const pub = (slugs: string[]): PlayerPublic[] =>
  slugs.map((slug) => ({ name: NAMES[slug], slug, bot: NAMES[slug].endsWith("🤖"), gulpsTotal: 0, folded: false, bet: 0, foldCost: null }));

function base(slugs: string[], now: number, extra: Partial<GameState>): GameState {
  return {
    phase: "poker",
    round: 1,
    startIndex: 0,
    lastRoundTypeId: null,
    playersPublic: pub(slugs),
    universe: "casino",
    ...extra,
  };
}

// ---------------- Poker ----------------

export type PokerScenario = "tour" | "abattage" | "huit";
export const POKER_SCENARIOS: { id: PokerScenario; label: string }[] = [
  { id: "tour", label: "À moi · river" },
  { id: "abattage", label: "Abattage" },
  { id: "huit", label: "8 joueurs · préflop" },
];

const BOARD: CardCode[] = ["Kc", "Qc", "9h", "3d", "6c"];

function pokerBase(seats: string[], extra: Partial<PokerState>): PokerState {
  return {
    seats,
    handNo: 3,
    button: seats.length - 1,
    sbSlug: seats[0],
    bbSlug: seats[1],
    level: 0,
    blinds: [10, 20],
    levelMs: 120_000,
    startBlinds: [10, 20],
    stage: "river",
    deck: "",
    hole: {},
    exposed: [],
    board: BOARD,
    inHand: seats.slice(),
    folded: [],
    allIn: [],
    streetBet: {},
    currentBet: 0,
    minRaise: 20,
    needAction: [],
    acted: [],
    toAct: null,
    actSeq: 17,
    startStacks: {},
    log: [],
    ...extra,
  };
}

export function pokerGame(scenario: PokerScenario, now: number, boardCount = 5): GameState {
  const g = pokerGameFull(scenario, now, boardCount);
  g.poker!.board = g.poker!.board.slice(0, boardCount);
  return g;
}

function pokerGameFull(scenario: PokerScenario, now: number, boardCount: number): GameState {
  if (scenario === "huit") {
    const seats = [ME, "gege", "jacky", "momo", "nana", "lulu", "bibi", "dede"];
    // Préflop : bouton Dédé, SB moi, BB Gégé ; Jacky relance, Momo suit,
    // c'est à Nana (bot) de parler.
    const p = pokerBase(seats, {
      handNo: 7,
      level: 1,
      blinds: [20, 40],
      stage: "preflop",
      board: [],
      hole: { [ME]: ["Ah", "Jh"] },
      streetBet: { [ME]: 20, gege: 40, jacky: 120, momo: 120 },
      currentBet: 120,
      minRaise: 80,
      toAct: "nana",
      needAction: ["nana", "lulu", "bibi", "dede", ME, "gege"],
      log: [
        { k: "sb", s: ME, n: 20 },
        { k: "bb", s: "gege", n: 40 },
        { k: "raise", s: "jacky", n: 120 },
        { k: "call", s: "momo", n: 120 },
      ],
    });
    const stacks = { [ME]: 860, gege: 1120, jacky: 640, momo: 1480, nana: 930, lulu: 410, bibi: 1215, dede: 1345 };
    return base(seats, now, {
      phase: "poker",
      casinoGameId: "poker",
      casinoStartedAt: now - 150_000,
      timer: { key: "p", deadlineAt: now + 11_000 },
      poker: p,
      chips: { startingStack: 1000, stacks, committed: { [ME]: 20, gege: 40, jacky: 120, momo: 120 }, bustOrder: [] },
    });
  }

  const seats = [ME, "gege", "jacky", "momo", "lulu", "dede"];
  const stacks = { [ME]: 790, gege: 980, jacky: 960, momo: 860, lulu: 910, dede: 990 };
  if (scenario === "abattage") {
    const hole: Record<string, CardCode[]> = { [ME]: ["7d", "Tc"], momo: ["Qd", "9s"], lulu: ["Kh", "Js"] };
    const best: Record<string, CardCode[]> = {};
    const labels: Record<string, string> = {};
    for (const [s, h] of Object.entries(hole)) {
      const b = bestHand(fromCodes([...h, ...BOARD]));
      best[s] = b.cards.map(toCode);
      labels[s] = describeHand(b.eval);
    }
    const p = pokerBase(seats, {
      stage: "handEnd",
      hole,
      exposed: [ME, "momo", "lulu"],
      folded: ["gege", "jacky", "dede"],
      result: {
        uncontested: false,
        pots: [{ amount: 620, eligible: [ME, "momo", "lulu"], winners: ["momo"], shares: { momo: 620 } }],
        labels,
        best,
        net: { momo: 380, [ME]: -140, lulu: -140, gege: -20, jacky: -20, dede: -60 },
        busted: [],
      },
    });
    return base(seats, now, {
      casinoGameId: "poker",
      casinoStartedAt: now - 79_000,
      poker: p,
      chips: { startingStack: 1000, stacks: { ...stacks, momo: 1240 }, committed: {}, bustOrder: [] },
    });
  }

  // River, à moi de parler : Momo a misé 80, Lulu a suivi, Dédé s'est couché.
  const p = pokerBase(seats, {
    board: BOARD.slice(0, boardCount),
    hole: { [ME]: ["7d", "Tc"] },
    folded: ["gege", "jacky", "dede"],
    streetBet: { momo: 80, lulu: 80 },
    currentBet: 80,
    minRaise: 80,
    toAct: ME,
    needAction: [ME],
    acted: ["momo", "lulu"],
    log: [
      { k: "street", st: "river" },
      { k: "check", s: ME },
      { k: "bet", s: "momo", n: 80 },
      { k: "call", s: "lulu", n: 80 },
      { k: "fold", s: "dede" },
    ],
  });
  return base(seats, now, {
    casinoGameId: "poker",
    casinoStartedAt: now - 79_000,
    timer: { key: "p", deadlineAt: now + 12_000 },
    poker: p,
    chips: { startingStack: 1000, stacks, committed: { [ME]: 60, gege: 20, jacky: 20, momo: 150, lulu: 150, dede: 60 }, bustOrder: [] },
  });
}

// ---------------- Blackjack ----------------

export type BjScenario = "tour" | "resultats" | "huit";
export const BJ_SCENARIOS: { id: BjScenario; label: string }[] = [
  { id: "tour", label: "À moi de jouer" },
  { id: "resultats", label: "Résultats" },
  { id: "huit", label: "8 joueurs · split" },
];

function hand(id: number, cards: CardCode[], bet: number, extra: Partial<BjtHand> = {}): BjtHand {
  return { id, cards, bet, doubled: false, fromSplit: false, splitAces: false, status: "stand", ...extra };
}

function dealLog(seats: BjtSeat[], dealerVisible: number, holeHidden: boolean): BjtDealEvent[] {
  const log: BjtDealEvent[] = [];
  // Distribution façon casino : une carte à chacun, le croupier, une
  // deuxième à chacun, la carte cachée, puis les cartes tirées.
  for (const s of seats) for (const h of s.hands) log.push({ t: "p", s: s.slug, h: h.id, n: 1 });
  log.push({ t: "du", n: 1 });
  for (const s of seats) for (const h of s.hands) if (h.cards.length >= 2) log.push({ t: "p", s: s.slug, h: h.id, n: 2 });
  if (holeHidden || dealerVisible >= 2) log.push({ t: "dh", n: 1 });
  for (const s of seats) for (const h of s.hands) for (let n = 3; n <= h.cards.length; n++) log.push({ t: "p", s: s.slug, h: h.id, n });
  if (!holeHidden && dealerVisible >= 2) {
    log.push({ t: "dr", n: 2 });
    for (let n = 3; n <= dealerVisible; n++) log.push({ t: "dd", n });
  }
  return log;
}

export function bjGame(scenario: BjScenario, now: number): GameState {
  const huit = scenario === "huit";
  // Ordre de la table : je joue en dernier (les autres ont déjà joué).
  const order = huit ? ["gege", "jacky", "momo", "nana", "lulu", "bibi", "dede", ME] : ["gege", "jacky", "momo", "lulu", "dede", ME];
  const results = scenario === "resultats";
  const seats: BjtSeat[] = [
    { slug: "gege", active: 0, hands: [hand(1, ["7d", "3s", "2c", "Ad", "9d"], 25, { status: "bust" })] },
    { slug: "jacky", active: 0, hands: [hand(2, ["4c", "As", "7h", "8c"], 50)] },
    { slug: "momo", active: 0, hands: [hand(3, ["8h", "Kh"], 15)] },
    ...(huit ? [{ slug: "nana", active: 0, hands: [hand(9, ["As", "2c", "3d", "Ah", "4s", "2h"], 20)] }] : []),
    { slug: "lulu", active: 0, hands: [hand(4, ["9c", "Qs"], 40)] },
    ...(huit ? [{ slug: "bibi", active: 0, hands: [hand(10, ["Ah", "Kd"], 30, { status: "blackjack" as const })] }] : []),
    { slug: "dede", active: 0, hands: [hand(5, ["5s", "3h", "9c"], 20)] },
    huit
      ? {
          slug: ME,
          active: 1,
          hands: [hand(6, ["8s", "3d", "Tc"], 25, { fromSplit: true }), hand(7, ["8d", "6h"], 25, { fromSplit: true, status: "playing" })],
        }
      : results
        ? { slug: ME, active: 0, hands: [hand(6, ["2s", "8c", "Ac"], 80, { doubled: true })] }
        : { slug: ME, active: 0, hands: [hand(6, ["2s", "8c"], 20, { status: "playing" })] },
  ];
  const dealerCards: CardCode[] = results ? ["Ts", "7h"] : ["Ts"];
  if (results) {
    const outcome = (s: BjtSeat) => {
      for (const h of s.hands) {
        const t = fromCodes(h.cards).reduce((a, c) => a + (c.value === 14 ? 1 : Math.min(10, c.value)), 0);
        const soft = h.cards.some((c) => c[0] === "A") && t + 10 <= 21 ? t + 10 : t;
        const bet = h.bet;
        if (h.status === "blackjack") Object.assign(h, { outcome: "blackjack", net: Math.floor(bet * 1.5) });
        else if (soft > 21) Object.assign(h, { outcome: "lose", net: -bet });
        else if (soft > 17) Object.assign(h, { outcome: "win", net: bet });
        else if (soft === 17) Object.assign(h, { outcome: "push", net: 0 });
        else Object.assign(h, { outcome: "lose", net: -bet });
      }
      s.net = s.hands.reduce((a, h) => a + (h.net ?? 0), 0);
    };
    seats.forEach(outcome);
  }
  const bets: Record<string, number> = {};
  for (const s of seats) bets[s.slug] = s.hands[0].bet / (s.hands[0].doubled ? 2 : 1);
  const stacks: Record<string, number> = {
    gege: 455,
    jacky: 610,
    momo: 380,
    lulu: 720,
    dede: 505,
    nana: 290,
    bibi: 545,
    [ME]: huit ? 410 : results ? 540 : 460,
  };
  const t: BjtState = {
    round: 3,
    totalRounds: 10,
    stage: results ? "roundEnd" : "playerTurns",
    shoe: "",
    shoeCards: 260,
    reshuffled: false,
    order,
    bets,
    betDone: order.slice(),
    seats,
    turn: seats.length - 1,
    dealer: { cards: dealerCards, hole: null, holeDealt: true, blackjack: false },
    log: dealLog(seats, dealerCards.length, !results),
    replayFrom: 0,
    actSeq: 9,
  };
  return base(order, now, {
    phase: "bjtable",
    casinoGameId: "bjtable",
    casinoStartedAt: now - 200_000,
    timer: results ? undefined : { key: "b", deadlineAt: now + 12_000 },
    bjt: t,
    chips: { startingStack: 500, stacks, committed: {}, bustOrder: [] },
  });
}
