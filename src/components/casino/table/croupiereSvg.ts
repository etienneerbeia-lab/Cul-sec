import type { CroupierLook } from "@/lib/dealer/croupiers";

// Croupière « Rubis » (dessin vectoriel) : robe rouge en satin, décolleté en
// V croisé, bijoux dorés, longs cheveux ondulés. viewBox 300×300 ; le bord
// de la table passe à y≈270 : le corps est dessiné derrière la table, les
// mains et les cartes devant. Le SVG est produit en texte (aucune donnée
// venant des joueurs n'y entre). Classes pour les animations : .cr-eyes
// (clignement), .cr-deal (geste de distribution).

interface Look {
  skin: [string, string];
  shade: string;
  hair: [string, string];
  hairHi: string;
  iris: [string, string];
  brows: string;
  lids: string;
}

const LOOKS: Record<CroupierLook, Look> = {
  brune: {
    skin: ["#f4d3bf", "#e2b195"],
    shade: "#c98f71",
    hair: ["#3a2216", "#1c0f09"],
    hairHi: "#8a5432",
    iris: ["#7a5a2a", "#3e2a12"],
    brows: "#2a1810",
    lids: "#a8674f",
  },
  blonde: {
    skin: ["#f6dccb", "#e8bca2"],
    shade: "#d29c80",
    hair: ["#e8c477", "#b48336"],
    hairHi: "#fff0b8",
    iris: ["#4f8fbf", "#1f4f7a"],
    brows: "#8a6431",
    lids: "#b47a6a",
  },
  metisse: {
    skin: ["#a8704c", "#86533a"],
    shade: "#6a3c26",
    hair: ["#2b1a12", "#120a06"],
    hairHi: "#7a4a2e",
    iris: ["#5a3a1c", "#2a170a"],
    brows: "#160c08",
    lids: "#7a3a3a",
  },
};

const RED = ["#e8304b", "#b4142d", "#6e0818"];
const GOLD = ["#f7dc8a", "#c9973a"];

function defs(L: Look, id: string) {
  return `<defs>
    <linearGradient id="${id}-skin" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="${L.skin[0]}"/><stop offset="1" stop-color="${L.skin[1]}"/></linearGradient>
    <radialGradient id="${id}-face" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="${L.skin[0]}"/><stop offset="0.75" stop-color="${L.skin[0]}"/><stop offset="1" stop-color="${L.skin[1]}"/></radialGradient>
    <linearGradient id="${id}-hair" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${L.hair[0]}"/><stop offset="1" stop-color="${L.hair[1]}"/></linearGradient>
    <linearGradient id="${id}-dress" x1="0.1" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="${RED[0]}"/><stop offset="0.45" stop-color="${RED[1]}"/><stop offset="1" stop-color="${RED[2]}"/></linearGradient>
    <linearGradient id="${id}-satin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#ffd6dc" stop-opacity="0.45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id}-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${GOLD[0]}"/><stop offset="1" stop-color="${GOLD[1]}"/></linearGradient>
    <radialGradient id="${id}-iris" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="${L.iris[0]}"/><stop offset="1" stop-color="${L.iris[1]}"/></radialGradient>
    <radialGradient id="${id}-blush"><stop offset="0" stop-color="#ff6f86" stop-opacity="0.32"/><stop offset="1" stop-color="#ff6f86" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}-lips" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d42a44"/><stop offset="1" stop-color="#9c1027"/></linearGradient>
  </defs>`;
}

// Cheveux derrière la tête et les épaules : longues ondulations.
function hairBack(L: Look, id: string) {
  return `<path d="M112 72 C 98 104, 104 132, 92 160 C 84 178, 92 192, 84 210 C 78 224, 86 236, 98 240
      C 104 226, 112 214, 114 196 L 186 196 C 188 214, 196 226, 202 240 C 214 236, 222 224, 216 210
      C 208 192, 216 178, 208 160 C 196 132, 202 104, 188 72 Z" fill="url(#${id}-hair)"/>
    <path d="M96 170 C 92 188, 98 204, 92 222" stroke="${L.hairHi}" stroke-width="2.4" fill="none" opacity="0.55" stroke-linecap="round"/>
    <path d="M206 168 C 210 186, 204 204, 210 222" stroke="${L.hairHi}" stroke-width="2.4" fill="none" opacity="0.55" stroke-linecap="round"/>`;
}

