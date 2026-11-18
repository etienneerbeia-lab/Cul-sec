import { roundTypeById } from "../game/roundTypes";
import { makeShuffledDeck } from "../game/cards";
import { fail, notNow } from "../errors";
import { chance, drink, type GameModule, nameOf, pick, slugsInOrder } from "../game/module";
import type { GameState, HighLowGuess } from "../game/types";

// Plus ou Moins : une carte est retournée ; chacun son tour, on parie que
// la suivante sera plus haute ou plus basse. Bonne réponse : la série
// grossit et on passe la main. Erreur (ou carte égale) : on boit la série
// entière, et elle repart à 1. Plus la chaîne tient, plus ça fait mal.
export const HIGHLOW_MAX_PILE = 6;

function laps(n: number): number {
  return n <= 2 ? 4 : n <= 4 ? 3 : n <= 6 ? 2 : 1;
}

export function startHighLow(g: GameState): void {
  const deck = [...makeShuffledDeck(), ...makeShuffledDeck()];
  const table = slugsInOrder(g);
  const order: string[] = [];
  for (let i = 0; i < laps(table.length); i++) order.push(...table);
  g.highlow = { deck, current: deck.shift()!, pile: 1, order, pointer: 0, turns: [] };
  g.phase = "highlow";
}

function guess(g: GameState, slug: string, choice: HighLowGuess): void {
  const h = g.highlow!;
  const card = h.deck.shift()!;
  const from = h.current;
  const correct = choice === "plus" ? card.value > from.value : card.value < from.value;
  let drank = 0;
  if (correct) h.pile = Math.min(HIGHLOW_MAX_PILE, h.pile + 1);
  else {
    drank = h.pile;
    drink(g, slug, drank, card.value === from.value ? "Carte égale" : "Mauvais pari");
    h.pile = 1;
  }
  h.turns = [...h.turns, { slug, name: nameOf(g, slug), guess: choice, from, card, correct, drank }];
  h.current = card;
  h.pointer += 1;
  if (h.pointer >= h.order.length) {
    g.lastResults = { type: "high" };
    g.phase = "showdown";
  }
}

export const highlowModule: GameModule = {
  id: "high",
  minPlayers: roundTypeById("high").minPlayers,
  start: (g) => startHighLow(g),
  act(g, slug, a) {
    const h = g.highlow;
    if (g.phase !== "highlow" || !h || a.type !== "hlGuess") notNow();
    if (h.order[h.pointer] !== slug) fail(403, "Ce n'est pas ton tour.");
    if (a.guess !== "plus" && a.guess !== "moins") fail(400, "Choix invalide.");
    guess(g, slug, a.guess);
  },
  pending(g) {
    const h = g.highlow;
    if (g.phase !== "highlow" || !h) return null;
    return { key: `hl:${h.pointer}`, actors: [h.order[h.pointer]], timeoutMs: 25000 };
  },
  auto(g, _slug, _ctx, { bot }) {
    const v = g.highlow!.current.value;
    // Le bot joue la probabilité, avec une petite part d'instinct.
    let choice: HighLowGuess = v < 8 ? "plus" : v > 8 ? "moins" : pick(["plus", "moins"]);
    if (bot && v >= 6 && v <= 10 && chance(0.15)) choice = choice === "plus" ? "moins" : "plus";
    return { type: "hlGuess", guess: choice };
  },
  // La carte se retourne en ~1,2 s chez chacun.
  botDelay: () => [1800, 3200],
};
