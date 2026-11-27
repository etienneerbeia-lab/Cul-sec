"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import { total, totalLabel } from "@/lib/bjtable/engine";
import type { CardCode } from "@/lib/casino/cards";
import { haptic } from "@/lib/haptics";
import { Tag, type TagTone } from "../TableKit";
import { INDEX_BOX, PlayingCard, type Deck } from "./PlayingCard";

// Mains de blackjack des variantes : chaque main vit dans une boîte de
// taille FIXE (réservée pour 6+ cartes) ; les cartes s'y rangent sans
// jamais en sortir ni pousser le reste de l'écran. Règle d'or : l'index
// (rang + couleur) de chaque carte reste visible. On essaie, de la plus
// grande taille à la plus petite : un décalage suffisant le long de la
// direction voulue (rangée ou cascade diagonale), puis des mini-cartes
// (index seul) côte à côte.

export interface RunLayout {
  cw: number;
  mini: boolean;
  // Position (coin haut-gauche) de chaque carte dans la boîte, et ordre
  // d'empilement (z) : en cascade vers le haut, les suivantes passent
  // dessous pour laisser voir leur index.
  pos: { x: number; y: number; z: number }[];
}

export type Align = "start" | "center" | "end";

const HAS_BOTTOM_INDEX: Record<Deck, boolean> = { classic: true, club: true, minimal: false, neon: false };

// Pas minimal entre deux cartes (px) dans la direction (ux, uy) pour que
// l'index reste lisible, et ordre d'empilement correspondant.
function minStep(cw: number, deck: Deck, ux: number, uy: number): { step: number; reverse: boolean } {
  const iw = Math.ceil(INDEX_BOX[deck].w * cw) + 1;
  const ih = Math.ceil(INDEX_BOX[deck].h * cw) + 1;
  const ax = Math.abs(ux);
  const ay = Math.abs(uy);
  // Suivante par-dessus : l'index haut-gauche de la précédente se voit si
  // on se décale vers la droite (ou vers le bas) d'au moins sa taille.
  const normalTL = Math.min(ux > 0.05 ? iw / ux : Infinity, uy > 0.05 ? ih / uy : Infinity);
  // Suivante dessous (cascade vers le haut / la gauche) : son index
  // haut-gauche dépasse en haut ou à gauche.
  const reverseTL = Math.min(uy < -0.05 ? ih / ay : Infinity, ux < -0.05 ? iw / ax : Infinity);
  // Jeu classique : l'index bas-droit (inversé) de la précédente se voit si
  // la suivante monte assez.
  const normalBR = HAS_BOTTOM_INDEX[deck] ? Math.min(uy < -0.05 ? ih / ay : Infinity, ux < -0.05 ? iw / ax : Infinity) : Infinity;
  // On préfère un index à l'endroit (haut-gauche) ; l'index inversé du jeu
  // classique ne sert que si l'autre obligerait à trop espacer les cartes.
  const upright = Math.min(normalTL, reverseTL);
  if (upright <= cw) return { step: upright, reverse: reverseTL < normalTL };
  const best = Math.min(upright, normalBR);
  return { step: best, reverse: best === reverseTL && reverseTL < normalTL };
}

function place(xs: number[], ys: number[], wItem: number, hItem: number, w: number, h: number, ax: Align, ay: Align) {
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs) + wItem;
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys) + hItem;
  const off = (a: Align, lo: number, hi: number, size: number) => (a === "start" ? -lo : a === "end" ? size - hi : (size - (hi - lo)) / 2 - lo);
  return { dx: off(ax, minX, maxX, w), dy: off(ay, minY, maxY, h) };
}

type RunOpts = {
  maxCw: number;
  minCw?: number;
  deck: Deck;
  dir?: { x: number; y: number };
  // Directions candidates (cascade) : on garde celle qui donne les plus
  // grandes cartes (à égalité, la première).
  dirs?: { x: number; y: number }[];
  align?: [Align, Align];
  spread?: number;
};

