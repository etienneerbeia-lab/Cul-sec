// Reconnexion / arrivée tardive via l'API (serveur local sur :3000). Usage : node scripts/test-rejoin.mjs
const BASE = process.env.BASE ?? "http://localhost:3000";
function client() {
  let cookie = "";
  return async (method, path, body) => {
    const r = await fetch(BASE + path, {
      method,
      headers: { "content-type": "application/json", cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = r.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: r.status, data: await r.json() };
  };
}
const host = client(), ana = client(), ana2 = client(), late = client();
const { data } = await host("POST", "/api/rooms", { name: "Hôte" });
const code = data.code;
console.log("join Ana", (await ana("POST", `/api/rooms/${code}/join`, { name: "Ana" })).data);
console.log("join ANA dup (lobby)", (await ana2("POST", `/api/rooms/${code}/join`, { name: "ana" })).status);
console.log("launch", (await host("POST", `/api/rooms/${code}/launch`, { totalRounds: 5, culSecRule: "last", enabledRoundTypeIds: ["dice", "golf"], bots: 0 })).data);
await ana("GET", `/api/rooms/${code}/state?beat=1`);
console.log("rejoin while present ->", (await ana2("POST", `/api/rooms/${code}/join`, { name: "Ana" })).status, "(409 attendu)");
console.log("Ana quitte", (await ana("POST", `/api/rooms/${code}/leave`)).data);
const r = await ana2("POST", `/api/rooms/${code}/join`, { name: "ana" });
console.log("rejoin après départ ->", r.status, r.data);
const l = await late("POST", `/api/rooms/${code}/join`, { name: "Zoé" });
console.log("arrivée tardive ->", l.status, l.data);
let s = (await late("GET", `/api/rooms/${code}/state`)).data;
console.log("Zoé à table ?", s.game.playersPublic.some((p) => p.slug === s.mySlug), "phase", s.game.phase);
// Hôte fait avancer jusqu'à la manche suivante
for (let i = 0; i < 200; i++) {
  s = (await host("GET", `/api/rooms/${code}/state?beat=1`)).data;
  await ana2("GET", `/api/rooms/${code}/state?beat=1`);
  const g = s.game;
  if (g.round >= 2) break;
  if (g.phase === "roundIntro") await host("POST", `/api/rooms/${code}/action`, { type: "confirmIntro" });
  else if (g.phase === "showdown") await host("POST", `/api/rooms/${code}/action`, { type: "nextRound" });
  else if (g.phase === "dice") {
    for (const c of [host, ana2]) await c("POST", `/api/rooms/${code}/action`, { type: "diceRoll" });
  } else if (g.phase === "golf") {
    for (const c of [host, ana2]) await c("POST", `/api/rooms/${code}/action`, { type: "golfShot", velocity: { x: 50, y: -300 } });
  }
  await new Promise((r) => setTimeout(r, 200));
}
s = (await late("GET", `/api/rooms/${code}/state`)).data;
console.log("manche", s.game.round, "Zoé à table ?", s.game.playersPublic.map((p) => p.name).join(", "));