// Cheveux de devant : raie sur le côté, frange balayée, côté gauche derrière
// l'oreille, mèche ondulée sur l'épaule droite (par-dessus la robe).
function hairFront(L: Look, id: string) {
  return `<path d="M118 100 C 112 64, 128 44, 150 43 C 176 42, 194 62, 186 104 C 184 92, 180 82, 172 74
      C 162 84, 146 86, 134 80 C 128 78, 124 76, 122 74 C 119 82, 118 90, 118 100 Z" fill="url(#${id}-hair)"/>
    <path d="M134 50 C 150 46, 170 52, 180 68 C 168 62, 152 60, 138 64 Z" fill="${L.hairHi}" opacity="0.35"/>
    <path d="M140 60 C 154 54, 170 58, 178 72" stroke="${L.hairHi}" stroke-width="1.6" fill="none" opacity="0.55"/>
    <path d="M182 92 C 192 112, 190 132, 196 150 C 202 168, 192 184, 200 200 C 206 214, 198 228, 190 236
      C 186 224, 190 212, 184 198 C 178 184, 186 170, 180 152 C 176 136, 176 118, 176 98 Z" fill="url(#${id}-hair)"/>
    <path d="M186 116 C 188 134, 186 150, 192 166 M188 182 C 192 196, 190 210, 192 222" stroke="${L.hairHi}" stroke-width="1.8" fill="none" opacity="0.6" stroke-linecap="round"/>`;
}

function face(L: Look, id: string) {
  const eye = (cx: number, side: number) => {
    const o = (dx: number) => cx + side * dx; // côté extérieur = +dx
    const cid = `${id}-eye${side > 0 ? "R" : "L"}`;
    const shape = `M${o(-10)} 99 C ${o(-5)} 93, ${o(5)} 92.2, ${o(10.5)} 97.4 C ${o(5)} 101.8, ${o(-4)} 102.6, ${o(-10)} 99 Z`;
    return `
      <clipPath id="${cid}"><path d="${shape}"/></clipPath>
      <path d="${shape}" fill="#fdf9f6"/>
      <g clip-path="url(#${cid})">
        <circle cx="${o(0.2)}" cy="97" r="4.9" fill="url(#${id}-iris)"/>
        <circle cx="${o(0.2)}" cy="97" r="4.9" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="0.5"/>
        <circle cx="${o(0.2)}" cy="97" r="2.2" fill="#0b0708"/>
        <circle cx="${o(-1.6)}" cy="95.6" r="1.3" fill="#fff"/>
        <path d="${shape}" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="2.4"/>
      </g>
      <path d="M${o(-10.5)} 98.8 C ${o(-5)} 92.2, ${o(5)} 91.4, ${o(10.8)} 97 L ${o(13)} 95" stroke="#1a0f12" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M${o(-8)} 90.6 C ${o(-3)} 87, ${o(5)} 86.8, ${o(10)} 90.8" stroke="${L.shade}" stroke-width="0.9" fill="none" opacity="0.6"/>
      <path d="M${o(-7)} 101.6 C ${o(-2)} 103.8, ${o(5)} 103.4, ${o(9)} 100.2" stroke="${L.shade}" stroke-width="0.7" fill="none" opacity="0.7"/>`;
  };
  const brow = (cx: number, side: number) => {
    const o = (dx: number) => cx + side * dx;
    return `<path d="M${o(-10)} 85.6 C ${o(-4)} 82, ${o(4)} 80.6, ${o(12)} 83.8 C ${o(4)} 82.2, ${o(-3)} 83.2, ${o(-10)} 86.8 Z" fill="${L.brows}"/>`;
  };
  return `
    <ellipse cx="135" cy="93.5" rx="11.5" ry="5" fill="${L.lids}" opacity="0.32"/>
    <ellipse cx="165" cy="93.5" rx="11.5" ry="5" fill="${L.lids}" opacity="0.32"/>
    <ellipse cx="129" cy="112" rx="10" ry="6.5" fill="url(#${id}-blush)"/>
    <ellipse cx="171" cy="112" rx="10" ry="6.5" fill="url(#${id}-blush)"/>
    <path d="M124 108 C 126 104, 132 104, 136 106" stroke="#fff" stroke-width="2" fill="none" opacity="0.2" stroke-linecap="round"/>
    <path d="M176 108 C 174 104, 168 104, 164 106" stroke="#fff" stroke-width="2" fill="none" opacity="0.2" stroke-linecap="round"/>
    <g class="cr-eyes">${eye(136, -1)}${eye(164, 1)}</g>
    ${brow(136, -1)}
    ${brow(164, 1)}
    <path d="M152.5 100 C 152 106, 154 111, 155 114" stroke="${L.shade}" stroke-width="1.2" fill="none" opacity="0.55" stroke-linecap="round"/>
    <path d="M146 115.4 C 148 117.6, 152 117.6, 154 115.4" stroke="${L.shade}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <path d="M149 103 L 149 112" stroke="#fff" stroke-width="1.4" opacity="0.18" stroke-linecap="round"/>
    <path d="M141 124.6 C 143.8 121.4, 147 120.8, 150 122.8 C 153 120.8, 156.2 121.4, 159 124.6 C 153 127, 147 127, 141 124.6 Z" fill="url(#${id}-lips)"/>
    <path d="M141.3 124.9 C 144 131.4, 156 131.4, 158.7 124.9 C 153 127.2, 147 127.2, 141.3 124.9 Z" fill="url(#${id}-lips)"/>
    <path d="M139.4 123.4 C 140 124.6, 140.8 125.2, 141.8 125.2 M160.6 123.4 C 160 124.6, 159.2 125.2, 158.2 125.2" stroke="#8a1a28" stroke-width="0.8" fill="none" stroke-linecap="round" opacity="0.8"/>
    <path d="M145.5 128.4 C 148 129.6, 152 129.6, 154.5 128.4" stroke="#fff" stroke-width="1.1" fill="none" opacity="0.55" stroke-linecap="round"/>
    <path d="M147 123.6 C 148.5 123, 149.5 123.4, 150 124" stroke="#fff" stroke-width="0.7" fill="none" opacity="0.4"/>`;
}

