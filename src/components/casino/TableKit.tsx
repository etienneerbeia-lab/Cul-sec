"use client";

import { useEffect, useRef, useState } from "react";
import { serverNow } from "@/lib/clock";

// Éléments communs aux tables Chill : anneau de timer, étiquettes d'action,
// taille mesurée du conteneur.

// Anneau de compte à rebours (autour d'un avatar ou d'un cercle de mise).
// Animé en CSS : une seule animation, aucun rendu React par seconde.
// À monter avec key={deadlineAt} pour repartir à chaque nouvelle échéance.
export function TimerRing({ deadlineAt, totalMs, size, stroke = 3 }: { deadlineAt: number; totalMs: number; size: number; stroke?: number }) {
  const [mountedAt] = useState(() => serverNow());
  const remaining = Math.max(0, deadlineAt - mountedAt);
  const total = Math.max(totalMs, remaining);
  const r = size / 2 - stroke / 2 - 0.5;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="tk-ring pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="tk-ring-arc"
        style={
          {
            "--c": `${c}`,
            animationDuration: `${total}ms`,
            animationDelay: `${-(total - remaining)}ms`,
          } as React.CSSProperties
        }
      />
    </svg>
  );
}

export type TagTone = "fold" | "check" | "bet" | "allin" | "win" | "push" | "lose" | "bj";

// Petite étiquette posée au-dessus d'un joueur : « CALL », « RAISE 440 »,
// « +53 € », « BUST »… Elle « pop » à chaque changement de texte.
export function Tag({ tone, children, small = false, className = "" }: { tone: TagTone; children: React.ReactNode; small?: boolean; className?: string }) {
  return (
    <span key={String(children)} className={`tk-tag tk-tag-${tone} ${small ? "tk-tag-sm" : ""} ${className}`}>
      {children}
    </span>
  );
}

// Largeur mesurée d'un élément (la géométrie des tables en dépend).
export function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

// Vrai seulement après le premier rendu : les cartes présentes au
// chargement de l'écran n'animent pas leur arrivée.
export function useAfterFirstPaint(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return ready;
}
