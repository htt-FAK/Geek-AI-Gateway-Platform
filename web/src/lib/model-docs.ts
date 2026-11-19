import {
  defaultThinkingStop,
  getThinkingProfile,
  thinkingStopToRequest,
} from "@/lib/thinking-depth";

export type ModelEndpoint = "chat" | "asr" | "tts" | "embedding" | "rerank";

export type ModelDoc = {
  id: string;
  summary: string;
  modality: string;
  endpoint: ModelEndpoint;
  notes: string[];
  officialUrl: string;
  officialLabel: string;
};

const DEEPSEEK_DOCS = "https://api-docs.deepseek.com/zh-cn/";
const DEEPSEEK_PRICING = "https://api-docs.deepseek.com/zh-cn/quick_start/pricing";
const MIMO_DOCS = "https://platform.xiaomimimo.com/";
const MIMO_PRICING = "https://mimo.mi.com/docs/price/pay-as-you-go";
const MIMO_PRO = "https://mimo.mi.com/models/en-US/mimo-v2.6-pro";
const MIMO_FLASH = "https://mimo.mi.com/models/en-US/mimo-v2.6-flash";
const XFYUN_MAAS = "https://maas.xfyun.cn/";
const SILICONFLOW_DOCS = "https://docs.siliconflow.cn/";
// 模型介绍一律展示模型自家厂商（名称＋官网），不写托管平台。
const QWEN_HOME = "https://qwen.ai/";
const KIMI_HOME = "https://www.kimi.com/";
const ZHIPU_HOME = "https://www.zhipu.ai/";
const MINIMAX_HOME = "https://www.minimax.io/";
const STEPFUN_HOME = "https://www.stepfun.com/";

