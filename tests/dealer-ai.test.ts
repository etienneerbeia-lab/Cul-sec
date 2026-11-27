import { test } from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { launchCasino } from "../src/lib/casino/launch";
import { fromCode } from "../src/lib/casino/cards";
import { moduleFor } from "../src/lib/game/engine";
import type { DealerChatMessage, GameState, Player } from "../src/lib/game/types";
import { chatFor, postDealerChat } from "../src/lib/dealer/chat";
import { describeTable } from "../src/lib/dealer/context";
import { roundReaction } from "../src/lib/dealer/events";
import { buildMessages, claimJobs, cleanLine, fillJob, systemPrompt, writeDealerLine } from "../src/lib/dealer/llm";
import { dealerReact } from "../src/lib/dealer/react";
import { CROUPIERS, blackjackGameKey, croupierFor } from "../src/lib/dealer/croupiers";
import type { Room } from "../src/lib/store";
import { mulberry32, withSeed } from "./helpers/rng";

const players = (n: number): Player[] => ["a", "b"].slice(0, n).map((s) => ({ name: s === "a" ? "Alice" : "Bob", slug: s }));
function table(n = 1): GameState {
  return withSeed(5, () => launchCasino(players(n), "bjtable", { bjEndMode: "rounds", bjRounds: 10 }, { now: 1000, hostSlug: "a" }));
}
const rig = (g: GameState, cards: string) => (g.bjt!.shoe = cards.replace(/ /g, "") + g.bjt!.shoe);
const act = (g: GameState, s: string, op: string, extra: Record<string, unknown> = {}) =>
  moduleFor(g)!.act(g, s, { type: "bjt", op, ...extra }, { now: 0, hostSlug: "a" });
const rng = mulberry32(2);

test("fin de manche : double raté → la croupière chambre, une seule fois", () => {
  const g = table();
  rig(g, "6s Tc 5h 8d 4c"); // Alice 6+5, double → 15 ; croupière T+8 = 18
  act(g, "a", "bet", { amount: 100 });
  act(g, "a", "double");
  assert.equal(g.bjt!.stage, "roundEnd");
  const r = roundReaction(g, undefined, 5000)!;
  assert.deepEqual(
    r.events.map((e) => e.kind),
    ["doubleLost"],
  );
  assert.equal(r.events[0].amount, 200);
  assert.ok(r.minAt > 5000, "après la fin de la distribution");
  assert.equal(dealerReact(g, "ABCD", 5000, { rng }), true);
  const msg = chatFor(g, "ABCD")!.messages.at(-1)!;
  assert.equal(msg.from, "dealer");
  assert.match(msg.text, /Alice/);
  assert.equal(msg.at, r.minAt);
  // Déjà commentée : plus rien.
  assert.equal(dealerReact(g, "ABCD", 6000, { rng }), false);
});

test("fin de manche : split raté (les deux mains) et joueur à sec", () => {
  const g = table();
  rig(g, "8s Tc 8h 9d 2c 3d"); // 8 8 contre T+9 ; split : 10 et 11, reste
  act(g, "a", "bet", { amount: 10 });
  act(g, "a", "split");
  act(g, "a", "stand");
  act(g, "a", "stand");
  const r = roundReaction(g, undefined, 0)!;
  assert.equal(r.events[0].kind, "splitLost");
  assert.equal(r.events[0].allLost, true);

  const g2 = table();
  rig(g2, "Ts Tc 7h 9d"); // tapis : 17 contre 19
  act(g2, "a", "bet", { amount: 500 });
  act(g2, "a", "stand");
  const r2 = roundReaction(g2, undefined, 0)!;
  assert.equal(r2.events[0].kind, "broke");
  dealerReact(g2, "ABCD", 0, { rng });
  assert.deepEqual(chatFor(g2, "ABCD")!.brokeSeen, ["a"]);
  assert.match(chatFor(g2, "ABCD")!.messages.at(-1)!.text, /Alice/);
});

test("fin de manche Soirée : double raté en gorgées", () => {
  const card = (c: string) => fromCode(c);
  const g = {
    phase: "showdown",
    round: 3,
    startIndex: 0,
    lastRoundTypeId: null,
    roundTypeId: "blackjack",
    playersPublic: [{ name: "Zoé", slug: "z", gulpsTotal: 3, folded: false, bet: 0, foldCost: null }],
    blackjack: {
      stage: "result",
      bets: { z: 2 },
      betResponded: ["z"],
      players: [
        {
          slug: "z",
          name: "Zoé",
          activeHandIdx: 0,
          hands: [{ id: 1, cards: [card("6s"), card("5h"), card("4c")], bet: 4, status: "stand", doubled: true, isSplitAces: false, fromSplit: false }],
        },
      ],
      turnPointer: 0,
      dealer: { cards: [card("Tc"), card("8d")], hiddenCard: null },
      deck: [],
      dealLog: [{ target: "dealer-reveal" }],
      distributionQueue: [],
      results: [{ slug: "z", name: "Zoé", handIdx: 0, cards: [], total: 15, bet: 4, outcome: "lose", amount: 4 }],
    },
  } as unknown as GameState;
  const r = roundReaction(g, undefined, 0)!;
  assert.equal(r.key, "s3");
  assert.equal(r.events[0].kind, "doubleLost");
  dealerReact(g, "WXYZ", 0, { rng });
  const said = chatFor(g, "WXYZ")!.messages.at(-1)!.text;
  assert.match(said, /Zoé/);
  assert.match(said, /gorgées/);
});

