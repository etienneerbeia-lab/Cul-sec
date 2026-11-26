import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ChipsError,
  commit,
  commitUpTo,
  createLedger,
  markBusted,
  ranking,
  release,
  seatPlayer,
  settle,
  stackOf,
  totalChips,
} from "../src/lib/chips/ledger";
import { formatChips } from "../src/lib/chips/format";

test("création et engagement", () => {
  const l = createLedger(["a", "b"], 1000);
  commit(l, "a", 300);
  assert.equal(stackOf(l, "a"), 700);
  assert.equal(l.committed.a, 300);
  assert.equal(totalChips(l), 2000);
  assert.throws(() => commit(l, "a", 701), ChipsError);
  assert.throws(() => commit(l, "a", -5), ChipsError);
  assert.throws(() => commit(l, "a", 1.5), ChipsError);
  assert.throws(() => commit(l, "zz", 1), ChipsError);
});

test("tapis plafonné au solde et remboursement", () => {
  const l = createLedger(["a"], 100);
  assert.equal(commitUpTo(l, "a", 250), 100);
  assert.equal(stackOf(l, "a"), 0);
  release(l, "a", 40);
  assert.equal(stackOf(l, "a"), 40);
  assert.throws(() => release(l, "a", 61), ChipsError);
});

test("règlement « table » : à somme nulle", () => {
  const l = createLedger(["a", "b", "c"], 100);
  commit(l, "a", 50);
  commit(l, "b", 50);
  commit(l, "c", 20);
  assert.throws(() => settle(l, { a: 100 }, "table"), ChipsError);
  const net = settle(l, { a: 120 }, "table");
  assert.deepEqual(net, { a: 70, b: -50, c: -20 });
  assert.equal(totalChips(l), 300);
  assert.deepEqual(l.committed, {});
});

test("règlement « banque » : la banque paie la différence", () => {
  const l = createLedger(["a", "b"], 500);
  commit(l, "a", 10);
  commit(l, "b", 10);
  const net = settle(l, { a: 25 }, "house");
  assert.deepEqual(net, { a: 15, b: -10 });
  assert.equal(stackOf(l, "a"), 515);
  assert.equal(stackOf(l, "b"), 490);
});

test("éliminations : ordre, départage et ex æquo", () => {
  const l = createLedger(["a", "b", "c", "d"], 100);
  l.stacks = { a: 0, b: 400, c: 0, d: 0 };
  // c avait le plus gros tapis au début du coup : il finit mieux classé ;
  // a et d étaient à égalité : même place.
  assert.deepEqual(markBusted(l, 1, { a: 50, c: 150, d: 50 }).sort(), ["a", "c", "d"]);
  assert.deepEqual(l.bustOrder, [["a", "d"], ["c"]]);
  assert.deepEqual(markBusted(l), []);
  const r = ranking(l, ["a", "b", "c", "d"]);
  assert.deepEqual(
    r.map((e) => [e.slug, e.rank, e.busted]),
    [
      ["b", 1, false],
      ["c", 2, true],
      ["a", 3, true],
      ["d", 3, true],
    ]
  );
});

test("seuil d'élimination (mise minimum du blackjack)", () => {
  const l = createLedger(["a", "b"], 500);
  l.stacks.a = 4;
  assert.deepEqual(markBusted(l, 5), ["a"]);
  // Un joueur qui a encore une mise engagée n'est pas éliminé.
  l.stacks.b = 0;
  l.committed.b = 10;
  assert.deepEqual(markBusted(l, 5), []);
});

test("classement : soldes décroissants, égalités partagées", () => {
  const l = createLedger(["a", "b", "c"], 100);
  l.stacks = { a: 300, b: 500, c: 300 };
  assert.deepEqual(
    ranking(l, ["a", "b", "c"]).map((e) => [e.slug, e.rank]),
    [
      ["b", 1],
      ["a", 2],
      ["c", 2],
    ]
  );
});

test("joueur ajouté en cours de partie", () => {
  const l = createLedger(["a"], 500);
  seatPlayer(l, "b");
  assert.equal(stackOf(l, "b"), 500);
  assert.throws(() => seatPlayer(l, "b"), ChipsError);
});

test("format", () => {
  assert.equal(formatChips(1250), "1 250");
  assert.equal(formatChips(500, "euro"), "500 €");
});
