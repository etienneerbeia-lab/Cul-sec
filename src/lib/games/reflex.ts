import { roundTypeById } from "../game/roundTypes";
import { fail, notNow } from "../errors";
import { chance, drink, type GameModule, rand } from "../game/module";
import type { GameState, ReflexCoup, ReflexTap } from "../game/types";

// Réflexe : rouge… puis vert à un instant aléatoire. Le plus lent boit, le
// faux départ boit double. 3 coups très courts par manche.
export const REFLEX_COUPS = 3;
// Temps laissé pour taper une fois le vert affiché.
export const REFLEX_WINDOW_MS = 2500;
export const REFLEX_REVEAL_MS = 3200;
export const REFLEX_SLOW_GULPS = 1;
export const REFLEX_EARLY_GULPS = 2;
// En dessous, ce n'est pas un réflexe humain mais une anticipation.
export const REFLEX_MIN_HUMAN_MS = 90;
// Laisse le temps à tous les téléphones d'afficher l'écran rouge.
const LEAD_MS = 1600;

function startCoup(g: GameState, now: number): void {
  const r = g.reflex!;
  const delayMs = Math.round(LEAD_MS + rand(1200, 4200));
  r.stage = "wait";
  r.delayMs = delayMs;
  r.goAt = now + delayMs;
  r.taps = {};
}

function closeCoup(g: GameState): void {
  const r = g.reflex!;
  const taps: Record<string, ReflexTap> = {};
  g.playersPublic.forEach((p) => (taps[p.slug] = r.taps[p.slug] ?? null));
  const early = Object.keys(taps).filter((s) => taps[s] === "early");
  const missed = Object.keys(taps).filter((s) => taps[s] === null);
  const timed = Object.entries(taps)
    .filter((e): e is [string, number] => typeof e[1] === "number")
    .sort((a, b) => a[1] - b[1]);
  // Ceux qui n'ont pas tapé sont les plus lents ; sinon le dernier chrono
  // (s'il y a au moins deux chronos — seul à avoir tapé, on a gagné).
  let slowest: string[] = missed;
  if (!slowest.length && timed.length >= 2) slowest = [timed[timed.length - 1][0]];
  early.forEach((s) => drink(g, s, REFLEX_EARLY_GULPS, "Faux départ"));
  slowest.forEach((s) => drink(g, s, REFLEX_SLOW_GULPS, taps[s] === null ? "Pas tapé à temps" : "Le plus lent"));
  const coup: ReflexCoup = { taps, slowest, early, fastest: timed[0]?.[0] };
  r.history = [...r.history, coup];
  r.stage = "reveal";
}

export const reflexModule: GameModule = {
  id: "reflex",
  minPlayers: roundTypeById("reflex").minPlayers,
  start(g, ctx) {
    g.reflex = { coup: 0, coups: REFLEX_COUPS, stage: "wait", goAt: 0, delayMs: 0, taps: {}, history: [] };
    startCoup(g, ctx.now);
    g.phase = "reflex";
  },
  act(g, slug, a) {
    const r = g.reflex;
    if (g.phase !== "reflex" || !r || r.stage !== "wait") notNow();
    if (a.type !== "reflexTap") fail(400, "Action inconnue.");
    if (r.taps[slug] !== undefined) fail(409, "Déjà tapé.");
    // Mesuré sur le téléphone : on fait confiance au client, mais on borne.
    const ms = Number(a.ms);
    r.taps[slug] = a.early === true || !Number.isFinite(ms) || ms < REFLEX_MIN_HUMAN_MS ? "early" : Math.min(Math.round(ms), REFLEX_WINDOW_MS);
    if (g.playersPublic.every((p) => r.taps[p.slug] !== undefined)) closeCoup(g);
  },
  pending(g) {
    const r = g.reflex;
    if (g.phase !== "reflex" || !r) return null;
    if (r.stage === "wait") {
      const actors = g.playersPublic.filter((p) => r.taps[p.slug] === undefined).map((p) => p.slug);
      return { key: `reflex:${r.coup}:wait`, actors, timeoutMs: r.delayMs + REFLEX_WINDOW_MS + 600 };
    }
    return { key: `reflex:${r.coup}:reveal`, actors: [], timeoutMs: REFLEX_REVEAL_MS };
  },
  onDeadline(g, ctx) {
    const r = g.reflex!;
    if (r.stage === "wait") closeCoup(g);
    else if (r.coup + 1 < r.coups) {
      r.coup += 1;
      startCoup(g, ctx.now);
    } else {
      g.lastResults = { type: "reflex" };
      g.phase = "showdown";
    }
  },
  auto(_g, _slug, _ctx, { bot }) {
    // Un humain absent ne tape pas : il sera le plus lent.
    if (!bot) return null;
    if (chance(0.06)) return { type: "reflexTap", early: true };
    return { type: "reflexTap", ms: Math.round(rand(230, 480)) };
  },
  // Les bots « tapent » peu après le vert, pour que leur coup n'arrive pas
  // avant que les humains aient vu l'écran changer.
  botDelay: (g) => {
    const d = g.reflex?.delayMs ?? 3000;
    return [d + 250, d + 700];
  },
};
