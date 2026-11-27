import { test } from "node:test";
import assert from "node:assert/strict";
import { launchCasino } from "../src/lib/casino/launch";
import { fromCodes } from "../src/lib/casino/cards";
import { dealerReply, normalize } from "../src/lib/dealer/bot";
import { CHAT_KEEP, chatFor, postDealerChat } from "../src/lib/dealer/chat";
import { blackjackGameKey, croupierFor, CROUPIERS } from "../src/lib/dealer/croupiers";
import { ApiError } from "../src/lib/errors";
import { performAction } from "../src/lib/game/room";
import type { GameState, Player } from "../src/lib/game/types";
import { viewFor } from "../src/lib/game/view";
import type { Room } from "../src/lib/store";
import { mulberry32, withSeed } from "./helpers/rng";

const players: Player[] = [
  { name: "Alice", slug: "a" },
  { name: "Bob", slug: "b" },
  { name: "Robo 🤖", slug: "r", bot: true },
];

function bjTable(now = 1000): GameState {
  return withSeed(3, () => launchCasino(players, "bjtable", { bjEndMode: "rounds", bjRounds: 5 }, { now, hostSlug: "a" }));
}
function room(g: GameState): Room {
  return { code: "ABCD", hostSlug: "a", players, game: g, createdAt: 0 };
}
const ctx = (extra: Partial<Parameters<typeof dealerReply>[1]> = {}) => ({
  croupier: CROUPIERS[0],
  playerName: "Alice",
  soiree: false,
  rng: mulberry32(1),
  ...extra,
});

test("croupière : même tirage pour tous, et les 3 sortent selon les parties", () => {
  const g = bjTable();
  const key = blackjackGameKey(g, "ABCD")!;
  assert.ok(key);
  assert.equal(croupierFor(key).name, croupierFor(key).name);
  const seen = new Set<string>();
  for (let i = 0; i < 60; i++) seen.add(croupierFor(`ABCD:c:${1000 + i * 60000}`).look);
  assert.equal(seen.size, 3);
  // Hors blackjack : pas de croupière.
  assert.equal(blackjackGameKey({ ...g, casinoGameId: "poker" }, "ABCD"), null);
});

test("bot : intentions principales, toujours une réponse", () => {
  assert.equal(normalize("Ça va ?!"), "ca va");
  assert.match(dealerReply("Salut !", ctx()), /Alice/);
  assert.match(dealerReply("comment tu t'appelles ?", ctx()), /Carmen/);
  assert.match(dealerReply("t'es trop belle", ctx()), /cartes|sabot|main|numéro/);
  assert.match(dealerReply("ta gueule", ctx()), /courtois|calme|classe/);
  assert.match(dealerReply("c'est quoi les règles ?", ctx({ soiree: true })), /gorgées/);
  assert.match(dealerReply("on boit ?", ctx({ soiree: false })), /jetons/);
  for (const t of ["", "???", "asdfgh", "🤔", "x".repeat(140)]) assert.ok(dealerReply(t, ctx()).length > 0);
});

test("bot : conseil de stratégie de base selon la main et la carte du croupier", () => {
  const advice = (hand: string[], up: string) =>
    dealerReply("je tire ou je reste ?", ctx({ hand: fromCodes(hand), dealerUp: fromCodes([up])[0], stage: "jeu" }));
  assert.match(advice(["Ts", "6h"], "Tc"), /16.*Roi|tirerais|Carte/);
  assert.match(advice(["Ts", "7h"], "9c"), /resterais|reste/);
  assert.match(advice(["6s", "5h"], "6c"), /doubler/);
  assert.match(advice(["8s", "8h"], "6c"), /séparerais/);
  assert.match(advice(["Ts", "As"], "6c"), /21/);
  assert.match(dealerReply("je tire ?", ctx({ stage: "mises" })), /mise/);
});

test("chat : partagé par la table, réponse différée, anti-spam, historique borné", () => {
  const g = bjTable();
  const r = room(g);
  performAction(r, "a", { type: "dealerChat", text: "  Salut   la table  " }, 5000);
  const chat = chatFor(r.game, "ABCD")!;
  assert.equal(chat.messages.length, 2);
  assert.equal(chat.messages[0].text, "Salut la table");
  assert.equal(chat.messages[0].name, "Alice");
  assert.equal(chat.messages[1].from, "dealer");
  assert.ok(chat.messages[1].at > 5000, "la croupière « écrit » avant de répondre");
  // Tout le monde voit la discussion (y compris un spectateur).
  assert.equal(viewFor(r.game, "b").game.dealerChat?.messages.length, 2);
  assert.equal(viewFor(r.game, null).game.dealerChat?.messages.length, 2);
  // Anti-spam, message vide, bot.
  assert.throws(() => performAction(r, "a", { type: "dealerChat", text: "encore" }, 5500), ApiError);
  assert.throws(() => performAction(r, "b", { type: "dealerChat", text: "   " }, 5500), ApiError);
  assert.throws(() => performAction(r, "r", { type: "dealerChat", text: "bip" }, 5500), ApiError);
  // Texte tronqué, historique borné.
  performAction(r, "b", { type: "dealerChat", text: "y".repeat(500) }, 6000);
  assert.equal(chatFor(r.game, "ABCD")!.messages.at(-2)!.text.length, 140);
  for (let i = 0; i < 40; i++) performAction(r, i % 2 ? "a" : "b", { type: "dealerChat", text: `m${i}` }, 10000 + i * 2000);
  assert.equal(chatFor(r.game, "ABCD")!.messages.length, CHAT_KEEP);
  // Les réponses arrivent dans l'ordre.
  const dealer = chatFor(r.game, "ABCD")!.messages.filter((m) => m.from === "dealer");
  for (let i = 1; i < dealer.length; i++) assert.ok(dealer[i].at > dealer[i - 1].at);
});

test("chat : ne compte pas comme un coup, et repart à zéro à la partie suivante", () => {
  const g = bjTable();
  const r = room(g);
  const seq = r.game.seq;
  performAction(r, "a", { type: "dealerChat", text: "coucou" }, 5000);
  assert.equal(r.game.seq, seq);
  // Nouvelle partie (Rejouer) : nouvelle clé, ancienne discussion ignorée.
  r.game = { ...r.game, casinoStartedAt: 999999 };
  assert.equal(chatFor(r.game, "ABCD"), null);
  postDealerChat(r.game, "ABCD", "b", "Bob", "re", 1_000_000);
  assert.equal(chatFor(r.game, "ABCD")!.messages.length, 2);
});
