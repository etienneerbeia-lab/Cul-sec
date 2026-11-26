import type { Ctx, GameModule } from "../game/module";
import type { GameState, Player, PlayerPublic } from "../game/types";
import { CASINO_MODULES } from "./registry";
export { finishCasino } from "./finish";
import { type CasinoGameId, type CasinoOptions, DEFAULT_CASINO_OPTIONS, MAX_CASINO_SEATS } from "./types";

export function casinoModule(id: CasinoGameId | undefined): GameModule | null {
  return id ? (CASINO_MODULES[id] ?? null) : null;
}

export function publicPlayer(p: Player): PlayerPublic {
  return { name: p.name, slug: p.slug, bot: p.bot || undefined, gulpsTotal: 0, folded: false, bet: 0, foldCost: null };
}

// Les 8 premiers (humains d'abord, dans l'ordre d'arrivée, puis bots)
// s'assoient ; les autres regardent.
export function seatOrder(players: Player[]): Player[] {
  const humans = players.filter((p) => !p.bot && !p.left);
  const bots = players.filter((p) => p.bot && !p.left);
  return [...humans, ...bots].slice(0, MAX_CASINO_SEATS);
}

export function launchCasino(
  players: Player[],
  gameId: CasinoGameId,
  options: CasinoOptions = DEFAULT_CASINO_OPTIONS,
  ctx: Ctx
): GameState {
  const mod = casinoModule(gameId);
  if (!mod) throw new Error(`Jeu casino indisponible : ${gameId}`);
  const g: GameState = {
    phase: "lobby",
    round: 1,
    startIndex: 0,
    lastRoundTypeId: null,
    playersPublic: seatOrder(players).map(publicPlayer),
    universe: "casino",
    casinoGameId: gameId,
    casinoOptions: { ...options },
    casinoStartedAt: ctx.now,
    seq: 0,
  };
  // Le module installe ses jetons et passe dans sa propre phase.
  mod.start(g, ctx);
  return g;
}

// Efface tout l'état propre au casino (retour au salon), en gardant le
// choix d'univers / de jeu / de réglages pour la prochaine partie.
export function clearCasinoRound(g: GameState): void {
  g.chips = undefined;
  g.casinoRanking = undefined;
  g.casinoStartedAt = undefined;
  g.casinoEndedAt = undefined;
  g.poker = undefined;
}
