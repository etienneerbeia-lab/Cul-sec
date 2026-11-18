import { minPlayersFor } from "../game/engine";
import type { Player, RoundTypeId } from "../game/types";

const BOT_NAMES = ["Gégé", "Jacky", "Momo", "Lulu", "Dédé", "Fifi", "Nanard", "Josette"];

export const MAX_BOTS = 6;

// Crée `count` joueurs virtuels, avec des prénoms qui ne collent à aucun
// joueur du salon.
export function makeBots(count: number, taken: Player[]): Player[] {
  const names = BOT_NAMES.filter((n) => !taken.some((p) => p.name.toLowerCase() === n.toLowerCase()));
  return Array.from({ length: count }, (_, i) => ({
    // Le 🤖 dans le nom les rend reconnaissables sur tous les écrans.
    name: `${names[i] ?? `Bot ${i + 1}`} 🤖`,
    slug: `bot-${i + 1}`,
    bot: true,
  }));
}

// Nombre de bots ajoutés automatiquement : en solo, assez pour que chaque
// mini-jeu choisi soit jouable ; à plusieurs, seulement ceux demandés par
// l'hôte (les jeux sans assez de joueurs sont alors simplement sautés).
export function autoBotCount(humans: number, enabled: RoundTypeId[], extra: number): number {
  const needed = humans === 1 ? Math.max(0, ...enabled.map(minPlayersFor)) - humans : 0;
  return Math.min(MAX_BOTS, Math.max(needed, extra));
}