const DOCS: Record<string, Omit<ModelDoc, "id" | "notes"> & { notes?: string[] }> = {
  "deepseek-flash": {
    summary: "DeepSeek Flash（V4.1-Flash）：更快更省，支持图像理解与思考模式。",
    modality: "文本 · 图像 · 思考",
    endpoint: "chat",
    officialUrl: DEEPSEEK_DOCS,
    officialLabel: "DeepSeek API 文档",
    notes: [
      "网关挂载名与官方推荐名一致：deepseek-flash（原 deepseek-v4-flash 为上游兼容别名）。",
      "支持思考模式（默认开启）；控制台当前不暴露该模型的思考深度档位。",
      "1M 上下文，最大 384K 输出；图像理解仅 Flash 支持。",
      "走本网关 OpenAI 兼容 `/v1/chat/completions`。",
      "峰时计费：北京时间周一至周五 09–12、14–18（法定节假日除外），峰时为空闲价 2 倍；周末与节假日全天错峰。",
    ],
  },
  "deepseek-v4-pro": {
    summary: "DeepSeek V4 Pro：文本旗舰，支持关闭 / 标准 / 极深思考档位。",
    modality: "文本 · 思考",
    endpoint: "chat",
    officialUrl: DEEPSEEK_DOCS,
    officialLabel: "DeepSeek API 文档",
    notes: [
      "思考档：关闭（thinking.disabled）、标准（enabled + reasoning_effort=high）、极深（enabled + reasoning_effort=max）。",
      "1M 上下文，最大 384K 输出。",
      "走本网关 OpenAI 兼容 `/v1/chat/completions`。",
      "峰时计费：北京时间周一至周五 09–12、14–18（法定节假日除外），峰时为空闲价 2 倍；周末与节假日全天错峰。",
    ],
  },
  "mimo-v2.6-pro": {
    summary: "小米 MiMo V2.6 Pro：全模态旗舰，支持开启/关闭思考。",
    modality: "全模态 · 思考",
    endpoint: "chat",
    officialUrl: MIMO_PRO,
    officialLabel: "MiMo V2.6 Pro 官方页",
    notes: [
      "思考档：关闭（thinking.disabled）或开启（thinking.enabled）。",
      "文本 / 图像 / 视频 / 音频输入，1M 上下文，最大 128K 输出；支持工具调用、联网搜索、结构化输出与上下文缓存。",
      "走本网关 OpenAI 兼容 `/v1/chat/completions`；调试台当前以文本对话为主。",
    ],
  },
  "mimo-v2.6-flash": {
    summary: "MiMo V2.6 Flash：全模态、低成本推理模型，更快更省。",
    modality: "全模态 · 思考",
    endpoint: "chat",
    officialUrl: MIMO_FLASH,
    officialLabel: "MiMo V2.6 Flash 官方页",
    notes: [
      "思考档：关闭（thinking.disabled）或开启（thinking.enabled）。",
      "文本 / 图像 / 视频 / 音频输入，1M 上下文，最大 128K 输出；支持工具调用、联网搜索、结构化输出与上下文缓存。",
      "走本网关 OpenAI 兼容 `/v1/chat/completions`。",
    ],
  },
  "xing4.0-29b": {
    summary: "TeleAI 星辰 Xing4.0-29B：29B-A4B 全国产开源 MoE，复杂推理与长程任务执行。",
    modality: "文本 · 思考",
    endpoint: "chat",
    officialUrl: SILICONFLOW_DOCS,
    officialLabel: "硅基流动文档",
    notes: [
      "思考默认开启（实测响应含 reasoning_content），调试台不提供思考档位。",
      "256K 原生上下文（官方外推可达 512K），纯文本输入输出，支持工具调用。",
      "经硅基流动接入，限时免费；L0 限流 RPM 1,000 / TPM 40,000。",
      "走本网关 OpenAI 兼容 `/v1/chat/completions`。",
    ],
  },
  "qwen3.5-4b": {
    summary: "Qwen3.5-4B：通义千问最轻量 Dense 多模态模型，256K 原生上下文。",
    modality: "文本 · 图像 · 思考",
    endpoint: "chat",
    officialUrl: SILICONFLOW_DOCS,
    officialLabel: "硅基流动文档",
    notes: [
      "思考默认开启（实测响应含 reasoning_content），调试台不提供思考档位。",
      "视觉输入（官方标称）+ 工具调用；256K 上下文，官方称可扩展至约 100 万 tokens。",
      "经硅基流动接入，限时免费；L0 限流 RPM 1,000 / TPM 80,000。",
      "走本网关 OpenAI 兼容 `/v1/chat/completions`。",
    ],
  },
  "deepseek-ocr": {
    summary: "DeepSeek-OCR：专注光学字符识别与「上下文光学压缩」的 3B 视觉模型。",
    modality: "图像 · OCR",
    endpoint: "chat",
    officialUrl: SILICONFLOW_DOCS,
    officialLabel: "硅基流动文档",
    notes: [
      "视觉输入实测可用：图片走标准 OpenAI 视觉格式（content 数组 + image_url，支持 data:base64）。",
      "输出 Markdown 等结构化文本；8K 上下文；无思考档位。",
      "经硅基流动接入，限时免费（官方限免标记）；L0 限流 RPM 1,000 / TPM 80,000。",
      "走本网关 OpenAI 兼容 `/v1/chat/completions`；调试台以文本对话为主，OCR 请走 API。",
    ],
  },
  "bge-m3": {
    summary: "BGE-M3：多语言多功能文本嵌入，支持密集 / 多向量 / 稀疏检索。",
    modality: "嵌入（1024 维）",
    endpoint: "embedding",
    officialUrl: SILICONFLOW_DOCS,
    officialLabel: "硅基流动文档",
    notes: [
      "1024 维，100+ 语言，最长 8192 词元；RAG 检索常用底座。",
      "经硅基流动接入，限时免费；L0 限流 RPM 2,000 / TPM 500,000。",
      "走本网关 OpenAI 兼容 `/v1/embeddings`。",
    ],
  },
  "bge-large-zh-v1.5": {
    summary: "BGE-Large-ZH v1.5：中文嵌入，C-MTEB 基准表现优异。",
    modality: "嵌入（1024 维）",
    endpoint: "embedding",
    officialUrl: SILICONFLOW_DOCS,
    officialLabel: "硅基流动文档",
    notes: [
      "1024 维，512 词元上下文，中文检索 / 语义相似度 / 文本对分类。",
      "经硅基流动接入，限时免费；L0 限流 RPM 2,000 / TPM 500,000。",
      "走本网关 OpenAI 兼容 `/v1/embeddings`。",
    ],
  },
  "bge-reranker-v2-m3": {
    summary: "BGE-Reranker-v2-M3：轻量多语言重排序，直接输出查询-文档相关度。",
    modality: "重排序",
    endpoint: "rerank",
    officialUrl: SILICONFLOW_DOCS,
    officialLabel: "硅基流动文档",
    notes: [
      "568M，基于 bge-m3 开发；输入查询 + 候选文档，输出相关度分数排序。",
      "经硅基流动接入（Jina 兼容格式），限时免费；L0 限流 RPM 2,000 / TPM 500,000。",
      "走本网关 OpenAI 兼容 `/v1/rerank`（OpenAI SDK 不含 rerank，请用 HTTP 调用）。",
    ],
  },
  "spark-x2.6": {
    summary: "讯飞星火 Spark-X2.6：293B-A30B MoE 旗舰，1M 上下文，思考默认开启。",
    modality: "文本 · 思考",
    endpoint: "chat",
    officialUrl: XFYUN_MAAS,
    officialLabel: "讯飞星辰 MaaS 平台",
    notes: [
      "思考默认开启（响应含 reasoning_content），调试台不提供思考档位。",
      "1M 上下文，纯文本输入输出；工具调用（Function Calling）已实测可用。",
      "上游限时免费，官方 2026-11-28 下架该模型，届时网关同步下线或替换。",
      "走本网关 OpenAI 兼容 `/v1/chat/completions`。",
    ],
  },
  "mimo-v2.5-asr": {
    summary: "MiMo 语音识别（ASR）。",
    modality: "语音识别",
    endpoint: "asr",
    officialUrl: MIMO_PRICING,
    officialLabel: "MiMo 计价与能力说明",
    notes: [
      "语音类请按上游 OpenAI 兼容音频接口调用；调试台以文本 chat 为主，不宜直接试 ASR。",
      "计价通常按音频小时计费，以官方为准。",
    ],
  },
  "mimo-v2.5-tts": {
    summary: "MiMo 语音合成（TTS）。",
    modality: "语音合成",
    endpoint: "tts",
    officialUrl: MIMO_PRICING,
    officialLabel: "MiMo 计价与能力说明",
    notes: [
      "语音类请按上游 OpenAI 兼容音频接口调用；调试台以文本 chat 为主。",
      "官方可能有限时免费，以定价页为准。",
    ],
  },
  "mimo-v2.5-tts-voiceclone": {
    summary: "MiMo TTS · 声音克隆。",
    modality: "语音合成 · 克隆",
    endpoint: "tts",
    officialUrl: MIMO_PRICING,
    officialLabel: "MiMo 计价与能力说明",
    notes: [
      "按上游 TTS / 声音克隆接口调用；调试台以文本 chat 为主。",
      "能力与计费以官方文档为准。",
    ],
  },
  "mimo-v2.5-tts-voicedesign": {
    summary: "MiMo TTS · 声音设计。",
    modality: "语音合成 · 设计",
    endpoint: "tts",
    officialUrl: MIMO_PRICING,
    officialLabel: "MiMo 计价与能力说明",
    notes: [
      "按上游 TTS / 声音设计接口调用；调试台以文本 chat 为主。",
      "能力与计费以官方文档为准。",
    ],
  },
  "qwen4-max": {
    summary: "千问 Qwen4-Max：复杂推理与编程旗舰，思考/非思考双模式。",
    modality: "文本 · 图像 · 视频 · 思考",
    endpoint: "chat",
    officialUrl: QWEN_HOME,
    officialLabel: "千问官网",
    notes: [
      "1M 上下文；最大输出 128K（非思考）/ 256K（思考+输出）。",
      "官方价：输入 ¥10/M、输出 ¥30/M、缓存命中 ¥0.5/M；Batch File 半价。",
      "支持图像（单图 ≤16M 像素、≤2048 张）与视频（≤2 小时/2GB、≤64 个）输入。",
      "走本网关 OpenAI 兼容 `/v1/chat/completions`。",
    ],
  },
  "qwen3.8-flash": {
    summary: "千问 Qwen3.8-Flash：快速低成本，支持图像/视频理解。",
    modality: "文本 · 图像 · 视频 · 思考",
    endpoint: "chat",
    officialUrl: QWEN_HOME,
    officialLabel: "千问官网",
    notes: [
      "1M 上下文，最大 128K 输出。",
      "官方价：输入 ¥0.8/M、输出 ¥2.7/M、缓存命中 ¥0.1/M。",
      "上游档位 RPM 30000 / TPM 5M，网关侧已设同档限流。",
    ],
  },
  "kimi-k3.1-pro": {
    summary: "月之暗面 Kimi K3.1 Pro：1M 上下文，默认开启思考。",
    modality: "文本 · 思考",
    endpoint: "chat",
    officialUrl: KIMI_HOME,
    officialLabel: "Kimi 官网",
    notes: [
      "思考默认开启；工具调用达标，结构化输出支持 JSON Mode。",
      "官方价：输入 ¥13/M、输出 ¥68/M、缓存命中 ¥1.3/M（思考 token 按输出价）。",
    ],
  },
  "glm-5.3-flash": {
    summary: "智谱 GLM-5.3-Flash：轻量快速，低成本日常任务。",
    modality: "文本 · 思考",
    endpoint: "chat",
    officialUrl: ZHIPU_HOME,
    officialLabel: "智谱官网",
    notes: [
      "模型代码 ZHIPU/GLM-5.3-Flash。",
      "官方价：输入 ¥0.8/M、输出 ¥2.8/M、缓存命中 ¥0.08/M。",
      "上游档位 RPM 500 / TPM 10M，网关侧已设同档限流。",
    ],
  },
  "glm-5.3": {
    summary: "智谱 GLM-5.3 旗舰：1M 上下文，仅思考模式。",
    modality: "文本 · 思考",
    endpoint: "chat",
    officialUrl: ZHIPU_HOME,
    officialLabel: "智谱官网",
    notes: [
      "模型代码 ZHIPU/GLM-5.3，仅思考模式。",
      "官方价：输入 ¥8/M、输出 ¥28/M；缓存命中 ¥2/M。",
      "上游档位 RPM 500 / TPM 5M，网关侧已设同档限流。",
    ],
  },
  "minimax-m3.1-flash": {
    summary: "MiniMax M3.1 Flash：1M 上下文，低成本快速响应。",
    modality: "文本",
    endpoint: "chat",
    officialUrl: MINIMAX_HOME,
    officialLabel: "MiniMax 官网",
    notes: [
      "模型代码 MiniMax/MiniMax-M3.1-Flash。",
      "官方价：输入 ¥1/M、输出 ¥4/M。",
      "官方仅标「上下文缓存享有折扣」未公布单价：网关暂按输入价计缓存命中，官方公布后同步。",
    ],
  },
  "step-5-preview": {
    summary: "阶跃星辰 Step-5 Preview：1M 上下文旗舰预览版。",
    modality: "文本 · 思考",
    endpoint: "chat",
    officialUrl: STEPFUN_HOME,
    officialLabel: "阶跃星辰官网",
    notes: [
      "模型代码 stepfun/step-5-preview。",
      "官方价：输入 ¥7/M、输出 ¥20/M；官方未提供缓存折扣价。",
      "预览版能力以官方模型页为准。",
    ],
  },
};

