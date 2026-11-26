import { test } from "node:test";
import assert from "node:assert/strict";
import type { HandEval } from "../src/lib/game/evaluate";
import { awardPots, buildPots } from "../src/lib/poker/pots";

const sum = (o: Record<string, number>) => Object.values(o).reduce((s, n) => s + n, 0);
// Force arbitraire : plus le chiffre est grand, meilleure est la main.
const ev = (n: number): HandEval => ({ rank: 0, tie: [n] });

test("pot unique sans tapis", () => {
  assert.deepEqual(buildPots({ a: 100, b: 100, c: 100 }, ["a", "b", "c"]), [{ amount: 300, eligible: ["a", "b", "c"] }]);
});

test("un joueur à tapis court : pot principal + side pot", () => {
  const pots = buildPots({ a: 50, b: 200, c: 200 }, ["a", "b", "c"]);
  assert.deepEqual(pots, [
    { amount: 150, eligible: ["a", "b", "c"] },
    { amount: 300, eligible: ["b", "c"] },
  ]);
});

test("trois tapis différents : trois pots", () => {
  const contrib = { a: 100, b: 250, c: 600, d: 600 };
  const pots = buildPots(contrib, ["a", "b", "c", "d"]);
  assert.deepEqual(pots, [
    { amount: 400, eligible: ["a", "b", "c", "d"] },
    { amount: 450, eligible: ["b", "c", "d"] },
    { amount: 700, eligible: ["c", "d"] },
  ]);
  assert.equal(pots.reduce((s, p) => s + p.amount, 0), sum(contrib));
  // Le plus court a la meilleure main : il ne gagne que le pot principal.
  const { payouts } = awardPots(pots, { a: ev(9), b: ev(5), c: ev(7), d: ev(1) }, ["a", "b", "c", "d"]);
  assert.deepEqual(payouts, { a: 400, c: 1150 });
});

test("l'argent d'un joueur couché reste dans les pots, sans qu'il puisse gagner", () => {
  // d a mis 80 puis s'est couché ; a est à tapis pour 50.
  const contrib = { a: 50, b: 200, c: 200, d: 80 };
  const pots = buildPots(contrib, ["a", "b", "c"]);
  assert.deepEqual(pots, [
    { amount: 200, eligible: ["a", "b", "c"] },
    { amount: 330, eligible: ["b", "c"] },
  ]);
  assert.equal(pots.reduce((s, p) => s + p.amount, 0), sum(contrib));
});

test("argent mort au-dessus des mises en jeu : reversé au dernier pot", () => {
  const pots = buildPots({ a: 100, b: 100, c: 300 }, ["a", "b"]);
  assert.deepEqual(pots, [{ amount: 500, eligible: ["a", "b"] }]);
});

test("partage à égalité, jeton indivisible au premier après le bouton", () => {
  const pots = buildPots({ a: 101, b: 101, c: 101 }, ["a", "b", "c"]);
  const { results, payouts } = awardPots(pots, { a: ev(5), b: ev(9), c: ev(9) }, ["c", "a", "b"]);
  assert.deepEqual(results[0].winners, ["c", "b"]);
  assert.deepEqual(payouts, { c: 152, b: 151 });
});

test("partage sur un side pot seulement", () => {
  const pots = buildPots({ a: 50, b: 200, c: 200 }, ["a", "b", "c"]);
  // a gagne le principal, b et c partagent le side pot.
  const { payouts } = awardPots(pots, { a: ev(9), b: ev(4), c: ev(4) }, ["a", "b", "c"]);
  assert.deepEqual(payouts, { a: 150, b: 150, c: 150 });
});

test("égalité entre le tapis court et un autre : le principal est partagé, le side va à l'autre", () => {
  const pots = buildPots({ a: 50, b: 200, c: 200 }, ["a", "b", "c"]);
  const { payouts } = awardPots(pots, { a: ev(9), b: ev(9), c: ev(1) }, ["a", "b", "c"]);
  assert.deepEqual(payouts, { a: 75, b: 375 });
});

test("conservation : la somme des gains égale la somme des mises (1 000 tirages)", () => {
  const players = ["a", "b", "c", "d", "e", "f"];
  for (let i = 0; i < 1000; i++) {
    const contrib: Record<string, number> = {};
    players.forEach((p) => (contrib[p] = Math.floor(Math.random() * 500)));
    const live = players.filter(() => Math.random() < 0.7);
    if (live.length === 0) continue;
    const evals: Record<string, HandEval> = {};
    live.forEach((p) => (evals[p] = ev(Math.floor(Math.random() * 4))));
    const { payouts } = awardPots(buildPots(contrib, live), evals, players);
    assert.equal(sum(payouts), sum(contrib));
    assert.ok(Object.keys(payouts).every((p) => live.includes(p)));
  }
});

import { potRaiseTo } from "../src/lib/poker/format";

test("raccourcis ½ pot / pot", () => {
  // Pot 100 (blindes + mise 60 de l'adversaire), je dois suivre 40 : pot
  // après mon call = 140 ; relance « pot » à 60 + 140 = 200.
  const base = { pot: 100, currentBet: 60, myStreetBet: 20, min: 100, max: 1000 };
  assert.equal(potRaiseTo({ ...base, fraction: 1 }), 200);
  assert.equal(potRaiseTo({ ...base, fraction: 0.5 }), 130);
  // Borné par le min-raise et le tapis.
  assert.equal(potRaiseTo({ ...base, fraction: 0.1, min: 100 }), 100);
  assert.equal(potRaiseTo({ ...base, fraction: 1, max: 150 }), 150);
});
