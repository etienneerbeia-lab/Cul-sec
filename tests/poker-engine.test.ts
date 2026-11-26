import { test } from "node:test";
import assert from "node:assert/strict";
import { launchCasino } from "../src/lib/casino/launch";
import { stackOf, totalChips } from "../src/lib/chips/ledger";
import { moduleFor } from "../src/lib/game/engine";
import { performAction, tick } from "../src/lib/game/room";
import type { GameState, Player } from "../src/lib/game/types";
import { viewFor } from "../src/lib/game/view";
import { applyPokerMove, legalFor, runoutStep, afterHandEnd, startHand } from "../src/lib/poker/engine";
import type { PokerMove } from "../src/lib/poker/types";
import type { Room } from "../src/lib/store";
import { ApiError } from "../src/lib/errors";
import { withSeed } from "./helpers/rng";

const NAMES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const players = (n: number): Player[] => NAMES.slice(0, n).map((s) => ({ name: s.toUpperCase(), slug: s }));

// Table de n joueurs, bouton sur `button` (index), tapis donnés.
function table(n: number, opts: { button?: number; stacks?: number[]; now?: number } = {}): GameState {
  const g = withSeed(42, () => launchCasino(players(n), "poker", undefined, { now: opts.now ?? 0, hostSlug: "a" }));
  const p = g.poker!;
  // Annule la première main et la redistribue avec le bouton voulu.
  g.chips!.committed = {};
  NAMES.slice(0, n).forEach((s, i) => (g.chips!.stacks[s] = opts.stacks?.[i] ?? 1000));
  p.handNo = 0;
  p.button = ((opts.button ?? 0) - 1 + n) % n; // startHand avance le bouton d'un cran
  startHand(g, opts.now ?? 0);
  return g;
}

// Fixe les cartes : mains privées et prochaines cartes du paquet (board).
function rig(g: GameState, hole: Record<string, string>, board: string): void {
  const p = g.poker!;
  for (const [s, cards] of Object.entries(hole)) p.hole[s] = cards.split(" ");
  p.deck = board.replace(/ /g, "") + p.deck;
}

const mv = (g: GameState, s: string, move: PokerMove, to?: number) => applyPokerMove(g, s, move, to);
const total = (g: GameState) => totalChips(g.chips!);

test("3 joueurs : bouton, SB, BB, premier à parler, BB a l'option", () => {
  const g = table(3, { button: 0 });
  const p = g.poker!;
  assert.equal(p.seats[p.button], "a");
  assert.equal(p.sbSlug, "b");
  assert.equal(p.bbSlug, "c");
  assert.equal(stackOf(g.chips!, "b"), 990);
  assert.equal(stackOf(g.chips!, "c"), 980);
  assert.equal(p.toAct, "a"); // UTG = bouton à 3
  mv(g, "a", "call");
  mv(g, "b", "call");
  assert.equal(p.toAct, "c");
  assert.equal(legalFor(g, "c").canCheck, true);
  assert.equal(legalFor(g, "c").canRaise, true, "la BB a l'option de relancer");
  mv(g, "c", "check");
  assert.equal(p.stage, "flop");
  assert.equal(p.board.length, 3);
  assert.equal(p.toAct, "b", "postflop : premier joueur après le bouton");
});

test("heads-up : le bouton est SB, parle en premier préflop et en dernier ensuite", () => {
  const g = table(2, { button: 1 });
  const p = g.poker!;
  assert.equal(p.seats[p.button], "b");
  assert.equal(p.sbSlug, "b");
  assert.equal(p.bbSlug, "a");
  assert.equal(p.toAct, "b");
  mv(g, "b", "call");
  mv(g, "a", "check");
  assert.equal(p.stage, "flop");
  assert.equal(p.toAct, "a");
  mv(g, "a", "check");
  assert.equal(p.toAct, "b");
  mv(g, "b", "raise", 20);
  mv(g, "a", "fold");
  afterHandEnd(g, 1);
  // Main suivante : le bouton passe à a, qui devient SB et parle en premier.
  assert.equal(p.seats[p.button], "a");
  assert.equal(p.sbSlug, "a");
  assert.equal(p.toAct, "a");
});

