/**
 * Generate entry background only.
 *   $env:AIGW_IMAGE_API_KEY="..."
 *   node scripts/generate-entry-bg.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "../public/brand/entry-bg.jpg");
const key = process.env.AIGW_IMAGE_API_KEY;
const baseURL = (process.env.AIGW_IMAGE_BASE_URL || "https://aigw.finloopai.ai/v1").replace(/\/$/, "");

if (!key) {
  console.error("Missing AIGW_IMAGE_API_KEY");
  process.exit(1);
}

const prompt = [
  "Cinematic ultra-wide background for a premium dark login page,",
  "deep charcoal and ink black, subtle cool steel-teal rim light from the left,",
  "soft volumetric haze and gentle light falloff, fine film grain,",
  "quiet architectural atmosphere like a high-end research portal,",
  "elegant and restrained, luxurious empty space,",
  "NO text, NO people, NO logo, NO purple neon, NO rainbow glow, NO particle explosion,",
  "photoreal subtle lighting, 16:9 composition",
].join(" ");

const res = await fetch(`${baseURL}/images/generations`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-image-2",
    prompt,
    n: 1,
    size: "1536x1024",
  }),
});

const text = await res.text();
if (!res.ok) {
  console.error(res.status, text.slice(0, 500));
  process.exit(1);
}

const data = JSON.parse(text);
const item = data.data?.[0];
fs.mkdirSync(path.dirname(out), { recursive: true });

if (item?.b64_json) {
  fs.writeFileSync(out, Buffer.from(item.b64_json, "base64"));
} else if (item?.url) {
  const img = await fetch(item.url);
  fs.writeFileSync(out, Buffer.from(await img.arrayBuffer()));
} else {
  console.error("no image payload");
  process.exit(1);
}

console.log("wrote", out);
