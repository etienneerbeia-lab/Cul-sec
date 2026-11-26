import { draw, fromCodes, shuffledShoe, toCode } from "../casino/cards";
import { finishCasino } from "../casino/finish";
import {
  activeSlugs,
  commit,
  committedOf,
  createLedger,
  markBusted,
  release,
  settle,
  stackOf,
  totalCommitted,
} from "../chips/ledger";
import { fail, notNow } from "../errors";
import { bestHand, describeHand, type HandEval } from "../game/evaluate";
import type { GameState } from "../game/types";
import { BLIND_STRUCTURE, blindsFor, levelAt, STARTING_STACK } from "./blinds";
import { awardPots, buildPots } from "./pots";
import type { PokerLegal, PokerMove, PokerStage, PokerState } from "./types";

// Pauses (ms) : le temps de voir le résultat d'une main, et de retourner
// le board carte par carte quand tout le monde est à tapis.
export const HAND_END_SHOWDOWN_MS = 5500;
export const HAND_END_FOLD_MS = 2500;
export const RUNOUT_STREET_MS = 1400;

export function pokerOf(g: GameState): PokerState {
  if (!g.poker) notNow();
  return g.poker;
}

// ---------- Ordre de table ----------

function seatIdx(p: PokerState, slug: string): number {
  return p.seats.indexOf(slug);
}

// Prochain siège (après `from`, dans le sens du jeu) qui vérifie `pred`.
function nextSeat(p: PokerState, from: number, pred: (slug: string) => boolean): number {
  const n = p.seats.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (pred(p.seats[i])) return i;
  }
  return -1;
}

// Joueurs de `list` dans l'ordre de la table, en commençant par `startSlug`
// (inclus) ou le premier après lui s'il n'est pas dans la liste.
function orderFrom(p: PokerState, list: string[], startIdx: number): string[] {
  const set = new Set(list);
  const out: string[] = [];
  const n = p.seats.length;
  for (let k = 0; k < n; k++) {
    const s = p.seats[(startIdx + k) % n];
    if (set.has(s)) out.push(s);
  }
  return out;
}

const live = (p: PokerState) => p.inHand.filter((s) => !p.folded.includes(s));
const canAct = (p: PokerState) => live(p).filter((s) => !p.allIn.includes(s));

// Ordre de distribution / partage des jetons indivisibles : à partir de la
// gauche du bouton.
export function leftOfButtonOrder(p: PokerState): string[] {
  return orderFrom(p, p.seats, (p.button + 1) % p.seats.length);
}

// ---------- Début du tournoi / d'une main ----------

export function startPokerTournament(g: GameState, now: number): void {
  const seats = g.playersPublic.map((pl) => pl.slug);
  const s = BLIND_STRUCTURE;
  g.chips = createLedger(seats, STARTING_STACK);
  g.poker = {
    seats,
    handNo: 0,
    button: Math.floor(Math.random() * seats.length),
    sbSlug: null,
    bbSlug: seats[0],
    level: 0,
    blinds: s.start,
    levelMs: s.levelMs,
    startBlinds: s.start,
    stage: "preflop",
    deck: "",
    hole: {},
    exposed: [],
    board: [],
    inHand: [],
    folded: [],
    allIn: [],
    streetBet: {},
    currentBet: 0,
    minRaise: 0,
    needAction: [],
    acted: [],
    toAct: null,
    actSeq: 0,
    startStacks: {},
    log: [],
  };
  g.phase = "poker";
  startHand(g, now, true);
}

function postBlind(g: GameState, slug: string, amount: number, kind: "sb" | "bb"): void {
  const p = g.poker!;
  const n = Math.min(amount, stackOf(g.chips!, slug));
  commit(g.chips!, slug, n);
  p.streetBet[slug] = n;
  if (stackOf(g.chips!, slug) === 0) p.allIn.push(slug);
  p.log.push({ k: kind, s: slug, n });
}

