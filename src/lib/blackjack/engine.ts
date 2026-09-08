import { makeShuffledDeck } from "../game/cards";
import type {
  BlackjackHand,
  BlackjackPendingDistribution,
  BlackjackPlayerState,
  BlackjackResultEntry,
  Card,
  GameState,
} from "../game/types";

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

function newHand(bet: number, fromSplit = false, isSplitAces = false): BlackjackHand {
  return { cards: [], bet, status: "playing", doubled: false, isSplitAces, fromSplit };
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

// Deals the full initial layout in one shot: a card to each player, one to
// the dealer, a second to each player, a second face-down to the dealer —
// exactly the order asked for. Every player card is public the instant
// this resolves (no per-card pacing beyond what the client chooses to
// animate), only the dealer's second card stays hidden server-side.
function dealInitial(g: GameState): void {
  const bj = g.blackjack!;
  const deck = makeShuffledDeck();

  bj.players.forEach((p) => {
    p.hands = [newHand(bj.bets[p.slug])];
    p.activeHandIdx = 0;
  });

  bj.players.forEach((p) => p.hands[0].cards.push(deck.shift()!));
  bj.dealer.cards.push(deck.shift()!);
  bj.players.forEach((p) => p.hands[0].cards.push(deck.shift()!));
  bj.dealer.hiddenCard = deck.shift()!;
  bj.deck = deck;

  bj.players.forEach((p) => {
    if (handValue(p.hands[0].cards) === 21) p.hands[0].status = "blackjack";
  });

  bj.stage = "playerTurns";
  bj.turnPointer = 0;
  if (!findNextActionable(g)) startDealerTurn(g);
}

function currentHand(g: GameState): { player: BlackjackPlayerState; hand: BlackjackHand } {
  const bj = g.blackjack!;
  const player = bj.players[bj.turnPointer];
  return { player, hand: player.hands[player.activeHandIdx] };
}

function advanceAfterHand(g: GameState): void {
  const bj = g.blackjack!;
  bj.players[bj.turnPointer].activeHandIdx++;
  if (!findNextActionable(g)) startDealerTurn(g);
}

export function blackjackHit(g: GameState): void {
  const bj = g.blackjack!;
  const { hand } = currentHand(g);
  hand.cards.push(bj.deck.shift()!);
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
  const { hand } = currentHand(g);
  hand.bet *= 2;
  hand.doubled = true;
  hand.cards.push(bj.deck.shift()!);
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

  const second = newHand(hand.bet, true, wasAces);
  second.cards = [c2];
  hand.cards = [c1];
  hand.fromSplit = true;
  hand.isSplitAces = wasAces;
  player.hands.splice(player.activeHandIdx + 1, 0, second);

  hand.cards.push(bj.deck.shift()!);
  second.cards.push(bj.deck.shift()!);

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
        pub.gulpsTotal += amount;
      } else if (outcome === "win" || outcome === "blackjack") {
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

export function applyBlackjackDistribution(
  g: GameState,
  targets: { slug: string; amount: number }[]
): void {
  const bj = g.blackjack!;
  const pending = bj.distributionQueue[0];
  const byslug = new Map(g.playersPublic.map((p) => [p.slug, p]));

  targets.forEach(({ slug, amount }) => {
    const p = byslug.get(slug);
    if (!p || amount <= 0) return;
    p.gulpsTotal += amount;
  });

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