test("min-raise : relance minimum = dernière relance, tapis toujours possible", () => {
  const g = table(3, { button: 0, stacks: [1000, 1000, 1000] });
  assert.deepEqual(legalFor(g, "a"), { canCheck: false, callAmount: 20, canRaise: true, minRaiseTo: 40, maxRaiseTo: 1000 });
  assert.throws(() => mv(g, "a", "raise", 39), ApiError);
  mv(g, "a", "raise", 100); // relance de 80
  assert.equal(legalFor(g, "b").minRaiseTo, 180);
  assert.throws(() => mv(g, "b", "raise", 179), ApiError);
  mv(g, "b", "raise", 180);
  assert.equal(legalFor(g, "c").minRaiseTo, 260);
  mv(g, "c", "raise", 1000); // tapis
  assert.equal(g.poker!.log.at(-1)!.k, "allin");
  assert.equal(total(g), 3000);
});

test("relance incomplète (tapis court) : ne rouvre pas les relances pour qui a déjà parlé", () => {
  // c n'a que 130 : son tapis relance de 30 seulement (< 80).
  const g = table(3, { button: 0, stacks: [1000, 1000, 150] });
  mv(g, "a", "raise", 100);
  mv(g, "b", "call");
  mv(g, "c", "raise", 150); // tapis : 150 au total, incomplet
  const p = g.poker!;
  assert.equal(p.currentBet, 150);
  assert.equal(p.toAct, "a");
  const la = legalFor(g, "a");
  assert.equal(la.callAmount, 50);
  assert.equal(la.canRaise, false, "a a déjà parlé depuis la dernière relance complète");
  assert.throws(() => mv(g, "a", "raise", 300), ApiError);
  mv(g, "a", "call");
  mv(g, "b", "call");
  assert.equal(p.stage, "flop");
});

test("mise non suivie remboursée, gain sans abattage, cartes non montrées", () => {
  const g = table(3, { button: 0 });
  mv(g, "a", "raise", 300);
  mv(g, "b", "fold");
  mv(g, "c", "fold");
  const p = g.poker!;
  assert.equal(p.stage, "handEnd");
  assert.equal(p.result!.uncontested, true);
  // a récupère ses 280 non suivis + gagne SB 10 + BB 20.
  assert.equal(stackOf(g.chips!, "a"), 1030);
  assert.ok(p.log.some((e) => e.k === "return" && e.s === "a" && e.n === 280));
  assert.deepEqual(p.exposed, []);
  const v = viewFor(g, "b").game.poker!;
  assert.deepEqual(Object.keys(v.hole), ["b"]);
  assert.equal(total(g), 3000);
});