export function startHand(g: GameState, now: number, first = false): void {
  const p = g.poker!;
  const l = g.chips!;
  const players = activeSlugs(l).filter((s) => stackOf(l, s) > 0);
  p.handNo += 1;
  const structure = { levelMs: p.levelMs, start: p.startBlinds };
  p.level = levelAt(structure, now - (g.casinoStartedAt ?? now));
  p.blinds = blindsFor(structure, p.level);
  const inGame = (s: string) => players.includes(s);
  // Bouton : au hasard au départ, puis au joueur suivant encore en jeu.
  if (first) {
    if (!inGame(p.seats[p.button])) p.button = nextSeat(p, p.button, inGame);
  } else p.button = nextSeat(p, p.button, inGame);

  let sbIdx: number;
  let bbIdx: number;
  if (players.length === 2) {
    // Heads-up : le bouton est petite blinde et parle en premier preflop.
    sbIdx = p.button;
    bbIdx = nextSeat(p, p.button, inGame);
  } else {
    sbIdx = nextSeat(p, p.button, inGame);
    bbIdx = nextSeat(p, sbIdx, inGame);
  }

  p.stage = "preflop";
  p.deck = shuffledShoe(1);
  p.hole = {};
  p.exposed = [];
  p.board = [];
  p.inHand = orderFrom(p, players, (p.button + 1) % p.seats.length);
  p.folded = [];
  p.allIn = [];
  p.streetBet = {};
  p.acted = [];
  p.log = [];
  p.result = undefined;
  p.startStacks = {};
  players.forEach((s) => (p.startStacks[s] = stackOf(l, s)));
  for (let round = 0; round < 2; round++)
    for (const s of p.inHand) {
      const [c, rest] = draw(p.deck);
      p.deck = rest;
      (p.hole[s] ??= []).push(c);
    }

  p.sbSlug = p.seats[sbIdx];
  p.bbSlug = p.seats[bbIdx];
  postBlind(g, p.sbSlug, p.blinds[0], "sb");
  postBlind(g, p.bbSlug, p.blinds[1], "bb");
  p.currentBet = Math.max(p.streetBet[p.sbSlug] ?? 0, p.streetBet[p.bbSlug] ?? 0);
  p.minRaise = p.blinds[1];

  // Premier à parler preflop : après la BB (heads-up : le bouton/SB).
  const firstIdx = players.length === 2 ? sbIdx : (bbIdx + 1) % p.seats.length;
  p.needAction = orderFrom(p, canAct(p), firstIdx);
  // Tout le monde déjà à tapis (ou seul à pouvoir parler, déjà à niveau) :
  // pas d'enchères.
  if (p.needAction.length === 1 && (p.streetBet[p.needAction[0]] ?? 0) >= p.currentBet) p.needAction = [];
  p.actSeq += 1;
  advance(g);
}

// ---------- Coups ----------

export function legalFor(g: GameState, slug: string): PokerLegal {
  const p = g.poker!;
  const stack = stackOf(g.chips!, slug);
  const mine = p.streetBet[slug] ?? 0;
  const toCall = Math.max(0, p.currentBet - mine);
  const callAmount = Math.min(toCall, stack);
  const othersCanAct = canAct(p).some((s) => s !== slug);
  const maxRaiseTo = mine + stack;
  const minRaiseTo = Math.min(p.currentBet + p.minRaise, maxRaiseTo);
  const canRaise = stack > toCall && othersCanAct && !p.acted.includes(slug);
  return { canCheck: toCall === 0, callAmount, canRaise, minRaiseTo, maxRaiseTo };
}

export function applyPokerMove(g: GameState, slug: string, move: PokerMove, to: number | undefined): void {
  const p = pokerOf(g);
  if (!["preflop", "flop", "turn", "river"].includes(p.stage)) notNow();
  if (p.toAct !== slug) fail(403, "Ce n'est pas ton tour.");
  const l = g.chips!;
  const legal = legalFor(g, slug);
  const mine = p.streetBet[slug] ?? 0;
  const others = () => orderFrom(p, canAct(p), (seatIdx(p, slug) + 1) % p.seats.length).filter((s) => s !== slug);

  switch (move) {
    case "fold":
      p.folded.push(slug);
      p.log.push({ k: "fold", s: slug });
      break;
    case "check":
      if (!legal.canCheck) fail(400, "Impossible de checker : il y a une mise à suivre.");
      p.log.push({ k: "check", s: slug });
      break;
    case "call": {
      if (legal.canCheck) fail(400, "Rien à suivre : checke.");
      commit(l, slug, legal.callAmount);
      p.streetBet[slug] = mine + legal.callAmount;
      if (stackOf(l, slug) === 0) p.allIn.push(slug);
      p.log.push({ k: p.allIn.includes(slug) ? "allin" : "call", s: slug, n: p.allIn.includes(slug) ? p.streetBet[slug] : legal.callAmount });
      break;
    }
    case "raise": {
      if (!legal.canRaise) fail(400, "Relance impossible.");
      if (typeof to !== "number" || !Number.isInteger(to)) fail(400, "Montant invalide.");
      if (to > legal.maxRaiseTo) fail(400, "Pas assez de jetons.");
      if (to < legal.minRaiseTo) fail(400, `Relance minimum : ${legal.minRaiseTo}.`);
      const wasBet = p.currentBet === 0;
      commit(l, slug, to - mine);
      p.streetBet[slug] = to;
      const inc = to - p.currentBet;
      p.currentBet = to;
      if (inc >= p.minRaise) {
        // Relance complète : rouvre les relances pour tout le monde.
        p.minRaise = inc;
        p.acted = [];
      }
      if (stackOf(l, slug) === 0) p.allIn.push(slug);
      p.log.push({ k: p.allIn.includes(slug) ? "allin" : wasBet ? "bet" : "raise", s: slug, n: to });
      // Tous les autres (pas couchés, pas à tapis) doivent reparler.
      p.needAction = [slug, ...others()];
      break;
    }
    default:
      fail(400, "Coup inconnu.");
  }
  p.needAction = p.needAction.filter((s) => s !== slug);
  if (!p.acted.includes(slug)) p.acted.push(slug);
  p.actSeq += 1;
  advance(g);
}

