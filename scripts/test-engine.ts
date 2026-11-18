// Simule des soirées complètes, sans Redis : une table de joueurs (bots +
// éventuellement des humains « absents ») joue chaque mini-jeu de bout en
// bout via le vrai moteur (tick + actions). Vérifie qu'aucune manche ne
// reste bloquée et que les gorgées restent cohérentes.
// Lancer : npm run test:engine
import { launchGame } from "../src/lib/game/engine";
import { performAction, tick } from "../src/lib/game/room";
import { ROUND_TYPES } from "../src/lib/game/roundTypes";
import { viewFor } from "../src/lib/game/view";
import { MODULES } from "../src/lib/games/registry";
import { makeBots } from "../src/lib/bots/names";
import type { Room } from "../src/lib/store";
import type { Player, RoundTypeId } from "../src/lib/game/types";

let failures = 0;
function check(cond: unknown, msg: string) {
  if (!cond) {
    failures++;
    console.error("  ✗ " + msg);
  }
}

function makeRoom(players: Player[], enabled: RoundTypeId[], rounds: number): Room {
  const host = players.find((p) => !p.bot) ?? players[0];
  return {
    code: "TEST",
    hostSlug: host.slug,
    players,
    game: launchGame(players, rounds, "first", enabled),
    createdAt: 0,
  };
}

// Joue une soirée ; l'hôte (humain absent) avance les écrans d'intro et de
// résultats, tout le reste est joué par le tick.
function playNight(room: Room, label: string): void {
  let now = 1_000_000;
  const host = room.hostSlug;
  const seen: Record<string, number> = {};
  const roundsSeen = new Set<RoundTypeId>();
  for (let step = 0; step < 20000; step++) {
    const g = room.game;
    // L'hôte est « présent » ; les autres humains sont absents.
    seen[host] = now;
    if (g.phase === "final") {
      tick(room, now, seen);
      if (g.culSecRule === "first" && !g.culSecTargetSlug && g.playersPublic.length > 1) {
        now += 1000;
        continue;
      }
      break;
    }
    if (g.phase === "roundIntro") {
      roundsSeen.add(g.roundTypeId!);
      performAction(room, host, { type: "confirmIntro" }, now, seen);
    } else if (g.phase === "showdown" || g.phase === "quizRecap") {
      check(g.lastResults || g.phase === "quizRecap", `${label}: résultats manquants (${g.roundTypeId})`);
      performAction(room, host, { type: "nextRound" }, now, seen);
    } else if (g.phase === "quiz" && g.quiz?.status === "result") {
      performAction(room, host, { type: "quizNext" }, now, seen);
    } else {
      tick(room, now, seen);
    }
    // La vue envoyée au client ne doit jamais contenir de secret.
    const v = viewFor(room.game, host);
    check(!v.game.hands, `${label}: mains envoyées au client`);
    if (v.game.undercover) check(!v.game.undercover.impostorSlug, `${label}: imposteur révélé`);
    if (v.game.blackjack) check(v.game.blackjack.deck.length === 0, `${label}: sabot envoyé`);
    now += 700;
  }
  const g = room.game;
  check(g.phase === "final", `${label}: la soirée n'est pas allée au bout (phase ${g.phase}, manche ${g.round}, jeu ${g.roundTypeId})`);
  g.playersPublic.forEach((p) => check(Number.isInteger(p.gulpsTotal) && p.gulpsTotal >= 0, `${label}: gorgées invalides`));
  const total = g.playersPublic.reduce((s, p) => s + p.gulpsTotal, 0);
  console.log(
    `  ${label}: ${g.round} manches, ${[...roundsSeen].join(", ")} — ${total} gorgées (${g.playersPublic
      .map((p) => `${p.name} ${p.gulpsTotal}`)
      .join(", ")})`
  );
}

const ALL = ROUND_TYPES.map((t) => t.id);
const human = (name: string): Player => ({ name, slug: name.toLowerCase() });

console.log("Chaque mini-jeu seul, plusieurs tailles de table :");
for (const id of ALL) {
  for (const size of [1, 2, 3, 4, 6, 8]) {
    if (size < MODULES[id].minPlayers) continue;
    for (let rep = 0; rep < 3; rep++) {
      const humans = [human("Hote")];
      const players = [...humans, ...makeBots(size - 1, humans)];
      // Deux jeux requis par le lobby : on double le même pour le forcer.
      const room = makeRoom(players, [id, id], 3);
      playNight(room, `${id}×${size}#${rep}`);
    }
  }
}

console.log("Soirées complètes, tous les jeux :");
for (const size of [1, 3, 5, 8]) {
  const humans = [human("Hote")];
  const players = [...humans, ...makeBots(Math.max(size - 1, 3), humans)];
  playNight(makeRoom(players, ALL, 20), `soirée×${players.length}`);
}

if (failures) {
  console.error(`\n${failures} échec(s).`);
  process.exit(1);
}
console.log("\nTout est OK.");
