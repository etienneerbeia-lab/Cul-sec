import type { GameState } from "../game/types";
import { chatState, pushMessage } from "./chat";
import { blackjackGameKey, croupierFor, dealerRng } from "./croupiers";
import { eventFacts, eventFallback, roundReaction } from "./events";

// Côté serveur : à la fin de chaque manche de blackjack, la croupière
// commente (elle chambre un double raté, un split foireux, un joueur à
// sec...). Une seule fois par manche ; affiché après la distribution.
// Retourne true si l'état a changé.
export function dealerReact(g: GameState, roomCode: string, now: number, opts: { llm?: boolean; llmWaitMs?: number; rng?: () => number } = {}): boolean {
  const key = blackjackGameKey(g, roomCode);
  if (!key) return false;
  const r = roundReaction(g, g.dealerChat?.key === key ? g.dealerChat : undefined, now);
  if (!r) return false;
  const chat = chatState(g, key);
  chat.reacted = [...(chat.reacted ?? []), r.key].slice(-40);
  if (r.broke.length) chat.brokeSeen = [...(chat.brokeSeen ?? []), ...r.broke];
  if (!r.events.length) return true;

  const croupier = croupierFor(key);
  const soiree = g.universe !== "casino";
  const text = eventFallback(r.events, croupier, soiree, opts.rng ?? dealerRng(`${key}:${r.key}`));
  const facts = eventFacts(r.events, soiree);
  if (opts.llm)
    pushMessage(chat, {
      from: "dealer",
      name: croupier.name,
      text,
      at: Math.max(r.minAt, now + (opts.llmWaitMs ?? 9000)),
      minAt: r.minAt,
      llm: "todo",
      job: { kind: "event", facts },
    });
  else pushMessage(chat, { from: "dealer", name: croupier.name, text, at: r.minAt });
  return true;
}
