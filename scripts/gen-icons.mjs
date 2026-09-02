import sharp from "sharp";
import { mkdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const appDir = path.join(__dirname, "..", "src", "app");
mkdirSync(publicDir, { recursive: true });

// Builds a valid .ico by embedding full PNG files per entry (supported by
// every modern browser and Windows Vista+) — avoids needing a real BMP/ICO
// encoder just to ship a favicon.
function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6 + 16 * count;
  let offset = headerSize;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  pngBuffers.forEach(({ size, data }, i) => {
    const entryOffset = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset + 0); // width
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1); // height
    header.writeUInt8(0, entryOffset + 2); // color count
    header.writeUInt8(0, entryOffset + 3); // reserved
    header.writeUInt16LE(1, entryOffset + 4); // planes
    header.writeUInt16LE(32, entryOffset + 6); // bit count
    header.writeUInt32LE(data.length, entryOffset + 8); // size of image data
    header.writeUInt32LE(offset, entryOffset + 12); // offset
    offset += data.length;
  });

  return Buffer.concat([header, ...pngBuffers.map((p) => p.data)]);
}

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
      <text x="51" y="44" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="15" fill="#8b2635">C</text>
      <path d="M68 52 L100 52 L91 118 Q90 124 84 124 Q78 124 77 118 Z" fill="none" stroke="#e0568c" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M72 64 L96 64 L89 112 Q88 116 84 116 Q80 116 79 112 Z" fill="#8b2635" opacity="0.93"/>
      <ellipse cx="84" cy="64" rx="12" ry="1.5" fill="#b23347" opacity="0.7"/>
      <path d="M74 58 L70 104" stroke="#f4ecd8" stroke-width="1.3" stroke-linecap="round" opacity="0.3"/>
      <g transform="rotate(180 84 78)">
        <text x="51" y="44" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="15" fill="#8b2635">S</text>
      </g>
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

// app/favicon.ico is the Next.js App Router special file that actually
// drives the browser tab icon — separate from the public/ PWA icons above,
// easy to forget. 16 and 32px, matching what browsers actually request.
const faviconSizes = [16, 32];
const faviconPngs = [];
for (const size of faviconSizes) {
  const data = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  faviconPngs.push({ size, data });
}
writeFileSync(path.join(appDir, "favicon.ico"), buildIco(faviconPngs));
console.log("wrote src/app/favicon.ico");
