// Service worker servi par Next (et non plus depuis public/) pour y graver
// l'identifiant du build : le nom du cache change à chaque déploiement, le
// navigateur voit un fichier différent, installe la nouvelle version et
// l'activation supprime l'ancien cache. Plus besoin de penser à incrémenter
// un numéro à la main (le bug « appli installée cassée après un
// déploiement » venait d'un cache resté en place).
export const dynamic = "force-static";

const BUILD_ID = process.env.APP_BUILD_ID ?? "dev";

const SCRIPT = `// Cul-Sec — service worker, build ${BUILD_ID}
const CACHE_NAME = "cs-shell-${BUILD_ID}";
// Jamais "/" ni les pages : leur HTML référence les fichiers JS/CSS hachés
// de CE build ; une copie en cache pointerait vers des fichiers que le
// déploiement suivant ne sert plus. Seulement des fichiers stables.
const SHELL_URLS = ["/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(SHELL_URLS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Réseau d'abord, toujours : c'est un jeu en temps réel. Les appels d'API
// ne passent jamais par le cache.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
`;

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
