// Test de bout en bout via l'API HTTP réelle (serveur Next + Redis) :
// un ou plusieurs « humains » scriptés jouent une soirée contre des bots.
// Usage : BASE=http://localhost:3000 HUMANS=1 ROUNDS=11 npx tsx scripts/test-api.ts
import { golfCourseById } from "../src/lib/golf/courses";
import type { StateResponse } from "../src/lib/api-client";

const BASE = process.env.BASE ?? "http://localhost:3000";
const HUMANS = Number(process.env.HUMANS ?? 1);
const ROUNDS = Number(process.env.ROUNDS ?? 10);
const GAMES = (process.env.GAMES ?? "high,holdem,duel,quiz,vote,meme,dice,undercover,blackjack,golf,archery").split(",");

class Client {
  cookie = "";
  constructor(public name: string) {}
  async req<T>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
    const res = await fetch(BASE + path, {
      method,
      headers: { "content-type": "application/json", cookie: this.cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0];
    return { status: res.status, data: (await res.json()) as T };
  }
}

function pickOther(s: StateResponse, me: string) {
  const others = s.game!.playersPublic.filter((p) => p.slug !== me);
  return others[Math.floor(Math.random() * others.length)]?.slug;
}

// Coup « humain » simple pour la phase en cours, ou null s'il n'y a rien à faire.
function humanMove(s: StateResponse): Record<string, unknown> | null {
  const g = s.game!;
  const me = s.mySlug!;
  const meIdx = g.playersPublic.findIndex((p) => p.slug === me);
  if (s.isHost) {
    if (g.phase === "roundIntro") return { type: "confirmIntro" };
    if (g.phase === "showdown" || g.phase === "quizRecap") return { type: "nextRound" };
  }
  switch (g.phase) {
    case "highlow":
      return g.highlow!.order[g.highlow!.pointer] === me ? { type: "hlGuess", guess: g.highlow!.current.value < 8 ? "plus" : "moins" } : null;
    case "betting":
      if (g.turnIdx !== meIdx) return null;
      return { type: "bet", action: g.currentBet === 0 ? "check" : "call" };
    case "duel": {
      const d = g.duel!;
      if (d.stage === "bets") return d.a !== me && d.b !== me && !d.betResponded.includes(me) ? { type: "duelBet", side: "a" } : null;
      const pos = me === d.a ? 0 : me === d.b ? 1 : -1;
      return pos >= 0 && !d.revealed[pos] ? { type: "duelFlip" } : null;
    }
    case "qcm": {
      const q = g.qcm!;
      if (q.stage === "ask" && !q.answers[me]) return { type: "qcmAnswer", choice: Math.floor(Math.random() * 4) };
      if (q.stage === "champion" && q.champion === me) return { type: "qcmGive", targetSlug: pickOther(s, me) };
      return null;
    }
    case "vote":
      if (g.vote!.responded.includes(me)) return null;
      return { type: "vote", choice: g.vote!.mode === "qui" ? pickOther(s, me) : Math.random() < 0.5 ? "A" : "B" };
    case "memeCaption":
      return g.meme!.captionResponded.includes(me) ? null : { type: "memeCaption", caption: `Légende de ${s.myName}` };
    case "memeVote": {
      if (g.meme!.voteResponded.includes(me)) return null;
      const opt = g.meme!.voteOrder.find((x) => x !== me);
      return { type: "memeVote", authorSlug: opt ?? null };
    }
    case "dice": {
      const d = g.dice!;
      const idx = d.tieBreak ? d.tieBreak.playerIdx : d.playerIdx;
      return idx === meIdx ? { type: "diceRoll" } : null;
    }
    case "undercoverClue": {
      const u = g.undercover!;
      if (u.revealUntil !== undefined) return null;
      return u.clueOrder[u.cluePointer] === me ? { type: "ucClue", text: "Un indice" } : null;
    }
    case "undercoverVote": {
      const u = g.undercover!;
      if (!u.remainingSlugs.includes(me) || u.voteResponded.includes(me)) return null;
      const t = (u.tieBreakCandidates ?? u.remainingSlugs).find((x) => x !== me);
      return { type: "ucVote", targetSlug: t ?? null };
    }
    case "undercoverGuess":
      return s.myUndercoverWord === null ? { type: "ucGuess", guess: "Café" } : null;
    case "blackjack": {
      const bj = g.blackjack!;
      if (bj.stage === "betting" && !bj.betResponded.includes(me)) return { type: "bjBet", amount: 2 };
      if (bj.stage === "playerTurns" && bj.players[bj.turnPointer].slug === me) return { type: "bjAct", action: "stand" };
      if (bj.stage === "distributing" && bj.distributionQueue[0]?.slug === me)
        return { type: "bjDistribute", targets: [{ slug: pickOther(s, me), amount: bj.distributionQueue[0].amount }] };
      return null;
    }
    case "golf": {
      const gl = g.golf!;
      if (gl.playerIdx !== meIdx) return null;
      const c = golfCourseById(gl.courseId);
      const pos = gl.positions[me];
      const dx = c.hole.x - pos.x;
      const dy = c.hole.y - pos.y;
      const d = Math.hypot(dx, dy);
      const speed = Math.min(340, 60 + d * 1.2);
      return { type: "golfShot", velocity: { x: (dx / d) * speed, y: (dy / d) * speed } };
    }
    case "archery":
      return g.archery!.playerIdx === meIdx ? { type: "archeryShot", aim: { x: 170, y: 170 }, power: 1 } : null;
    case "final":
      if (g.culSecRule === "first" && !g.culSecTargetSlug && [...g.playersPublic].sort((a, b) => a.gulpsTotal - b.gulpsTotal)[0].slug === me) return { type: "assignCulSec", targetSlug: pickOther(s, me) };
      return null;
  }
  return null;
}

async function main() {
  const host = new Client("Hôte");
  const created = await host.req<{ code: string }>("POST", "/api/rooms", { name: "Hôte" });
  const code = created.data.code;
  const clients = [host];
  for (let i = 1; i < HUMANS; i++) {
    const c = new Client(`Joueur${i}`);
    const r = await c.req("POST", `/api/rooms/${code}/join`, { name: c.name });
    if (r.status !== 200) throw new Error("join: " + JSON.stringify(r.data));
    clients.push(c);
  }
  const launch = await host.req("POST", `/api/rooms/${code}/launch`, {
    totalRounds: ROUNDS,
    culSecRule: "first",
    enabledRoundTypeIds: GAMES,
    bots: 0,
  });
  if (launch.status !== 200) throw new Error("launch: " + JSON.stringify(launch.data));
  console.log(`Salon ${code}, ${HUMANS} humain(s).`);

  const start = Date.now();
  let lastLabel = "";
  let errors = 0;
  for (;;) {
    if (Date.now() - start > 30 * 60 * 1000) throw new Error("trop long");
    // Tous les clients rafraîchissent et agissent en parallèle (conditions réelles).
    const states = await Promise.all(clients.map((c) => c.req<StateResponse>("GET", `/api/rooms/${code}/state?beat=1`)));
    const g = states[0].data.game!;
    const label = `manche ${g.round} ${g.roundTypeId} ${g.phase}`;
    if (label !== lastLabel) {
      console.log(`  [${Math.round((Date.now() - start) / 1000)}s] ${label}`);
      lastLabel = label;
    }
    if (g.phase === "final" && (g.culSecRule !== "first" || g.culSecTargetSlug)) break;
    await Promise.all(
      clients.map(async (c, i) => {
        const move = humanMove(states[i].data);
        if (!move) return;
        const r = await c.req<{ error?: string }>("POST", `/api/rooms/${code}/action`, move);
        // 409 = quelqu'un (ou un bot) a déjà fait avancer la partie : normal.
        if (r.status !== 200 && r.status !== 409) {
          errors++;
          console.error(`    ✗ ${c.name} ${JSON.stringify(move)} -> ${r.status} ${r.data.error}`);
        }
      })
    );
    await new Promise((r) => setTimeout(r, 400));
  }
  const final = (await host.req<StateResponse>("GET", `/api/rooms/${code}/state`)).data.game!;
  console.log("Fin :", final.playersPublic.map((p) => `${p.name} ${p.gulpsTotal}`).join(", "));
  if (errors) {
    console.error(`${errors} erreur(s)`);
    process.exit(1);
  }
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
