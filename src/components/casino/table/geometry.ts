// Géométrie des tables des variantes (px, à partir de la largeur mesurée).
// Trois formes : « stadium » (pilule verticale), « rrect » (rectangle très
// arrondi), « oval » (ellipse allongée). Les sièges sont posés le long d'un
// tracé parallèle au bord, à abscisse curviligne régulière : l'écart entre
// deux sièges ne dépend pas de la forme.

export type Shape = "stadium" | "rrect" | "oval";

export interface Box {
  cx: number;
  cy: number;
  a: number; // demi-largeur
  b: number; // demi-hauteur
}

const cornerR = (bx: Box) => Math.min(bx.a, bx.b) * 0.42;

// Contour SVG de la forme, rétréci de `inset` px.
export function outlinePath(shape: Shape, bx: Box, inset = 0): string {
  const a = bx.a - inset;
  const b = bx.b - inset;
  const { cx, cy } = bx;
  if (shape === "oval") return `M${cx - a} ${cy} A${a} ${b} 0 1 1 ${cx + a} ${cy} A${a} ${b} 0 1 1 ${cx - a} ${cy} Z`;
  if (shape === "stadium") {
    const L = Math.max(0, b - a);
    return `M${cx - a} ${cy - L} A${a} ${a} 0 0 1 ${cx + a} ${cy - L} V${cy + L} A${a} ${a} 0 0 1 ${cx - a} ${cy + L} Z`;
  }
  const r = Math.max(4, cornerR(bx) - inset);
  return `M${cx - a + r} ${cy - b} H${cx + a - r} A${r} ${r} 0 0 1 ${cx + a} ${cy - b + r} V${cy + b - r} A${r} ${r} 0 0 1 ${cx + a - r} ${cy + b} H${cx - a + r} A${r} ${r} 0 0 1 ${cx - a} ${cy + b - r} V${cy - b + r} A${r} ${r} 0 0 1 ${cx - a + r} ${cy - b} Z`;
}

// Point du bord dans la direction (dx, dy) depuis le centre.
function boundary(shape: Shape, bx: Box, dx: number, dy: number, radius: number): [number, number] {
  const { a, b } = bx;
  if (shape === "oval") {
    const t = 1 / Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b));
    return [dx * t, dy * t];
  }
  const circle = (cx: number, cy: number, r: number): [number, number] => {
    const dc = dx * cx + dy * cy;
    const t = dc + Math.sqrt(Math.max(0, dc * dc - (cx * cx + cy * cy) + r * r));
    return [dx * t, dy * t];
  };
  if (shape === "stadium") {
    const L = Math.max(0, b - a);
    if (Math.abs(dx) > 1e-9) {
      const t = a / Math.abs(dx);
      if (Math.abs(dy * t) <= L) return [dx * t, dy * t];
    }
    return circle(0, Math.sign(dy) * L, a);
  }
  const r = radius;
  const t = Math.min(Math.abs(dx) > 1e-9 ? a / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-9 ? b / Math.abs(dy) : Infinity);
  const px = dx * t;
  const py = dy * t;
  if (Math.abs(px) > a - r && Math.abs(py) > b - r) return circle(Math.sign(px) * (a - r), Math.sign(py) * (b - r), r);
  return [px, py];
}

// Point à la fraction `f` du périmètre, en partant du milieu du bas et en
// tournant vers la gauche (sens des aiguilles d'une montre à l'écran).
export function perimeterPoint(shape: Shape, bx: Box, f: number, radius = cornerR(bx)): { x: number; y: number } {
  const N = 720;
  const pts: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const ang = Math.PI / 2 + (i / N) * Math.PI * 2;
    pts.push(boundary(shape, bx, Math.cos(ang), Math.sin(ang), radius));
  }
  const cum = [0];
  for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const target = (((f % 1) + 1) % 1) * cum[N];
  let i = 1;
  while (i < N && cum[i] < target) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  const u = (target - cum[i - 1]) / seg;
  return {
    x: bx.cx + pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u,
    y: bx.cy + pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u,
  };
}

// Fractions du périmètre des sièges adverses selon la taille de la table
// (le mien est à 0, en bas). Réglées pour laisser le board dégagé.
export const SEAT_FRACTIONS: Record<number, number[]> = {
  1: [],
  2: [0.5],
  3: [0.36, 0.64],
  4: [0.2, 0.5, 0.8],
  5: [0.2, 0.4, 0.6, 0.8],
  6: [1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6],
  7: [0.15, 0.29, 0.425, 0.575, 0.71, 0.85],
  8: [0.15, 0.26, 0.38, 0.5, 0.62, 0.74, 0.85],
};

export interface Rect {
  l: number;
  r: number;
  t: number;
  b: number;
}
export const rectAt = (x: number, y: number, w: number, h: number): Rect => ({ l: x - w / 2, r: x + w / 2, t: y - h / 2, b: y + h / 2 });
export const overlapArea = (a: Rect, b: Rect) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

// Place des éléments (mises) entre chaque siège et le centre : positions
// candidates de plus en plus loin, puis décalées sur les côtés ; on garde
// la première qui ne touche aucun obstacle (à défaut, celle qui chevauche
// le moins). Chaque élément placé devient un obstacle pour les suivants.
export function placeToward(
  items: { key: string; from: { x: number; y: number } }[],
  center: { x: number; y: number },
  size: { w: number; h: number },
  obstacles: Rect[],
  bounds: Rect,
): Map<string, { x: number; y: number }> {
  const obs = [...obstacles];
  const placed = new Map<string, { x: number; y: number }>();
  for (const it of items) {
    const dx = center.x - it.from.x;
    const dy = center.y - it.from.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    let best: { x: number; y: number; cost: number } | null = null;
    search: for (let d = 30; d <= 220; d += 6) {
      for (const off of [0, 22, -22, 44, -44, 66, -66, 88, -88]) {
        const x = it.from.x + ux * d - uy * off;
        const y = it.from.y + uy * d + ux * off;
        const r = rectAt(x, y, size.w, size.h);
        if (r.l < bounds.l || r.r > bounds.r || r.t < bounds.t || r.b > bounds.b) continue;
        const cost = obs.reduce((s, o) => s + overlapArea(o, r), 0) + d * 0.01;
        if (!best || cost < best.cost) best = { x, y, cost };
        if (cost < 3) break search;
      }
    }
    const p = best ?? { x: it.from.x + ux * 60, y: it.from.y + uy * 60 };
    placed.set(it.key, p);
    obs.push(rectAt(p.x, p.y, size.w, size.h));
  }
  return placed;
}
