import { fail, notNow } from "../errors";
import type { Room } from "../store";
import { culSecWinnerSlug, endNight, confirmRoundIntro, moduleFor, nextRound, restartToLobby } from "./engine";
import { type Action, type Ctx, type Pending, pick, rand } from "./module";
import type { GameState } from "./types";

// Un humain qui n'a pas donné signe de vie depuis ce délai est considéré
// absent : ses coups sont joués pour lui sans attendre la fin du chrono.
export const AWAY_MS = 45000;
// L'hôte absent depuis ce délai passe la main à un autre humain présent.
export const HOST_AWAY_MS = 20000;

const HOST_ACTIONS = new Set(["confirmIntro", "nextRound", "endNight", "restart"]);

function ctxFor(room: Room, now: number): Ctx {
  return { now, hostSlug: room.hostSlug };
}

function corePending(room: Room): Pending | null {
  const g = room.game;
  if (g.phase === "final" && g.culSecRule === "first" && !g.culSecTargetSlug) {
    const winner = culSecWinnerSlug(g);
    if (winner && g.playersPublic.length > 1) return { key: "final:culsec", actors: [winner], timeoutMs: 90000 };
  }
  return null;
}

function currentPending(room: Room): Pending | null {
  const mod = moduleFor(room.game);
  const inRound = !["lobby", "roundIntro", "showdown", "final", "quizRecap"].includes(room.game.phase);
  if (mod && inRound) return mod.pending(room.game);
  return corePending(room);
}

function assignCulSec(g: GameState, slug: string, target: unknown) {
  if (g.phase !== "final" || g.culSecRule !== "first") notNow();
  if (g.culSecTargetSlug) fail(409, "Déjà désigné.");
  if (slug !== culSecWinnerSlug(g)) fail(403, "Seul le plus sobre peut désigner.");
  if (typeof target !== "string" || target === slug || !g.playersPublic.some((p) => p.slug === target))
    fail(400, "Cible invalide.");
  g.culSecTargetSlug = target;
}

// Applique une action (d'un joueur, d'un bot ou d'un délai expiré) à la
// partie. Lève ApiError si elle n'est pas valide maintenant.
function applyGameAction(room: Room, slug: string, action: Action, now: number): void {
  const g = room.game;
  const ctx = ctxFor(room, now);
  if (HOST_ACTIONS.has(action.type) && slug !== room.hostSlug) fail(403, "Réservé à l'hôte.");
  switch (action.type) {
    case "confirmIntro":
      if (g.phase !== "roundIntro") notNow();
      confirmRoundIntro(g, ctx);
      break;
    case "nextRound":
      if (g.phase !== "showdown") notNow();
      seatLateJoiners(room);
      nextRound(g);
      break;
    case "endNight":
      if (g.phase !== "showdown") notNow();
      endNight(g);
      break;
    case "restart":
      if (g.phase === "lobby") notNow();
      restartToLobby(g);
      // Les bots et les joueurs partis quittent la table ; ils seront
      // recréés au prochain lancement si besoin.
      room.players = room.players.filter((p) => !p.bot && !p.left);
      break;
    case "assignCulSec":
      assignCulSec(g, slug, action.targetSlug);
      break;
    default: {
      const mod = moduleFor(g);
      if (!mod || g.phase === "lobby") notNow();
      if (!g.playersPublic.some((p) => p.slug === slug)) fail(403, "Tu ne participes pas à cette partie.");
      mod.act(g, slug, action, ctx);
    }
  }
  g.seq = (g.seq ?? 0) + 1;
}

// Les joueurs arrivés en cours de partie prennent place à la manche
// suivante, avec le plus petit score de la table (ni avantage ni punition).
function seatLateJoiners(room: Room): void {
  const g = room.game;
  const seated = new Set(g.playersPublic.map((p) => p.slug));
  const min = Math.min(...g.playersPublic.map((p) => p.gulpsTotal));
  room.players
    .filter((p) => !seated.has(p.slug) && !p.left)
    .forEach((p) => {
      g.playersPublic.push({
        name: p.name,
        slug: p.slug,
        bot: p.bot || undefined,
        gulpsTotal: Number.isFinite(min) ? min : 0,
        folded: false,
        bet: 0,
        foldCost: null,
      });
    });
}

function autoAction(room: Room, slug: string, bot: boolean, now: number): Action | null {
  const g = room.game;
  if (g.phase === "final") {
    const pool = g.playersPublic.filter((p) => p.slug !== slug);
    return pool.length ? { type: "assignCulSec", targetSlug: pick(pool).slug } : null;
  }
  return moduleFor(g)?.auto(g, slug, ctxFor(room, now), { bot }) ?? null;
}

