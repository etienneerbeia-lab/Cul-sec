"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { serverNow } from "@/lib/clock";
import { CHAT_MAX_LEN, chatFor } from "@/lib/dealer/chat";
import { blackjackGameKey, croupierFor, type Croupier } from "@/lib/dealer/croupiers";
import type { DealerChatMessage } from "@/lib/game/types";
import { haptic } from "@/lib/haptics";
import { useGame } from "../../GameContext";
import { Sheet } from "../../ui/Feedback";
import { playerColor } from "../../ui/Players";
import { CroupiereAvatar } from "./Croupiere";

// Chat de la table avec la croupière : un bouton en haut à droite (avec les
// messages non lus), un panneau pour lire et écrire ; la dernière réponse de
// la croupière s'affiche aussi en bulle à côté d'elle.

export interface DealerChatData {
  croupier: Croupier;
  messages: DealerChatMessage[];
  mySlug: string;
  send: (text: string) => void;
}

// Croupière et discussion de la partie de blackjack en cours (null hors
// blackjack).
export function useDealerChat(): DealerChatData | null {
  const { game, roomCode, mySlug, act } = useGame();
  const key = blackjackGameKey(game, roomCode);
  return useMemo(() => {
    if (!key) return null;
    return {
      croupier: croupierFor(key),
      messages: chatFor(game, roomCode)?.messages ?? [],
      mySlug,
      send: (text: string) => act({ type: "dealerChat", text }),
    };
  }, [key, game, roomCode, mySlug, act]);
}

// Heure serveur, rafraîchie tant que `active` (réponses en attente...).
function useNow(active: boolean, ms = 400): number {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(serverNow()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

const BUBBLE_MS = 6500;

// Bulle : la dernière réponse de la croupière, quelques secondes.
export function DealerBubble({ data }: { data: DealerChatData }) {
  const lastDealer = [...data.messages].reverse().find((m) => m.from === "dealer");
  const now = useNow(!!lastDealer && serverNow() < lastDealer.at + BUBBLE_MS);
  if (!lastDealer || now < lastDealer.at || now > lastDealer.at + BUBBLE_MS) return null;
  return (
    <div key={lastDealer.id} className="cr-bubble animate-pop" data-bubble-dealer>
      {lastDealer.text}
    </div>
  );
}

const SUGGESTIONS = ["Salut !", "Je tire ou je reste ?", "Tu triches ? 😏", "Une blague ?", "C'est quoi les règles ?"];

export function DealerChatButton({ data }: { data: DealerChatData }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [seenId, setSeenId] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const pending = data.messages.some((m) => m.at > serverNow());
  const now = useNow(open || pending);
  const visible = data.messages.filter((m) => m.at <= now);
  const typing = data.messages.some((m) => m.from === "dealer" && m.at > now);
  const lastId = visible.at(-1)?.id ?? 0;
  const unread = open ? 0 : visible.filter((m) => m.id > seenId && m.slug !== data.mySlug).length;

  // Panneau ouvert : tout est lu, et on descend au dernier message.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeenId(lastId);
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [open, lastId, typing]);

  const send = (t: string) => {
    const v = t.replace(/\s+/g, " ").trim();
    if (!v) return;
    haptic("tap");
    data.send(v.slice(0, CHAT_MAX_LEN));
    setText("");
  };
  const name = data.croupier.name;

  return (
    <>
      <button
        type="button"
        className="cr-chat-btn"
        aria-label={`Parler avec ${name}${unread ? ` (${unread} non lus)` : ""}`}
        onClick={() => {
          haptic("select");
          setOpen(true);
        }}
        data-chat-button
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
          <path
            d="M4 5.5C4 4.1 5.1 3 6.5 3h11C18.9 3 20 4.1 20 5.5v8c0 1.4-1.1 2.5-2.5 2.5H11l-4.6 3.6c-.5.4-1.2 0-1.2-.6V16h0C4.5 16 4 15.4 4 14.7V5.5Z"
            fill="currentColor"
          />
          <circle cx="8.5" cy="9.6" r="1.2" fill="#2a0d18" />
          <circle cx="12" cy="9.6" r="1.2" fill="#2a0d18" />
          <circle cx="15.5" cy="9.6" r="1.2" fill="#2a0d18" />
        </svg>
        {unread > 0 && <span className="cr-chat-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)}>
        <div className="mb-3 flex items-center gap-3" data-chat-panel>
          <CroupiereAvatar look={data.croupier.look} size={46} />
          <div className="min-w-0">
            <div className="font-display text-xl leading-tight font-extrabold">{name}</div>
            <div className="text-[0.78rem] text-mute">
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-lime align-middle" />
              Croupière · elle répond à toute la table
            </div>
          </div>
        </div>

        <div ref={listRef} className="cr-chat-list" data-chat-list>
          {visible.length === 0 && <p className="py-6 text-center text-sm text-mute">Dis bonjour à {name} : toute la table verra vos messages.</p>}
          {visible.map((m) => {
            const mine = m.slug === data.mySlug;
            const dealer = m.from === "dealer";
            return (
              <div key={m.id} className={`cr-msg ${mine ? "cr-msg-me" : dealer ? "cr-msg-dealer" : "cr-msg-other"}`}>
                {!mine && (
                  <div className="cr-msg-name" style={dealer ? undefined : { color: playerColor(m.slug ?? m.name) }}>
                    {m.name}
                  </div>
                )}
                <div className="cr-msg-text">{m.text}</div>
              </div>
            );
          })}
          {typing && (
            <div className="cr-msg cr-msg-dealer cr-typing">
              <div className="cr-msg-name">{name}</div>
              <div className="cr-msg-text">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
        </div>

        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="cs-chip shrink-0 px-3! text-[0.8rem]!" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <input
            className="cs-input min-h-12! flex-1"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={CHAT_MAX_LEN}
            placeholder={`Écrire à ${name}…`}
            enterKeyHint="send"
            autoComplete="off"
            aria-label={`Message pour ${name}`}
          />
          <button type="submit" className="cr-send" disabled={!text.trim()} aria-label="Envoyer">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" fill="currentColor" />
            </svg>
          </button>
        </form>
      </Sheet>
    </>
  );
}
