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

  <g transform="translate(56,56) scale(2.5)">
    <g transform="rotate(-10 64 70)">
      <rect x="26" y="18" width="76" height="104" rx="10" fill="#f4ecd8" stroke="#e0568c" stroke-width="3.5"/>
      <text x="40" y="42" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="20" fill="#8b2635">&#9824;</text>
    </g>
    <g transform="rotate(8 84 78)">
      <rect x="46" y="26" width="76" height="104" rx="10" fill="#f4ecd8" stroke="#e0568c" stroke-width="3.5"/>
      <path d="M68 52 L100 52 L91 118 Q90 124 84 124 Q78 124 77 118 Z" fill="none" stroke="#e0568c" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M72 64 L96 64 L89 112 Q88 116 84 116 Q80 116 79 112 Z" fill="#8b2635"/>
    </g>
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
