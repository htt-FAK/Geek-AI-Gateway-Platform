// 用本网关 deepseek-ocr 转录用户提供的榜单参考图（一次性工具脚本）
import { readFileSync, writeFileSync } from "node:fs";

const imagePath = process.argv[2];
const outPath = process.argv[3];
if (!imagePath) throw new Error("usage: node ocr-leaderboard.mjs <image> [out.txt]");

const envText = readFileSync(new URL("../gateway/.env", import.meta.url), "utf8");
const master = envText.match(/^LITELLM_MASTER_KEY=(.*)$/m)?.[1]?.trim().replace(/^"|"$/g, "");
if (!master) throw new Error("LITELLM_MASTER_KEY not found");

const b64 = readFileSync(imagePath).toString("base64");
const ext = imagePath.toLowerCase().endsWith(".png") ? "png" : "jpeg";

const prompt =
  process.argv[4] ??
  "请完整转录这张模型排行榜图片中的所有内容：标题、每一列的列名、每一行的模型名称与全部数值（智能指数、速度、延迟、价格、成本等，有什么列就转录什么列）、以及图例/脚注/注释文字。按图中从上到下的顺序逐行输出为 Markdown 表格，数字务必精确，不要遗漏任何一行。";

const res = await fetch("http://127.0.0.1:4000/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${master}` },
  body: JSON.stringify({
    model: process.env.OCR_MODEL ?? "deepseek-ocr",
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/${ext};base64,${b64}` } },
          { type: "text", text: prompt },
        ],
      },
    ],
    max_tokens: 8000,
  }),
  signal: AbortSignal.timeout(180000),
});
const json = await res.json();
if (!res.ok) {
  console.error("HTTP", res.status, JSON.stringify(json).slice(0, 800));
  process.exit(1);
}
const text = json.choices?.[0]?.message?.content ?? "(empty)";
if (outPath) writeFileSync(outPath, text, "utf8");
console.log(text);