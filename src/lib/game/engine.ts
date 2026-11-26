import { ROUND_TYPES, roundTypeById } from "./roundTypes";
import { pickDuelists } from "../games/duel";
import { MODULES } from "../games/registry";
import { casinoModule, clearCasinoRound } from "../casino/launch";
import type { Ctx, GameModule } from "./module";
import type { CulSecRule, GameState, Player, PlayerPublic, RoundTypeId } from "./types";

export function slugify(name: string): string {
  return (
    (name || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "joueur"
  );
}

// Slug unique dans le salon, même si deux prénoms se ressemblent.
export function uniqueSlug(name: string, taken: string[]): string {
  const base = slugify(name);
  if (!taken.includes(base)) return base;
  for (let i = 2; ; i++) if (!taken.includes(`${base}-${i}`)) return `${base}-${i}`;
}

export function moduleFor(g: GameState): GameModule | null {
  if (g.universe === "casino") return casinoModule(g.casinoGameId);
  return g.roundTypeId ? (MODULES[g.roundTypeId] ?? null) : null;
}

export function minPlayersFor(id: RoundTypeId): number {
  return roundTypeById(id).minPlayers;
}

export function playableTypes(enabled: RoundTypeId[], tableSize: number): RoundTypeId[] {
  // Ignore les jeux retirés de l'appli (ex. ancien « golf » dans un salon
  // enregistré avant sa suppression).
  return enabled.filter((id) => id in MODULES && minPlayersFor(id) <= tableSize);
}

export function setupRoundType(g: GameState): void {
  const enabled = g.enabledRoundTypeIds ?? ROUND_TYPES.map((t) => t.id);
  const available = playableTypes(enabled, g.playersPublic.length);
  const pool = available.filter((id) => id !== g.lastRoundTypeId);
  const drawFrom = pool.length > 0 ? pool : available;
  const chosen = drawFrom[Math.floor(Math.random() * drawFrom.length)];
  g.lastRoundTypeId = chosen;
  g.roundTypeId = chosen;
  g.duelists = null;
  if (chosen === "duel") pickDuelists(g);
}

export function launchGame(
  players: Player[],
  totalRounds: number,
  culSecRule: CulSecRule,
  enabledRoundTypeIds: RoundTypeId[],
  adultMode = false
): GameState {
  const playersPublic: PlayerPublic[] = players.map((p) => ({
    name: p.name,
    slug: p.slug,
    bot: p.bot || undefined,
    gulpsTotal: 0,
    folded: false,
    bet: 0,
    foldCost: null,
  }));
  const g: GameState = {
    phase: "roundIntro",
    round: 1,
    startIndex: 0,
    lastRoundTypeId: null,
    playersPublic,
    totalRounds,
    enabledRoundTypeIds,
    culSecRule,
    adultMode,
    seq: 0,
  };
  setupRoundType(g);
  return g;
}

export function confirmRoundIntro(g: GameState, ctx: Ctx): void {
  g.drinks = [];
  moduleFor(g)!.start(g, ctx);
}

function resetRoundFields(g: GameState): void {
  g.playersPublic.forEach((p) => {
    p.folded = false;
    p.bet = 0;
    p.foldCost = null;
  });
  g.hands = undefined;
  g.community = undefined;
  g.communityRevealed = undefined;
  g.lastResults = undefined;
  g.drinks = [];
  g.highlow = undefined;
  g.duel = undefined;
  g.qcm = undefined;
  g.reflex = undefined;
  g.dice421 = undefined;
  g.timer = undefined;
  g.botPlan = undefined;
}

export function nextRound(g: GameState): void {
  if (g.totalRounds && g.round >= g.totalRounds) {
    g.phase = "final";
    return;
  }
  g.round += 1;
  g.startIndex = (g.startIndex + 1) % g.playersPublic.length;
  resetRoundFields(g);
  setupRoundType(g);
  g.phase = "roundIntro";
}

export function endNight(g: GameState): void {
  g.phase = "final";
}

export function restartToLobby(g: GameState): void {
  g.phase = "lobby";
  g.round = 0;
  g.startIndex = 0;
  g.lastRoundTypeId = null;
  g.playersPublic = [];
  g.culSecTargetSlug = undefined;
  resetRoundFields(g);
  // Univers / jeu / réglages casino gardés : l'hôte retrouve son choix.
  clearCasinoRound(g);
}

// Règle « first » : le plus sobre choisit qui boit le cul sec.
export function culSecWinnerSlug(g: GameState): string | null {
  if (g.playersPublic.length === 0) return null;
  const sorted = [...g.playersPublic].sort((a, b) => a.gulpsTotal - b.gulpsTotal);
  return sorted[0].slug;
}