function thinkingNotes(model: string): string[] {
  const profile = getThinkingProfile(model);
  if (profile.kind === "none") {
    return ["本模型不暴露思考深度控制。"];
  }
  if (profile.kind === "deepseek") {
    return [`思考档位：${profile.stops.map((s) => s.label).join(" / ")}。`];
  }
  return [`思考档位：${profile.stops.map((s) => s.label).join(" / ")}。`];
}

export function getModelDoc(model: string): ModelDoc {
  const base = DOCS[model];
  if (base) {
    const notes = [...(base.notes ?? [])];
    if (base.endpoint === "chat") {
      const tn = thinkingNotes(model);
      for (const n of tn) {
        if (!notes.some((x) => x.includes("思考"))) notes.push(n);
      }
    }
    if (model.startsWith("deepseek-") && !notes.some((x) => x.includes("定价") || x.includes("峰时"))) {
      notes.push(`官方定价参考：${DEEPSEEK_PRICING}`);
    }
    return { id: model, ...base, notes };
  }

  const id = model.toLowerCase();
  const endpoint: ModelEndpoint = id.includes("-asr") ? "asr" : id.includes("-tts") ? "tts" : "chat";
  const isDeepseek = id.includes("deepseek");
  return {
    id: model,
    summary: "网关已挂载的上游模型。",
    modality: endpoint === "chat" ? "文本" : endpoint === "asr" ? "语音识别" : "语音合成",
    endpoint,
    notes: [
      ...thinkingNotes(model),
      endpoint === "chat"
        ? "走本网关 OpenAI 兼容 `/v1/chat/completions`。"
        : "语音类请按上游 OpenAI 兼容音频接口调用；调试台以文本 chat 为主。",
    ],
    officialUrl: isDeepseek ? DEEPSEEK_DOCS : MIMO_DOCS,
    officialLabel: isDeepseek ? "DeepSeek API 文档" : "MiMo 平台文档",
  };
}

