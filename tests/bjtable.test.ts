import { test } from "node:test";
import assert from "node:assert/strict";
import { launchCasino } from "../src/lib/casino/launch";
import { stackOf } from "../src/lib/chips/ledger";
import { ApiError } from "../src/lib/errors";
import { moduleFor } from "../src/lib/game/engine";
import { performAction, tick } from "../src/lib/game/room";
import type { GameState, Player } from "../src/lib/game/types";
import { viewFor } from "../src/lib/game/view";
import { BJT_RULES } from "../src/lib/bjtable/config";
import { afterRoundEnd, closeBetting, legalFor, totalLabel } from "../src/lib/bjtable/engine";
import type { Room } from "../src/lib/store";
import { withSeed } from "./helpers/rng";

const NAMES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const players = (n: number): Player[] => NAMES.slice(0, n).map((s) => ({ name: s.toUpperCase(), slug: s }));

function table(n: number, opts: { rounds?: number; survivor?: boolean } = {}): GameState {
  return withSeed(7, () =>
    launchCasino(
      players(n),
      "bjtable",
      { bjEndMode: opts.survivor ? "survivor" : "rounds", bjRounds: opts.rounds ?? 10 },
      { now: 0, hostSlug: "a" }
    )
  );
}

// Fixe les prochaines cartes du sabot. Ordre de distribution : 1re carte de
// chaque joueur, carte visible du croupier, 2e carte de chaque joueur,
// carte cachée, puis les tirages.
function rig(g: GameState, cards: string): void {
  g.bjt!.shoe = cards.replace(/ /g, "") + g.bjt!.shoe;
}
const act = (g: GameState, s: string, op: string, extra: Record<string, unknown> = {}) =>
  moduleFor(g)!.act(g, s, { type: "bjt", op, ...extra }, { now: 0, hostSlug: "a" });
const bet = (g: GameState, s: string, amount: number) => act(g, s, "bet", { amount });
const stack = (g: GameState, s: string) => stackOf(g.chips!, s);
const hand = (g: GameState, s: string, i = 0) => g.bjt!.seats.find((x) => x.slug === s)!.hands[i];

test("mises : minimum 5 €, maximum le solde, une seule fois", () => {
  const g = table(2);
  assert.throws(() => bet(g, "a", 4), ApiError);
  assert.throws(() => bet(g, "a", 501), ApiError);
  assert.throws(() => bet(g, "a", 7.5), ApiError);
  bet(g, "a", 25);
  assert.equal(stack(g, "a"), 475);
  assert.throws(() => bet(g, "a", 25), ApiError);
  assert.equal(g.bjt!.stage, "betting");
  rig(g, "9c 9d 7s 8c 8d Ts");
  bet(g, "b", 500); // tapis
  assert.equal(g.bjt!.stage, "playerTurns");
  assert.equal(stack(g, "b"), 0);
});

test("chrono de mise : ceux qui n'ont pas misé ne jouent pas ; personne → manche passée", () => {
  const g = table(3);
  rig(g, "9c 7s 8c Ts");
  bet(g, "a", 10);
  closeBetting(g);
  assert.deepEqual(g.bjt!.seats.map((s) => s.slug), ["a"]);
  const g2 = table(2, { rounds: 5 });
  closeBetting(g2);
  assert.equal(g2.bjt!.stage, "roundEnd");
  assert.equal(g2.bjt!.noBets, true);
  afterRoundEnd(g2, 1);
  assert.equal(g2.bjt!.round, 2, "la manche sans mise compte");
});

test("blackjack payé 3:2 (arrondi au-dessus)", () => {
  const g = table(2);
  // a : A+K blackjack ; b : 9+8 ; croupier 9 visible + 8 caché.
  rig(g, "As 9h 9d Kc 8s 8d");
  bet(g, "a", 10);
  bet(g, "b", 5);
  assert.equal(hand(g, "a").status, "blackjack");
  act(g, "b", "stand");
  assert.equal(g.bjt!.stage, "roundEnd");
  assert.equal(hand(g, "a").outcome, "blackjack");
  assert.equal(hand(g, "a").net, 15);
  assert.equal(stack(g, "a"), 515);
  assert.equal(hand(g, "b").outcome, "push");
  // Mise de 5 € : 7,50 arrondi à 8 €.
  const g2 = table(1);
  rig(g2, "As 9d Kc 8s");
  bet(g2, "a", 5);
  assert.equal(stack(g2, "a"), 508);
});

