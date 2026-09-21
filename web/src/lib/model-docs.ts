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
const MIMO_DOCS = "https://platform.xiaomimimo.com/";
const MIMO_PRICING = "https://platform.xiaomimimo.com/static/docs/price/pay-as-you-go.md";
const MIMO_ULTRASPEED = "https://mimo.mi.com/models/en-US/mimo-v2.5-pro-ultraspeed";
const GLM_DOCS = "https://docs.bigmodel.cn/cn/api/introduction";
const GLM_PRICING = "https://www.bigmodel.cn/pricing";
const GLM_THINKING = "https://docs.bigmodel.cn/cn/guide/capabilities/thinking";

const DOCS: Record<string, Omit<ModelDoc, "id" | "notes"> & { notes?: string[] }> = {
  "deepseek-flash": {
    summary: "DeepSeek-V4.1-Flash：当前官方 Flash，支持思考与图像理解。",
    modality: "文本 · 多模态 · 思考",
    endpoint: "chat",
    officialUrl: DEEPSEEK_DOCS,
    officialLabel: "DeepSeek API 文档",
    notes: [
      "官方模型名请使用 `deepseek-flash`。",
      "思考档：关闭 / 标准（reasoning_effort=high） / 极深（max）。默认思考开启。",
      "DeepSeek 计费有峰时倍率（上海时区工作日 09–12、14–18），空闲价为峰时一半。",
    ],
  },
  "deepseek-v4-flash": {
    summary: "旧模型名别名：请求由 DeepSeek-V4.1-Flash 承接，按 Flash 价格计费。",
    modality: "文本 · 思考（别名）",
    endpoint: "chat",
    officialUrl: DEEPSEEK_DOCS,
    officialLabel: "DeepSeek API 文档",
    notes: [
      "官方已下线 V4 Flash；此 ID 仍可调用，实际路由到 `deepseek-flash`。",
      "新接入请改用 `deepseek-flash`。",
      "DeepSeek 计费有峰时倍率（上海时区工作日 09–12、14–18）。",
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
      "峰时计费见官方定价页。",
    ],
  },
  "mimo-v2.5-pro": {
    summary: "小米 MiMo V2.5 Pro：文本旗舰，支持开启/关闭思考。",
    modality: "文本 · 思考",
    endpoint: "chat",
    officialUrl: MIMO_DOCS,
    officialLabel: "MiMo 平台文档",
    notes: [
      "思考档：关闭（thinking.disabled）或开启（thinking.enabled）。",
      "走本网关 OpenAI 兼容 `/v1/chat/completions`。",
    ],
  },
  "mimo-v2.5-pro-ultraspeed": {
    summary: "MiMo V2.5 Pro UltraSpeed：文本旗舰的更高速度档。",
    modality: "文本 · 高速",
    endpoint: "chat",
    officialUrl: MIMO_ULTRASPEED,
    officialLabel: "MiMo UltraSpeed 说明",
    notes: [
      "支持开启/关闭思考。",
      "走本网关 OpenAI 兼容 `/v1/chat/completions`。",
      "定价与能力以官方 UltraSpeed 页为准。",
    ],
  },
  "mimo-v2.5": {
    summary: "MiMo V2.5：全模态能力（网关侧以 chat 入口为主）。",
    modality: "全模态",
    endpoint: "chat",
    officialUrl: MIMO_DOCS,
    officialLabel: "MiMo 平台文档",
    notes: [
      "支持开启/关闭思考。",
      "多模态细节以官方文档为准；调试台当前以文本对话为主。",
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
  "glm-5.3": {
    summary: "智谱 GLM-5.3：旗舰文本模型，强制思考，支持轻度 / 标准 / 极深。",
    modality: "文本 · 思考",
    endpoint: "chat",
    officialUrl: GLM_DOCS,
    officialLabel: "智谱 API 文档",
    notes: [
      "官方模型名 `glm-5.3`。思考不可关闭；传 `thinking.type=disabled` 会报错。",
      "思考档：轻度（reasoning_effort=low）/ 标准（high）/ 极深（max）。省略 effort 时官方默认为 max。",
      "刊例价（每百万 tokens）：输入 8 / 输出 28 / 缓存命中 2 元。",
      `思考参数说明：${GLM_THINKING}`,
    ],
  },
  "glm-5.3-flash": {
    summary: "智谱 GLM-5.3-Flash：更快更省的旗舰 Flash，强制思考，支持图文。",
    modality: "文本 · 多模态 · 思考",
    endpoint: "chat",
    officialUrl: GLM_DOCS,
    officialLabel: "智谱 API 文档",
    notes: [
      "官方模型名 `glm-5.3-flash`。思考不可关闭。",
      "思考档：轻度（low）/ 标准（high）/ 极深（max）。",
      "刊例价（每百万 tokens）：输入 0.8 / 输出 2.8 / 缓存命中 0.23 元；限时折扣以定价页为准。",
      `官方定价：${GLM_PRICING}`,
    ],
  },
  "glm-4.7": {
    summary: "智谱 GLM-4.7：可开关思考的文本模型。",
    modality: "文本 · 思考",
    endpoint: "chat",
    officialUrl: GLM_DOCS,
    officialLabel: "智谱 API 文档",
    notes: [
      "思考档：关闭（thinking.disabled）或开启（thinking.enabled）。开启时为强制思考（非混合自动）。",
      "不支持 reasoning_effort。",
      "刊例价按长度分档；网关按最低档计入：输入 2 / 输出 8 / 缓存命中 0.4 元每百万 tokens。更长上下文更贵，以定价页为准。",
    ],
  },
  "glm-4.7-flash": {
    summary: "智谱 GLM-4.7-Flash：官方免费档文本模型。",
    modality: "文本 · 思考",
    endpoint: "chat",
    officialUrl: GLM_DOCS,
    officialLabel: "智谱 API 文档",
    notes: [
      "思考档：关闭或开启，与 GLM-4.7 相同。",
      "官方定价页当前为免费；网关侧记 0 元。免费策略以官方为准。",
    ],
  },
};

function thinkingNotes(model: string): string[] {
  const profile = getThinkingProfile(model);
  if (profile.kind === "none") {
    return ["本模型不暴露思考深度控制。"];
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
    officialLabel: isDeepseek ? "DeepSeek API 文档" : isGlm ? "智谱 API 文档" : "MiMo 平台文档",
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
