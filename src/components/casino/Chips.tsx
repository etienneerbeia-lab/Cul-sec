"use client";

import { memo } from "react";

// Jetons de casino en SVG : vus de dessus (bouton dealer, blindes, rack du
// croupier) et en piles vues de profil (mises, pot).

export interface Denom {
  value: number;
  color: string;
  edge: string; // couleur des rayures de la tranche
  dark: string; // tranche (ombre)
}

// Couleurs de casino classiques, par valeur.
export const DENOMS: Denom[] = [
  { value: 5000, color: "#e8631b", edge: "#fff3e0", dark: "#a8420c" },
  { value: 1000, color: "#f2b81c", edge: "#5b3a00", dark: "#b0820b" },
  { value: 500, color: "#7b2cbf", edge: "#f3e8ff", dark: "#521c85" },
  { value: 100, color: "#202024", edge: "#f4f4f4", dark: "#0b0b0d" },
  { value: 25, color: "#1f8a4c", edge: "#f1fff6", dark: "#13603a" },
  { value: 5, color: "#c8202f", edge: "#fff1f2", dark: "#8f121e" },
  { value: 1, color: "#f1f1f1", edge: "#2b5bd7", dark: "#bdbdbd" },
];

// Décompose un montant en jetons (glouton), limité à `maxColumns` piles de
// `maxPerColumn` jetons pour rester lisible.
export function breakdown(amount: number, maxColumns = 3, maxPerColumn = 8): { denom: Denom; count: number }[] {
  const out: { denom: Denom; count: number }[] = [];
  let rest = Math.max(0, Math.round(amount));
  for (const d of DENOMS) {
    if (rest < d.value) continue;
    const n = Math.floor(rest / d.value);
    rest -= n * d.value;
    out.push({ denom: d, count: n });
  }
  // Les plus grosses valeurs d'abord ; on limite le nombre de piles et leur hauteur.
  return out.slice(0, maxColumns).map((c) => ({ ...c, count: Math.min(maxPerColumn, c.count) }));
}

// Pile(s) de jetons vue(s) de profil. `scale` 1 = jeton de 20 px de large.
export const ChipStack = memo(function ChipStack({
  amount,
  scale = 1,
  maxColumns = 3,
  maxPerColumn = 8,
  className = "",
}: {
  amount: number;
  scale?: number;
  maxColumns?: number;
  maxPerColumn?: number;
  className?: string;
}) {
  const cols = breakdown(amount, maxColumns, maxPerColumn);
  if (cols.length === 0) return null;
  const rx = 10;
  const ry = 4;
  const step = 2.6; // épaisseur d'un jeton
  const gap = 3;
  const tallest = Math.max(...cols.map((c) => c.count));
  const w = cols.length * (rx * 2) + (cols.length - 1) * gap + 2;
  const h = ry * 2 + tallest * step + 2;
  return (
    <svg
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      className={`block overflow-visible ${className}`}
      aria-hidden
    >
      {cols.map((col, ci) => {
        const cx = 1 + rx + ci * (rx * 2 + gap);
        const baseY = h - ry - 1;
        return (
          <g key={ci}>
            {/* Ombre au sol */}
            <ellipse cx={cx + 1} cy={baseY + 1.2} rx={rx + 0.5} ry={ry} fill="rgba(0,0,0,0.35)" />
            {Array.from({ length: col.count }, (_, i) => {
              const y = baseY - i * step;
              return (
                <g key={i}>
                  {/* Tranche avec rayures */}
                  <path d={`M${cx - rx} ${y - step} L${cx - rx} ${y} A${rx} ${ry} 0 0 0 ${cx + rx} ${y} L${cx + rx} ${y - step} Z`} fill={col.denom.dark} />
                  {[-0.72, -0.2, 0.32, 0.84].map((t) => (
                    <rect key={t} x={cx + t * rx - 1.3} y={y - step + 0.4} width={2.6} height={step} fill={col.denom.edge} opacity={0.85} />
                  ))}
                  {/* Dessus */}
                  <ellipse cx={cx} cy={y - step} rx={rx} ry={ry} fill={col.denom.color} />
                  {i === col.count - 1 && (
                    <>
                      <ellipse cx={cx} cy={y - step} rx={rx * 0.68} ry={ry * 0.68} fill="none" stroke={col.denom.edge} strokeOpacity={0.7} strokeWidth={0.8} strokeDasharray="2 1.6" />
                      <ellipse cx={cx - 2} cy={y - step - 1} rx={rx * 0.5} ry={ry * 0.35} fill="rgba(255,255,255,0.18)" />
                    </>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
});

// Jeton vu de dessus, avec rayures sur le pourtour et un marquage central
// (bouton dealer « D », « SB », « BB »...).
export const ChipTop = memo(function ChipTop({
  size,
  color,
  edge,
  label,
  labelColor = "#111",
  className = "",
}: {
  size: number;
  color: string;
  edge: string;
  label?: string;
  labelColor?: string;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={`block ${className}`} aria-label={label}>
      <circle cx="20" cy="21.5" r="19" fill="rgba(0,0,0,0.45)" />
      <circle cx="20" cy="20" r="19" fill={color} />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x="17.5" y="1" width="5" height="6" rx="1" fill={edge} transform={`rotate(${i * 45} 20 20)`} />
      ))}
      <circle cx="20" cy="20" r="12.5" fill={color} stroke={edge} strokeOpacity="0.8" strokeWidth="1.2" strokeDasharray="2.4 1.8" />
      <circle cx="20" cy="20" r="19" fill="none" stroke="rgba(0,0,0,0.25)" />
      <ellipse cx="15" cy="13" rx="8" ry="4" fill="rgba(255,255,255,0.22)" />
      {label && (
        <text
          x="20"
          y={label.length > 1 ? 24.5 : 26.5}
          textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontWeight="700"
          fontSize={label.length > 1 ? 12 : 17}
          fill={labelColor}
        >
          {label}
        </text>
      )}
    </svg>
  );
});

export function DealerButton({ size = 22 }: { size?: number }) {
  return <ChipTop size={size} color="#f7f4ec" edge="#c9a24a" label="D" labelColor="#14131a" />;
}

export function BlindChip({ kind, size = 18 }: { kind: "SB" | "BB"; size?: number }) {
  return kind === "SB" ? (
    <ChipTop size={size} color="#2a5bd7" edge="#e8efff" label="SB" labelColor="#fff" />
  ) : (
    <ChipTop size={size} color="#e9b21c" edge="#4a3000" label="BB" labelColor="#2a1a00" />
  );
}
