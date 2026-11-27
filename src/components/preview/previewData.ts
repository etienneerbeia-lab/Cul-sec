import { fromCode, fromCodes, toCode, type CardCode } from "@/lib/casino/cards";
import type { BjtDealEvent, BjtHand, BjtSeat, BjtState } from "@/lib/bjtable/types";
import { bestHand, bestOf7, describeHand, handLabel5 } from "@/lib/game/evaluate";
import type {
  BlackjackDealEvent,
  BlackjackHand,
  BlackjackPlayerState,
  BlackjackResultEntry,
  Card,
  DrinkEntry,
  GameState,
  PlayerPublic,
} from "@/lib/game/types";
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

// ---------------- Soirée : Poker ----------------

export type PartyPokerScenario = "tour" | "abattage";
export const PARTY_POKER_SCENARIOS: { id: PartyPokerScenario; label: string }[] = [
  { id: "tour", label: "À moi · river" },
  { id: "abattage", label: "Abattage" },
];

const PARTY = [ME, "gege", "jacky", "momo", "lulu", "dede"];
const cards = (codes: string[]): Card[] => codes.map(fromCode);
const gulps: Record<string, number> = { [ME]: 7, gege: 3, jacky: 12, momo: 5, lulu: 9, dede: 4 };

function partyBase(now: number, extra: Partial<GameState>): GameState {
  return {
    ...base(PARTY, now, {}),
    universe: undefined,
    round: 4,
    totalRounds: 10,
    playersPublic: pub(PARTY).map((p) => ({ ...p, gulpsTotal: gulps[p.slug] ?? 0 })),
    ...extra,
  };
}

export function partyPokerGame(scenario: PartyPokerScenario, now: number, boardCount = 5): { game: GameState; myHand: Card[] } {
  const myHand = cards(["7d", "Tc"]);
  const board = cards(BOARD.slice(0, boardCount));
  const g = partyBase(now, {
    phase: "betting",
    roundTypeId: "holdem",
    street: "river",
    community: board,
    communityRevealed: board.length,
    pot: 9,
    currentBet: 1,
    foldReferencePot: 6,
    dealTargets: [0, 1, 2, 3, 4, 5],
    turnIdx: 0,
    startIndex: 1,
    turnOrder: [1, 2, 3, 4, 5, 0],
    turnPointer: 5,
    needsToAct: [0],
    bettingOpts: { mode: "check-or-bet", foldCost: "pot" },
    timer: { key: "p", deadlineAt: now + 25_000 },
  });
  const set = (slug: string, v: Partial<GameState["playersPublic"][number]>) => Object.assign(g.playersPublic.find((p) => p.slug === slug)!, v);
  set("gege", { folded: true, foldCost: 2 });
  set("jacky", { folded: true, foldCost: 4 });
  set("dede", { folded: true, foldCost: 6 });
  set("momo", { bet: 1 });
  set("lulu", { bet: 1 });
  const drinks: DrinkEntry[] = [
    { slug: "gege", name: NAMES.gege, n: 2, why: "S'est couché" },
    { slug: "jacky", name: NAMES.jacky, n: 4, why: "S'est couché" },
    { slug: "dede", name: NAMES.dede, n: 6, why: "S'est couché" },
  ];
  g.drinks = drinks;
  if (scenario === "abattage") {
    const hands: Record<string, Card[]> = { [NAMES[ME]]: myHand, [NAMES.momo]: cards(["Qd", "9s"]), [NAMES.lulu]: cards(["Kh", "Js"]) };
    const full = cards(BOARD);
    const labels: Record<string, string> = {};
    for (const [n, h] of Object.entries(hands)) labels[n] = handLabel5(bestOf7([...h, ...full]));
    g.phase = "showdown";
    g.community = full;
    g.turnIdx = undefined;
    g.timer = undefined;
    g.pot = 9;
    g.playersPublic.forEach((p) => (p.bet = 0));
    g.lastResults = {
      type: "holdem",
      soleSurvivor: false,
      winners: [NAMES.momo],
      losers: [NAMES[ME], NAMES.lulu],
      potAtEnd: 9,
      hands,
      handLabels: labels,
    };
    g.drinks = [...drinks, { slug: ME, name: NAMES[ME], n: 9, why: "Perdu à l'abattage" }, { slug: "lulu", name: NAMES.lulu, n: 9, why: "Perdu à l'abattage" }];
  }
  return { game: g, myHand };
}

