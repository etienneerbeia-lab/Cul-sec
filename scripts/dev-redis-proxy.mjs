// Proxy REST compatible Upstash, pour développer et tester en local contre un
// vrai redis-server (aucune dépendance). Usage :
//   redis-server --port 6379 --daemonize yes
//   node scripts/dev-redis-proxy.mjs            # écoute sur :8079
//   KV_REST_API_URL=http://localhost:8079 KV_REST_API_TOKEN=dev npm run dev
// Implémente ce qu'utilise @upstash/redis : POST / (une commande),
// POST /pipeline et /multi-exec (liste de commandes), encodage base64.
import http from "node:http";
import net from "node:net";

const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const PORT = Number(process.env.PORT || 8079);

function encodeCommand(args) {
  let out = `*${args.length}\r\n`;
  for (const a of args) {
    const s = typeof a === "string" ? a : JSON.stringify(a);
    out += `$${Buffer.byteLength(s)}\r\n${s}\r\n`;
  }
  return out;
}

// Minimal RESP2 parser returning [value, nextOffset] or null if incomplete.
function parse(buf, off = 0) {
  if (off >= buf.length) return null;
  const type = String.fromCharCode(buf[off]);
  const end = buf.indexOf("\r\n", off);
  if (end < 0) return null;
  const line = buf.toString("utf8", off + 1, end);
  if (type === "+") return [line, end + 2];
  if (type === "-") return [{ __error: line }, end + 2];
  if (type === ":") return [Number(line), end + 2];
  if (type === "$") {
    const len = Number(line);
    if (len < 0) return [null, end + 2];
    if (buf.length < end + 2 + len + 2) return null;
    return [buf.toString("utf8", end + 2, end + 2 + len), end + 2 + len + 2];
  }
  if (type === "*") {
    const n = Number(line);
    if (n < 0) return [null, end + 2];
    const arr = [];
    let p = end + 2;
    for (let i = 0; i < n; i++) {
      const r = parse(buf, p);
      if (!r) return null;
      arr.push(r[0]);
      p = r[1];
    }
    return [arr, p];
  }
  throw new Error("RESP inattendu: " + type);
}

function connect() {
  const sock = net.createConnection({ port: REDIS_PORT });
  let buf = Buffer.alloc(0);
  const queue = [];
  sock.on("data", (d) => {
    buf = Buffer.concat([buf, d]);
    for (;;) {
      const r = parse(buf);
      if (!r) break;
      buf = buf.subarray(r[1]);
      queue.shift()?.(r[0]);
    }
  });
  return (args) =>
    new Promise((resolve) => {
      queue.push(resolve);
      sock.write(encodeCommand(args));
    });
}

const send = connect();

function enc(v, b64) {
  if (!b64) return v;
  if (typeof v === "string") return Buffer.from(v, "utf8").toString("base64");
  if (Array.isArray(v)) return v.map((x) => enc(x, b64));
  return v;
}

async function run(cmd, b64) {
  const r = await send(cmd.map(String));
  if (r && typeof r === "object" && "__error" in r) return { error: r.__error };
  return { result: enc(r, b64) };
}

http
  .createServer(async (req, res) => {
    let body = "";
    for await (const c of req) body += c;
    const b64 = String(req.headers["upstash-encoding"] || "").toLowerCase() === "base64";
    try {
      const parsed = JSON.parse(body || "[]");
      let out;
      if (req.url.startsWith("/pipeline") || req.url.startsWith("/multi-exec")) {
        out = [];
        for (const c of parsed) out.push(await run(c, b64));
      } else {
        out = await run(parsed, b64);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(out));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(e) }));
    }
  })
  .listen(PORT, () => console.log(`[dev-redis-proxy] http://localhost:${PORT} -> redis:${REDIS_PORT}`));