function body(L: Look, id: string) {
  // Robe : épaules, taille marquée ; décolleté en V croisé (portefeuille).
  const dress = `M100 170 C 88 172, 82 178, 80 190 C 80 214, 86 250, 92 300 L 208 300 C 214 250, 220 214, 220 190
    C 218 178, 212 172, 200 170 L 180 170 L 150 206 L 120 170 Z`;
  const arm = (side: number) => {
    const x = (dx: number) => 150 + side * dx;
    return `<path d="M${x(-70)} 180 C ${x(-82)} 190, ${x(-85)} 220, ${x(-84)} 250 C ${x(-84)} 266, ${x(-74)} 278, ${x(-60)} 286 L ${x(-46)} 276
        C ${x(-58)} 268, ${x(-64)} 258, ${x(-64)} 242 C ${x(-64)} 220, ${x(-62)} 200, ${x(-60)} 190 Z" fill="url(#${id}-dress)"/>
      <path d="M${x(-64)} 196 C ${x(-66)} 220, ${x(-66)} 240, ${x(-62)} 258" stroke="rgba(60,0,10,0.45)" stroke-width="1.4" fill="none"/>
      <path d="M${x(-79)} 200 C ${x(-81)} 220, ${x(-81)} 238, ${x(-77)} 254" stroke="#ffd6dc" stroke-opacity="0.35" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  };
  return `
    ${hairBack(L, id)}
    <path d="M139 120 L 139 156 C 130 162, 118 166, 104 170 L 196 170 C 182 166, 170 162, 161 156 L 161 120 Z" fill="url(#${id}-skin)"/>
    <path d="M120 170 L 180 170 L 150 207 Z" fill="url(#${id}-skin)"/>
    <path d="M139 138 Q 150 150 161 138 L 161 150 Q 150 160 139 150 Z" fill="${L.shade}" opacity="0.45"/>
    <path d="M124 173 C 132 176, 140 178, 146 178 M176 173 C 168 176, 160 178, 154 178" stroke="${L.shade}" stroke-width="1" fill="none" opacity="0.55" stroke-linecap="round"/>
    <path d="M138 158 C 142 170, 146 176, 150 179 C 154 176, 158 170, 162 158" stroke="url(#${id}-gold)" stroke-width="1" fill="none"/>
    <path d="M150 179 L 147.6 182.6 L 150 186.6 L 152.4 182.6 Z" fill="#c4122f" stroke="url(#${id}-gold)" stroke-width="0.8"/>
    <path d="${dress}" fill="url(#${id}-dress)"/>
    <path d="M180 170 L 150 206 L 156 214 C 166 198, 178 184, 192 172 Z" fill="${RED[1]}"/>
    <path d="M120 170 L 150 206 L 162 222 C 150 214, 134 196, 108 172 Z" fill="${RED[0]}"/>
    <path d="M120 170 L 150 206" stroke="#ff9aa8" stroke-width="1" opacity="0.6"/>
    <path d="M180 170 L 150 206" stroke="#ff9aa8" stroke-width="1" opacity="0.45"/>
    <path d="M156 214 C 170 226, 186 232, 204 234" stroke="rgba(70,0,12,0.45)" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M160 222 C 172 236, 186 244, 206 248" stroke="rgba(70,0,12,0.35)" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M150 222 C 140 232, 124 240, 98 244" stroke="rgba(70,0,12,0.35)" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M158 216 C 172 228, 188 236, 204 238" stroke="#ffd6dc" stroke-opacity="0.25" stroke-width="1.2" fill="none"/>
    <path d="M96 182 C 104 176, 112 174, 118 176" stroke="#ffd6dc" stroke-opacity="0.45" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M204 182 C 196 176, 188 174, 182 176" stroke="#ffd6dc" stroke-opacity="0.3" stroke-width="3" fill="none" stroke-linecap="round"/>
    <g transform="translate(110 194) rotate(6)">
      <rect x="-12" y="-4.4" width="24" height="8.8" rx="2.4" fill="url(#${id}-gold)"/>
      <text x="0" y="2.2" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="5.2" fill="#3a2200">CUL·SEC</text>
    </g>
    ${arm(-1)}${arm(1)}
    <ellipse cx="117.5" cy="101" rx="4.6" ry="8" fill="${L.skin[1]}"/>
    <path d="M117.5 108 L 117.5 116" stroke="url(#${id}-gold)" stroke-width="1"/>
    <circle cx="117.5" cy="118.6" r="2.6" fill="#c4122f" stroke="url(#${id}-gold)" stroke-width="0.9"/>
    <path d="M150 52 C 173 52, 183 70, 182 94 C 181 114, 170 132, 150 139 C 130 132, 119 114, 118 94 C 117 70, 127 52, 150 52 Z" fill="url(#${id}-face)"/>
    <path d="M120 106 C 124 124, 136 135, 150 139 C 140 132, 130 122, 126 106 Z" fill="${L.shade}" opacity="0.28"/>
    <path d="M180 106 C 176 124, 164 135, 150 139 C 160 132, 170 122, 174 106 Z" fill="${L.shade}" opacity="0.18"/>
    ${face(L, id)}
    ${hairFront(L, id)}`;
}

function hands(L: Look, id: string) {
  const back = (x: number, y: number, r: number, w = 26) => {
    const h = w * 1.4;
    return `<g transform="translate(${x} ${y}) rotate(${r})">
      <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="3" fill="#f7f1e6" stroke="rgba(0,0,0,0.25)" stroke-width="0.6"/>
      <rect x="${-w / 2 + 2.6}" y="${-h / 2 + 2.6}" width="${w - 5.2}" height="${h - 5.2}" rx="2" fill="#7d1426"/>
      <rect x="${-w / 2 + 5}" y="${-h / 2 + 5}" width="${w - 10}" height="${h - 10}" rx="1.5" fill="none" stroke="rgba(255,236,205,0.7)" stroke-width="1"/>
    </g>`;
  };
  const skin = `url(#${id}-skin)`;
  const bracelet = (x: number, y: number, r: number) =>
    `<rect x="${x - 10}" y="${y - 2}" width="20" height="4" rx="2" fill="url(#${id}-gold)" transform="rotate(${r} ${x} ${y})"/>`;
  return `
    <path d="M86 282 C 82 290, 86 298, 96 299 L 112 298 C 116 297, 116 292, 112 291 L 100 290 C 98 286, 94 280, 86 282 Z" fill="${skin}"/>
    <ellipse cx="114.4" cy="294.6" rx="2" ry="1.6" fill="#c4122f"/>
    ${back(108, 284, -8)}${back(109.5, 282.5, -8)}${back(111, 281, -8)}
    <path d="M94 276 C 98 272, 106 272, 112 276 C 114 278, 112 281, 108 280 C 104 279, 100 280, 97 282 Z" fill="${skin}"/>
    <ellipse cx="111.6" cy="277.6" rx="1.8" ry="1.4" fill="#c4122f"/>
    ${bracelet(96.5, 281.5, -35.5)}
    <g class="cr-deal">
    ${back(198, 290, 14)}
    <path d="M216 270 C 208 266, 200 270, 198 276 C 197 280, 200 282, 204 281 L 206 280 C 205 284, 206 287, 210 287 C 216 287, 220 281, 220 276 C 220 273, 219 271, 216 270 Z" fill="${skin}"/>
    <path d="M199 276 C 196 278, 194 282, 196 284 C 198 285, 201 282, 202 279 Z" fill="${skin}"/>
    <ellipse cx="196.4" cy="283" rx="1.6" ry="1.3" fill="#c4122f"/>
    <path d="M205 280 L 213 279 M206 283.5 L 213 283" stroke="${L.shade}" stroke-width="0.8" opacity="0.7"/>
    ${bracelet(203.5, 281.5, 35.5)}
    </g>`;
}

export type CroupiereLayer = "all" | "body" | "hands";

// SVG complet (texte). `viewBox` : recadrage (ex. le visage pour l'avatar).
export function croupiereSvg(look: CroupierLook, layer: CroupiereLayer, id: string, viewBox = "0 0 300 300"): string {
  const L = LOOKS[look];
  const inner = layer === "hands" ? hands(L, id) : layer === "body" ? body(L, id) : body(L, id) + hands(L, id);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%" aria-hidden="true">${defs(L, id)}${inner}</svg>`;
}
