"use client";

import { useEffect } from "react";

// Sur iPhone, le clavier ne réduit pas la hauteur de la page : on cale la
// hauteur de l'appli (--app-h) sur la zone réellement visible, pour que la
// barre d'actions et le champ actif restent au-dessus du clavier.
export function useViewportHeight(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    const apply = () => {
      const h = vv ? vv.height : window.innerHeight;
      document.documentElement.style.setProperty("--app-h", `${Math.round(h)}px`);
      // iOS fait défiler la page sous le clavier : on la remet en place.
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    apply();
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    return () => {
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
    };
  }, []);
}
