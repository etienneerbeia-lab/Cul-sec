// Simulation de tournois de Poker casino : durée des parties avec la
// structure de lib/poker/blinds.ts. Utilise le VRAI moteur et le vrai tick
// du salon, avec une horloge virtuelle ; les joueurs sont des bots
// (lib/poker/bot.ts) mais avec des temps de réflexion humains.
//
//   npx tsx scripts/sim-poker.ts                     # 300 parties, 2 à 8 joueurs
//   GAMES=500 SIZES=3,5,8 npx tsx scripts/sim-poker.ts
import { launchCasino } from "../src/lib/casino/launch";
import { tick } from "../src/lib/game/room";
import type { Player } from "../src/lib/game/types";
import { pokerModule } from "../src/lib/games/casinoPoker";
import { ACTION_MS } from "../src/lib/poker/blinds";
import { stackOf } from "../src/lib/chips/ledger";
import type { Room } from "../src/lib/store";

const GAMES = Number(process.env.GAMES ?? 300);
const SIZES = (process.env.SIZES ?? "2,3,4,5,6,7,8").split(",").map(Number);

// ---- Temps de réflexion humain ----
function gauss(): number {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}
const logNormal = (median: number, sigma: number) => median * Math.exp(sigma * gauss());

// Délai entre le moment où c'est à toi et ton clic :
// - décalage d'affichage : le poll (1,2 s) te montre ton tour en 0 à 1,2 s ;
// - réflexion : médiane 2,2 s préflop, 3,5 s ensuite, plus longue face à
//   une grosse mise ; ~3 % de joueurs distraits laissent filer le chrono.
pokerModule.botDelay = (g, slug) => {
  const p = g.poker!;
  const lag = Math.random() * 1200 + 250;
  if (Math.random() < 0.03) return [ACTION_MS + 1000, ACTION_MS + 1000];
  const toCall = Math.max(0, p.currentBet - (p.streetBet[slug] ?? 0));
  const big = toCall > 0.25 * stackOf(g.chips!, slug);
  const median = (p.board.length === 0 ? 2200 : 3500) * (big ? 1.6 : 1);
  // Première décision de la main : le temps de voir ses cartes arriver.
  const dealt = p.log.every((e) => e.k === "sb" || e.k === "bb") ? 900 : 0;
  const d = Math.min(ACTION_MS + 1000, lag + dealt + logNormal(median, 0.55));
  return [d, d];
};

interface GameStat {
  ms: number;
  hands: number;
  level: number;
}

function playOne(n: number): GameStat {
  const ps: Player[] = Array.from({ length: n }, (_, i) => ({ name: `P${i}`, slug: `p${i}`, bot: true }));
  const room: Room = {
    code: "SIM",
    hostSlug: "p0",
    players: ps,
    game: launchCasino(ps, "poker", undefined, { now: 0, hostSlug: "p0" }),
    createdAt: 0,
  };
  let now = 0;
  for (let i = 0; i < 200000; i++) {
    tick(room, now, {});
    const g = room.game;
    if (g.phase === "final") break;
    // Saute directement au prochain événement (coup d'un bot ou échéance).
    const times = [...Object.values(g.botPlan?.at ?? {}), g.timer?.deadlineAt ?? Infinity].filter((t) => t > now);
    now = Math.min(...times);
    if (!Number.isFinite(now)) throw new Error("simulation bloquée");
  }
  const g = room.game;
  if (g.phase !== "final") throw new Error("tournoi non terminé");
  return { ms: g.casinoEndedAt! - g.casinoStartedAt!, hands: g.poker!.handNo, level: g.poker!.level };
}

function quantile(sorted: number[], q: number): number {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.min(lo + 1, sorted.length - 1)] - sorted[lo]) * (i - lo);
}

const fmt = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function run(n: number, games: number) {
  const stats = Array.from({ length: games }, () => playOne(n));
  const ms = stats.map((s) => s.ms).sort((a, b) => a - b);
  const mean = ms.reduce((a, b) => a + b, 0) / ms.length;
  return {
    n,
    games,
    mean,
    median: quantile(ms, 0.5),
    p10: quantile(ms, 0.1),
    p90: quantile(ms, 0.9),
    over8: ms.filter((m) => m > 8 * 60000).length / ms.length,
    hands: stats.reduce((a, s) => a + s.hands, 0) / stats.length,
    lastLevel: stats.reduce((a, s) => a + s.level, 0) / stats.length,
  };
}

function line(r: ReturnType<typeof run>) {
  return [
    `${r.n} joueurs`.padEnd(10),
    `moy ${fmt(r.mean)}`,
    `méd ${fmt(r.median)}`,
    `P10 ${fmt(r.p10)}`,
    `P90 ${fmt(r.p90)}`,
    `>8min ${(r.over8 * 100).toFixed(1)}%`.padEnd(12),
    `mains ${r.hands.toFixed(1)}`,
    `niveau final ${(r.lastLevel + 1).toFixed(1)}`,
  ].join("  ");
}

for (const n of SIZES) console.log(line(run(n, GAMES)));
