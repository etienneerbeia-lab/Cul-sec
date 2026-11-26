"use client";

import { createContext, useContext } from "react";
import type { Card, GameState, Player } from "@/lib/game/types";

export type ActFn = (action: { type: string; [key: string]: unknown }) => void;

export interface GameCtx {
  roomCode: string;
  game: GameState;
  players: Player[];
  mySlug: string;
  isHost: boolean;
  busy: boolean;
  myHand: Card[] | null;
  myVoteChoice: string | null;
  myUndercoverWord: string | null;
  // Joueurs absents (partis ou silencieux) : badge sur leur siège.
  away: string[];
  // Envoie une action au serveur (avec gestion d'erreur et rafraîchissement).
  act: ActFn;
  // Ouvre le menu (règles du jeu en cours, classement, quitter).
  openMenu: () => void;
}

export const GameContext = createContext<GameCtx | null>(null);

export function useGame(): GameCtx {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame hors de GameContext");
  return ctx;
}

export function useMe() {
  const { game, mySlug } = useGame();
  const idx = game.playersPublic.findIndex((p) => p.slug === mySlug);
  return { idx, me: idx >= 0 ? game.playersPublic[idx] : null };
}
