"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { serverNow } from "@/lib/clock";
import { haptic } from "@/lib/haptics";

// Pastille « gorgées ». 10 et plus = cul sec.
export function Gulps({ n, prefix = "" }: { n: number; prefix?: string }) {
  if (n <= 0) return <span className="cs-gulp cs-gulp-zero">0</span>;
  if (n >= 10) return <span className="cs-gulp cs-gulp-cs">🍺 Cul sec</span>;
  return (
    <span className="cs-gulp">
      🍺 {prefix}
      {n}
    </span>
  );
}

// Nombre qui défile jusqu'à sa valeur (scores, totaux).
export function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className="tabular-nums">{shown}</span>;
}

// Secondes restantes jusqu'à une heure serveur, rafraîchi 4×/s.
export function useCountdown(deadlineAt: number | null | undefined): number | null {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    if (!deadlineAt) return;
    const id = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(id);
  }, [deadlineAt]);
  if (!deadlineAt) return null;
  return Math.max(0, deadlineAt - now);
}

export function TimerBar({ deadlineAt, totalMs, label = true }: { deadlineAt: number | null | undefined; totalMs: number; label?: boolean }) {
  const remaining = useCountdown(deadlineAt);
  const warned = useRef(false);
  const urgent = remaining !== null && remaining < 5000;
  useEffect(() => {
    if (urgent && !warned.current) {
      warned.current = true;
      haptic("warn");
    }
    if (!urgent) warned.current = false;
  }, [urgent]);
  if (remaining === null) return null;
  const pct = Math.max(0, Math.min(100, (remaining / totalMs) * 100));
  return (
    <div className="flex items-center gap-3">
      <div className="cs-timer flex-1" data-urgent={urgent}>
        <div style={{ width: `${pct}%` }} />
      </div>
      {label && (
        <span className={`w-9 text-right font-display text-lg font-extrabold tabular-nums ${urgent ? "text-neon" : "text-ink-2"}`}>
          {Math.ceil(remaining / 1000)}
        </span>
      )}
    </div>
  );
}

// Bottom sheet façon iOS : se ferme par le bouton, un tap sur le fond, ou en
// la faisant glisser vers le bas. Le glissé part de la poignée, ou de
// n'importe où dans la sheet tant que son contenu est scrollé tout en haut
// (sinon c'est le scroll interne qui gagne).
const DISMISS_DISTANCE = 0.28; // fraction de la hauteur de la sheet
const DISMISS_MIN_PX = 110;
const DISMISS_VELOCITY = 0.55; // px/ms, un « flick » vers le bas

