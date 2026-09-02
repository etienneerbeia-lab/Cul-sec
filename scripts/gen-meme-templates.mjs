import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(__dirname, "..", "src", "lib", "meme", "templates.ts");

const res = await fetch("https://api.imgflip.com/get_memes");
const data = await res.json();
if (!data.success) throw new Error("Imgflip API returned success:false");

const memes = data.data.memes;
const lines = memes.map(
  (m) => `  { id: "${m.id}", url: "${m.url}", width: ${m.width}, height: ${m.height} },`
);

const content = `import type { MemeTemplate } from "./types";

// Popular blank meme templates from Imgflip's public, keyless get_memes
// endpoint (https://api.imgflip.com/get_memes) — no text baked in, exactly
// what a caption-writing game needs. Hotlinked directly from Imgflip's own
// CDN, no hosting or API key required. Re-run \`node scripts/gen-meme-templates.mjs\`
// any time to refresh/grow this list.
export const MEME_TEMPLATES: MemeTemplate[] = [
${lines.join("\n")}
];
`;

writeFileSync(outFile, content);
console.log(`wrote ${memes.length} templates to ${outFile}`);
