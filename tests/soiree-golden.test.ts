// Non-régression des jeux « Soirée » à cartes (Poker, Blackjack) : avec
// Math.random seedé et une horloge virtuelle, chaque partie est rejouée à
// l'identique. On compare un résumé complet (résultats, gorgées) à un
// instantané pris AVANT toute modification du moteur. Si ce test casse,
// le comportement Soirée a changé.
// Mettre à jour (uniquement si le changement est voulu) :
//   UPDATE_GOLDEN=1 npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launchGame } from "../src/lib/game/engine";
import { performAction, tick } from "../src/lib/game/room";
import { makeBots } from "../src/lib/bots/names";
import type { Room } from "../src/lib/store";
import type { Player, RoundTypeId } from "../src/lib/game/types";
import { withSeed } from "./helpers/rng";

const GOLDEN = join(__dirname, "golden", "soiree.json");

function playRounds(id: RoundTypeId, size: number, rounds: number): unknown[] {
  const host: Player = { name: "Hote", slug: "hote" };
  const players = [host, ...makeBots(size - 1, [host])];
  const room: Room = {
    code: "GOLD",
    hostSlug: host.slug,
    players,
    game: launchGame(players, rounds, "last", [id, id]),
    createdAt: 0,
  };
  let now = 1_000_000;
  const seen: Record<string, number> = {};
  const log: unknown[] = [];
  for (let step = 0; step < 20000 && room.game.phase !== "final"; step++) {
    const g = room.game;
    seen[host.slug] = now;
    if (g.phase === "roundIntro") performAction(room, host.slug, { type: "confirmIntro" }, now, seen);
    else if (g.phase === "showdown") {
      log.push({ round: g.round, results: g.lastResults, drinks: g.drinks });
      performAction(room, host.slug, { type: "nextRound" }, now, seen);
    } else tick(room, now, seen);
    now += 700;
  }
  log.push({ final: room.game.phase, gulps: room.game.playersPublic.map((p) => [p.slug, p.gulpsTotal]) });
  return log;
}

const CASES: { id: RoundTypeId; size: number; seed: number }[] = [];
for (const id of ["holdem", "blackjack"] as RoundTypeId[])
  for (const size of [1, 2, 3, 5, 8]) {
    if (id === "holdem" && size < 2) continue;
    for (const seed of [1, 2, 3, 4]) CASES.push({ id, size, seed: seed * 1000 + size });
  }

test("Soirée : poker et blackjack identiques à l'instantané", () => {
  const actual: Record<string, string> = {};
  for (const c of CASES) {
    const log = withSeed(c.seed, () => playRounds(c.id, c.size, 8));
    const last = log[log.length - 1] as { final: string };
    assert.equal(last.final, "final", `${c.id}×${c.size} n'est pas allé au bout`);
    assert.ok(log.length >= 8, `${c.id}×${c.size} : manches manquantes`);
    actual[`${c.id}×${c.size}#${c.seed}`] = createHash("sha256").update(JSON.stringify(log)).digest("hex");
  }
  if (process.env.UPDATE_GOLDEN || !existsSync(GOLDEN)) {
    writeFileSync(GOLDEN, JSON.stringify(actual, null, 2) + "\n");
    return;
  }
  const expected = JSON.parse(readFileSync(GOLDEN, "utf8")) as Record<string, string>;
  assert.deepEqual(actual, expected);
});