test("tapis multiples : cartes retournées, board rue par rue, side pots, élimination simultanée", () => {
  // a 100, b 300, c 1000, d 1000. Mains : a meilleure, puis b, puis c, d pire.
  const g = table(4, { button: 0, stacks: [100, 300, 1000, 1000] });
  const p = g.poker!;
  assert.equal(p.sbSlug, "b");
  assert.equal(p.bbSlug, "c");
  rig(g, { a: "As Ah", b: "Ks Kh", c: "Qs Qh", d: "7c 2d" }, "2s 5d 9c Jh 3c");
  assert.equal(p.toAct, "d");
  mv(g, "d", "call");
  mv(g, "a", "raise", 100); // tapis (incomplet : 100 < 20+20 ? non, complet : 80 ≥ 20)
  mv(g, "b", "raise", 300); // tapis
  mv(g, "c", "call");
  mv(g, "d", "call");
  // c et d peuvent encore jouer : flop.
  assert.equal(p.stage, "flop");
  mv(g, "c", "check");
  mv(g, "d", "raise", 700); // d tapis
  mv(g, "c", "call");
  assert.equal(p.stage, "runout");
  assert.deepEqual([...p.exposed].sort(), ["a", "b", "c", "d"]);
  // Pendant le tapis, tout le monde voit toutes les cartes.
  assert.equal(Object.keys(viewFor(g, "a").game.poker!.hole).length, 4);
  assert.equal(viewFor(g, "a").game.poker!.deck, "");
  runoutStep(g);
  assert.equal(p.board.length, 4);
  runoutStep(g);
  assert.equal(p.stage, "handEnd");
  const r = p.result!;
  assert.equal(r.labels.a, "Paire d'As");
  assert.deepEqual(r.pots.map((x) => [x.amount, x.winners]), [
    [400, ["a"]],
    [600, ["b"]],
    [1400, ["c"]],
  ]);
  assert.equal(stackOf(g.chips!, "a"), 400);
  assert.equal(stackOf(g.chips!, "b"), 600);
  assert.equal(stackOf(g.chips!, "c"), 1400);
  assert.equal(stackOf(g.chips!, "d"), 0);
  assert.deepEqual(r.busted, ["d"]);
  assert.equal(total(g), 2400);
  afterHandEnd(g, 1000);
  assert.ok(!g.poker!.inHand.includes("d"), "un éliminé ne reçoit plus de cartes");
});

test("partage du pot à égalité", () => {
  const g = table(2, { button: 0 });
  rig(g, { a: "Ac 2d", b: "Ad 3c" }, "Ks Qs Js Ts 4h");
  mv(g, "a", "call");
  mv(g, "b", "check");
  for (let i = 0; i < 3; i++) {
    mv(g, "b", "check");
    mv(g, "a", "check");
  }
  const r = g.poker!.result!;
  assert.equal(r.labels.a, "Quinte à l'As");
  assert.deepEqual(r.pots[0].winners.sort(), ["a", "b"]);
  assert.equal(stackOf(g.chips!, "a"), 1000);
  assert.equal(stackOf(g.chips!, "b"), 1000);
  // Les cartes de la main gagnante sont fournies (pour les mettre en avant).
  assert.equal(r.best.a.length, 5);
});

test("fin du tournoi : classement, le premier éliminé est dernier", () => {
  const g = table(3, { button: 0, stacks: [1000, 50, 30] });
  rig(g, { a: "As Ah", b: "Ks Kh", c: "Qs Qh" }, "2s 5d 9c Jh 3c");
  mv(g, "a", "raise", 1000);
  mv(g, "b", "call");
  mv(g, "c", "call");
  runoutStep(g);
  runoutStep(g);
  runoutStep(g);
  assert.equal(g.poker!.over, true);
  afterHandEnd(g, 5000);
  assert.equal(g.phase, "final");
  // b avait 50 au début de la main, c 30 : b finit mieux classé.
  assert.deepEqual(g.casinoRanking!.map((r) => [r.slug, r.rank]), [
    ["a", 1],
    ["b", 2],
    ["c", 3],
  ]);
});

test("blindes au temps : nouveau niveau à la main suivante", () => {
  const g = table(3, { button: 0, now: 0 });
  const p = g.poker!;
  assert.deepEqual(p.blinds, [10, 20]);
  mv(g, "a", "fold");
  mv(g, "b", "fold");
  afterHandEnd(g, p.levelMs + 1);
  assert.deepEqual(p.blinds, [20, 40]);
  assert.equal(p.level, 1);
  // Au-delà du dernier palier, les blindes doublent.
  mv(g, p.toAct!, "fold");
  if (g.poker!.stage !== "handEnd") mv(g, g.poker!.toAct!, "fold");
  afterHandEnd(g, p.levelMs * 8 + 1); // niveau 8 = 2 doublements après 500/1000
  assert.deepEqual(p.blinds, [2000, 4000]);
});

