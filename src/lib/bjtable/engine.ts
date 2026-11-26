import { BJ_DEAL_MS, BJ_DEALER_MS } from "../blackjack/engine";
import { dealerShouldHit, handValue, isSoft } from "../blackjack/rules";
import { cardValue, draw, fromCodes, shuffledShoe, shoeSize, type CardCode } from "../casino/cards";
import { finishCasino } from "../casino/finish";
import { activeSlugs, commit, createLedger, isBusted, markBusted, seatPlayer, settle, stackOf } from "../chips/ledger";
import { fail, notNow } from "../errors";
import type { GameState, Player, PlayerPublic } from "../game/types";
import { BJT_RULES as R } from "./config";
import type { BjtDealEvent, BjtHand, BjtSeat, BjtState } from "./types";

// ---------- Outils ----------

export const points = (c: CardCode) => {
  const v = cardValue(c);
  return v === 14 ? 11 : Math.min(10, v);
};
export const total = (cards: CardCode[]) => handValue(fromCodes(cards));
export const soft = (cards: CardCode[]) => isSoft(fromCodes(cards));

// Texte du total, avec les mains soft : « 7 / 17 », « 21 », « 12 ».
export function totalLabel(cards: CardCode[]): string {
  if (cards.length === 0) return "";
  const t = total(cards);
  if (t <= 21 && soft(cards) && t !== 21) return `${t - 10} / ${t}`;
  return String(t);
}

export function bjtOf(g: GameState): BjtState {
  if (!g.bjt) notNow();
  return g.bjt;
}

// Délai de rejeu côté client d'une liste d'événements (même rythme que le
// Blackjack Soirée : distribution rapide, croupier plus lent).
export function replayMs(events: BjtDealEvent[]): number {
  return events.reduce((t, e) => t + (e.t === "dr" || e.t === "dd" ? BJ_DEALER_MS : BJ_DEAL_MS), 0);
}

function drawCard(t: BjtState): CardCode {
  // Sécurité : un sabot de 6 jeux ne s'épuise pas en une manche, mais au
  // cas où, on en ouvre un neuf.
  if (t.shoe.length < 2) t.shoe = shuffledShoe(R.decks);
  const [c, rest] = draw(t.shoe);
  t.shoe = rest;
  return c;
}

export const activePlayers = (g: GameState) => bjtOf(g).order.filter((s) => !isBusted(g.chips!, s));

// ---------- Début de partie / de manche ----------

export function startBjTable(g: GameState): void {
  const order = g.playersPublic.map((p) => p.slug);
  g.chips = createLedger(order, R.startingBankroll);
  const opts = g.casinoOptions;
  g.bjt = {
    round: 0,
    totalRounds: opts?.bjEndMode === "survivor" ? 0 : (opts?.bjRounds ?? 10),
    stage: "betting",
    shoe: shuffledShoe(R.decks),
    shoeCards: R.decks * 52,
    reshuffled: true,
    order,
    bets: {},
    betDone: [],
    seats: [],
    turn: 0,
    dealer: { cards: [], hole: null, holeDealt: false, blackjack: false },
    log: [],
    actSeq: 0,
    replayFrom: 0,
  };
  g.phase = "bjtable";
  startRound(g);
}

export function startRound(g: GameState): void {
  const t = bjtOf(g);
  t.round += 1;
  g.round = t.round;
  t.stage = "betting";
  t.bets = {};
  t.betDone = [];
  t.seats = [];
  t.turn = 0;
  t.dealer = { cards: [], hole: null, holeDealt: false, blackjack: false };
  t.log = [];
  t.replayFrom = 0;
  t.noBets = undefined;
  t.startStacks = {};
  // Remélange quand ~75 % du sabot est sorti.
  t.reshuffled = shoeSize(t.shoe) <= t.shoeCards * (1 - R.reshuffleAt);
  if (t.reshuffled) t.shoe = shuffledShoe(R.decks);
  t.actSeq += 1;
}

