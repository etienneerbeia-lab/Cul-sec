"use client";

import { memo, useId, useState, type CSSProperties, type ReactNode } from "react";
import { fromCode, type CardCode } from "@/lib/casino/cards";
import type { Card } from "@/lib/game/types";
import { Back as ClassicBack, Front as DetailedFront, Pip, SUIT_KEY, rankLabel, type SuitKey } from "../CasinoCard";

// Cartes des variantes de table (labo). Quatre jeux :
// - classic : vraie carte (ratio 2,5:3,5), index rang + couleur en coin
//   haut-gauche et bas-droit inversé, symbole central ; vrais pips et
//   figures dès qu'elle est assez grande ;
// - minimal : blanche et plate, gros index (rang, couleur dessous), grosse
//   couleur en bas à droite ;
// - club : la classique, avec liseré doré, reflet et ombre portée ;
// - neon : fond coloré par couleur (♠ graphite, ♥ rouge, ♦ bleu, ♣ vert).
// Tout est en SVG (net sur Retina) ; les animations reprennent celles de
// CasinoCard (classes .cc*).

export type Deck = "classic" | "minimal" | "club" | "neon";

// Zone de l'index (rang + couleur) en coin haut-gauche, en fraction de la
// largeur de la carte : ce qui doit rester visible quand les cartes se
// chevauchent.
export const INDEX_BOX: Record<Deck, { w: number; h: number }> = {
  classic: { w: 0.36, h: 0.74 },
  club: { w: 0.36, h: 0.74 },
  minimal: { w: 0.46, h: 0.98 },
  neon: { w: 0.44, h: 0.92 },
};

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "var(--font-inter), 'Helvetica Neue', Arial, sans-serif";

// Couleurs d'encre selon le jeu (4 couleurs : ♦ bleu, ♣ vert).
function inkOf(deck: Deck, suit: SuitKey, fourColor: boolean): string {
  if (deck === "neon") return "#ffffff";
  const red = deck === "minimal" ? "#e0262f" : "#b3122e";
  const black = deck === "minimal" ? "#14161c" : "#16141c";
  if (fourColor) {
    if (suit === "d") return deck === "minimal" ? "#1764d8" : "#1d4fb8";
    if (suit === "c") return deck === "minimal" ? "#12893f" : "#16703a";
  }
  return suit === "h" || suit === "d" ? red : black;
}

const NEON_BG: Record<SuitKey, [string, string]> = {
  s: ["#3a3f55", "#1d2030"],
  h: ["#ff4a64", "#c4122f"],
  d: ["#3f86ff", "#1748c4"],
  c: ["#2fc46b", "#11803f"],
};

function RankText({
  label,
  x,
  y,
  size,
  font,
  color,
  anchor = "middle",
  weight = 700,
  narrow,
}: {
  label: string;
  x: number;
  y: number;
  size: number;
  font: string;
  color: string;
  anchor?: "start" | "middle";
  weight?: number;
  // Largeur imposée du « 10 » (deux chiffres serrés).
  narrow: number;
}) {
  const ten = label === "10";
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      style={{ fontFamily: font }}
      fontWeight={weight}
      fontSize={size}
      fill={color}
      {...(ten ? { textLength: narrow, lengthAdjust: "spacingAndGlyphs" } : {})}
    >
      {label}
    </text>
  );
}

// Coiffe des figures (boîte 100×60), pour les petites cartes.
const CROWN: Record<number, string> = {
  13: "M6 56 L6 18 L26 36 L50 4 L74 36 L94 18 L94 56 Z",
  12: "M10 56 L16 22 L33 40 L50 14 L67 40 L84 22 L90 56 Z",
  11: "M8 56 Q50 -6 92 56 Z",
};

// ---- Faces ----

// Classique / club, petite taille : index en coin, symbole central.
function ClassicSmall({ card, suit, ink, id, club }: { card: Card; suit: SuitKey; ink: string; id: string; club: boolean }) {
  const label = rankLabel(card.value);
  const corner = (
    <g>
      <RankText label={label} x={46} y={104} size={label === "10" ? 92 : 102} font={SERIF} color={ink} narrow={78} />
      <Pip suit={suit} x={46} y={146} size={58} color={ink} />
    </g>
  );
  return (
    <g>
      {corner}
      <g transform="rotate(180 125 175)">{corner}</g>
      {card.value === 14 ? (
        <g>
          <circle cx={125} cy={175} r={56} fill="none" stroke={ink} strokeOpacity={0.16} strokeWidth={3} />
          <Pip suit={suit} x={125} y={175} size={92} color={ink} />
        </g>
      ) : card.value >= 11 ? (
        <g>
          <rect x={86} y={110} width={78} height={130} rx={8} fill={club ? `url(#${id}-gold)` : "#f6e9c6"} stroke={ink} strokeWidth={3} />
          <g transform="translate(97 122) scale(0.56)">
            <path d={CROWN[card.value]} fill="#c9a24a" stroke={ink} strokeWidth={4} strokeLinejoin="round" />
          </g>
          <Pip suit={suit} x={125} y={196} size={52} color={ink} />
        </g>
      ) : (
        <Pip suit={suit} x={125} y={175} size={88} color={ink} />
      )}
    </g>
  );
}

