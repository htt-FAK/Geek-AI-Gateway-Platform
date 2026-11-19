/**
 * 百炼接入探测：确认账号可用 endpoint 与各模型真实调用 ID。
 * 用户账号可能是专属 MaaS endpoint（llm-xxx.maas.aliyuncs.com），模型 ID 与公共市场不同。
 * 运行：node scripts/probe-bailian-endpoints.mjs [endpoint序号]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envText = fs.readFileSync(path.join(root, "..", "gateway", ".env"), "utf8");
const KEY = /^DASHSCOPE_API_KEY=(.*)$/m.exec(envText)?.[1]?.trim();
if (!KEY || KEY.startsWith("sk-your")) { console.error("gateway/.env 的 DASHSCOPE_API_KEY 未填写"); process.exit(1); }

const ENDPOINTS = [
  "https://llm-5zdh15ss8avq13uc.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
  "https://dashscope.aliyuncs.com/compatible-mode/v1",
];

// 每个网关别名 → 候选上游 ID（按优先级）
const CANDIDATES = {
  "glm-5.3": ["glm-5.3", "zhipu-glm-5.3", "ZHIPU/GLM-5.3"],
  "qwen4-max": ["qwen4-max"],
  "qwen3.8-flash": ["qwen3.8-flash"],
  "kimi-k3.1-pro": ["kimi-k3.1-pro", "kimi/kimi-k3.1-pro"],
  "glm-5.3-flash": ["glm-5.3-flash", "zhipu-glm-5.3-flash", "ZHIPU/GLM-5.3-Flash"],
  "minimax-m3.1-flash": ["minimax-m3.1-flash", "MiniMax/MiniMax-M3.1-Flash", "MiniMax-M3.1-Flash"],
  "step-5-preview": ["step-5-preview", "stepfun/step-5-preview"],
};

async function tryCall(base, model) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "回复 ok" }], max_tokens: 256, stream: false }),
      signal: AbortSignal.timeout(60000),
    });
    const ms = Date.now() - t0;
    if (!res.ok) {
      const text = (await res.text()).slice(0, 160).replace(/\s+/g, " ");
      return { ok: false, ms, err: `${res.status} ${text}` };
    }
    const j = await res.json();
    const u = j.usage ?? {};
    const msg = j.choices?.[0]?.message ?? {};
    return {
      ok: true, ms,
      usage: `in=${u.prompt_tokens} out=${u.completion_tokens} reason=${u.completion_tokens_details?.reasoning_tokens ?? "-"}`,
      content: String(msg.content ?? "").slice(0, 30),
      hasReasoning: Boolean(msg.reasoning_content),
      finish: j.choices?.[0]?.finish_reason,
    };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, err: e.message?.slice(0, 120) };
  }
}

const only = process.argv[2] ? [ENDPOINTS[Number(process.argv[2])]] : ENDPOINTS;
for (const base of only) {
  console.log(`\n########## ENDPOINT ${base}`);
  for (const [alias, ids] of Object.entries(CANDIDATES)) {
    let done = false;
    for (const id of ids) {
      const r = await tryCall(base, id);
      if (r.ok) {
        console.log(`OK   ${alias} ← ${id} | ${r.ms}ms ${r.usage} finish=${r.finish} reasoning=${r.hasReasoning} content="${r.content}"`);
        done = true;
        break;
      }
      console.log(`FAIL ${alias} ← ${id} | ${r.err}`);
    }
    if (!done) console.log(`!!!! ${alias} 全部候选失败`);
  }
}