test("blackjack contre blackjack : égalité ; assurance payée 2:1", () => {
  const g = table(2);
  // a : A+K ; b : T+9 ; croupier As visible + Q cachée = blackjack.
  rig(g, "As Th Ad Kc 9s Qd");
  bet(g, "a", 20);
  bet(g, "b", 20);
  assert.equal(g.bjt!.stage, "insurance", "As visible : assurance proposée avant le peek");
  act(g, "a", "insurance", { take: false });
  act(g, "b", "insurance", { take: true }); // coûte 10 ; le peek suit aussitôt
  assert.equal(g.bjt!.seats[1].insurance, 10);
  assert.equal(g.bjt!.stage, "roundEnd");
  assert.equal(g.bjt!.dealer.blackjack, true);
  assert.equal(hand(g, "a").outcome, "push");
  assert.equal(stack(g, "a"), 500);
  // b perd sa main (−20) mais l'assurance paie 2:1 (+20) : à l'équilibre.
  assert.equal(hand(g, "b").outcome, "lose");
  assert.equal(g.bjt!.seats[1].insuranceNet, 20);
  assert.equal(g.bjt!.seats[1].net, 0);
  assert.equal(stack(g, "b"), 500);
});

test("assurance perdue quand le croupier n'a pas blackjack ; la manche continue", () => {
  const g = table(1);
  rig(g, "Ts As 9h 7d");
  bet(g, "a", 20);
  act(g, "a", "insurance", { take: true });
  assert.equal(g.bjt!.stage, "playerTurns");
  act(g, "a", "stand");
  // 19 contre A+7 = 18 (le croupier reste sur soft 17... et 18).
  assert.equal(hand(g, "a").outcome, "win");
  assert.equal(g.bjt!.seats[0].insuranceNet, -10);
  assert.equal(stack(g, "a"), 500 + 20 - 10);
});

test("peek avec un 10 visible : blackjack du croupier, la manche s'arrête", () => {
  const g = table(1);
  rig(g, "9s Kd 9h Ac");
  bet(g, "a", 50);
  assert.equal(g.bjt!.stage, "roundEnd");
  assert.equal(hand(g, "a").outcome, "lose");
  assert.equal(stack(g, "a"), 450);
});

test("le croupier saute : toutes les mains restées gagnent", () => {
  const g = table(2);
  // a 18, b 13 ; croupier 6 + T = 16, tire un 9 → 25.
  rig(g, "Ts 7d 6c 8s 6h Td 9c");
  bet(g, "a", 10);
  bet(g, "b", 10);
  act(g, "a", "stand");
  act(g, "b", "stand");
  assert.equal(totalLabel(g.bjt!.dealer.cards), "25");
  assert.ok(g.bjt!.log.some((e) => e.t === "dd"));
  assert.equal(hand(g, "a").outcome, "win");
  assert.equal(hand(g, "b").outcome, "win");
  assert.equal(stack(g, "b"), 510);
});

test("le croupier reste sur soft 17", () => {
  const g = table(1);
  rig(g, "Ts As 8h 6d");
  bet(g, "a", 10);
  act(g, "a", "insurance", { take: false });
  act(g, "a", "stand");
  assert.equal(g.bjt!.dealer.cards.length, 2);
  assert.equal(totalLabel(g.bjt!.dealer.cards), "7 / 17");
  assert.equal(hand(g, "a").outcome, "win");
});

test("mains soft affichées « 7 / 17 », 21 et bust", () => {
  assert.equal(totalLabel(["As", "6d"]), "7 / 17");
  assert.equal(totalLabel(["As", "Kd"]), "21");
  assert.equal(totalLabel(["As", "6d", "Kc"]), "17");
  assert.equal(totalLabel(["Ts", "6d", "Kc"]), "26");
});

test("doubler : mise doublée, une seule carte, seulement sur 2 cartes", () => {
  const g = table(1);
  rig(g, "6s 9d 5h 7c 9h");
  bet(g, "a", 20);
  assert.equal(legalFor(g, "a")!.canDouble, true);
  act(g, "a", "double");
  const h = hand(g, "a");
  assert.equal(h.bet, 40);
  assert.equal(h.cards.length, 3);
  assert.equal(h.status, "stand");
  assert.equal(h.outcome, "win"); // 20 contre 16+... 9+7=16 → tire
  const g2 = table(1);
  rig(g2, "2s 9d 3h 7c 4h");
  bet(g2, "a", 20);
  act(g2, "a", "hit");
  assert.equal(legalFor(g2, "a")!.canDouble, false);
  assert.throws(() => act(g2, "a", "double"), ApiError);
  // Pas assez pour doubler.
  const g3 = table(1);
  rig(g3, "6s 9d 5h 7c");
  bet(g3, "a", 300);
  assert.equal(legalFor(g3, "a")!.canDouble, false);
});

