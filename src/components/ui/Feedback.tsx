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

export function Sheet({ open, onClose, children }: { open: boolean; onClose?: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="cs-sheet-backdrop" onClick={onClose}>
      <div className="cs-sheet" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="cs-sheet-handle" />
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
