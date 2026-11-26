import type { GameModule } from "../game/module";
import type { CasinoGameId } from "./types";

// Modules des jeux casino (côté serveur). Un jeu absent d'ici ne peut pas
// être lancé (le salon l'affiche « Bientôt » via catalog.ts).
export const CASINO_MODULES: Partial<Record<CasinoGameId, GameModule>> = {};