// Minimal : gros rang en haut à gauche, couleur dessous, grosse couleur en
// bas à droite.
function MinimalFace({ card, suit, ink }: { card: Card; suit: SuitKey; ink: string }) {
  const label = rankLabel(card.value);
  return (
    <g>
      <RankText label={label} x={22} y={122} size={124} font={SANS} color={ink} anchor="start" weight={800} narrow={98} />
      <Pip suit={suit} x={62} y={192} size={74} color={ink} />
      <Pip suit={suit} x={170} y={268} size={118} color={ink} />
    </g>
  );
}

// Néon : fond coloré, index blanc, grande couleur en filigrane.
function NeonFace({ card, suit, id }: { card: Card; suit: SuitKey; id: string }) {
  const label = rankLabel(card.value);
  return (
    <g>
      <rect x={0} y={0} width={250} height={350} fill={`url(#${id}-neon)`} />
      <Pip suit={suit} x={158} y={248} size={160} color="rgba(255,255,255,0.2)" />
      <rect x={8} y={8} width={234} height={334} rx={16} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={3} />
      <RankText label={label} x={26} y={122} size={122} font={SANS} color="#fff" anchor="start" weight={800} narrow={96} />
      <Pip suit={suit} x={64} y={188} size={70} color="#fff" />
    </g>
  );
}

// Mini-carte : juste l'index, en grand (mains très chargées).
function MiniFace({ card, suit, ink }: { card: Card; suit: SuitKey; ink: string }) {
  const label = rankLabel(card.value);
  return (
    <g>
      <RankText label={label} x={125} y={168} size={label === "10" ? 150 : 176} font={SANS} color={ink} weight={800} narrow={196} />
      <Pip suit={suit} x={125} y={262} size={118} color={ink} />
    </g>
  );
}

function FaceSvg({ card, deck, fourColor, mini, width, id }: { card: Card; deck: Deck; fourColor: boolean; mini: boolean; width: number; id: string }) {
  const suit = SUIT_KEY[card.suit.sym] ?? "s";
  const ink = inkOf(deck, suit, fourColor);
  // Grandes cartes classiques : vrais pips et figures (dessin de CasinoCard).
  if ((deck === "classic" || deck === "club") && !mini && width >= 60) {
    return (
      <div className="relative h-full w-full">
        <DetailedFront card={card} id={id} compact={false} color={ink} />
        {deck === "club" && <Gloss />}
      </div>
    );
  }
  const neon = deck === "neon";
  const paper = deck === "minimal" ? ["#ffffff", "#f4f5f7"] : ["#fffdf7", "#f1ead9"];
  return (
    <div className="relative h-full w-full">
      <svg viewBox="0 0 250 350" className="block h-full w-full" aria-label={`${rankLabel(card.value)} ${card.suit.sym}`}>
        <defs>
          <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor={paper[0]} />
            <stop offset="1" stopColor={paper[1]} />
          </linearGradient>
          <linearGradient id={`${id}-neon`} x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0" stopColor={NEON_BG[suit][0]} />
            <stop offset="1" stopColor={NEON_BG[suit][1]} />
          </linearGradient>
          <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fbefc9" />
            <stop offset="1" stopColor="#e7cf8c" />
          </linearGradient>
        </defs>
        {neon ? (
          mini ? (
            <rect x={0} y={0} width={250} height={350} fill={`url(#${id}-neon)`} />
          ) : null
        ) : (
          <rect x="1" y="1" width="248" height="348" rx="18" fill={`url(#${id}-paper)`} stroke={deck === "minimal" ? "#d5d9e0" : "#cfc4ad"} strokeWidth="2" />
        )}
        {deck === "club" && !mini && <rect x={10} y={10} width={230} height={330} rx={12} fill="none" stroke="#c9a24a" strokeWidth={3} />}
        {mini ? (
          <MiniFace card={card} suit={suit} ink={ink} />
        ) : neon ? (
          <NeonFace card={card} suit={suit} id={id} />
        ) : deck === "minimal" ? (
          <MinimalFace card={card} suit={suit} ink={ink} />
        ) : (
          <ClassicSmall card={card} suit={suit} ink={ink} id={id} club={deck === "club"} />
        )}
      </svg>
      {deck === "club" && <Gloss />}
    </div>
  );
}

// Reflet de la carte « club » (vernis).
function Gloss() {
  return <div className="pc-gloss" aria-hidden />;
}