// Joueurs arrivés en cours de partie : ils s'assoient avant la distribution
// (pendant les mises ou la pause de fin de manche), avec 500 €.
export function admitPlayers(g: GameState, waiting: Player[]): boolean {
  const t = g.bjt;
  if (!t || !(t.stage === "betting" || t.stage === "roundEnd") || t.over) return false;
  let changed = false;
  for (const p of waiting) {
    if (t.order.length >= 8 || t.order.includes(p.slug)) continue;
    seatPlayer(g.chips!, p.slug, R.startingBankroll);
    t.order.push(p.slug);
    const pub: PlayerPublic = { name: p.name, slug: p.slug, bot: p.bot || undefined, gulpsTotal: 0, folded: false, bet: 0, foldCost: null };
    g.playersPublic.push(pub);
    changed = true;
  }
  return changed;
}

// ---------- Mises ----------

export function placeBet(g: GameState, slug: string, amount: number): void {
  const t = bjtOf(g);
  if (t.stage !== "betting") notNow();
  if (!activePlayers(g).includes(slug)) fail(403, "Tu ne joues pas à cette table.");
  if (t.betDone.includes(slug)) fail(409, "Tu as déjà misé.");
  if (!Number.isInteger(amount) || amount < 0) fail(400, "Mise invalide.");
  const stack = stackOf(g.chips!, slug);
  if (amount > 0 && amount < R.minBet) fail(400, `Mise minimum : ${R.minBet} €.`);
  if (amount > stack) fail(400, "Tu n'as pas assez.");
  if (amount > 0) commit(g.chips!, slug, amount);
  t.bets[slug] = amount;
  t.betDone.push(slug);
  t.actSeq += 1;
  if (activePlayers(g).every((s) => t.betDone.includes(s))) deal(g);
}

// Fin du chrono de mise : ceux qui n'ont rien misé ne jouent pas cette manche.
export function closeBetting(g: GameState): void {
  const t = bjtOf(g);
  if (t.stage !== "betting") return;
  for (const s of activePlayers(g)) if (!t.betDone.includes(s)) {
    t.bets[s] = 0;
    t.betDone.push(s);
  }
  deal(g);
}

function newHand(id: number, bet: number): BjtHand {
  return { id, cards: [], bet, doubled: false, fromSplit: false, splitAces: false, status: "playing" };
}

function deal(g: GameState): void {
  const t = bjtOf(g);
  const players = t.order.filter((s) => (t.bets[s] ?? 0) > 0);
  if (players.length === 0) {
    t.noBets = true;
    return endRound(g);
  }
  players.forEach((s) => (t.startStacks![s] = stackOf(g.chips!, s) + t.bets[s]));
  t.seats = players.map((slug) => ({ slug, hands: [newHand(0, t.bets[slug])], active: 0 }));
  t.log = [];
  t.replayFrom = 0;
  for (let round = 0; round < 2; round++) {
    for (const seat of t.seats) {
      seat.hands[0].cards.push(drawCard(t));
      t.log.push({ t: "p", s: seat.slug, h: 0, n: round + 1 });
    }
    if (round === 0) {
      t.dealer.cards.push(drawCard(t));
      t.log.push({ t: "du", n: 1 });
    } else {
      t.dealer.hole = drawCard(t);
      t.dealer.holeDealt = true;
      t.log.push({ t: "dh", n: 2 });
    }
  }
  for (const seat of t.seats) if (total(seat.hands[0].cards) === 21) seat.hands[0].status = "blackjack";
  t.actSeq += 1;

  // Assurance : proposée à chacun quand le croupier montre un As.
  if (R.insurance && cardValue(t.dealer.cards[0]) === 14) {
    for (const seat of t.seats) {
      const cost = Math.floor(seat.hands[0].bet / 2);
      if (cost < 1 || stackOf(g.chips!, seat.slug) < cost) seat.insurance = 0;
    }
    if (t.seats.some((s) => s.insurance === undefined)) {
      t.stage = "insurance";
      return;
    }
  }
  afterInsurance(g);
}

// ---------- Assurance ----------

export function decideInsurance(g: GameState, slug: string, take: boolean): void {
  const t = bjtOf(g);
  if (t.stage !== "insurance") notNow();
  const seat = t.seats.find((s) => s.slug === slug);
  if (!seat) fail(403, "Tu ne joues pas cette manche.");
  if (seat.insurance !== undefined) fail(409, "Déjà décidé.");
  const cost = Math.floor(seat.hands[0].bet / 2);
  if (take) commit(g.chips!, slug, cost);
  seat.insurance = take ? cost : 0;
  t.actSeq += 1;
  if (t.seats.every((s) => s.insurance !== undefined)) afterInsurance(g);
}