export function layoutRun(n: number, box: { w: number; h: number }, opts: RunOpts): RunLayout {
  if (opts.dirs && opts.dirs.length > 1) {
    let best: RunLayout | null = null;
    for (const dir of opts.dirs) {
      const l = layoutRun(n, box, { ...opts, dirs: undefined, dir });
      if (!best || (best.mini && !l.mini) || (l.mini === best.mini && l.cw > best.cw)) best = l;
    }
    return best!;
  }
  const { maxCw, deck } = opts;
  const minCw = opts.minCw ?? 20;
  const dir = opts.dirs?.[0] ?? opts.dir ?? { x: 1, y: 0 };
  const len = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / len;
  const uy = dir.y / len;
  const [alX, alY] = opts.align ?? ["center", "center"];
  if (n <= 0) return { cw: maxCw, mini: false, pos: [] };
  for (let cw = maxCw; cw >= minCw; cw--) {
    const ch = Math.round(cw * 1.4);
    if (cw > box.w || ch > box.h) continue;
    const { step: need, reverse } = minStep(cw, deck, ux, uy);
    // Un peu d'air au-delà du minimum, si la boîte le permet.
    const roomX = Math.abs(ux) > 0.05 ? (box.w - cw) / Math.abs(ux) : Infinity;
    const roomY = Math.abs(uy) > 0.05 ? (box.h - ch) / Math.abs(uy) : Infinity;
    const maxStep = n > 1 ? Math.min(roomX, roomY) / (n - 1) : Infinity;
    if (n > 1 && maxStep < need) continue;
    const step = n > 1 ? Math.min(maxStep, Math.max(need, cw * (opts.spread ?? 0.5))) : 0;
    const xs = Array.from({ length: n }, (_, i) => i * step * ux);
    const ys = Array.from({ length: n }, (_, i) => i * step * uy);
    const { dx, dy } = place(xs, ys, cw, ch, box.w, box.h, alX, alY);
    return { cw, mini: false, pos: xs.map((x, i) => ({ x: Math.round(x + dx), y: Math.round(ys[i] + dy), z: reverse ? n - i : i + 1 })) };
  }
  // Mini-cartes (index seul) côte à côte, sur une ou deux rangées.
  const gap = 2;
  for (const rows of [1, 2, 3]) {
    const per = Math.ceil(n / rows);
    const mw = Math.min(26, Math.floor((box.w - gap * (per - 1)) / per), Math.floor((box.h - gap * (rows - 1)) / rows / 1.4));
    if (mw < 13 && rows < 3) continue;
    const mh = Math.round(mw * 1.4);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < n; i++) {
      xs.push((i % per) * (mw + gap));
      ys.push(Math.floor(i / per) * (mh + gap));
    }
    const { dx, dy } = place(xs, ys, mw, mh, box.w, box.h, alX, alY);
    return { cw: mw, mini: true, pos: xs.map((x, i) => ({ x: Math.round(x + dx), y: Math.round(ys[i] + dy), z: i + 1 })) };
  }
  return { cw: minCw, mini: true, pos: [] };
}

