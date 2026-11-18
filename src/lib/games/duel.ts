import { roundTypeById } from "../game/roundTypes";
import { makeShuffledDeck, shuffleArr } from "../game/cards";
import { fail, notNow } from "../errors";
import { drink, type GameModule, pick } from "../game/module";
import type { GameState } from "../game/types";

// Bataille : deux joueurs tirés au sort retournent chacun une carte, la
// plus forte gagne. Égalité = « bataille ! » : on rejoue un coup, et le
// perdant boira 2 gorgées de plus par bataille. Les autres parient avant
// sur le vainqueur : mauvais pari = 1 gorgée.
export const DUEL_BASE = 2;

export function pickDuelists(g: GameState): void {
  const idxs = [...Array(g.playersPublic.length).keys()];
  shuffleArr(idxs);
  g.duelists = [idxs[0], idxs[1]];
}

function spectators(g: GameState): string[] {
  const d = g.duel!;
  return g.playersPublic.map((p) => p.slug).filter((s) => s !== d.a && s !== d.b);
}

function resolveFlip(g: GameState): void {
  const d = g.duel!;
  const a = d.pendingA!;
  const b = d.pendingB!;
  d.flips = [...d.flips, { a, b }];
  d.pendingA = undefined;
  d.pendingB = undefined;
  d.revealed = [false, false];
  if (a.value === b.value) return; // bataille : on rejoue
  d.winner = a.value > b.value ? "a" : "b";
  d.stage = "done";
  const batailles = d.flips.length - 1;
  const loser = d.winner === "a" ? d.b : d.a;
  drink(g, loser, DUEL_BASE + 2 * batailles, batailles ? `Perd après ${batailles} bataille${batailles > 1 ? "s" : ""}` : "Perd le duel");
  Object.entries(d.bets).forEach(([slug, side]) => {
    if (side !== d.winner) drink(g, slug, 1, "Mauvais pari");
  });
  spectators(g)
    .filter((s) => !d.bets[s])
    .forEach((s) => drink(g, s, 1, "N'a pas parié"));
  g.lastResults = { type: "duel" };
  g.phase = "showdown";
}

export const duelModule: GameModule = {
  id: "duel",
  minPlayers: roundTypeById("duel").minPlayers,
  start(g) {
    if (!g.duelists) pickDuelists(g);
    const [ia, ib] = g.duelists!;
    g.duel = {
      a: g.playersPublic[ia].slug,
      b: g.playersPublic[ib].slug,
      stage: g.playersPublic.length > 2 ? "bets" : "flip",
      bets: {},
      betResponded: [],
      revealed: [false, false],
      flips: [],
      deck: makeShuffledDeck(),
    };
    g.phase = "duel";
  },
  act(g, slug, a) {
    const d = g.duel;
    if (g.phase !== "duel" || !d) notNow();
    if (a.type === "duelBet") {
      if (d.stage !== "bets") notNow();
      if (!spectators(g).includes(slug)) fail(403, "Les duellistes ne parient pas.");
      if (d.betResponded.includes(slug)) fail(409, "Tu as déjà parié.");
      if (a.side === "a" || a.side === "b") d.bets[slug] = a.side;
      d.betResponded = [...d.betResponded, slug];
      if (d.betResponded.length >= spectators(g).length) d.stage = "flip";
    } else if (a.type === "duelFlip") {
      if (d.stage !== "flip") notNow();
      if (slug !== d.a && slug !== d.b) fail(403, "Tu ne participes pas à ce duel.");
      const pos: 0 | 1 = slug === d.a ? 0 : 1;
      if (d.revealed[pos]) fail(409, "Déjà retournée.");
      d.revealed[pos] = true;
      if (pos === 0) d.pendingA = d.deck.shift();
      else d.pendingB = d.deck.shift();
      if (d.revealed[0] && d.revealed[1]) resolveFlip(g);
    } else fail(400, "Action inconnue.");
  },
  pending(g) {
    const d = g.duel;
    if (g.phase !== "duel" || !d) return null;
    if (d.stage === "bets") {
      const actors = spectators(g).filter((s) => !d.betResponded.includes(s));
      return { key: `duel:bets`, actors, timeoutMs: 15000 };
    }
    const actors = [d.a, d.b].filter((_, i) => !d.revealed[i]);
    return { key: `duel:flip:${d.flips.length}`, actors, timeoutMs: 20000 };
  },
  auto(g, _slug, _ctx, { bot }) {
    const d = g.duel!;
    if (d.stage === "bets") return { type: "duelBet", side: bot ? pick(["a", "b"]) : null };
    return { type: "duelFlip" };
  },
  botDelay: (g) => (g.duel?.stage === "bets" ? [2000, 6000] : [1200, 3000]),
};
