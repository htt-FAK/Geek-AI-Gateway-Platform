/**
 * Generate a brighter premium entry background (tech atmospheric).
 *   $env:AIGW_IMAGE_API_KEY="..."
 *   node scripts/generate-entry-bg-v2.mjs
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
  "Ultra-wide cinematic background for a premium AI gateway login,",
  "dark navy-charcoal scene with CLEAR visible atmosphere: soft steel-cyan light beams,",
  "subtle geometric glass planes and faint horizon glow,",
  "luxurious depth of field, gentle mist, fine film grain,",
  "modern infrastructure mood like Hermes research portal,",
  "more midtone detail than pure black, elegant and cool,",
  "NO text, NO people, NO logo, NO purple neon blobs, NO cartoon,",
  "photoreal cinematic lighting, 16:9",
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
