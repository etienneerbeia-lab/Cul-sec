import { Redis } from "@upstash/redis";

// Vercel's "Upstash" marketplace storage injects KV_REST_API_URL / KV_REST_API_TOKEN;
// fall back to the plain Upstash-account names for local/non-Vercel setups.
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  console.warn(
    "[redis] Missing KV_REST_API_URL/KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL/TOKEN) — set them in .env.local."
  );
}

export const redis = new Redis({ url: url || "", token: token || "" });

// Rooms are ephemeral party sessions — auto-expire after a night of play.
export const ROOM_TTL_SECONDS = 12 * 60 * 60; // 12h
