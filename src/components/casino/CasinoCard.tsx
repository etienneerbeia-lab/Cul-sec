"use client";

import { memo, useId, useState, type CSSProperties } from "react";
import type { Card } from "@/lib/game/types";

// Carte de casino en SVG (tables Chill) : vrais pips, figures, dos guilloché.
// Tout est vectoriel : net sur écran Retina, sans aucune image externe.

type SuitKey = "s" | "h" | "d" | "c";
const SUIT_KEY: Record<string, SuitKey> = { "♠": "s", "♥": "h", "♦": "d", "♣": "c" };
const RED = "#b3122e";
const BLACK = "#16141c";
const GOLD = "#c9a24a";

// Symboles dessinés dans une boîte 100×100 (pas de caractères Unicode : iOS
// les affiche parfois en emoji).
const SUIT_PATH: Record<SuitKey, string> = {
  h: "M50 92 C34 78 4 60 4 32 C4 14 17 4 31 4 C41 4 47 10 50 18 C53 10 59 4 69 4 C83 4 96 14 96 32 C96 60 66 78 50 92 Z",
  d: "M50 2 Q68 27 90 50 Q68 73 50 98 Q32 73 10 50 Q32 27 50 2 Z",
  s: "M50 4 C62 22 93 40 93 62 C93 77 82 86 69 86 C61 86 55 82 52 77 C53 86 57 92 66 97 L34 97 C43 92 47 86 48 77 C45 82 39 86 31 86 C18 86 7 77 7 62 C7 40 38 22 50 4 Z",
  c: "M50 6 A19 19 0 0 1 66 36 A19 19 0 1 1 57 68 C58 82 62 90 70 97 L30 97 C38 90 42 82 43 68 A19 19 0 1 1 34 36 A19 19 0 0 1 50 6 Z",
};

const RANK_LABEL: Record<number, string> = { 11: "V", 12: "D", 13: "R", 14: "A" };
const rankLabel = (v: number) => RANK_LABEL[v] ?? String(v);

function Pip({ suit, x, y, size, flip = false, color }: { suit: SuitKey; x: number; y: number; size: number; flip?: boolean; color: string }) {
  const s = size / 100;
  return (
    <path
      d={SUIT_PATH[suit]}
      fill={color}
      transform={`translate(${x} ${y}) ${flip ? "rotate(180)" : ""} scale(${s}) translate(-50 -50)`}
    />
  );
}

// Disposition classique des pips (carte 250×350). r = retourné (moitié basse).
const L = 82;
const C = 125;
const R = 168;
const T = 72;
const B = 278;
const M = 175;
const PIPS: Record<number, [number, number][]> = {
  2: [[C, T], [C, B]],
  3: [[C, T], [C, M], [C, B]],
  4: [[L, T], [R, T], [L, B], [R, B]],
  5: [[L, T], [R, T], [C, M], [L, B], [R, B]],
  6: [[L, T], [R, T], [L, M], [R, M], [L, B], [R, B]],
  7: [[L, T], [R, T], [C, 123], [L, M], [R, M], [L, B], [R, B]],
  8: [[L, T], [R, T], [C, 123], [L, M], [R, M], [C, 227], [L, B], [R, B]],
  9: [[L, T], [R, T], [L, 141], [R, 141], [C, M], [L, 209], [R, 209], [L, B], [R, B]],
  10: [[L, T], [R, T], [C, 106], [L, 141], [R, 141], [L, 209], [R, 209], [C, 244], [L, B], [R, B]],
};

// Couronnes / coiffes des figures (boîte 100×60).
const CROWN: Record<number, string> = {
  13: "M6 56 L6 18 L26 36 L50 4 L74 36 L94 18 L94 56 Z", // Roi
  12: "M10 56 L16 22 L33 40 L50 14 L67 40 L84 22 L90 56 Z", // Dame
  11: "M8 56 Q50 -6 92 56 Z", // Valet
};

function Index({ label, suit, color }: { label: string; suit: SuitKey; color: string }) {
  const ten = label === "10";
  return (
    <g>
      <text
        x={30}
        y={54}
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight={700}
        fontSize={ten ? 40 : 48}
        letterSpacing={ten ? -3 : 0}
        fill={color}
      >
        {label}
      </text>
      <Pip suit={suit} x={30} y={80} size={30} color={color} />
    </g>
  );
}