function isBot(room: Room, slug: string): boolean {
  return !!room.players.find((p) => p.slug === slug)?.bot;
}

// Fait avancer la partie de tout ce qui est dû à l'instant `now` : coups
// des bots, joueurs absents, délais expirés, hôte absent. Appelé après
// chaque action et à chaque rafraîchissement d'un joueur — il n'y a pas de
// processus de fond sur Vercel, ce sont les requêtes qui font tourner
// l'horloge. Retourne true si la partie a changé.
export function tick(room: Room, now: number, seen?: Record<string, number>): boolean {
  let changed = false;
  const g = room.game;

  if (seen && g.phase !== "lobby") changed = transferHostIfAway(room, now, seen) || changed;

  const isAway = (slug: string) => {
    const p = room.players.find((pl) => pl.slug === slug);
    if (!p || p.bot) return false;
    if (p.left) return true;
    return !!seen && seen[slug] !== undefined && now - seen[slug] > AWAY_MS;
  };

  for (let guard = 0; guard < 60; guard++) {
    const p = currentPending(room);
    if (!p) {
      if (g.timer || g.botPlan) {
        g.timer = undefined;
        g.botPlan = undefined;
        changed = true;
      }
      break;
    }
    if (!g.timer || g.timer.key !== p.key) {
      g.timer = { key: p.key, deadlineAt: p.timeoutMs != null ? now + p.timeoutMs : null };
      changed = true;
    }
    if (!g.botPlan || g.botPlan.key !== p.key) {
      g.botPlan = { key: p.key, at: {} };
      changed = true;
    }
    const autos = p.actors.filter((s) => isBot(room, s) || isAway(s));
    for (const s of autos) {
      if (g.botPlan.at[s] === undefined) {
        const mod = moduleFor(g);
        const [a, b] = isBot(room, s) ? (mod?.botDelay?.(g, s) ?? [1500, 3500]) : [800, 1500];
        g.botPlan.at[s] = Math.round(now + rand(a, b));
        changed = true;
      }
    }
    const due = autos.find((s) => g.botPlan!.at[s] <= now);
    if (due) {
      const bot = isBot(room, due);
      const action = autoAction(room, due, bot, now);
      try {
        if (!action) throw new Error("aucun coup");
        applyGameAction(room, due, action, now);
      } catch (e) {
        console.error("[tick] coup automatique refusé", due, action, e);
        g.botPlan.at[due] = now + 60000;
      }
      changed = true;
      continue;
    }
    if (g.timer.deadlineAt != null && now >= g.timer.deadlineAt) {
      const mod = moduleFor(g);
      const inRound = currentPending(room) && p.key !== "final:culsec";
      if (inRound && mod?.onDeadline) mod.onDeadline(g, ctxFor(room, now));
      else {
        for (const s of p.actors) {
          if (currentPending(room)?.key !== p.key) break;
          const action = autoAction(room, s, isBot(room, s), now);
          try {
            if (action) applyGameAction(room, s, action, now);
          } catch (e) {
            console.error("[tick] délai : coup refusé", s, action, e);
          }
        }
      }
      // Garantit qu'on ne reboucle pas sur le même délai si rien n'a bougé.
      if (currentPending(room)?.key === p.key) g.timer = { key: p.key, deadlineAt: null };
      changed = true;
      continue;
    }
    break;
  }
  return changed;
}

function transferHostIfAway(room: Room, now: number, seen: Record<string, number>): boolean {
  const fresh = (slug: string) => seen[slug] !== undefined && now - seen[slug] < HOST_AWAY_MS;
  const host = room.players.find((p) => p.slug === room.hostSlug);
  // Pas encore de signe de vie connu (« jamais vu ») = on ne sait pas, on
  // ne transfère pas ; seul un hôte parti ou silencieux depuis 20 s cède.
  if (host && !host.left && (seen[host.slug] === undefined || fresh(host.slug))) return false;
  const candidate = room.players.find((p) => !p.bot && !p.left && fresh(p.slug));
  if (!candidate || candidate.slug === room.hostSlug) return false;
  room.hostSlug = candidate.slug;
  return true;
}

export function performAction(room: Room, slug: string, action: Action, now: number, seen?: Record<string, number>) {
  applyGameAction(room, slug, action, now);
  tick(room, now, seen);
}
