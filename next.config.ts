import type { NextConfig } from "next";

// Identifiant de ce déploiement, injecté dans le service worker (voir
// src/app/sw.js/route.ts) : chaque déploiement a son propre cache, et
// l'ancien est supprimé à l'activation. Vercel fournit le hash du commit ;
// ailleurs, l'heure du build fait l'affaire.
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || process.env.VERCEL_DEPLOYMENT_ID || Date.now().toString(36);

const nextConfig: NextConfig = {
  env: { APP_BUILD_ID: BUILD_ID },
  async headers() {
    return [
      {
        // Le navigateur doit toujours revérifier le service worker : c'est
        // lui qui décide quand l'appli installée se met à jour.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
