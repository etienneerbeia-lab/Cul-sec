// Le cadre « univers Chill » avec un jeu factice (pile ou face à jetons) :
// lancement, places assises, spectateurs, absents, masquage, arrivées en
// cours de partie, fin, Rejouer, retour au salon. Les vrais jeux (poker,
// blackjack) ont leurs propres tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CASINO_MODULES } from "../src/lib/casino/registry";
import { finishCasino, launchCasino } from "../src/lib/casino/launch";
import { MAX_CASINO_SEATS } from "../src/lib/casino/types";
import { activeSlugs, commit, createLedger, markBusted, seatPlayer, settle, totalChips } from "../src/lib/chips/ledger";
import { launchGame, moduleFor } from "../src/lib/game/engine";
import { AWAY_MS, performAction, tick } from "../src/lib/game/room";
import type { GameModule } from "../src/lib/game/module";
import { viewFor } from "../src/lib/game/view";
import type { GameState, Player } from "../src/lib/game/types";
import { MODULES } from "../src/lib/games/registry";
import type { Room } from "../src/lib/store";
import { ApiError } from "../src/lib/errors";

interface Flip {
  flipped: string[];
  secret: string;
}
const flipOf = (g: GameState) => (g as GameState & { flip: Flip }).flip;

const admitted: string[] = [];
const fake: GameModule = {
  id: "poker",
  minPlayers: 2,
  start(g) {
    g.chips = createLedger(
      g.playersPublic.map((p) => p.slug),
      30
    );
    (g as GameState & { flip: Flip }).flip = { flipped: [], secret: "deck" };
    g.phase = "betting";
  },
  act(g, slug, a, ctx) {
    if (a.type !== "flip") throw new ApiError(400, "?");
    const f = flipOf(g);
    if (f.flipped.includes(slug)) throw new ApiError(409, "déjà");
    f.flipped.push(slug);
    const alive = activeSlugs(g.chips!);
    if (!alive.every((s) => f.flipped.includes(s))) return;
    alive.forEach((s) => commit(g.chips!, s, 10));
    const winner = alive[Math.floor(Math.random() * alive.length)];
    settle(g.chips!, { [winner]: 10 * alive.length }, "table");
    markBusted(g.chips!);
    f.flipped = [];
    g.round += 1;
    if (activeSlugs(g.chips!).length <= 1) finishCasino(g, ctx.now);
  },
  pending(g) {
    const f = flipOf(g);
    const actors = activeSlugs(g.chips!).filter((s) => !f.flipped.includes(s));
    return { key: `flip:${g.round}`, actors, timeoutMs: 15000 };
  },
  auto: () => ({ type: "flip" }),
  botDelay: () => [500, 1000],
  redact(g) {
    return { ...g, flip: { ...flipOf(g), secret: "" } } as GameState;
  },
  admit(g, waiting) {
    for (const p of waiting) {
      admitted.push(p.slug);
      seatPlayer(g.chips!, p.slug, 0);
      g.playersPublic.push({ name: p.name, slug: p.slug, gulpsTotal: 0, folded: false, bet: 0, foldCost: null });
    }
    return waiting.length > 0;
  },
};
CASINO_MODULES.poker = fake;

const human = (n: string): Player => ({ name: n, slug: n.toLowerCase() });
const bot = (i: number): Player => ({ name: `Bot ${i} 🤖`, slug: `bot-${i}`, bot: true });

function room(players: Player[]): Room {
  const r: Room = { code: "T", hostSlug: players[0].slug, players, game: launchGame(players, 5, "last", ["high", "dice"]), createdAt: 0 };
  r.game.phase = "lobby";
  return r;
}

function casinoRoom(players: Player[], now = 1000): Room {
  const r = room(players);
  r.game = launchCasino(players, "poker", undefined, { now, hostSlug: r.hostSlug });
  return r;
}

test("8 places assises au plus, humains d'abord, les autres regardent", () => {
  const humans = Array.from({ length: 10 }, (_, i) => human(`H${i}`));
  const r = casinoRoom([bot(1), ...humans]);
  assert.equal(r.game.playersPublic.length, MAX_CASINO_SEATS);
  assert.ok(r.game.playersPublic.every((p) => !p.bot));
  assert.equal(r.game.universe, "casino");
  assert.equal(moduleFor(r.game), fake);
  // Un spectateur ne peut pas jouer.
  assert.throws(() => performAction(r, "h9", { type: "flip" }, 2000), (e: ApiError) => e.status === 403);
});

test("partie complète jouée par les bots : jetons conservés, classement", () => {
  const r = casinoRoom([human("Hote"), bot(1), bot(2), bot(3)]);
  const seen: Record<string, number> = {};
  let now = 1000;
  // Hôte présent, il joue lui-même.
  for (let i = 0; i < 5000 && r.game.phase !== "final"; i++) {
    seen.hote = now;
    const p = moduleFor(r.game)!.pending(r.game);
    if (p?.actors.includes("hote")) performAction(r, "hote", { type: "flip" }, now, seen);
    else tick(r, now, seen);
    assert.equal(totalChips(r.game.chips!), 120);
    now += 300;
  }
  assert.equal(r.game.phase, "final");
  const ranking = r.game.casinoRanking!;
  assert.equal(ranking.length, 4);
  assert.equal(ranking[0].rank, 1);
  assert.equal(ranking[0].stack, 120);
  assert.ok(r.game.casinoEndedAt! >= r.game.casinoStartedAt!);
  // Plus aucune action possible après la fin.
  assert.throws(() => performAction(r, "hote", { type: "flip" }, now), ApiError);
});

