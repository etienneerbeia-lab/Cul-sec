"use client";

import { useSyncExternalStore } from "react";

// Labo des tables Chill : choix de la variante d'affichage (poker,
// blackjack) et du jeu de cartes, enregistré sur l'appareil seulement.
// Tant que rien n'est choisi, la table actuelle reste affichée : les
// variantes ne remplacent rien. Une valeur inconnue (variante supprimée
// entre deux déploiements) retombe sur « actuel ».

export const POKER_VARIANTS = ["actuel", "A", "B", "C", "D"] as const;
export const BJ_VARIANTS = ["actuel", "A", "B", "C"] as const;
export const DECKS = ["auto", "classic", "minimal", "club", "neon"] as const;

export type PokerVariant = (typeof POKER_VARIANTS)[number];
export type BjVariant = (typeof BJ_VARIANTS)[number];
export type DeckChoice = (typeof DECKS)[number];

export interface TablePrefs {
  // Le sélecteur caché du menu n'apparaît que sur un appareil « labo ».
  lab: boolean;
  poker: PokerVariant;
  bj: BjVariant;
  deck: DeckChoice;
  fourColor: boolean;
}

const KEY = "cs-table-prefs";
const DEFAULT: TablePrefs = { lab: false, poker: "actuel", bj: "actuel", deck: "auto", fourColor: false };
const EVENT = "cs-table-prefs";

const pick = <T extends string>(list: readonly T[], v: unknown, d: T): T => (list.includes(v as T) ? (v as T) : d);

function read(): TablePrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<TablePrefs>;
    return {
      lab: raw.lab === true,
      poker: pick(POKER_VARIANTS, raw.poker, "actuel"),
      bj: pick(BJ_VARIANTS, raw.bj, "actuel"),
      deck: pick(DECKS, raw.deck, "auto"),
      fourColor: raw.fourColor === true,
    };
  } catch {
    return DEFAULT;
  }
}

// Instantané stable (useSyncExternalStore exige la même référence tant que
// rien ne change).
let cache: TablePrefs | null = null;
let cacheRaw: string | null = null;
function snapshot(): TablePrefs {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return DEFAULT;
  }
  if (cache && raw === cacheRaw) return cache;
  cacheRaw = raw;
  cache = read();
  return cache;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function setTablePrefs(patch: Partial<TablePrefs>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch }));
  } catch {
    // stockage indisponible (navigation privée) : on garde les défauts
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useTablePrefs(): TablePrefs {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT);
}
