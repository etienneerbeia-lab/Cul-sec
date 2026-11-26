// Évaluateur de mains (partagé par le poker Soirée et le Poker casino).
import { test } from "node:test";
import assert from "node:assert/strict";
import { fromCode } from "../src/lib/casino/cards";
import { bestHand, bestOf7, compareHand, describeHand, evaluate5 } from "../src/lib/game/evaluate";
import type { Card } from "../src/lib/game/types";

const C = (s: string): Card[] => s.split(" ").map(fromCode);
const best = (s: string) => bestHand(C(s));
// < 0 : a gagne ; > 0 : b gagne ; 0 : égalité (convention de compareHand).
const cmp = (a: string, b: string) => compareHand(best(a).eval, best(b).eval);

test("ordre des catégories", () => {
  const hands = [
    "As Ks Qs Js Ts 2c 3d", // quinte flush royale
    "9h 9d 9s 9c Kd 2c 3d", // carré
    "Qh Qd Qs 4c 4d 2c 7s", // full
    "Ah 9h 6h 4h 2h Kc Qd", // couleur
    "9c 8d 7h 6s 5c Kd 2h", // quinte
    "7c 7d 7h Ks 2c 4d 9h", // brelan
    "Kc Kd 7h 7s 2c 4d 9h", // double paire
    "Jc Jd 8h 6s 2c 4d 9h", // paire
    "Ac Qd 8h 6s 2c 4d 9h", // hauteur
  ];
  for (let i = 0; i + 1 < hands.length; i++) assert.ok(cmp(hands[i], hands[i + 1]) < 0, `${hands[i]} > ${hands[i + 1]}`);
});

test("couleur bat quinte, full bat couleur", () => {
  assert.ok(cmp("2h 5h 7h 9h Jh Kc Qd", "9c Td Jh Qs Kc 2d 3c") < 0);
  assert.ok(cmp("2c 2d 2h 3s 3c Kd Qh", "2h 5h 7h 9h Jh Kc Qd") < 0);
});

test("quinte A-2-3-4-5 (la roue)", () => {
  const w = best("Ah 2c 3d 4s 5h Kd Qc");
  assert.equal(w.eval.rank, 4);
  assert.equal(describeHand(w.eval), "Quinte au 5");
  // La roue perd contre une quinte au 6.
  assert.ok(cmp("2c 3d 4s 5h 6d Kc Qh", "Ah 2c 3d 4s 5h Kd Qc") < 0);
  // A-K-Q-J-T est la plus haute, l'As ne « tourne » pas : Q-K-A-2-3 n'est pas une quinte.
  assert.equal(best("Qc Kd Ah 2s 3c 8d 9h").eval.rank, 0);
  // Quinte flush à la roue.
  const sf = best("Ad 2d 3d 4d 5d Kc Kh");
  assert.equal(sf.eval.rank, 8);
  assert.equal(describeHand(sf.eval), "Quinte flush au 5");
  // 6 cartes consécutives : on prend la plus haute.
  assert.equal(describeHand(best("4c 5d 6h 7s 8c 9d 2h").eval), "Quinte au 9");
});

test("kickers", () => {
  // Même paire, le kicker décide.
  assert.ok(cmp("Ac Kd 7h 7s 2c 4d 9h", "Ad Qd 7c 7d 2c 4d 9h") < 0);
  // Double paire identique : 5e carte.
  assert.ok(cmp("Kc Kd 7h 7s Ac 4d 2h", "Ks Kh 7c 7d Qc 4d 2h") < 0);
  // Trois paires : on garde les deux meilleures + la meilleure 5e carte.
  const tp = best("Ac Ad Kh Ks Qc Qd 2h");
  assert.deepEqual(tp.eval.tie, [14, 13, 12]);
  // Hauteur : comparaison carte par carte jusqu'à la 5e.
  assert.ok(cmp("Ac Kd 9h 7s 5c 3d 2h", "As Kh 9c 7d 4c 3d 2h") < 0);
  // Couleur : les 5 plus hautes de la couleur, même avec 6 cartes de la couleur.
  const fl = best("Ah Kh 9h 7h 5h 3h 2c");
  assert.deepEqual(fl.eval.tie, [14, 13, 9, 7, 5]);
  assert.ok(cmp("Ah Kh 9h 7h 6h 2c 3d", "As Ks 9s 7s 5s 2c 3d") < 0);
  // Full : le brelan compte avant la paire ; deux brelans → le plus haut + paire du second.
  const fh = best("8c 8d 8h 5s 5c 5d Kh");
  assert.equal(describeHand(fh.eval), "Full aux 8 par les 5");
  assert.ok(cmp("9c 9d 9h 2s 2c Kd Qh", "8c 8d 8h As Ac Kd Qh") < 0);
  // Carré : kicker.
  assert.ok(cmp("9c 9d 9h 9s Ac 2d 3h", "9c 9d 9h 9s Kc 2d 3h") < 0);
});

