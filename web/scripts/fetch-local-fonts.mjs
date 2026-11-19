/**
 * 把 layout.tsx 用到的 Google Fonts 下载为本地 woff2（latin 子集），
 * 供 next/font/local 使用 —— 生产构建不再依赖 fonts.googleapis.com（国内常被断连）。
 * 走 fonts.loli.net / gstatic.loli.net 镜像（Google Fonts 官方 CSS 的国内镜像）。
 * 运行：node scripts/fetch-local-fonts.mjs   （输出 src/fonts/*.woff2 + manifest.json）
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "src", "fonts");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// 与 src/app/layout.tsx 的 next/font/google 配置一一对应（subsets: ["latin"]）
const SPECS = [
  { name: "dm-serif-display", query: "DM+Serif+Display", variable: false },
  { name: "ibm-plex-mono", query: "IBM+Plex+Mono:wght@400;500", variable: false },
  { name: "inter", query: "Inter:wght@100..900", variable: true },
  { name: "jetbrains-mono", query: "JetBrains+Mono:wght@400;500", variable: false },
  { name: "dm-sans", query: "DM+Sans:wght@100..1000", variable: true },
  { name: "poppins", query: "Poppins:wght@400;500;600", variable: false },
  { name: "fraunces", query: "Fraunces:wght@400..700", variable: true },
  { name: "newsreader", query: "Newsreader:wght@400..600", variable: true },
];

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

// 解析 CSS：只保留 latin 子集注释后的 @font-face 块
function latinFaces(css) {
  const faces = [];
  const re = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]+)\}/g;
  let m;
  while ((m = re.exec(css))) {
    if (m[1] !== "latin") continue;
    const body = m[2];
    const weight = /font-weight:\s*([^;]+);/.exec(body)?.[1].trim();
    const style = /font-style:\s*([^;]+);/.exec(body)?.[1].trim();
    const url = /url\((https:[^)]+\.woff2)\)/.exec(body)?.[1];
    if (!weight || !url) throw new Error("无法解析 @font-face: " + body);
    faces.push({ weight, style: style ?? "normal", url });
  }
  return faces;
}

await mkdir(outDir, { recursive: true });
const manifest = [];
for (const spec of SPECS) {
  const css = await fetchText(`https://fonts.loli.net/css2?family=${spec.query}&display=swap`);
  const faces = latinFaces(css);
  if (faces.length === 0) throw new Error(`${spec.name}: 未找到 latin 子集`);
  const files = [];
  for (const face of faces) {
    const weightTag = face.weight.replace(/\s+/g, "-");
    const file = `${spec.name}-${weightTag}${face.style === "italic" ? "-italic" : ""}.woff2`;
    const buf = Buffer.from(await (await fetch(face.url, { headers: { "User-Agent": UA } })).arrayBuffer());
    if (buf.length < 1000) throw new Error(`${file} 下载异常（${buf.length}B）`);
    await writeFile(path.join(outDir, file), buf);
    files.push({ file, weight: face.weight, style: face.style });
    console.log(`OK ${file} (${(buf.length / 1024).toFixed(1)}KB)`);
  }
  manifest.push({ name: spec.name, variable: spec.variable, files });
}
await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`完成：${manifest.length} 族 → src/fonts/（manifest.json）`);