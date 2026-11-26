"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // updateViaCache "none" : le navigateur ne lit jamais sw.js depuis son
    // cache HTTP, il voit chaque nouveau déploiement dès le prochain
    // chargement.
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        // Vérifie aussi quand l'appli installée revient au premier plan
        // (une PWA peut rester ouverte des jours).
        const onVisible = () => document.visibilityState === "visible" && reg.update().catch(() => {});
        document.addEventListener("visibilitychange", onVisible);
      })
      .catch(() => {});
  }, []);
  return null;
}