// ---- Dos ----
function BackSvg({ deck, id }: { deck: Deck; id: string }) {
  if (deck === "classic") return <ClassicBack id={id} color="bordeaux" />;
  if (deck === "minimal")
    return (
      <svg viewBox="0 0 250 350" className="block h-full w-full" aria-hidden>
        <defs>
          <pattern id={`${id}-st`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="14" height="14" fill="#23324d" />
            <rect width="5" height="14" fill="#2b3d5c" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="250" height="350" rx="18" fill="#f7f8fa" />
        <rect x="12" y="12" width="226" height="326" rx="11" fill={`url(#${id}-st)`} />
        <circle cx="125" cy="175" r="34" fill="#f7f8fa" />
        <Pip suit="s" x={125} y={175} size={40} color="#23324d" />
      </svg>
    );
  if (deck === "club")
    return (
      <svg viewBox="0 0 250 350" className="block h-full w-full" aria-hidden>
        <defs>
          <pattern id={`${id}-dk`} width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M12 0 L24 12 L12 24 L0 12 Z" fill="none" stroke="rgba(214,175,92,0.32)" strokeWidth="1.4" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="250" height="350" rx="18" fill="#141018" />
        <rect x="0" y="0" width="250" height="350" rx="18" fill={`url(#${id}-dk)`} />
        <rect x="12" y="12" width="226" height="326" rx="10" fill="none" stroke="#d6af5c" strokeWidth="4" />
        <rect x="22" y="22" width="206" height="306" rx="6" fill="none" stroke="rgba(214,175,92,0.6)" strokeWidth="1.5" />
        <g transform="translate(125 175)">
          <path d="M0 -58 L40 0 L0 58 L-40 0 Z" fill="#141018" stroke="#d6af5c" strokeWidth="3" />
          <path d="M0 -36 L24 0 L0 36 L-24 0 Z" fill="#d6af5c" opacity="0.85" />
        </g>
      </svg>
    );
  return (
    <svg viewBox="0 0 250 350" className="block h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={`${id}-nb`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b2bd1" />
          <stop offset="1" stopColor="#d4246f" />
        </linearGradient>
        <pattern id={`${id}-ng`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M10 0 L20 10 L10 20 L0 10 Z" fill="none" stroke="rgba(120,240,255,0.25)" strokeWidth="1.2" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="250" height="350" rx="18" fill={`url(#${id}-nb)`} />
      <rect x="0" y="0" width="250" height="350" rx="18" fill={`url(#${id}-ng)`} />
      <rect x="12" y="12" width="226" height="326" rx="12" fill="none" stroke="#7cf0ff" strokeWidth="3" opacity="0.8" />
      <text x="125" y="190" textAnchor="middle" style={{ fontFamily: SANS }} fontWeight={900} fontSize="52" fill="#fff" opacity="0.9">
        C·S
      </text>
    </svg>
  );
}

// Carte complète (face + dos dans un conteneur 3D) : mêmes animations que
// CasinoCard. `mini` = index seul, pour les mains très chargées.
export const PlayingCard = memo(function PlayingCard({
  code,
  faceDown = false,
  width,
  deck,
  fourColor = false,
  mini = false,
  backDeck,
  dealFrom,
  flipIn = false,
  animate = true,
  delayMs = 0,
  dim = false,
  highlight = false,
  className = "",
  style,
  children,
}: {
  code?: CardCode | null;
  faceDown?: boolean;
  width: number;
  deck: Deck;
  fourColor?: boolean;
  mini?: boolean;
  backDeck?: Deck;
  dealFrom?: { x: number; y: number };
  flipIn?: boolean;
  animate?: boolean;
  delayMs?: number;
  dim?: boolean;
  highlight?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  // Figé au montage : une carte déjà affichée ne rejoue jamais son entrée.
  const [anim] = useState(animate);
  const card = code ? fromCode(code) : null;
  const height = Math.round(width * 1.4);
  const showFace = !!card && !faceDown;
  const outerStyle: CSSProperties = {
    width,
    height,
    ...(anim && dealFrom ? ({ "--from-x": `${dealFrom.x}px`, "--from-y": `${dealFrom.y}px`, animationDelay: `${delayMs}ms` } as CSSProperties) : {}),
    ...style,
  };
  return (
    <div
      className={`cc pc-${deck} ${mini ? "pc-mini" : ""} ${anim && dealFrom ? "cc-deal" : ""} ${dim ? "cc-dim" : ""} ${highlight ? "cc-lit" : ""} ${className}`}
      style={outerStyle}
    >
      <div
        className={`cc-inner ${showFace ? "" : "cc-down"} ${anim && flipIn && showFace ? "cc-flip-in" : ""}`}
        style={anim && flipIn ? { animationDelay: `${delayMs}ms` } : undefined}
      >
        <div className="cc-face">{card ? <FaceSvg card={card} deck={deck} fourColor={fourColor} mini={mini} width={width} id={id} /> : null}</div>
        <div className="cc-face cc-back">
          <BackSvg deck={backDeck ?? deck} id={`${id}b`} />
        </div>
      </div>
      {children}
    </div>
  );
});