export function closeInsurance(g: GameState): void {
  const t = bjtOf(g);
  if (t.stage !== "insurance") return;
  t.seats.forEach((s) => (s.insurance ??= 0));
  afterInsurance(g);
}

function revealHole(t: BjtState): void {
  if (!t.dealer.hole) return;
  t.dealer.cards.push(t.dealer.hole);
  t.dealer.hole = null;
  t.log.push({ t: "dr", n: t.dealer.cards.length });
}

function afterInsurance(g: GameState): void {
  const t = bjtOf(g);
  const up = t.dealer.cards[0];
  // Peek : avec un As ou un 10 visible, le croupier regarde sa carte
  // cachée ; s'il a blackjack, la manche s'arrête tout de suite.
  if (R.peek && points(up) >= 10 && points(up) + points(t.dealer.hole!) === 21) {
    t.dealer.blackjack = true;
    revealHole(t);
    return settleRound(g);
  }
  t.stage = "playerTurns";
  t.turn = 0;
  t.seats.forEach((s) => (s.active = 0));
  if (!findNext(t)) dealerPlay(g);
}

// ---------- Tours des joueurs ----------

function findNext(t: BjtState): boolean {
  while (t.turn < t.seats.length) {
    const seat = t.seats[t.turn];
    while (seat.active < seat.hands.length) {
      if (seat.hands[seat.active].status === "playing") return true;
      seat.active++;
    }
    t.turn++;
  }
  return false;
}

export function currentSeat(t: BjtState): BjtSeat | null {
  return t.stage === "playerTurns" ? (t.seats[t.turn] ?? null) : null;
}

export interface BjtLegal {
  canHit: boolean;
  canDouble: boolean;
  canSplit: boolean;
}

export function legalFor(g: GameState, slug: string): BjtLegal | null {
  const t = bjtOf(g);
  const seat = currentSeat(t);
  if (!seat || seat.slug !== slug) return null;
  const hand = seat.hands[seat.active];
  const stack = stackOf(g.chips!, slug);
  const two = hand.cards.length === 2;
  const pair =
    two && (R.splitAnyTen ? points(hand.cards[0]) === points(hand.cards[1]) : cardValue(hand.cards[0]) === cardValue(hand.cards[1]));
  const aces = two && cardValue(hand.cards[0]) === 14 && cardValue(hand.cards[1]) === 14;
  return {
    canHit: true,
    canDouble: two && stack >= hand.bet && (!hand.fromSplit || R.doubleAfterSplit) && !hand.splitAces,
    canSplit: pair && stack >= hand.bet && seat.hands.length < R.maxHands && !(aces && hand.fromSplit && !R.resplitAces),
  };
}

export type BjtMove = "hit" | "stand" | "double" | "split";