function FaceArt({ value, suit, color, id }: { value: number; suit: SuitKey; color: string; id: string }) {
  const half = (
    <g>
      {/* Coiffe dorée */}
      <g transform="translate(83 58) scale(0.84)">
        <path d={CROWN[value]} fill={GOLD} stroke={color} strokeWidth={3} strokeLinejoin="round" />
        {value === 12 && [16, 50, 84].map((cx) => <circle key={cx} cx={cx} cy={cx === 50 ? 14 : 22} r={5} fill={color} />)}
        {value === 13 && [6, 50, 94].map((cx) => <circle key={cx} cx={cx} cy={cx === 50 ? 4 : 18} r={5} fill={color} />)}
        {value === 11 && <path d="M50 8 Q62 -8 78 2" stroke={color} strokeWidth={3} fill="none" />}
        <rect x={4} y={50} width={92} height={8} rx={2} fill={color} />
      </g>
      <text
        x={125}
        y={160}
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight={700}
        fontStyle="italic"
        fontSize={74}
        fill={color}
      >
        {RANK_LABEL[value]}
      </text>
      <Pip suit={suit} x={84} y={146} size={22} color={color} />
    </g>
  );
  return (
    <g>
      <rect x={52} y={40} width={146} height={270} rx={8} fill={`url(#${id}-hatch)`} stroke={color} strokeWidth={3} />
      <rect x={58} y={46} width={134} height={258} rx={5} fill="none" stroke={GOLD} strokeWidth={1.5} />
      {half}
      <g transform="rotate(180 125 175)">{half}</g>
      <line x1={58} y1={175} x2={192} y2={175} stroke={GOLD} strokeWidth={1.5} />
    </g>
  );
}

export type CardBack = "bordeaux" | "navy";

function Back({ id, color }: { id: string; color: CardBack }) {
  const [base, dark] = color === "navy" ? ["#1b2a5c", "#101a3d"] : ["#7d1426", "#560a18"];
  return (
    <svg viewBox="0 0 250 350" className="block h-full w-full" aria-hidden>
      <defs>
        <pattern id={`${id}-lattice`} width="22" height="22" patternUnits="userSpaceOnUse">
          <path d="M0 11 L11 0 L22 11 L11 22 Z" fill="none" stroke="rgba(255,240,220,0.22)" strokeWidth="1.2" />
          <circle cx="11" cy="11" r="1.6" fill="rgba(255,240,220,0.28)" />
        </pattern>
        <radialGradient id={`${id}-bg`} cx="50%" cy="45%" r="70%">
          <stop offset="0" stopColor={base} />
          <stop offset="1" stopColor={dark} />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="250" height="350" rx="18" fill="#f7f1e6" />
      <rect x="9" y="9" width="232" height="332" rx="12" fill={`url(#${id}-bg)`} />
      <rect x="9" y="9" width="232" height="332" rx="12" fill={`url(#${id}-lattice)`} />
      <rect x="19" y="19" width="212" height="312" rx="8" fill="none" stroke="rgba(255,240,220,0.75)" strokeWidth="2.5" />
      {/* Rosace guillochée */}
      <g transform="translate(125 175)" fill="none" stroke="rgba(255,236,205,0.5)" strokeWidth="1.3">
        {Array.from({ length: 12 }, (_, i) => (
          <ellipse key={i} rx="62" ry="20" transform={`rotate(${i * 15})`} />
        ))}
        <circle r="16" fill={dark} stroke="rgba(255,236,205,0.8)" strokeWidth="2" />
        <circle r="9" fill="none" stroke="rgba(255,236,205,0.6)" />
      </g>
    </svg>
  );
}