// ---------------- Soirée : Blackjack ----------------

export type PartyBjScenario = "tour" | "resultats";
export const PARTY_BJ_SCENARIOS: { id: PartyBjScenario; label: string }[] = [
  { id: "tour", label: "À moi de jouer" },
  { id: "resultats", label: "Résultats" },
];

function bjHand(id: number, codes: string[], bet: number, extra: Partial<BlackjackHand> = {}): BlackjackHand {
  return { id, cards: cards(codes), bet, status: "stand", doubled: false, isSplitAces: false, fromSplit: false, ...extra };
}

export function partyBjGame(scenario: PartyBjScenario, now: number): GameState {
  const results = scenario === "resultats";
  const order = ["gege", "jacky", "momo", "lulu", "dede", ME];
  const players: BlackjackPlayerState[] = [
    { slug: "gege", name: NAMES.gege, activeHandIdx: 0, hands: [bjHand(1, ["7d", "3s", "2c", "Ad", "9d"], 2, { status: "bust" })] },
    { slug: "jacky", name: NAMES.jacky, activeHandIdx: 0, hands: [bjHand(2, ["4c", "As", "7h", "8c"], 3)] },
    { slug: "momo", name: NAMES.momo, activeHandIdx: 0, hands: [bjHand(3, ["8h", "Kh"], 1)] },
    { slug: "lulu", name: NAMES.lulu, activeHandIdx: 0, hands: [bjHand(4, ["9c", "Qs"], 4)] },
    { slug: "dede", name: NAMES.dede, activeHandIdx: 0, hands: [bjHand(5, ["5s", "3h", "9c"], 2)] },
    {
      slug: ME,
      name: NAMES[ME],
      activeHandIdx: 0,
      hands: [results ? bjHand(6, ["2s", "8c", "Ac"], 4, { doubled: true }) : bjHand(6, ["2s", "8c"], 2, { status: "playing" })],
    },
  ];
  const log: BlackjackDealEvent[] = [];
  for (const p of players) log.push({ target: "player", slug: p.slug, handId: p.hands[0].id });
  log.push({ target: "dealer-up" });
  for (const p of players) log.push({ target: "player", slug: p.slug, handId: p.hands[0].id });
  log.push({ target: "dealer-hidden" });
  for (const p of players) for (let k = 2; k < p.hands[0].cards.length; k++) log.push({ target: "player", slug: p.slug, handId: p.hands[0].id });
  if (results) log.push({ target: "dealer-reveal" });
  const bets: Record<string, number> = {};
  players.forEach((p) => (bets[p.slug] = p.hands[0].bet / (p.hands[0].doubled ? 2 : 1)));
  const g = partyBase(now, {
    phase: results ? "showdown" : "blackjack",
    roundTypeId: "blackjack",
    timer: results ? undefined : { key: "b", deadlineAt: now + 20_000 },
    blackjack: {
      stage: results ? "result" : "playerTurns",
      bets,
      betResponded: order.slice(),
      players,
      turnPointer: 5,
      dealer: { cards: cards(results ? ["Ts", "7h"] : ["Ts"]), hiddenCard: null },
      deck: [],
      dealLog: log,
      distributionQueue: [],
    },
  });
  if (results) {
    const res: BlackjackResultEntry[] = [];
    const outcome: Record<string, BlackjackResultEntry["outcome"]> = { gege: "lose", jacky: "win", momo: "win", lulu: "win", dede: "push", [ME]: "win" };
    for (const p of players) {
      const h = p.hands[0];
      const o = outcome[p.slug];
      res.push({ slug: p.slug, name: p.name, handIdx: 0, cards: h.cards, total: 0, bet: h.bet, outcome: o, amount: o === "push" ? 0 : h.bet });
    }
    g.lastResults = { type: "blackjack", blackjackResults: res };
    g.drinks = [
      { slug: "gege", name: NAMES.gege, n: 2, why: "Sauté" },
      { slug: "dede", name: NAMES.dede, n: 3, why: "Offert par Jacky" },
      { slug: ME, name: NAMES[ME], n: 1, why: "Offert par Momo" },
    ];
  }
  return g;
}
