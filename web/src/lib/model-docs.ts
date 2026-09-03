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

const DOCS: Record<string, Omit<ModelDoc, "id" | "notes"> & { notes?: string[] }> = {
  "deepseek-v4-flash": {
    summary: "DeepSeek V4 Flash：更快、更省的文本对话模型。",
    modality: "文本",
    endpoint: "chat",
    officialUrl: DEEPSEEK_DOCS,
    officialLabel: "DeepSeek API 文档",
    notes: [
      "走本网关 OpenAI 兼容 `/v1/chat/completions`。",
      "该模型不支持思考深度控制。",
      "DeepSeek 计费：工作日（周一至周五，北京时间）09:00–12:00、14:00–18:00 为峰时，价格 = 低谷价 ×2；周六、周日整天按低谷价。详见官方定价。",
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
      "DeepSeek 计费：工作日（周一至周五，北京时间）09:00–12:00、14:00–18:00 为峰时，价格 = 低谷价 ×2；周六、周日整天按低谷价。详见官方定价。",
    ],
  },
  "deepseek-v4-flash-vision-exp": {
    summary: "DeepSeek V4 Flash Vision Exp：多模态视觉，支持图片与文本混合输入，图片按官方规则折算 token 计费。",
    endpoint: "chat",
    officialUrl: DEEPSEEK_DOCS,
    officialLabel: "DeepSeek API 文档",
    notes: [
      "走本网关 OpenAI 兼容 `/v1/chat/completions`。",
      "支持图片与文本混合输入；图片按尺寸折算为 token，与文本一并计费。",
      "DeepSeek 计费：工作日（周一至周五，北京时间）09:00–12:00、14:00–18:00 为峰时，价格 = 低谷价 ×2；周六、周日整天按低谷价。详见官方定价。",
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