// Coup par défaut (chrono expiré, joueur absent) : check si possible,
// sinon se coucher.
export function defaultMove(g: GameState, slug: string): PokerMove {
  return legalFor(g, slug).canCheck ? "check" : "fold";
}

// ---------- Déroulement ----------

function dealStreet(g: GameState): void {
  const p = g.poker!;
  const n = p.board.length === 0 ? 3 : 1;
  for (let i = 0; i < n; i++) {
    const [c, rest] = draw(p.deck);
    p.deck = rest;
    p.board.push(c);
  }
  const st: PokerStage = p.board.length === 3 ? "flop" : p.board.length === 4 ? "turn" : "river";
  p.log.push({ k: "street", st });
}

// Rend la part d'une mise que personne n'a suivie.
function returnUncalled(g: GameState): void {
  const p = g.poker!;
  const bets = p.inHand.map((s) => [s, p.streetBet[s] ?? 0] as const).sort((a, b) => b[1] - a[1]);
  if (bets.length < 2) return;
  const [[top, a], [, b]] = bets;
  if (a > b) {
    release(g.chips!, top, a - b);
    p.streetBet[top] = b;
    p.allIn = p.allIn.filter((s) => s !== top || stackOf(g.chips!, s) === 0);
    p.log.push({ k: "return", s: top, n: a - b });
  }
}

function advance(g: GameState): void {
  const p = g.poker!;
  const alive = live(p);
  if (alive.length === 1) {
    returnUncalled(g);
    return winUncontested(g, alive[0]);
  }
  if (p.needAction.length > 0) {
    p.toAct = p.needAction[0];
    return;
  }
  // Fin de la rue.
  p.toAct = null;
  returnUncalled(g);
  p.streetBet = {};
  p.currentBet = 0;
  p.minRaise = p.blinds[1];
  p.acted = [];
  if (p.board.length === 5) return showdown(g);
  if (canAct(p).length <= 1) {
    // Tout le monde (sauf un au plus) est à tapis : on retourne les cartes
    // et le board sort rue par rue (voir onDeadline).
    p.stage = "runout";
    p.exposed = alive.slice();
    return;
  }
  dealStreet(g);
  p.stage = p.board.length === 3 ? "flop" : p.board.length === 4 ? "turn" : "river";
  p.needAction = orderFrom(p, canAct(p), (p.button + 1) % p.seats.length);
  p.toAct = p.needAction[0];
}

// Tapis : une rue de plus à chaque échéance, puis l'abattage.
export function runoutStep(g: GameState): void {
  const p = g.poker!;
  if (p.stage !== "runout") return;
  if (p.board.length < 5) dealStreet(g);
  if (p.board.length === 5) showdown(g);
}

function winUncontested(g: GameState, winner: string): void {
  const p = g.poker!;
  const pot = totalCommitted(g.chips!);
  const net = settle(g.chips!, { [winner]: pot }, "table");
  p.result = {
    uncontested: true,
    pots: [{ amount: pot, eligible: [winner], winners: [winner], shares: { [winner]: pot } }],
    labels: {},
    best: {},
    net,
    busted: [],
  };
  p.log.push({ k: "win", s: winner, n: pot });
  endHand(g);
}

function showdown(g: GameState): void {
  const p = g.poker!;
  const alive = live(p);
  const evals: Record<string, HandEval> = {};
  p.result = { uncontested: false, pots: [], labels: {}, best: {}, net: {}, busted: [] };
  const board = fromCodes(p.board);
  for (const s of alive) {
    const bh = bestHand([...fromCodes(p.hole[s]), ...board]);
    evals[s] = bh.eval;
    p.result.best[s] = bh.cards.map(toCode);
  }
  const contrib: Record<string, number> = {};
  p.inHand.forEach((s) => (contrib[s] = committedOf(g.chips!, s)));
  const pots = buildPots(contrib, alive);
  const { results, payouts } = awardPots(pots, evals, leftOfButtonOrder(p));
  p.result.pots = results;
  p.result.net = settle(g.chips!, payouts, "table");
  p.exposed = alive.slice();
  for (const s of alive) p.result.labels[s] = describeHand(evals[s]);
  results.forEach((r) => r.winners.forEach((w) => p.log.push({ k: "win", s: w, n: r.shares[w] })));
  endHand(g);
}

function endHand(g: GameState): void {
  const p = g.poker!;
  p.stage = "handEnd";
  p.toAct = null;
  p.needAction = [];
  p.result!.busted = markBusted(g.chips!, 1, p.startStacks);
  if (activeSlugs(g.chips!).length <= 1) p.over = true;
}

// Après la pause de fin de main : main suivante, ou classement final.
export function afterHandEnd(g: GameState, now: number): void {
  const p = g.poker!;
  if (p.stage !== "handEnd") return;
  if (p.over) finishCasino(g, now);
  else startHand(g, now);
}