test("chrono : check si possible, sinon couché (via le tick du salon)", () => {
  const g = table(3, { button: 0 });
  const room: Room = { code: "T", hostSlug: "a", players: players(3), game: g, createdAt: 0 };
  const seen = { a: 0, b: 0, c: 0 };
  tick(room, 0, seen);
  assert.equal(g.timer!.deadlineAt, 15000);
  tick(room, 15001, { a: 15001, b: 15001, c: 15001 });
  assert.ok(g.poker!.folded.includes("a"), "face à la BB, a se couche");
  // b (SB) face à 10 de plus : couché aussi → c gagne.
  tick(room, 30002, { a: 30002, b: 30002, c: 30002 });
  assert.equal(g.poker!.stage, "handEnd");
  // c avait l'option : le chrono checke pour lui sur une main suivante.
  const g2 = table(3, { button: 0 });
  const room2: Room = { ...room, game: g2 };
  mv(g2, "a", "call");
  mv(g2, "b", "call");
  tick(room2, 0, seen);
  tick(room2, 15001, { a: 15001, b: 15001, c: 15001 });
  assert.equal(g2.poker!.log.at(-2)!.k, "check");
});

test("un spectateur ou un joueur hors tour ne peut pas jouer", () => {
  const g = table(3, { button: 0 });
  const room: Room = { code: "T", hostSlug: "a", players: [...players(3), { name: "Z", slug: "z" }], game: g, createdAt: 0 };
  assert.throws(() => performAction(room, "b", { type: "poker", move: "call" }, 0), (e: ApiError) => e.status === 403);
  assert.throws(() => performAction(room, "z", { type: "poker", move: "call" }, 0), (e: ApiError) => e.status === 403);
  assert.throws(() => performAction(room, "a", { type: "poker", move: "dance" }, 0), (e: ApiError) => e.status === 400);
  assert.throws(() => performAction(room, "a", { type: "poker", move: "raise", to: 55.5 }, 0), ApiError);
  // Spectateur : ne voit aucune carte privée.
  assert.deepEqual(Object.keys(viewFor(g, "z").game.poker!.hole), []);
  assert.deepEqual(Object.keys(viewFor(g, null).game.poker!.hole), []);
});

// Tournois complets joués par les bots via le vrai tick : aucune main ne
// reste bloquée, les jetons sont conservés à chaque instant, aucune carte
// cachée ne sort, et chaque tournoi se termine.
test("200 tournois complets de 2 à 8 bots", () => {
  for (let i = 0; i < 200; i++) {
    const n = 2 + (i % 7);
    withSeed(1000 + i, () => {
      const ps: Player[] = NAMES.slice(0, n).map((s) => ({ name: s, slug: s, bot: true }));
      const room: Room = { code: "T", hostSlug: "a", players: ps, game: launchCasino(ps, "poker", undefined, { now: 0, hostSlug: "a" }), createdAt: 0 };
      let now = 0;
      for (let step = 0; step < 100000 && room.game.phase !== "final"; step++) {
        tick(room, now, {});
        now += 250;
        const g = room.game;
        if (g.phase === "final") break;
        assert.equal(total(g), n * 1000, `seed ${i} : jetons non conservés`);
        const v = viewFor(g, "a").game.poker!;
        assert.equal(v.deck, "");
        for (const s of Object.keys(v.hole)) assert.ok(s === "a" || g.poker!.exposed.includes(s), "carte cachée envoyée");
        assert.ok(moduleFor(g)!.pending(g), `seed ${i} : aucune attente (bloqué)`);
      }
      assert.equal(room.game.phase, "final", `tournoi ${i} (${n} joueurs) pas terminé`);
      const rk = room.game.casinoRanking!;
      assert.equal(rk.length, n);
      assert.equal(rk[0].stack, n * 1000);
      assert.equal(rk.filter((r) => r.rank === 1).length, 1);
    });
  }
});
