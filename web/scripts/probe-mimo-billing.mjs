/**
 * P1-4 诊断：MiMo ±8% 计费口径差定位。
 * 同一 prompt 分别直连上游（api.xiaomimimo.com）与走网关，对比：
 *   上游 usage tokens / 网关 usage tokens / 网关实际入账 cost / 按价目表手算 cost。
 * 运行：node scripts/probe-mimo-billing.mjs   （约 6 次真实调用，费用 < ¥0.02）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function readEnv(p) {
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const gwEnv = readEnv(path.join(root, "..", "gateway", ".env"));
const webEnv = readEnv(path.join(root, ".env"));
const MASTER = webEnv.LITELLM_MASTER_KEY;
const MIMO_KEY = gwEnv.MIMO_API_KEY;
const GW = (webEnv.GATEWAY_BASE_URL || "http://127.0.0.1:4000").replace(/\/v1$/, "");
const UPSTREAM = "https://api.xiaomimimo.com/v1";
// ¥/M tokens（与 gateway/config.yaml 一致）
const PRICES = { "mimo-v2.6-flash": [1, 2], "mimo-v2.6-pro": [3, 6] };

const PROMPT = "9.11 和 9.9 哪个更大？只回答数字。";

async function chat(base, key, model, stream) {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model, messages: [{ role: "user", content: PROMPT }], max_tokens: 300, stream,
      // 流式必须显式要 usage，否则上游/网关都不回 usage 块
      ...(stream ? { stream_options: { include_usage: true } } : {}),
    }),
  });
  const requestId = res.headers.get("x-litellm-request-id");
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  if (!stream) {
    const json = await res.json();
    // 网关非流式回包顶层带 response_cost（直连上游没有此字段）
    return { usage: json.usage, requestId, cost: json.usage?.cost ?? json.response_cost };
  }
  // 流式：读到最后一条带 usage 的 data 块
  const text = await res.text();
  let usage = null;
  let cost;
  for (const line of text.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (payload === "[DONE]") continue;
    try {
      const j = JSON.parse(payload);
      if (j.usage) { usage = j.usage; cost = j.usage.cost ?? j.response_cost ?? cost; }
    } catch {}
  }
  return { usage, requestId, cost };
}

async function spendLog(requestId) {
  if (!requestId) return null;
  const res = await fetch(`${GW}/spend/logs?request_id=${encodeURIComponent(requestId)}`, {
    headers: { Authorization: `Bearer ${MASTER}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

const fmt = (u) => u ? `in=${u.prompt_tokens} out=${u.completion_tokens}` +
  (u.completion_tokens_details?.reasoning_tokens != null ? ` reason=${u.completion_tokens_details.reasoning_tokens}` : "") +
  (u.prompt_tokens_details?.cached_tokens ? ` cached=${u.prompt_tokens_details.cached_tokens}` : "") : "null";

// 缓存假设验证：长 prompt 连打两次，第二次应命中上游隐式缓存（cached_tokens > 0），
// 入账按缓存价折扣 → 与「忽略缓存的手算」出现负偏差（即审计里观察到的 ±8% 来源）。
const CACHE_PRICES = { "mimo-v2.6-flash": 0.02, "mimo-v2.6-pro": 0.025 }; // ¥/M 缓存命中输入
const longPrompt = "计费缓存探针文本。".repeat(120) + "只回复 ok";
for (const model of Object.keys(PRICES)) {
  const [pi, po] = PRICES[model];
  const pc = CACHE_PRICES[model];
  console.log(`\n=== 缓存探针 ${model} ===`);
  for (let i = 1; i <= 2; i++) {
    const res = await fetch(`${GW}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${MASTER}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: longPrompt }], max_tokens: 60, stream: true, stream_options: { include_usage: true } }),
    });
    const text = await res.text();
    let usage = null, cost;
    for (const line of text.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const p = line.slice(5).trim();
      if (p === "[DONE]") continue;
      try { const j = JSON.parse(p); if (j.usage) { usage = j.usage; cost = j.usage.cost ?? cost; } } catch {}
    }
    const cached = usage?.prompt_tokens_details?.cached_tokens ?? 0;
    const naive = usage ? (usage.prompt_tokens * pi + usage.completion_tokens * po) / 1e6 : NaN;
    const withCache = usage ? ((usage.prompt_tokens - cached) * pi + cached * pc + usage.completion_tokens * po) / 1e6 : NaN;
    console.log(`  第${i}次: ${fmt(usage)} cost=${cost ?? "无"}`);
    console.log(`    忽略缓存手算 ¥${naive.toFixed(6)} | 含缓存折扣手算 ¥${withCache.toFixed(6)} | 偏差(忽略缓存) ${(((cost - naive) / naive) * 100).toFixed(2)}%`);
  }
}

// 口径差必须在「同一请求」内比：网关转发的 usage（=上游真实上报）vs 网关入账 tokens/cost。
// 两次独立调用的思考 token 天然不同，跨请求对比无意义。
for (const model of Object.keys(PRICES)) {
  for (const stream of [false, true]) {
    const [pi, po] = PRICES[model];
    console.log(`\n=== ${model} stream=${stream} ===`);
    const gw = await chat(GW, MASTER, model, stream);
    // spend 入账有异步延迟，稍等再查
    await new Promise((r) => setTimeout(r, 3000));
    const log = await spendLog(gw.requestId);
    const billed = Number(log?.spend ?? gw.cost ?? NaN);
    const handCost = gw.usage ? (gw.usage.prompt_tokens * pi + gw.usage.completion_tokens * po) / 1e6 : NaN;
    console.log(`  网关转发 usage: ${fmt(gw.usage)}  request_id=${gw.requestId}`);
    console.log(`  回包 cost: ${gw.cost ?? "无"} | spend/logs 入账: ¥${Number.isFinite(billed) ? billed.toFixed(6) : "查不到"}`);
    console.log(`  按转发 usage 手算: ¥${Number.isFinite(handCost) ? handCost.toFixed(6) : "NaN"}`);
    if (Number.isFinite(billed) && handCost > 0) {
      console.log(`  ★ 同一请求偏差: ${(((billed - handCost) / handCost) * 100).toFixed(2)}%`);
    }
    if (log) {
      console.log(`  入账 tokens: in=${log.prompt_tokens} out=${log.completion_tokens} total=${log.total_tokens}`);
      const logHand = (log.prompt_tokens * pi + log.completion_tokens * po) / 1e6;
      console.log(`  按入账 tokens 手算: ¥${logHand.toFixed(6)}（与 spend 差 ¥${(billed - logHand).toFixed(8)}）`);
    } else {
      console.log(`  （spend/logs 未查到该 request_id）`);
    }
  }
}