// Une main dans sa boîte fixe. `onOpen` : agrandir dans le pop-up.
export function HandRun({
  cards,
  w,
  h,
  maxCw,
  minCw,
  deck,
  fourColor,
  dir,
  dirs,
  align,
  spread,
  animate,
  dealFrom,
  dim,
  active,
  faceDown,
  onOpen,
  className = "",
  style,
  children,
}: {
  cards: CardCode[];
  w: number;
  h: number;
  maxCw: number;
  minCw?: number;
  deck: Deck;
  fourColor: boolean;
  dir?: { x: number; y: number };
  dirs?: { x: number; y: number }[];
  align?: [Align, Align];
  spread?: number;
  animate: boolean;
  dealFrom?: (i: number) => { x: number; y: number };
  dim?: boolean;
  active?: boolean;
  faceDown?: (i: number) => boolean;
  onOpen?: () => void;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const lay = layoutRun(cards.length, { w, h }, { maxCw, minCw, deck, dir, dirs, align, spread });
  const Tag_ = onOpen ? "button" : "div";
  return (
    <Tag_
      {...(onOpen
        ? {
            type: "button" as const,
            "aria-label": "Agrandir la main",
            onClick: () => {
              haptic("select");
              onOpen();
            },
          }
        : {})}
      className={`bv-hand block shrink-0 ${className}`}
      style={{ position: "relative", width: w, height: h, ...style }}
      data-hand-box
    >
      {cards.map((c, i) => {
        const p = lay.pos[i];
        if (!p) return null;
        return (
          <PlayingCard
            key={i}
            code={c}
            deck={deck}
            fourColor={fourColor}
            mini={lay.mini}
            width={lay.cw}
            animate={animate}
            faceDown={faceDown?.(i)}
            flipIn
            dealFrom={dealFrom?.(i)}
            dim={dim}
            style={{ position: "absolute", left: p.x, top: p.y, zIndex: p.z }}
          />
        );
      })}
      {/* Main en cours (split) : cadre autour des cartes elles-mêmes */}
      {active && lay.pos.length > 0 && (
        <span
          className="bv-hand-active"
          style={{
            left: Math.min(...lay.pos.map((q) => q.x)),
            top: Math.min(...lay.pos.map((q) => q.y)),
            width: Math.max(...lay.pos.map((q) => q.x)) - Math.min(...lay.pos.map((q) => q.x)) + lay.cw,
            height: Math.max(...lay.pos.map((q) => q.y)) - Math.min(...lay.pos.map((q) => q.y)) + Math.round(lay.cw * 1.4),
          }}
        />
      )}
      {children}
    </Tag_>
  );
}

// Pastille du total : rouge si bust, dorée si blackjack. Jamais posée sur
// les cartes (chaque variante lui réserve sa place).
export function TotalBadge({ cards, blackjack = false, size = "md" }: { cards: CardCode[]; blackjack?: boolean; size?: "sm" | "md" | "lg" }) {
  if (!cards.length) return null;
  const v = total(cards);
  const tone = blackjack ? "bj" : v > 21 ? "bust" : "plain";
  return (
    <span className={`bv-total bv-total-${tone} bv-total-${size}`} data-total>
      {blackjack ? "BJ" : totalLabel(cards)}
    </span>
  );
}

// ---- Pop-up : la main d'un joueur en grand ----
export interface ZoomHand {
  cards: CardCode[];
  bet: number;
  doubled: boolean;
  natural: boolean;
  res: { tone: TagTone; text: string } | null;
}

export function HandZoom({
  open,
  onClose,
  name,
  hands,
  deck,
  fourColor,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  hands: ZoomHand[];
  deck: Deck;
  fourColor: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="bv-zoom" onClick={onClose} role="dialog" aria-label={`Main de ${name}`} data-zoom>
      <div className="bv-zoom-card animate-pop" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="truncate font-display text-lg font-extrabold">{name}</div>
          <button type="button" className="bv-zoom-x" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {hands.map((h, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <TotalBadge cards={h.cards} blackjack={h.natural} size="lg" />
                <span className="text-sm font-semibold tabular-nums text-ink-2">
                  {hands.length > 1 ? `Main ${i + 1} · ` : ""}Mise {h.bet} €{h.doubled ? " (doublée)" : ""}
                </span>
                {h.res && <Tag tone={h.res.tone}>{h.res.text}</Tag>}
              </div>
              <HandRun
                cards={h.cards}
                w={300}
                h={h.cards.length > 4 ? 98 : 112}
                maxCw={80}
                minCw={30}
                deck={deck}
                fourColor={fourColor}
                spread={0.72}
                animate={false}
              />
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-mute">Touche en dehors pour fermer</p>
      </div>
    </div>
  );
}