test("égalités : main jouée sur le board, couleurs différentes", () => {
  // Le board fait la meilleure main pour les deux : partage.
  assert.equal(cmp("2c 3d As Ks Qs Js Ts", "4h 5h As Ks Qs Js Ts"), 0);
  // Même quinte, couleurs différentes : égalité.
  assert.equal(cmp("9c 8d 7h 6s 5c 2d 2h", "9h 8s 7c 6d 5h 2d 2h"), 0);
  // Les kickers au-delà de 5 cartes ne comptent pas.
  assert.equal(cmp("Ac Ad Kh Qs Jc 3d 2h", "As Ah Kc Qd Jh 4c 2s"), 0);
});

test("cartes qui composent la main gagnante", () => {
  const b = best("Ah Kh 2c 9h 7h 5h Ks");
  assert.equal(b.cards.length, 5);
  assert.deepEqual(b.cards.map((c) => c.value).sort((x, y) => y - x), [14, 13, 9, 7, 5]);
  assert.ok(b.cards.every((c) => c.suit.sym === "♥"));
});

test("noms des mains", () => {
  const d = (s: string) => describeHand(best(s).eval);
  assert.equal(d("As Ks Qs Js Ts 2c 3d"), "Quinte flush royale");
  assert.equal(d("Ah 9h 6h 4h 2h Kc Qd"), "Couleur à l'As");
  assert.equal(d("Qh 9h 6h 4h 2h 3c 8d"), "Couleur à la Dame");
  assert.equal(d("Kc Kd 7h 7s 2c 4d 9h"), "Double paire Rois et 7");
  assert.equal(d("Ac Ad 7h 6s 2c 4d 9h"), "Paire d'As");
  assert.equal(d("Jc Jd 7h 6s 2c 4d 9h"), "Paire de Valets");
  assert.equal(d("9h 9d 9s 9c Kd 2c 3d"), "Carré de 9");
  assert.equal(d("Qh Qd Qs 4c 4d 2c 7s"), "Full aux Dames par les 4");
  assert.equal(d("7c 7d 7h Ks 2c 4d 9h"), "Brelan de 7");
  assert.equal(d("Kc Jd 8h 6s 2c 4d 9h"), "Hauteur Roi");
  assert.equal(d("9c 8d 7h 6s 5c 2d 2h"), "Quinte au 9");
  assert.equal(d("Tc Jd Qh Ks Ac 2d 2h"), "Quinte à l'As");
});

test("bestHand = bestOf7 (fonction du poker Soirée) sur 3 000 mains au hasard", () => {
  const deck = C(
    "2s 3s 4s 5s 6s 7s 8s 9s Ts Js Qs Ks As 2h 3h 4h 5h 6h 7h 8h 9h Th Jh Qh Kh Ah 2d 3d 4d 5d 6d 7d 8d 9d Td Jd Qd Kd Ad 2c 3c 4c 5c 6c 7c 8c 9c Tc Jc Qc Kc Ac"
  );
  for (let i = 0; i < 3000; i++) {
    const d = deck.slice().sort(() => Math.random() - 0.5).slice(0, 7);
    assert.deepEqual(bestHand(d).eval, bestOf7(d));
    assert.deepEqual(evaluate5(bestHand(d).cards), bestOf7(d));
  }
});

test("fréquences exactes sur les 2 598 960 mains de 5 cartes", () => {
  const deck = C(
    "2s 3s 4s 5s 6s 7s 8s 9s Ts Js Qs Ks As 2h 3h 4h 5h 6h 7h 8h 9h Th Jh Qh Kh Ah 2d 3d 4d 5d 6d 7d 8d 9d Td Jd Qd Kd Ad 2c 3c 4c 5c 6c 7c 8c 9c Tc Jc Qc Kc Ac"
  );
  const counts = new Array(9).fill(0);
  const h: Card[] = new Array(5);
  for (let a = 0; a < 52; a++)
    for (let b = a + 1; b < 52; b++)
      for (let c = b + 1; c < 52; c++)
        for (let d = c + 1; d < 52; d++)
          for (let e = d + 1; e < 52; e++) {
            h[0] = deck[a];
            h[1] = deck[b];
            h[2] = deck[c];
            h[3] = deck[d];
            h[4] = deck[e];
            counts[evaluate5(h).rank]++;
          }
  assert.deepEqual(counts, [1302540, 1098240, 123552, 54912, 10200, 5108, 3744, 624, 40]);
});