function Front({ card, id, compact }: { card: Card; id: string; compact: boolean }) {
  const suit = SUIT_KEY[card.suit.sym] ?? "s";
  const color = card.suit.color === "red" ? RED : BLACK;
  const label = rankLabel(card.value);
  return (
    <svg viewBox="0 0 250 350" className="block h-full w-full" aria-label={`${label} ${card.suit.sym}`}>
      <defs>
        <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#fffdf7" />
          <stop offset="1" stopColor="#f1ead9" />
        </linearGradient>
        <pattern id={`${id}-grain`} width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.7" fill="rgba(90,70,40,0.07)" />
          <circle cx="4.5" cy="4" r="0.5" fill="rgba(90,70,40,0.05)" />
        </pattern>
        <pattern id={`${id}-hatch`} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="10" height="10" fill="#fbf6ea" />
          <line x1="0" y1="0" x2="0" y2="10" stroke={color} strokeOpacity="0.1" strokeWidth="3" />
        </pattern>
      </defs>
      <rect x="1" y="1" width="248" height="348" rx="18" fill={`url(#${id}-paper)`} stroke="#cfc4ad" strokeWidth="2" />
      <rect x="1" y="1" width="248" height="348" rx="18" fill={`url(#${id}-grain)`} />
      {compact ? (
        // Petite carte : index géant, lisible même à 24 px de large.
        <g>
          <text
            x={card.value === 10 ? 112 : 104}
            y={170}
            textAnchor="middle"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontWeight={700}
            fontSize={card.value === 10 ? 136 : 170}
            letterSpacing={card.value === 10 ? -12 : 0}
            fill={color}
          >
            {label}
          </text>
          <Pip suit={suit} x={150} y={258} size={120} color={color} />
        </g>
      ) : (
        <g>
          <Index label={label} suit={suit} color={color} />
          <g transform="rotate(180 125 175)">
            <Index label={label} suit={suit} color={color} />
          </g>
          {card.value === 14 ? (
            <g>
              <circle cx={125} cy={175} r={70} fill="none" stroke={color} strokeOpacity={0.18} strokeWidth={2} />
              <Pip suit={suit} x={125} y={175} size={108} color={color} />
            </g>
          ) : card.value >= 11 ? (
            <FaceArt value={card.value} suit={suit} color={color} id={id} />
          ) : (
            (PIPS[card.value] ?? []).map(([x, y], i) => <Pip key={i} suit={suit} x={x} y={y} size={46} flip={y > M} color={color} />)
          )}
        </g>
      )}
    </svg>
  );
}

// Carte complète : face et dos dans un conteneur 3D. `faceDown` qui passe
// à false retourne la carte (transition) ; `dealFrom` fait glisser la carte
// depuis ce décalage (px) à son apparition ; `flipIn` la retourne à son
// apparition. Les animations ne jouent que pour les cartes qui apparaissent
// (pas pour celles déjà là au chargement de l'écran).
export const CasinoCard = memo(function CasinoCard({
  card,
  faceDown = false,
  width,
  back = "bordeaux",
  dealFrom,
  flipIn = false,
  animate = true,
  delayMs = 0,
  dim = false,
  highlight = false,
  className = "",
  style,
}: {
  card?: Card | null;
  faceDown?: boolean;
  width: number;
  back?: CardBack;
  dealFrom?: { x: number; y: number };
  flipIn?: boolean;
  animate?: boolean;
  delayMs?: number;
  dim?: boolean;
  highlight?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  // Figé au montage : une carte déjà affichée ne rejoue jamais son entrée.
  const [anim] = useState(animate);
  const height = Math.round(width * 1.4);
  const showFace = !!card && !faceDown;
  const outerStyle: CSSProperties = {
    width,
    height,
    ...(anim && dealFrom
      ? ({ "--from-x": `${dealFrom.x}px`, "--from-y": `${dealFrom.y}px`, animationDelay: `${delayMs}ms` } as CSSProperties)
      : {}),
    ...style,
  };
  return (
    <div
      className={`cc ${anim && dealFrom ? "cc-deal" : ""} ${dim ? "cc-dim" : ""} ${highlight ? "cc-lit" : ""} ${className}`}
      style={outerStyle}
    >
      <div
        className={`cc-inner ${showFace ? "" : "cc-down"} ${anim && flipIn && showFace ? "cc-flip-in" : ""}`}
        style={anim && flipIn ? { animationDelay: `${delayMs}ms` } : undefined}
      >
        <div className="cc-face">{card ? <Front card={card} id={id} compact={width < 44} /> : null}</div>
        <div className="cc-face cc-back">
          <Back id={`${id}b`} color={back} />
        </div>
      </div>
    </div>
  );
});