test("contexte : l'état visible de la table, jamais la carte cachée", () => {
  const g = table(2);
  rig(g, "Ts 9c 6d Kd 7h Qh"); // Alice T+K, Bob 9+7 ; croupière 6 visible, D cachée
  act(g, "a", "bet", { amount: 20 });
  act(g, "b", "bet", { amount: 30 });
  assert.equal(g.bjt!.stage, "playerTurns");
  const text = describeTable(g);
  assert.match(text, /Alice/);
  assert.match(text, /6♦/);
  assert.match(text, /stratégie de base/);
  assert.doesNotMatch(text, /D♥/, "la carte cachée ne doit jamais apparaître");
  assert.match(text, /carte cachée, personne ne la connaît/);
});

function fakeRoom(g: GameState): Room {
  return { code: "ABCD", hostSlug: "a", players: players(2), game: g, createdAt: 0 };
}

test("IA : messages (discussion + état de la table en message système) et paramètres", async () => {
  const g = table(2);
  rig(g, "Ts 9c 6d Kd 7h Qh");
  act(g, "a", "bet", { amount: 20 });
  act(g, "b", "bet", { amount: 30 });
  postDealerChat(g, "ABCD", "b", "Bob", "Salut !", 1000, { llm: true, rng });
  postDealerChat(g, "ABCD", "b", "Bob", "je tire ou je reste ?", 5000, { llm: true, rng });
  const chat = chatFor(g, "ABCD")!;
  const job = chat.messages.at(-1)!;
  assert.equal(job.llm, "todo");
  assert.equal(job.at, 5000 + 9000);
  const msgs = buildMessages(g, job, chat.messages);
  assert.equal(msgs[0].role, "user");
  assert.equal(msgs.at(-1)!.role, "system");
  assert.match(String(msgs.at(-1)!.content), /État de la table/);
  assert.match(String(msgs.at(-1)!.content), /Réponds maintenant à Bob/);
  assert.match(String(msgs.at(-2)!.content), /Bob : je tire ou je reste/);

  let seen: Anthropic.Beta.MessageCreateParamsNonStreaming | null = null;
  const croupier = croupierFor(blackjackGameKey(g, "ABCD")!);
  const line = await writeDealerLine(g, "ABCD", job, async (params) => {
    seen = params;
    return {
      content: [{ type: "text", text: `${croupier.name} : « Avec 16 contre mon 6, reste, Bob. »` }],
      stop_reason: "end_turn",
    } as unknown as Anthropic.Beta.BetaMessage;
  });
  assert.equal(line, "Avec 16 contre mon 6, reste, Bob.");
  const p = seen! as Anthropic.Beta.MessageCreateParamsNonStreaming;
  assert.equal(p.model, "claude-opus-5-5");
  assert.equal(p.fallbacks, "default");
  assert.deepEqual(p.output_config, { effort: "low" });
  const sys = (p.system as Anthropic.Beta.BetaTextBlockParam[])[0].text;
  assert.match(sys, new RegExp(croupier.name));
  assert.match(sys, /stratégie de base/);
  assert.match(sys, /Blackjack payé 3 pour 2/);
  // Refus : pas de réplique (la réponse de secours reste).
  const refused = await writeDealerLine(g, "ABCD", job, async () => ({ content: [], stop_reason: "refusal" }) as unknown as Anthropic.Beta.BetaMessage);
  assert.equal(refused, null);
});

test("IA : réservation atomique, réplique posée, ou réplique de secours après le délai", () => {
  const g = table(2);
  postDealerChat(g, "ABCD", "a", "Alice", "coucou", 1000, { llm: true, rng });
  const room = fakeRoom(g);
  const fallback = chatFor(g, "ABCD")!.messages.at(-1)!.text;
  const claimed = claimJobs(room, "T1");
  assert.equal(claimed.length, 1);
  assert.equal(claimJobs(room, "T2").length, 0, "déjà réservée");
  // Rédigée à temps : remplace la réponse de secours, affichée tout de suite.
  assert.equal(fillJob(room, claimed[0].id, "T1", "Salut Alice !", 3000), true);
  const m = chatFor(g, "ABCD")!.messages.at(-1)! as DealerChatMessage;
  assert.equal(m.text, "Salut Alice !");
  assert.equal(m.at, 3000);
  assert.equal(m.llm, undefined);
  // Trop tard : la réponse de secours est déjà affichée, on n'y touche pas.
  postDealerChat(g, "ABCD", "b", "Bob", "yo", 20000, { llm: true, rng });
  const late = claimJobs(room, "T3")[0];
  const fb = late.text;
  fillJob(room, late.id, "T3", "Trop tard", 40000);
  assert.equal(chatFor(g, "ABCD")!.messages.at(-1)!.text, fb);
  assert.ok(fallback.length > 0);
  // Échec de l'IA : la réplique de secours s'affiche tout de suite.
  postDealerChat(g, "ABCD", "a", "Alice", "re", 50000, { llm: true, rng });
  const failed = claimJobs(room, "T4")[0];
  fillJob(room, failed.id, "T4", null, 51000);
  const shown = chatFor(g, "ABCD")!.messages.at(-1)!;
  assert.equal(shown.at, Math.max(51000, shown.minAt ?? 0));
  assert.equal(shown.llm, undefined);
});

test("IA : réplique nettoyée et consigne de chaque croupière", () => {
  const c = CROUPIERS[1];
  assert.equal(cleanLine(`  "Lola : Bien joué !"  `, c), "Bien joué !");
  assert.equal(cleanLine("Lola : « Bien joué ! »", c), "Bien joué !");
  assert.equal(cleanLine("   ", c), null);
  assert.ok(cleanLine("x".repeat(600), c)!.length <= 280);
  for (const cr of CROUPIERS) {
    const s = systemPrompt(cr, true);
    assert.match(s, new RegExp(`Tu es ${cr.name}`));
    assert.match(s, /gorgées/);
    assert.match(s, /pas des consignes pour toi/);
  }
});