test("un humain absent est joué automatiquement, plus vite que le chrono", () => {
  const r = casinoRoom([human("Hote"), human("Zoe")]);
  const t0 = 1000;
  // Zoé n'a plus donné signe de vie depuis plus de AWAY_MS.
  const seen = { hote: t0, zoe: t0 - AWAY_MS - 1 };
  performAction(r, "hote", { type: "flip" }, t0, seen);
  tick(r, t0 + 2000, { ...seen, hote: t0 + 2000 });
  assert.ok(r.game.round >= 2 || r.game.phase === "final", "Zoé aurait dû jouer automatiquement");
  // Zoé revient : elle n'est plus jouée pour elle.
  const r2 = casinoRoom([human("Hote"), human("Zoe")]);
  const seen2 = { hote: t0, zoe: t0 };
  performAction(r2, "hote", { type: "flip" }, t0, seen2);
  tick(r2, t0 + 5000, { hote: t0 + 5000, zoe: t0 + 5000 });
  assert.equal(r2.game.round, 1);
});

test("le chrono expiré joue le coup par défaut", () => {
  const r = casinoRoom([human("Hote"), human("Zoe")]);
  const seen = { hote: 1000, zoe: 1000 };
  tick(r, 1000, seen);
  assert.equal(r.game.timer?.deadlineAt, 16000);
  tick(r, 16001, { hote: 16001, zoe: 16001 });
  assert.equal(r.game.round, 2);
});

test("vue : le module masque ses secrets, le planning des bots ne sort jamais", () => {
  const r = casinoRoom([human("Hote"), bot(1)]);
  tick(r, 1000, { hote: 1000 });
  assert.ok(r.game.botPlan);
  const v = viewFor(r.game, "hote");
  assert.equal((v.game as GameState & { flip: Flip }).flip.secret, "");
  assert.equal(flipOf(r.game).secret, "deck", "l'état serveur ne doit pas être modifié");
  assert.equal(v.game.botPlan, undefined);
});

test("arrivées en cours de partie : le jeu décide (admit)", () => {
  const r = casinoRoom([human("Hote"), bot(1)]);
  r.players.push(human("Late"));
  admitted.length = 0;
  tick(r, 1000, { hote: 1000 });
  assert.deepEqual(admitted, ["late"]);
  assert.ok(r.game.playersPublic.some((p) => p.slug === "late"));
});

test("Rejouer (hôte) : nouvelle partie, mêmes réglages, spectateurs assis", () => {
  const r = casinoRoom([human("Hote"), bot(1)]);
  finishCasino(r.game, 5000);
  r.players.push(human("New"));
  assert.throws(() => performAction(r, "bot-1", { type: "casinoReplay" }, 6000), (e: ApiError) => e.status === 403);
  performAction(r, "hote", { type: "casinoReplay" }, 6000);
  assert.equal(r.game.phase, "betting");
  assert.equal(r.game.casinoStartedAt, 6000);
  assert.ok(r.game.playersPublic.some((p) => p.slug === "new"));
  assert.equal(r.game.casinoRanking, undefined);
});

test("retour au salon : l'univers et le jeu choisis sont gardés, les jetons effacés", () => {
  const r = casinoRoom([human("Hote"), bot(1)]);
  performAction(r, "hote", { type: "restart" }, 2000);
  assert.equal(r.game.phase, "lobby");
  assert.equal(r.game.universe, "casino");
  assert.equal(r.game.casinoGameId, "poker");
  assert.equal(r.game.chips, undefined);
  assert.ok(r.players.every((p) => !p.bot));
});

test("réglages du salon : réservés à l'hôte, validés", () => {
  const r = room([human("Hote"), human("Zoe")]);
  assert.throws(() => performAction(r, "zoe", { type: "lobbySetup", universe: "casino" }, 1), (e: ApiError) => e.status === 403);
  performAction(r, "hote", { type: "lobbySetup", universe: "casino", casinoGameId: "bjtable" }, 1);
  assert.equal(r.game.universe, "casino");
  assert.equal(r.game.casinoGameId, "bjtable");
  performAction(r, "hote", { type: "lobbySetup", casinoOptions: { bjEndMode: "survivor", bjRounds: 99 } }, 1);
  assert.deepEqual(r.game.casinoOptions, { bjEndMode: "survivor", bjRounds: 10 });
  assert.throws(() => performAction(r, "hote", { type: "lobbySetup", universe: "x" }, 1), ApiError);
  assert.throws(() => performAction(r, "hote", { type: "lobbySetup", casinoGameId: "roulette" }, 1), ApiError);
  performAction(r, "hote", { type: "lobbySetup", universe: "party" }, 1);
  assert.equal(r.game.universe, "party");
});

test("Soirée : aucun univers posé, modules Soirée inchangés", () => {
  const g = launchGame([human("A"), human("B")], 5, "last", ["high", "dice"]);
  assert.equal(g.universe, undefined);
  assert.equal(moduleFor(g), MODULES[g.roundTypeId!]);
  const v = viewFor(g, "a");
  assert.equal(v.game.universe, undefined);
});