export function Sheet({ open, onClose, children }: { open: boolean; onClose?: () => void; children: ReactNode }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    if (!open || !sheet || !backdrop) return;

    type Drag = { startY: number; offset: number; lastY: number; lastT: number; v: number; fromHandle: boolean; mode: "idle" | "drag" | "scroll" };
    let d: Drag | null = null;
    let closing = false;
    let suppressClick = false;

    const apply = (offset: number, animate: string | null) => {
      sheet.style.transition = animate ?? "none";
      sheet.style.transform = offset ? `translate3d(0, ${offset}px, 0)` : "";
      const h = sheet.offsetHeight || 1;
      backdrop.style.setProperty("--sheet-dim-t", animate ? (animate.match(/[\d.]+m?s/)?.[0] ?? "0s") : "0s");
      backdrop.style.setProperty("--sheet-dim", String(Math.max(0, Math.min(1, 1 - offset / h))));
    };

    const begin = (y: number, target: EventTarget | null) => {
      if (closing) return;
      const fromHandle = !!(target instanceof Element && target.closest("[data-sheet-handle]"));
      d = { startY: y, offset: 0, lastY: y, lastT: performance.now(), v: 0, fromHandle, mode: "idle" };
    };

    // Renvoie true si le geste est un glissé de la sheet (à ne pas laisser au navigateur).
    const move = (y: number): boolean => {
      if (!d) return false;
      const dy = y - d.startY;
      if (d.mode === "idle") {
        if (Math.abs(dy) < 2) return false;
        d.mode = dy > 0 && (d.fromHandle || sheet.scrollTop <= 0) ? "drag" : "scroll";
        if (d.mode === "drag") d.startY = y; // pas de saut au démarrage
      }
      if (d.mode !== "drag") return false;
      const now = performance.now();
      const dt = Math.max(1, now - d.lastT);
      d.v = 0.8 * ((y - d.lastY) / dt) + 0.2 * d.v;
      d.lastY = y;
      d.lastT = now;
      const raw = y - d.startY;
      // Vers le haut : légère résistance, la sheet ne monte presque pas.
      d.offset = raw >= 0 ? raw : raw / 6;
      apply(d.offset, null);
      return true;
    };

    const end = () => {
      if (!d) return;
      const { mode, offset, v } = d;
      d = null;
      if (mode !== "drag") return;
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 0);
      const h = sheet.offsetHeight;
      if (offset > Math.max(DISMISS_MIN_PX, h * DISMISS_DISTANCE) || (v > DISMISS_VELOCITY && offset > 12)) {
        closing = true;
        haptic("tap");
        // Plus on lâche vite, plus la sortie est courte.
        const ms = Math.round(Math.max(140, Math.min(280, (h - offset) / Math.max(v, 1.2))));
        apply(h + 24, `transform ${ms}ms cubic-bezier(0.32, 0.72, 0, 1)`);
        setTimeout(() => closeRef.current?.(), ms);
      } else {
        apply(0, "transform 0.36s cubic-bezier(0.34, 1.4, 0.64, 1)");
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) begin(e.touches[0].clientY, e.target);
      else d = null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (move(e.touches[0].clientY) && e.cancelable) e.preventDefault();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      begin(e.clientY, e.target);
      const mm = (ev: MouseEvent) => {
        if (move(ev.clientY)) ev.preventDefault();
      };
      const mu = () => {
        window.removeEventListener("mousemove", mm);
        window.removeEventListener("mouseup", mu);
        end();
      };
      window.addEventListener("mousemove", mm);
      window.addEventListener("mouseup", mu);
    };
    const onClickCapture = (e: MouseEvent) => {
      if (suppressClick) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    sheet.addEventListener("touchstart", onTouchStart, { passive: true });
    sheet.addEventListener("touchmove", onTouchMove, { passive: false });
    sheet.addEventListener("touchend", end);
    sheet.addEventListener("touchcancel", end);
    sheet.addEventListener("mousedown", onMouseDown);
    backdrop.addEventListener("click", onClickCapture, true);
    return () => {
      sheet.removeEventListener("touchstart", onTouchStart);
      sheet.removeEventListener("touchmove", onTouchMove);
      sheet.removeEventListener("touchend", end);
      sheet.removeEventListener("touchcancel", end);
      sheet.removeEventListener("mousedown", onMouseDown);
      backdrop.removeEventListener("click", onClickCapture, true);
    };
  }, [open]);

  if (!open) return null;
  return (
    <div ref={backdropRef} className="cs-sheet-backdrop" onClick={onClose}>
      <div ref={sheetRef} className="cs-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="cs-sheet-grip" data-sheet-handle aria-hidden="true">
          <div className="cs-sheet-handle" />
        </div>
        {children}
      </div>
    </div>
  );
}

// « En attente de … » avec petits points animés.
export function Waiting({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2 py-3 text-center text-ink-2">
      <span className="inline-flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-neon"
            style={{ animation: `cs-float 1s ${i * 0.15}s ease-in-out infinite` }}
          />
        ))}
      </span>
      <span>{children}</span>
    </div>
  );
}

// Bandeau de résultat coloré (bonne/mauvaise réponse, verdict...).
export function Verdict({ tone, children }: { tone: "good" | "bad" | "neutral"; children: ReactNode }) {
  const cls =
    tone === "good"
      ? "bg-lime/15 text-lime border-lime/40"
      : tone === "bad"
        ? "bg-danger/15 text-danger border-danger/40 animate-shake"
        : "bg-white/5 text-ink border-white/15";
  return (
    <div className={`animate-pop rounded-2xl border px-4 py-3 text-center font-display text-xl font-extrabold ${cls}`}>
      {children}
    </div>
  );
}
