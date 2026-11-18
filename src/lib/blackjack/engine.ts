import { drink } from "../game/module";
import { makeShuffledDeck, shuffleArr } from "../game/cards";
import type {
  BlackjackDealEvent,
  BlackjackHand,
  BlackjackPendingDistribution,
  BlackjackPlayerState,
  BlackjackResultEntry,
  Card,
  GameState,
} from "../game/types";

// How many entries of `log` (already sliced to whatever the viewer has
// caught up to) refer to this specific target — directly usable as "how
// many of this hand's/dealer's cards should currently be shown", since
// entries are always appended in the same order the underlying cards[]
// array itself was built in. Shared between server (push order) and
// client (render order) so the two can never drift apart.
export function revealedCount(
  log: BlackjackDealEvent[],
  target: BlackjackDealEvent["target"],
  slug?: string,
  handId?: number
): number {
  let n = 0;
  for (const e of log) {
    if (e.target !== target) continue;
    if (target === "player" && (e.slug !== slug || e.handId !== handId)) continue;
    n++;
  }
  return n;
}

// card.value runs 2-14 (11=Valet, 12=Dame, 13=Roi, 14=As) — 10/J/Q/K all
// count 10, an Ace counts 11 unless that would bust the hand, in which case
// it drops to 1 (repeated for a second Ace if the hand somehow still needs
// it, e.g. two Aces plus a ten-value card).
export function handValue(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.value === 14) {
      total += 11;
      aces++;
    } else if (c.value >= 11) {
      total += 10;
    } else {
      total += c.value;
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function newHand(id: number, bet: number, fromSplit = false, isSplitAces = false): BlackjackHand {
  return { id, cards: [], bet, status: "playing", doubled: false, isSplitAces, fromSplit };
}

export function startBlackjackRound(g: GameState): void {
  const n = g.playersPublic.length;
  const order: number[] = [];
  for (let i = 0; i < n; i++) order.push((g.startIndex + i) % n);
  g.blackjack = {
    stage: "betting",
    bets: {},
    betResponded: [],
    players: order.map((i) => ({
      slug: g.playersPublic[i].slug,
      name: g.playersPublic[i].name,
      hands: [],
      activeHandIdx: 0,
    })),
    turnPointer: 0,
    dealer: { cards: [], hiddenCard: null },
    deck: [],
    dealLog: [],
    distributionQueue: [],
  };
  g.phase = "blackjack";
}

export function applyBlackjackBet(g: GameState, slug: string, amount: number): void {
  const bj = g.blackjack!;
  bj.bets[slug] = amount;
  if (!bj.betResponded.includes(slug)) bj.betResponded.push(slug);
  if (bj.players.every((p) => bj.betResponded.includes(p.slug))) {
    dealInitial(g);
  }
}

// Finds the next hand anyone still has left to play, resuming from wherever
// `turnPointer`/`activeHandIdx` currently sit — a player's own additional
// hands (from a split) are always exhausted before moving to the next
// player, matching table order otherwise. Returns false once nobody has
// anything left, which is the cue to move on to the dealer.
function findNextActionable(g: GameState): boolean {
  const bj = g.blackjack!;
  while (bj.turnPointer < bj.players.length) {
    const p = bj.players[bj.turnPointer];
    while (p.activeHandIdx < p.hands.length) {
      if (p.hands[p.activeHandIdx].status === "playing") return true;
      p.activeHandIdx++;
    }
    bj.turnPointer++;
  }
  return false;
}

// Deals the full initial layout — a card to each player, one to the
// dealer, a second to each player, a second face-down to the dealer —
// exactly the order asked for, logging each placement into `dealLog` so
// every client replays it card by card instead of seeing it all land at
// once. Only the dealer's second card stays hidden server-side (its
// placement is still logged as a face-down "dealer-hidden" event so the
// card-back itself appears in the right spot in the sequence).
function dealInitial(g: GameState): void {
  const bj = g.blackjack!;
  // Sabot de 6 jeux, comme au casino : ne s'épuise jamais en une manche.
  const deck: Card[] = [];
  for (let i = 0; i < 6; i++) deck.push(...makeShuffledDeck());
  shuffleArr(deck);

  bj.players.forEach((p) => {
    p.hands = [newHand(0, bj.bets[p.slug])];
    p.activeHandIdx = 0;
  });

  bj.players.forEach((p) => {
    p.hands[0].cards.push(deck.shift()!);
    bj.dealLog.push({ target: "player", slug: p.slug, handId: 0 });
  });
  bj.dealer.cards.push(deck.shift()!);
  bj.dealLog.push({ target: "dealer-up" });
  bj.players.forEach((p) => {
    p.hands[0].cards.push(deck.shift()!);
    bj.dealLog.push({ target: "player", slug: p.slug, handId: 0 });
  });
  bj.dealer.hiddenCard = deck.shift()!;
  bj.dealLog.push({ target: "dealer-hidden" });
  bj.deck = deck;

  bj.players.forEach((p) => {
    if (handValue(p.hands[0].cards) === 21) p.hands[0].status = "blackjack";
  });

  bj.stage = "playerTurns";
  bj.turnPointer = 0;
  // La banque regarde sa carte cachée si elle montre un As ou un 10 : avec
  // un blackjack, la main s'arrête tout de suite (règle européenne avec
  // « peek », comme dans les casinos).
  const up = bj.dealer.cards[0];
  if ((up.value === 14 || up.value >= 10) && handValue([up, bj.dealer.hiddenCard!]) === 21) {
    bj.players.forEach((p) => p.hands.forEach((h) => h.status === "playing" && (h.status = "stand")));
    startDealerTurn(g);
    return;
  }
  if (!findNextActionable(g)) startDealerTurn(g);
}

function currentHand(g: GameState): { player: BlackjackPlayerState; hand: BlackjackHand } {
  const bj = g.blackjack!;
  const player = bj.players[bj.turnPointer];
  return { player, hand: player.hands[player.activeHandIdx] };
}

function logPlayerCard(g: GameState, slug: string, handId: number): void {
  g.blackjack!.dealLog.push({ target: "player", slug, handId });
}

function advanceAfterHand(g: GameState): void {
  const bj = g.blackjack!;
  bj.players[bj.turnPointer].activeHandIdx++;
  if (!findNextActionable(g)) startDealerTurn(g);
}

export function blackjackHit(g: GameState): void {
  const bj = g.blackjack!;
  const { player, hand } = currentHand(g);
  hand.cards.push(bj.deck.shift()!);
  logPlayerCard(g, player.slug, hand.id);
  if (handValue(hand.cards) > 21) {
    hand.status = "bust";
    advanceAfterHand(g);
  } else if (hand.isSplitAces) {
    hand.status = "stand";
    advanceAfterHand(g);
  }
}

export function blackjackStand(g: GameState): void {
  const { hand } = currentHand(g);
  hand.status = "stand";
  advanceAfterHand(g);
}

export function blackjackDouble(g: GameState): void {
  const bj = g.blackjack!;
  const { player, hand } = currentHand(g);
  hand.bet *= 2;
  hand.doubled = true;
  hand.cards.push(bj.deck.shift()!);
  logPlayerCard(g, player.slug, hand.id);
  hand.status = handValue(hand.cards) > 21 ? "bust" : "stand";
  advanceAfterHand(g);
}

// Re-splitting a hand that already came from a split is allowed (the spec
// only asks for the classic split-aces restriction) — nothing here caps
// how many times a player can keep splitting.
export function blackjackSplit(g: GameState): void {
  const bj = g.blackjack!;
  const { player, hand } = currentHand(g);
  const [c1, c2] = hand.cards;
  const wasAces = c1.value === 14;

  // `hands.length` is a safe fresh id here regardless of where this splice
  // lands positionally — it only ever grows, so it can never collide with
  // an id handed out by an earlier split, even one that inserted itself
  // ahead of this one in the array.
  const second = newHand(player.hands.length, hand.bet, true, wasAces);
  second.cards = [c2];
  hand.cards = [c1];
  hand.fromSplit = true;
  hand.isSplitAces = wasAces;
  player.hands.splice(player.activeHandIdx + 1, 0, second);

  hand.cards.push(bj.deck.shift()!);
  logPlayerCard(g, player.slug, hand.id);
  second.cards.push(bj.deck.shift()!);
  logPlayerCard(g, player.slug, second.id);

  if (wasAces) {
    hand.status = "stand";
    second.status = "stand";
    advanceAfterHand(g);
  }
  // Otherwise both hands stay "playing" — the player keeps acting on
  // `hand` (still the active one) until it resolves, then `findNextActionable`
  // picks up `second` next before moving to the next player.
}

function startDealerTurn(g: GameState): void {
  const bj = g.blackjack!;
  bj.stage = "dealerTurn";
  bj.dealer.cards.push(bj.dealer.hiddenCard!);
  bj.dealer.hiddenCard = null;
  while (handValue(bj.dealer.cards) < 17) {
    bj.dealer.cards.push(bj.deck.shift()!);
    bj.dealLog.push({ target: "dealer-hit" });
  }
  resolveBlackjackRound(g);
}

function resolveBlackjackRound(g: GameState): void {
  const bj = g.blackjack!;
  const dealerVal = handValue(bj.dealer.cards);
  const dealerBust = dealerVal > 21;
  const dealerNatural = bj.dealer.cards.length === 2 && dealerVal === 21;

  const results: BlackjackResultEntry[] = [];
  const distributionQueue: BlackjackPendingDistribution[] = [];

  bj.players.forEach((p) => {
    const pub = g.playersPublic.find((pp) => pp.slug === p.slug)!;
    p.hands.forEach((hand, handIdx) => {
      const total = handValue(hand.cards);
      // A blackjack made via a split doesn't count as a "natural" (pays
      // even money, not 3:2) — standard casino rule, and easy to apply
      // here since `fromSplit` is already tracked.
      const isNatural = hand.cards.length === 2 && total === 21 && !hand.fromSplit;

      let outcome: BlackjackResultEntry["outcome"];
      let amount: number;

      if (hand.status === "bust") {
        outcome = "lose";
        amount = hand.bet;
      } else if (isNatural) {
        if (dealerNatural) {
          outcome = "push";
          amount = 0;
        } else {
          outcome = "blackjack";
          amount = Math.ceil(hand.bet * 1.5);
        }
      } else if (dealerBust || total > dealerVal) {
        outcome = "win";
        amount = hand.bet;
      } else if (total === dealerVal) {
        outcome = "push";
        amount = 0;
      } else {
        outcome = "lose";
        amount = hand.bet;
      }

      if (outcome === "lose") {
        drink(g, pub.slug, amount, hand.status === "bust" ? "Sauté" : "Battu par la banque");
      } else if ((outcome === "win" || outcome === "blackjack") && g.playersPublic.length > 1) {
        distributionQueue.push({ slug: p.slug, name: p.name, handIdx, amount });
      }

      results.push({
        slug: p.slug,
        name: p.name,
        handIdx,
        cards: hand.cards,
        total,
        bet: hand.bet,
        outcome,
        amount,
      });
    });
  });

  bj.results = results;
  bj.distributionQueue = distributionQueue;
  if (distributionQueue.length === 0) finalizeBlackjackResults(g);
  else bj.stage = "distributing";
}

// Le gagnant fait boire sa mise à un joueur de son choix.
export function applyBlackjackDistribution(g: GameState, targetSlug: string): void {
  const bj = g.blackjack!;
  const pending = bj.distributionQueue[0];
  const byslug = new Map(g.playersPublic.map((p) => [p.slug, p]));
  const targets = [{ slug: targetSlug, amount: pending.amount }];
  drink(g, targetSlug, pending.amount, `Offert par ${pending.name}`);

  const resultEntry = bj.results!.find((r) => r.slug === pending.slug && r.handIdx === pending.handIdx)!;
  resultEntry.distributedTo = targets
    .filter((t) => t.amount > 0)
    .map((t) => ({ slug: t.slug, name: byslug.get(t.slug)!.name, amount: t.amount }));

  bj.distributionQueue.shift();
  if (bj.distributionQueue.length === 0) finalizeBlackjackResults(g);
}

function finalizeBlackjackResults(g: GameState): void {
  const bj = g.blackjack!;
  bj.stage = "result";
  g.lastResults = {
    type: "blackjack",
    blackjackResults: bj.results,
    blackjackDealerCards: bj.dealer.cards,
    blackjackDealerTotal: handValue(bj.dealer.cards),
    blackjackDealerBust: handValue(bj.dealer.cards) > 21,
  };
  g.phase = "showdown";
}
