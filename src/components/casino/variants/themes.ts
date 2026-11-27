import type { Shape } from "./geometry";
import type { Deck } from "./PlayingCard";

// Habillage de chaque variante de table de poker.
export type PokerVariantId = "A" | "B" | "C" | "D";

export interface PokerTheme {
  id: PokerVariantId;
  name: string;
  shape: Shape;
  deck: Deck;
  // Épaisseur du rail (px) ; 0 = pas de rail (bord néon).
  rail: number;
  seat: "plate" | "flat" | "gold" | "tile";
  railColors: [string, string, string];
  felt: [string, string, string, string];
  // Ligne de mise imprimée sur le tapis.
  line: { color: string; width: number; dash?: string; glow?: boolean };
  // Liseré lumineux entre rail et feutre.
  edge?: { color: string; glow: boolean; gradient?: [string, string, string] };
  stitch?: string;
  grain: number;
  print: { color: string; font: "serif" | "sans" };
  logo: [string, string];
}

export const POKER_THEMES: Record<PokerVariantId, PokerTheme> = {
  A: {
    id: "A",
    name: "Casino classique",
    shape: "stadium",
    deck: "classic",
    rail: 16,
    seat: "plate",
    railColors: ["#5a3720", "#2a170c", "#120804"],
    felt: ["#2b9466", "#1b6c46", "#0f4a30", "#072818"],
    line: { color: "rgba(222,186,104,0.5)", width: 1.5 },
    stitch: "rgba(255,214,160,0.3)",
    grain: 0.22,
    print: { color: "rgba(222,186,104,0.5)", font: "serif" },
    logo: ["♠ CUL·SEC ♠", "CHILL POKER TOUR"],
  },
  B: {
    id: "B",
    name: "Minimal moderne",
    shape: "rrect",
    deck: "minimal",
    rail: 7,
    seat: "flat",
    railColors: ["#2b3a4c", "#18222e", "#0c121a"],
    felt: ["#2f4a66", "#233a52", "#192b3e", "#101d2b"],
    line: { color: "rgba(255,255,255,0.09)", width: 1.5 },
    grain: 0,
    print: { color: "rgba(255,255,255,0.16)", font: "sans" },
    logo: ["CUL·SEC", "CHILL POKER"],
  },
  C: {
    id: "C",
    name: "Club",
    shape: "oval",
    deck: "club",
    rail: 14,
    seat: "gold",
    railColors: ["#2a1a20", "#130a0f", "#050205"],
    felt: ["#86203a", "#5e1428", "#3a0a19", "#1f040d"],
    line: { color: "rgba(246,205,112,0.85)", width: 1.4, glow: true },
    edge: { color: "#e3b955", glow: true },
    grain: 0.18,
    print: { color: "rgba(240,200,110,0.42)", font: "serif" },
    logo: ["CUL·SEC CLUB", "PRIVATE · HIGH STAKES"],
  },
  D: {
    id: "D",
    name: "Néon Cul·Sec",
    shape: "stadium",
    deck: "neon",
    rail: 0,
    seat: "tile",
    railColors: ["#000", "#000", "#000"],
    felt: ["#2b1b5c", "#1c1140", "#120a2a", "#0a0518"],
    line: { color: "rgba(69,227,255,0.28)", width: 1.2, dash: "2 6" },
    edge: { color: "#ff3d8b", glow: true, gradient: ["#ff3d8b", "#9b6bff", "#45e3ff"] },
    grain: 0,
    print: { color: "rgba(255,61,139,0.45)", font: "sans" },
    logo: ["CUL·SEC", "NEON NIGHT POKER"],
  },
};
