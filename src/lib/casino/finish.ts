import { ranking } from "../chips/ledger";
import type { GameState } from "../game/types";

// Fin de partie : fige le classement (soldes, éliminations) et affiche
// l'écran final.
export function finishCasino(g: GameState, now: number): void {
  g.casinoEndedAt = now;
  const order = g.playersPublic.map((p) => p.slug);
  const names = new Map(g.playersPublic.map((p) => [p.slug, p.name]));
  g.casinoRanking = g.chips
    ? ranking(g.chips, order).map((e) => ({ ...e, name: names.get(e.slug) ?? e.slug }))
    : [];
  g.phase = "final";
  g.timer = undefined;
  g.botPlan = undefined;
}
