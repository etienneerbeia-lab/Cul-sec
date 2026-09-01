import sharp from "sharp";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
mkdirSync(publicDir, { recursive: true });

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#1c3b2e"/>
  <rect x="0" y="0" width="512" height="512" fill="url(#g)"/>
  <defs>
    <radialGradient id="g" cx="50%" cy="10%" r="80%">
      <stop offset="0%" stop-color="#24493a"/>
      <stop offset="55%" stop-color="#1c3b2e"/>
      <stop offset="100%" stop-color="#142c22"/>
    </radialGradient>
  </defs>
  <rect x="146" y="88" width="220" height="336" rx="26" fill="#f4ecd8" stroke="#c9a24b" stroke-width="10"/>
  <text x="256" y="222" font-family="Georgia, 'Times New Roman', serif" font-size="72" font-weight="700" fill="#8b2635" text-anchor="middle">A♥</text>
  <text x="256" y="330" font-family="Georgia, 'Times New Roman', serif" font-size="140" fill="#8b2635" text-anchor="middle">♥</text>
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