test("split : deux mains, double après split, jusqu'à 4 mains", () => {
  const g = table(1);
  // a : 8 8 ; croupier 6 visible. Après split : 8+8 → re-split, etc.
  rig(g, "8s 6d 8h Tc 8d 8c 3s 2h 9d 9h 9s");
  bet(g, "a", 10);
  act(g, "a", "split"); // main 0 : 8+8d ; main 1 : 8h+8c
  assert.equal(g.bjt!.seats[0].hands.length, 2);
  assert.equal(stack(g, "a"), 480);
  act(g, "a", "split"); // main 0 : 8s+3s ; nouvelle : 8d+2h
  assert.equal(g.bjt!.seats[0].hands.length, 3);
  // Double après split sur 8+3 = 11.
  assert.equal(legalFor(g, "a")!.canDouble, true);
  act(g, "a", "double"); // 8+3+9 = 20
  assert.equal(hand(g, "a", 0).bet, 20);
  // Main 1 : 8d+2h = 10, on tire 9 → 19.
  act(g, "a", "hit");
  act(g, "a", "stand");
  // Main 2 : 8h+8c, re-split → 4 mains.
  act(g, "a", "split");
  assert.equal(g.bjt!.seats[0].hands.length, 4);
  // 5e main interdite même avec une paire.
  const seat = g.bjt!.seats[0];
  const cur = seat.hands[seat.active];
  cur.cards = ["7s", "7d"];
  assert.equal(legalFor(g, "a")!.canSplit, false);
  assert.throws(() => act(g, "a", "split"), ApiError);
  // Les ids restent uniques et chaque main a sa mise.
  assert.equal(new Set(seat.hands.map((h) => h.id)).size, 4);
});

test("As séparés : une carte chacun, pas de re-split ; 21 après split payé 1:1", () => {
  const g = table(1);
  rig(g, "As 9d Ah 7c Kd Ac 2c"); // croupier 9+7 tire 2 → 18
  bet(g, "a", 10);
  act(g, "a", "split");
  const hs = g.bjt!.seats[0].hands;
  assert.equal(hs.length, 2);
  assert.ok(hs.every((h) => h.cards.length === 2 && h.status === "stand" && h.splitAces));
  // A+K après split = 21, pas un blackjack ; A+A = 12.
  assert.equal(g.bjt!.stage, "roundEnd");
  assert.equal(hs[0].outcome, "win");
  assert.equal(hs[0].net, 10);
  assert.equal(hs[1].outcome, "lose");
});

test("chrono d'action : stand ; mise et carte cachée jamais envoyées", () => {
  const g = table(2);
  rig(g, "Ts 9d 9h 7c 8d 6s");
  const room: Room = { code: "T", hostSlug: "a", players: players(2), game: g, createdAt: 0 };
  performAction(room, "a", { type: "bjt", op: "bet", amount: 10 }, 0, {});
  performAction(room, "b", { type: "bjt", op: "bet", amount: 10 }, 0, {});
  const v = viewFor(g, null).game.bjt!;
  assert.equal(v.shoe, "");
  assert.equal(v.dealer.hole, null);
  assert.ok(g.bjt!.dealer.hole, "l'état serveur garde la carte cachée");
  assert.throws(() => performAction(room, "b", { type: "bjt", op: "hit" }, 0, {}), (e: ApiError) => e.status === 403);
  assert.throws(() => performAction(room, "a", { type: "bjt", op: "bet", amount: 10 }, 0, {}), ApiError);
  tick(room, 0, { a: 0, b: 0 });
  const deadline = g.timer!.deadlineAt!;
  assert.ok(deadline > BJT_RULES.actionMs, "le chrono inclut l'animation de la distribution");
  tick(room, deadline + 1, { a: deadline, b: deadline });
  assert.equal(hand(g, "a").status, "stand");
});

test("à court d'argent : spectateur ; dernier survivant ; manches ; classement", () => {
  const g = table(2, { survivor: true });
  rig(g, "Ts 9d 9h 7c 8d 6s");
  bet(g, "a", 500);
  bet(g, "b", 10);
  act(g, "a", "stand"); // 19
  act(g, "b", "stand"); // 17 contre 9+6=15 → tire 8 = 23 : tout le monde gagne
  assert.equal(stack(g, "a"), 1000);
  // Manche 2 : a perd tout.
  afterRoundEnd(g, 1);
  rig(g, "Ts 9d Tc 7c 8d Th");
  bet(g, "a", 1000);
  bet(g, "b", 510);
  act(g, "a", "stand"); // 18 contre 20
  act(g, "b", "stand");
  assert.equal(stack(g, "a"), 0);
  assert.equal(stack(g, "b"), 0);
  assert.equal(g.bjt!.over, true);
  afterRoundEnd(g, 2);
  assert.equal(g.phase, "final");
  // Les deux éliminés à la même manche : départagés par le solde d'avant (a 1000 > b 510).
  assert.deepEqual(g.casinoRanking!.map((r) => [r.slug, r.rank]), [["a", 1], ["b", 2]]);
  // Mode manches.
  const g2 = table(1, { rounds: 5 });
  for (let r = 1; r <= 5; r++) {
    closeBetting(g2);
    assert.equal(g2.bjt!.over, r === 5);
    afterRoundEnd(g2, r);
  }
  assert.equal(g2.phase, "final");
});

