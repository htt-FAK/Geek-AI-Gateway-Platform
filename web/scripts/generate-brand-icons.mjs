/**
 * Generate brand icons via OpenAI-compatible images API.
 * Usage:
 *   set AIGW_IMAGE_API_KEY=...   (never commit the key)
 *   set AIGW_IMAGE_BASE_URL=https://aigw.finloopai.ai/v1   (optional)
 *   node scripts/generate-brand-icons.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/icons");
const key = process.env.AIGW_IMAGE_API_KEY;
const baseURL = (process.env.AIGW_IMAGE_BASE_URL || "https://aigw.finloopai.ai/v1").replace(/\/$/, "");

if (!key) {
  console.error("Missing AIGW_IMAGE_API_KEY in environment. Aborting (key must not be hardcoded).");
  process.exit(1);
}

const jobs = [
  {
    file: "mark.png",
    prompt:
      "Minimal app logo mark, geometric diamond rotated square with a small gap, single-color white line icon on pure black background, Lucide style thin stroke, no text, no glow, no gradients, square composition, favicon suitable",
  },
  {
    file: "nav-playground.png",
    prompt:
      "Minimal UI icon: terminal or code brackets for AI playground, white thin line icon on pure black, Lucide style, no text, no fill, square, 24px friendly",
  },
  {
    file: "nav-dashboard.png",
    prompt:
      "Minimal UI icon: simple bar chart for analytics dashboard, white thin line icon on pure black, Lucide style, no text, square",
  },
  {
    file: "nav-models.png",
    prompt:
      "Minimal UI icon: stacked layers or cubes for AI models list, white thin line icon on pure black, Lucide style, no text, square",
  },
  {
    file: "nav-keys.png",
    prompt:
      "Minimal UI icon: key outline for API keys, white thin line icon on pure black, Lucide style, no text, square",
  },
];

async function generateOne(job) {
  const res = await fetch(`${baseURL}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt: job.prompt,
      n: 1,
      size: "1024x1024",
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${job.file}: ${res.status} ${text.slice(0, 400)}`);
  }
  const data = JSON.parse(text);
  const item = data.data?.[0];
  if (!item) throw new Error(`${job.file}: empty data`);

  fs.mkdirSync(outDir, { recursive: true });
  const dest = path.join(outDir, job.file);

  if (item.b64_json) {
    fs.writeFileSync(dest, Buffer.from(item.b64_json, "base64"));
    console.log("wrote", dest, "(b64)");
    return;
  }
  if (item.url) {
    const img = await fetch(item.url);
    if (!img.ok) throw new Error(`${job.file}: download ${img.status}`);
    const buf = Buffer.from(await img.arrayBuffer());
    fs.writeFileSync(dest, buf);
    console.log("wrote", dest, "(url)");
    return;
  }
  throw new Error(`${job.file}: no url or b64_json`);
}

async function main() {
  for (const job of jobs) {
    try {
      await generateOne(job);
    } catch (e) {
      console.error(String(e));
      process.exitCode = 1;
    }
  }
}

main();