/** Build curl + Python snippets for this gateway base URL. */
export function buildModelCallSnippets(model: string, gatewayBase: string): {
  curl: string;
  python: string;
  label: string;
} {
  const doc = getModelDoc(model);
  const base = gatewayBase.replace(/\/$/, "");

  if (doc.endpoint === "embedding") {
    const curl = `curl ${base}/embeddings \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $AI_GATEWAY_API_KEY" \\
  -d '{
    "model": "${model}",
    "input": "需要向量化的文本"
  }'`;

    const python = `from openai import OpenAI

client = OpenAI(
    api_key="...",  # 或环境变量 AI_GATEWAY_API_KEY
    base_url="${base}",
)

resp = client.embeddings.create(
    model="${model}",
    input="需要向量化的文本",
)
print(len(resp.data[0].embedding))  # 向量维度`;

    return { curl, python, label: "Embeddings" };
  }

  if (doc.endpoint === "rerank") {
    const curl = `curl ${base}/rerank \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $AI_GATEWAY_API_KEY" \\
  -d '{
    "model": "${model}",
    "query": "检索查询",
    "documents": ["候选文档 A", "候选文档 B"],
    "top_n": 2
  }'`;

    const python = `import requests  # rerank 走 HTTP 接口（OpenAI SDK 不含 rerank）

resp = requests.post(
    "${base}/rerank",
    headers={"Authorization": "Bearer ..."},  # 或环境变量 AI_GATEWAY_API_KEY
    json={
        "model": "${model}",
        "query": "检索查询",
        "documents": ["候选文档 A", "候选文档 B"],
        "top_n": 2,
    },
)
print(resp.json()["results"])`;

    return { curl, python, label: "Rerank" };
  }

  if (doc.endpoint !== "chat") {
    const curl = `# ${doc.modality}：请按上游 OpenAI 兼容音频接口调用
# Base URL: ${base}
# Authorization: Bearer $AI_GATEWAY_API_KEY
# model: ${model}
#
# 调试台当前以文本 chat 为主，不直接演示 ASR/TTS 请求体。
# 完整字段以官方文档为准：${doc.officialUrl}`;

    const python = `# ${doc.modality} — 使用本网关 Key，请求体以官方音频接口为准
from openai import OpenAI

client = OpenAI(
    api_key="...",  # 或环境变量 AI_GATEWAY_API_KEY
    base_url="${base}",
)

# model="${model}"
# 具体 ASR/TTS 调用方式见：${doc.officialUrl}`;

    return { curl, python, label: "音频接口说明" };
  }

  const profile = getThinkingProfile(model);
  const stop = defaultThinkingStop(profile);
  const fields = thinkingStopToRequest(profile, stop);
  const thinkingLines: string[] = [];
  if (fields.thinking) {
    thinkingLines.push(`    "thinking": ${JSON.stringify(fields.thinking)},`);
  }
  if (fields.reasoning_effort) {
    thinkingLines.push(`    "reasoning_effort": "${fields.reasoning_effort}",`);
  }

  const curl = `curl ${base}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $AI_GATEWAY_API_KEY" \\
  -d '{
    "model": "${model}",
    "messages": [
      {"role": "user", "content": "Hello"}
    ],
    "temperature": 0.7,
    "max_tokens": 2048,
${thinkingLines.length ? `${thinkingLines.join("\n")}\n` : ""}    "stream": false
  }'`;

  const pyExtra: string[] = [];
  if (fields.thinking) {
    pyExtra.push(`        "thinking": ${JSON.stringify(fields.thinking)},`);
  }
  if (fields.reasoning_effort) {
    pyExtra.push(`        "reasoning_effort": "${fields.reasoning_effort}",`);
  }

  const python = `from openai import OpenAI

client = OpenAI(
    api_key="...",  # 或环境变量 AI_GATEWAY_API_KEY
    base_url="${base}",
)

resp = client.chat.completions.create(
    model="${model}",
    messages=[{"role": "user", "content": "Hello"}],
    temperature=0.7,
    max_tokens=2048,
    stream=False,${
      pyExtra.length
        ? `
    extra_body={
${pyExtra.join("\n")}
    },`
        : ""
    }
)
print(resp.choices[0].message.content)`;

  return { curl, python, label: "Chat Completions" };
}