test("solde sous la mise minimum : on regarde la fin", () => {
  const g = table(2);
  rig(g, "Ts 9d Tc 7c 8d Th");
  bet(g, "a", 497);
  bet(g, "b", 5);
  act(g, "a", "stand");
  act(g, "b", "stand");
  assert.equal(stack(g, "a"), 3);
  afterRoundEnd(g, 1);
  assert.equal(moduleFor(g)!.pending(g)!.actors.includes("a"), false);
  assert.throws(() => bet(g, "a", 3), ApiError);
});

test("arrivées en cours de partie : assises à la manche suivante avec 500 €", () => {
  const g = table(2);
  const room: Room = { code: "T", hostSlug: "a", players: players(2), game: g, createdAt: 0 };
  rig(g, "Ts 9d 9h 7c 8d 6s");
  performAction(room, "a", { type: "bjt", op: "bet", amount: 10 }, 0, {});
  performAction(room, "b", { type: "bjt", op: "bet", amount: 10 }, 0, {});
  room.players.push({ name: "Late", slug: "late" });
  tick(room, 1, { a: 1, b: 1 });
  assert.ok(!g.bjt!.order.includes("late"), "pas pendant la manche en cours");
  performAction(room, g.bjt!.seats[g.bjt!.turn].slug, { type: "bjt", op: "stand" }, 2, {});
  performAction(room, g.bjt!.seats[g.bjt!.turn].slug, { type: "bjt", op: "stand" }, 3, {});
  assert.equal(g.bjt!.stage, "roundEnd");
  tick(room, 4, { a: 4, b: 4, late: 4 });
  assert.ok(g.bjt!.order.includes("late"));
  assert.equal(stack(g, "late"), 500);
  // 9 joueurs : le 9e reste spectateur.
  const g9 = table(8);
  const r9: Room = { code: "T", hostSlug: "a", players: [...players(8), { name: "Nine", slug: "nine" }], game: g9, createdAt: 0 };
  tick(r9, 0, {});
  assert.equal(g9.bjt!.order.length, 8);
});

test("sabot remélangé quand ~75 % des cartes sont sorties", () => {
  const g = table(1);
  const t = g.bjt!;
  closeBetting(g);
  t.shoe = t.shoe.slice(0, 2 * 70); // 70 cartes restantes sur 312
  afterRoundEnd(g, 1);
  assert.equal(t.reshuffled, true);
  assert.equal(t.shoe.length / 2, 312);
  closeBetting(g);
  t.shoe = t.shoe.slice(0, 2 * 200);
  afterRoundEnd(g, 2);
  assert.equal(t.reshuffled, false);
});

// Parties complètes jouées par les bots via le vrai tick.
test("120 parties complètes de 1 à 8 bots (manches et dernier survivant)", () => {
  for (let i = 0; i < 120; i++) {
    const n = 1 + (i % 8);
    const survivor = i % 3 === 0;
    withSeed(500 + i, () => {
      const ps: Player[] = NAMES.slice(0, n).map((s) => ({ name: s, slug: s, bot: true }));
      const room: Room = {
        code: "T",
        hostSlug: "a",
        players: ps,
        game: launchCasino(ps, "bjtable", { bjEndMode: survivor ? "survivor" : "rounds", bjRounds: 5 + (i % 3) * 5 }, { now: 0, hostSlug: "a" }),
        createdAt: 0,
      };
      let now = 0;
      for (let step = 0; step < 200000 && room.game.phase !== "final"; step++) {
        tick(room, now, {});
        now += 300;
        const g = room.game;
        if (g.phase === "final") break;
        for (const s of Object.keys(g.chips!.stacks)) {
          assert.ok(Number.isInteger(stack(g, s)) && stack(g, s) >= 0, "solde invalide");
        }
        const v = viewFor(g, "a").game.bjt!;
        assert.equal(v.shoe, "");
        assert.equal(v.dealer.hole, null);
        assert.ok(moduleFor(g)!.pending(g), `partie ${i} bloquée`);
      }
      assert.equal(room.game.phase, "final", `partie ${i} (${n} joueurs, ${survivor ? "survivant" : "manches"}) pas terminée`);
      assert.equal(room.game.casinoRanking!.length, n);
    });
  }
});
