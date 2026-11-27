"use client";

import { useId, useState, type ReactNode } from "react";
import type { CroupierLook } from "@/lib/dealer/croupiers";
import { croupiereSvg } from "./croupiereSvg";

// La croupière, debout derrière la table de blackjack : son buste dans une
// bande au-dessus du feutre (derrière le rail), ses mains posées sur la
// table (devant). Elle cligne des yeux, respire, et fait un geste de la main
// à chaque carte distribuée.

export const CROUPIER_BAND = 108; // hauteur réservée au-dessus de la table (px)
const S = 122; // taille du dessin (300 unités)
const TOP = CROUPIER_BAND + 4 - Math.round((270 / 300) * S); // rail juste sous le bord de la table

const svgId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "");

export function CroupiereBand({
  look,
  dealCount,
  bubble,
  chat,
}: {
  look: CroupierLook;
  // Nombre de cartes distribuées : chaque nouvelle carte relance le geste.
  dealCount: number;
  bubble?: ReactNode;
  chat?: ReactNode;
}) {
  const id = svgId(useId());
  const [initial] = useState(dealCount);
  const box = { top: TOP, left: `calc(50% - ${S / 2}px)`, width: S, height: S };
  return (
    <div className="relative mt-1" style={{ height: CROUPIER_BAND }} data-croupier={look}>
      <div className="cr-glow" aria-hidden />
      <div className="cr-body absolute" style={{ ...box, zIndex: 0 }} dangerouslySetInnerHTML={{ __html: croupiereSvg(look, "body", `${id}b`) }} />
      <div
        key={dealCount}
        className={`cr-hands pointer-events-none absolute ${dealCount !== initial ? "cr-dealing" : ""}`}
        style={{ ...box, zIndex: 6 }}
        dangerouslySetInnerHTML={{ __html: croupiereSvg(look, "hands", `${id}h`) }}
      />
      {bubble}
      {chat && <div className="absolute top-1 right-0 z-10">{chat}</div>}
    </div>
  );
}

// Visage seul (avatar du chat).
export function CroupiereAvatar({ look, size }: { look: CroupierLook; size: number }) {
  const id = svgId(useId());
  return (
    <span
      className="cr-avatar block shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: croupiereSvg(look, "body", `${id}a`, "110 44 80 80") }}
    />
  );
}
