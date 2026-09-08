// Bumped so any existing install's cache (which may hold a now-broken "/"
// from before it was removed below) gets dropped by the activate handler
// instead of lingering forever.
const CACHE_NAME = "maa-shell-v2";
// Deliberately NOT caching "/" — it's the one URL that changes on every
// deploy (its HTML references that build's hashed JS/CSS files), so a
// precached copy goes stale the moment the next deploy ships. Once stale,
// it's actively harmful: the very first transient network blip falls back
// to it, and it points at JS chunks Vercel no longer serves, breaking the
// installed PWA until its cache is cleared. Only cache things that don't
// change (or don't matter if briefly stale) — a network failure on "/"
// now just surfaces the browser's normal offline error instead.
const SHELL_URLS = ["/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first for everything: this is a live, real-time game — a stale
// cached page or API response would show a player the wrong game state.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