export function playMove(g: GameState, slug: string, move: BjtMove): void {
  const t = bjtOf(g);
  if (t.stage !== "playerTurns") notNow();
  const legal = legalFor(g, slug);
  if (!legal) fail(403, "Ce n'est pas ton tour.");
  const seat = t.seats[t.turn];
  const hand = seat.hands[seat.active];
  t.replayFrom = t.log.length;
  const push = (h: BjtHand) => {
    h.cards.push(drawCard(t));
    t.log.push({ t: "p", s: slug, h: h.id, n: h.cards.length });
  };
  switch (move) {
    case "hit":
      push(hand);
      if (total(hand.cards) > 21) hand.status = "bust";
      // 21 : on reste automatiquement.
      else if (total(hand.cards) === 21) hand.status = "stand";
      break;
    case "stand":
      hand.status = "stand";
      break;
    case "double":
      if (!legal.canDouble) fail(400, "Doubler n'est pas possible ici.");
      commit(g.chips!, slug, hand.bet);
      hand.bet *= 2;
      hand.doubled = true;
      push(hand);
      hand.status = total(hand.cards) > 21 ? "bust" : "stand";
      break;
    case "split": {
      if (!legal.canSplit) fail(400, "Séparer n'est pas possible ici.");
      commit(g.chips!, slug, hand.bet);
      const aces = cardValue(hand.cards[0]) === 14;
      const second = newHand(Math.max(...seat.hands.map((h) => h.id)) + 1, hand.bet);
      second.cards = [hand.cards[1]];
      hand.cards = [hand.cards[0]];
      for (const h of [hand, second]) {
        h.fromSplit = true;
        h.splitAces = aces;
      }
      seat.hands.splice(seat.active + 1, 0, second);
      t.log.push({ t: "p", s: slug, h: hand.id, n: 1 });
      t.log.push({ t: "p", s: slug, h: second.id, n: 1 });
      push(hand);
      push(second);
      for (const h of [hand, second]) {
        // As séparés : une seule carte chacun. 21 après split = 21 (pas un
        // blackjack), on reste automatiquement.
        if ((aces && R.splitAcesOneCard) || total(h.cards) === 21) h.status = "stand";
      }
      break;
    }
    default:
      fail(400, "Coup inconnu.");
  }
  t.actSeq += 1;
  if (!findNext(t)) dealerPlay(g);
}

// ---------- Croupier et règlement ----------

function dealerPlay(g: GameState): void {
  const t = bjtOf(g);
  revealHole(t);
  // Le croupier ne tire que s'il reste une main à battre (ni sautée, ni
  // blackjack déjà payé).
  const needed = t.seats.some((s) => s.hands.some((h) => h.status === "stand"));
  while (needed && dealerShouldHit(fromCodes(t.dealer.cards), R.dealerHitsSoft17)) {
    t.dealer.cards.push(drawCard(t));
    t.log.push({ t: "dd", n: t.dealer.cards.length });
  }
  settleRound(g);
}

export function settleRound(g: GameState): void {
  const t = bjtOf(g);
  const dv = total(t.dealer.cards);
  const dealerBJ = t.dealer.blackjack || (t.dealer.cards.length === 2 && dv === 21);
  const dealerBust = dv > 21;
  const payouts: Record<string, number> = {};
  for (const seat of t.seats) {
    let pay = 0;
    let net = 0;
    for (const h of seat.hands) {
      const v = total(h.cards);
      const natural = h.status === "blackjack";
      if (h.status === "bust") h.outcome = "lose";
      else if (dealerBJ) h.outcome = natural ? "push" : "lose";
      else if (natural) h.outcome = "blackjack";
      else if (dealerBust || v > dv) h.outcome = "win";
      else if (v === dv) h.outcome = "push";
      else h.outcome = "lose";
      const win = h.outcome === "blackjack" ? Math.ceil(h.bet * R.blackjackPays) : h.outcome === "win" ? h.bet : 0;
      const back = h.outcome === "lose" ? 0 : h.bet + win;
      h.net = back - h.bet;
      pay += back;
      net += h.net;
    }
    if (seat.insurance && seat.insurance > 0) {
      seat.insuranceNet = dealerBJ ? seat.insurance * R.insurancePays : -seat.insurance;
      if (dealerBJ) pay += seat.insurance * (R.insurancePays + 1);
      net += seat.insuranceNet;
    }
    seat.net = net;
    payouts[seat.slug] = pay;
  }
  settle(g.chips!, payouts, "house");
  endRound(g);
}

function endRound(g: GameState): void {
  const t = bjtOf(g);
  t.stage = "roundEnd";
  // Sous la mise minimum : plus de quoi jouer, on regarde la fin.
  markBusted(g.chips!, R.minBet, t.startStacks ?? {});
  const alive = activeSlugs(g.chips!).length;
  const survivorDone = t.order.length >= 2 ? alive <= 1 : alive === 0;
  if (alive === 0) t.over = true;
  else if (t.totalRounds > 0) t.over = t.round >= t.totalRounds;
  else t.over = survivorDone || t.round >= R.survivorMaxRounds;
  t.actSeq += 1;
}

export function afterRoundEnd(g: GameState, now: number): void {
  const t = bjtOf(g);
  if (t.stage !== "roundEnd") return;
  if (t.over) finishCasino(g, now);
  else startRound(g);
}
