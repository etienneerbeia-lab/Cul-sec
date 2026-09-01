import sharp from "sharp";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
mkdirSync(publicDir, { recursive: true });

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#170f2e"/>
  <rect x="0" y="0" width="512" height="512" fill="url(#g)"/>
  <defs>
    <radialGradient id="g" cx="50%" cy="10%" r="80%">
      <stop offset="0%" stop-color="#3a2361"/>
      <stop offset="55%" stop-color="#241a44"/>
      <stop offset="100%" stop-color="#170f2e"/>
    </radialGradient>
  </defs>

  <g transform="translate(38,172) scale(1.55)">
    <path d="M32 24 L88 24 L78 96 Q76 108 60 108 Q44 108 42 96 Z" fill="none" stroke="#e0568c" stroke-width="4.5" stroke-linejoin="round"/>
    <path d="M38 40 L82 40 L76 90 Q75 98 60 98 Q45 98 44 90 Z" fill="#e0568c" opacity="0.2"/>
    <line x1="45" y1="56" x2="75" y2="56" stroke="#e0568c" stroke-width="3.5" opacity="0.55"/>
  </g>

  <g transform="translate(254,154) scale(1.55)">
    <rect x="22" y="14" width="70" height="98" rx="10" fill="#f4ecd8" stroke="#e0568c" stroke-width="4" transform="rotate(-8 57 63)"/>
    <rect x="38" y="22" width="70" height="98" rx="10" fill="#f4ecd8" stroke="#e0568c" stroke-width="4" transform="rotate(6 73 71)"/>
    <text x="73" y="80" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="46" fill="#8b2635" text-anchor="middle" transform="rotate(6 73 71)">&#9824;</text>
  </g>
</svg>
`;

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

for (const t of targets) {
  await sharp(Buffer.from(svg))
    .resize(t.size, t.size)
    .png()
    .toFile(path.join(publicDir, t.file));
  console.log("wrote", t.file);
}
