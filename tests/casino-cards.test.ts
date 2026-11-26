import { test } from "node:test";
import assert from "node:assert/strict";
import { cardValue, draw, fromCode, shoeSize, shuffledShoe, toCode } from "../src/lib/casino/cards";
import { makeShuffledDeck } from "../src/lib/game/cards";

test("aller-retour Card <-> code pour les 52 cartes", () => {
  const deck = makeShuffledDeck();
  for (const c of deck) assert.deepEqual(fromCode(toCode(c)), c);
  assert.equal(new Set(deck.map(toCode)).size, 52);
  assert.equal(cardValue("As"), 14);
  assert.equal(cardValue("Td"), 10);
  assert.equal(cardValue("2c"), 2);
  assert.throws(() => fromCode("1s"));
  assert.throws(() => fromCode("Ax"));
});

test("sabot de 6 jeux : 312 cartes, 6 de chaque", () => {
  const shoe = shuffledShoe(6);
  assert.equal(shoeSize(shoe), 312);
  assert.equal(shoe.length, 624);
  const counts = new Map<string, number>();
  for (let i = 0; i < shoe.length; i += 2) counts.set(shoe.slice(i, i + 2), (counts.get(shoe.slice(i, i + 2)) ?? 0) + 1);
  assert.equal(counts.size, 52);
  for (const n of counts.values()) assert.equal(n, 6);
  const [c, rest] = draw(shoe);
  assert.equal(c, shoe.slice(0, 2));
  assert.equal(shoeSize(rest), 311);
  assert.throws(() => draw(""));
});
