import {
  defaultThinkingStop,
  getThinkingProfile,
  thinkingStopToRequest,
} from "@/lib/thinking-depth";

export type ModelEndpoint = "chat" | "asr" | "tts";

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
const MIMO_DOCS = "https://mimo.mi.com/docs/en-US/quick-start/model";
const MIMO_PRICING = "https://mimo.mi.com/docs/price/pay-as-you-go";
const MIMO_ULTRASPEED = "https://mimo.mi.com/models/en-US/mimo-v2.6-pro-ultraspeed";
const GLM_DOCS = "https://docs.bigmodel.cn/cn/guide/models/vlm/glm-5.3-flash";
const GLM_PRICING = "https://docs.bigmodel.cn/cn/guide/start/pricing";

const DOCS: Record<string, Omit<ModelDoc, "id" | "notes"> & { notes?: string[] }> = {
  "deepseek-flash": {
    summary: "DeepSeek Flash：当前由 DeepSeek-V4.1-Flash 提供，更快更省，支持思考和图像理解。",
    modality: "文本 · 图像 · 思考",
    endpoint: "chat",
    officialUrl: DEEPSEEK_DOCS,
    officialLabel: "DeepSeek API 文档",
    notes: [
      "模型名使用 deepseek-flash。旧名 deepseek-v4-flash 已退役，请求会被转到 V4.1 Flash。",
      "思考档：关闭、标准（reasoning_effort=high）、极深（reasoning_effort=max）。",
      "走本网关 OpenAI 兼容 `/v1/chat/completions`。",
      "峰时为北京时间周一至周五（不含法定节假日）09:00–12:00、14:00–18:00，价格为闲时 2 倍。",
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
      "走本网关 OpenAI 兼容 `/v1/chat/completions`。",
      "峰时为北京时间周一至周五（不含法定节假日）09:00–12:00、14:00–18:00。",
    ],
  },
  "glm-5.3-flash": {
    summary: "智谱 GLM-5.3-Flash：原生多模态，思考不能关闭。",
    modality: "图片 · 视频 · 文件 · 文本",
    endpoint: "chat",
    officialUrl: GLM_DOCS,
    officialLabel: "GLM-5.3-Flash 文档",
    notes: [
      "思考始终开启。档位：轻量（reasoning_effort=low）、增强（high）、深度（max，默认）。",
      "不要传 thinking.type=disabled，上游会拒绝。",
      "走本网关 OpenAI 兼容 `/v1/chat/completions`，上游为 https://open.bigmodel.cn/api/paas/v4。",
      "目录价按官方标准价：输入 0.8、输出 2.8、缓存命中 0.23 元/百万 tokens。开放平台若有限时折扣，以定价页为准。",
    ],
  },
  "mimo-v2.6-pro": {
    summary: "小米 MiMo V2.6 Pro：全模态旗舰，支持开启/关闭思考。",
    modality: "全模态 · 思考",
    endpoint: "chat",
    officialUrl: MIMO_DOCS,
    officialLabel: "MiMo 模型列表",
    notes: [
      "思考档：关闭（thinking.disabled）或开启（thinking.enabled）。",
      "mimo-v2.5-pro 已于 2026-10-21 下线，请使用本 ID。",
      "走本网关 OpenAI 兼容 `/v1/chat/completions`。",
    ],
  },
  "mimo-v2.6-flash": {
    summary: "MiMo V2.6 Flash：全模态、高性价比，适合高频调用。",
    modality: "全模态",
    endpoint: "chat",
    officialUrl: MIMO_DOCS,
    officialLabel: "MiMo 模型列表",
    notes: [
      "支持开启/关闭思考。思考模式下上游会忽略自定义 temperature / top_p。",
      "mimo-v2.5 已于 2026-10-21 下线，请使用本 ID。",
      "调试台当前以文本对话为主。",
    ],
  },
  "mimo-v2.6-pro-ultraspeed": {
    summary: "MiMo V2.6 Pro UltraSpeed：旗舰能力，输出更快。",
    modality: "全模态 · 高速",
    endpoint: "chat",
    officialUrl: MIMO_ULTRASPEED,
    officialLabel: "MiMo UltraSpeed 说明",
    notes: [
      "支持开启/关闭思考。",
      "走本网关 OpenAI 兼容 `/v1/chat/completions`。",
      "国内价：缓存命中 0.25、未命中输入 30、输出 60 元/百万 tokens。",
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
    if (model.startsWith("glm-") && !notes.some((x) => x.includes(GLM_PRICING))) {
      notes.push(`官方定价参考：${GLM_PRICING}`);
    }
    return { id: model, ...base, notes };
  }

  const id = model.toLowerCase();
  const endpoint: ModelEndpoint = id.includes("-asr") ? "asr" : id.includes("-tts") ? "tts" : "chat";
  const isDeepseek = id.includes("deepseek");
  const isGlm = id.startsWith("glm-");
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
    officialUrl: isDeepseek ? DEEPSEEK_DOCS : isGlm ? GLM_DOCS : MIMO_DOCS,
    officialLabel: isDeepseek ? "DeepSeek API 文档" : isGlm ? "智谱 GLM 文档" : "MiMo 平台文档",
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
