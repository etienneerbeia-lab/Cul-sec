import type { ReactNode } from "react";

// Écran standard : zone défilante + barre d'actions collée en bas, dans la
// zone du pouce, au-dessus de la barre d'accueil iPhone.
export function Screen({
  children,
  actions,
  className = "",
  center = false,
}: {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  center?: boolean;
}) {
  return (
    <>
      <div className={`cs-scroll animate-enter pb-4 ${center ? "justify-center" : ""} ${className}`}>{children}</div>
      {actions && <div className="cs-actionbar">{actions}</div>}
      {!actions && <div style={{ height: "calc(12px + var(--safe-bottom))" }} className="shrink-0" />}
    </>
  );
}

export function Kicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`cs-kicker ${className}`}>{children}</div>;
}

export function Title({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h1 className={`font-display text-[2rem] font-extrabold leading-[1.02] ${className}`}>{children}</h1>;
}

// Grand titre centré avec une icône (intro de manche, résultats...).
export function Hero({
  icon,
  kicker,
  title,
  children,
}: {
  icon?: ReactNode;
  kicker?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      {icon && <div className="animate-pop mb-1 text-[4rem] leading-none drop-shadow-[0_8px_24px_rgba(255,61,139,0.45)]">{icon}</div>}
      {kicker && <Kicker>{kicker}</Kicker>}
      <Title className="text-balance">{title}</Title>
      {children && <div className="max-w-[34ch] text-[1.02rem] leading-snug text-ink-2">{children}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`cs-card p-4 ${className}`}>{children}</div>;
}

export function Section({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mt-5 ${className}`}>
      {title && <Kicker className="mb-2 px-1">{title}</Kicker>}
      {children}
    </section>
  );
}

export function Note({ children, tone = "mute" }: { children: ReactNode; tone?: "mute" | "danger" | "neon" }) {
  const color = tone === "danger" ? "text-danger" : tone === "neon" ? "text-neon" : "text-ink-2";
  return <p className={`my-2 text-center text-[0.95rem] leading-snug ${color}`}>{children}</p>;
}
