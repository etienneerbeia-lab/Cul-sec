import { fromCodes } from "../casino/cards";
import { fail, notNow } from "../errors";
import type { Card, DealerChatMessage, DealerChatState, GameState } from "../game/types";
import { dealerReply, type BotStage } from "./bot";
import { blackjackGameKey, croupierFor } from "./croupiers";

// Chat de la table avec la croupière : chaque joueur du salon peut écrire,
// tout le monde voit les messages (ils voyagent avec la partie, comme le
// reste de l'état public), et la croupière répond à chacun après un court
// « … écrit ». Rien ici ne touche au déroulement du jeu.

export const CHAT_MAX_LEN = 140;
export const CHAT_KEEP = 30;
export const CHAT_MIN_GAP_MS = 1500;

const cleanName = (n: string) => (n.endsWith(" 🤖") ? n.slice(0, -3) : n);

// Main en cours du joueur et carte visible du croupier, pour les conseils.
function context(g: GameState, slug: string): { hand?: Card[]; dealerUp?: Card; stage?: BotStage } {
  if (g.universe === "casino" && g.bjt) {
    const t = g.bjt;
    const seat = t.seats.find((s) => s.slug === slug);
    const hand = seat?.hands[Math.min(seat.active, seat.hands.length - 1)];
    const stage: BotStage = t.stage === "betting" ? "mises" : t.stage === "roundEnd" ? "fin" : "jeu";
    return { hand: hand ? fromCodes(hand.cards) : undefined, dealerUp: t.dealer.cards[0] ? fromCodes([t.dealer.cards[0]])[0] : undefined, stage };
  }
  if (g.blackjack) {
    const bj = g.blackjack;
    const p = bj.players.find((x) => x.slug === slug);
    const hand = p?.hands[Math.min(p.activeHandIdx, p.hands.length - 1)];
    const stage: BotStage = bj.stage === "betting" ? "mises" : bj.stage === "playerTurns" ? "jeu" : bj.stage === "dealerTurn" ? "banque" : "fin";
    return { hand: hand?.cards, dealerUp: bj.dealer.cards[0], stage };
  }
  return {};
}

// Messages de la partie en cours (ceux d'une partie précédente sont ignorés).
export function chatFor(g: GameState, roomCode: string): DealerChatState | null {
  const key = blackjackGameKey(g, roomCode);
  return key && g.dealerChat?.key === key ? g.dealerChat : null;
}

export function postDealerChat(
  g: GameState,
  roomCode: string,
  slug: string,
  name: string,
  rawText: unknown,
  now: number,
  rng: () => number = Math.random,
): void {
  const key = blackjackGameKey(g, roomCode);
  if (!key || g.phase === "lobby" || g.phase === "final") notNow();
  if (typeof rawText !== "string") fail(400, "Message vide.");
  const text = rawText.replace(/\s+/g, " ").trim().slice(0, CHAT_MAX_LEN);
  if (!text) fail(400, "Message vide.");

  if (g.dealerChat?.key !== key) g.dealerChat = { key, next: 1, messages: [], last: {} };
  const chat = g.dealerChat!;
  const last = chat.last[slug];
  if (last !== undefined && now - last < CHAT_MIN_GAP_MS) fail(429, "Doucement : un message à la fois.");
  chat.last[slug] = now;

  const croupier = croupierFor(key);
  const player = cleanName(name);
  const push = (m: Omit<DealerChatMessage, "id">) => chat.messages.push({ id: chat.next++, ...m });
  push({ from: "player", slug, name: player, text, at: now });

  const reply = dealerReply(text, { croupier, playerName: player, soiree: g.universe !== "casino", rng, ...context(g, slug) });
  // Elle « écrit » un instant (plus long pour une longue réponse), et ses
  // réponses arrivent dans l'ordre des questions.
  const lastDealer = [...chat.messages].reverse().find((m) => m.from === "dealer");
  const at = Math.max(now + Math.min(2600, 700 + reply.length * 16), (lastDealer?.at ?? 0) + 700);
  push({ from: "dealer", name: croupier.name, text: reply, at });

  if (chat.messages.length > CHAT_KEEP) chat.messages = chat.messages.slice(-CHAT_KEEP);
}
