/**
 * 模型广场数据（阿里云百炼式卡片 / 详情页用）。
 * 价格与 gateway/model_catalog.json 保持一致（CNY / 百万 token）；
 * 规格与能力来自 DeepSeek / MiMo / 讯飞 / 硅基流动官网（采集于 2026-11-18/19）。
 * 改价时请同步 gateway/config.yaml 与 gateway/model_catalog.json。
 */

export type MarketProvider = "deepseek" | "mimo" | "xfyun" | "siliconflow" | "bailian";
export type MarketEndpoint = "chat" | "asr" | "tts" | "embedding" | "rerank";

export type MarketCapabilities = {
  thinking: boolean;
  toolCall: boolean;
  webSearch: boolean;
  structuredOutput: boolean;
  contextCache: boolean;
  vision: boolean;
  fim: boolean;
};

export type MarketModel = {
  id: string;
  provider: MarketProvider;
  endpoint: MarketEndpoint;
  tagline: string;
  tags: string[];
  modalityIn: string[];
  modalityOut: string[];
  pricing:
    | { kind: "tokens"; inputPerM: number; outputPerM: number; cacheHitPerM: number }
    | { kind: "note"; note: string };
  context: string;
  maxOutput: string;
  concurrency?: number;
  rpm?: number;
  tpm?: string;
  capabilities: MarketCapabilities;
  officialUrl: string;
  versionNote?: string;
  peakPricing?: boolean;
  /** 模型广场卡片右上角「推荐」角标 */
  recommended?: boolean;
};

const NO_CAPS: MarketCapabilities = {
  thinking: false,
  toolCall: false,
  webSearch: false,
  structuredOutput: false,
  contextCache: false,
  vision: false,
  fim: false,
};

const DS_FLASH = "https://api-docs.deepseek.com/zh-cn/";
const DS_PRICING = "https://api-docs.deepseek.com/zh-cn/quick_start/pricing";
const MIMO_PRO = "https://mimo.mi.com/models/en-US/mimo-v2.6-pro";
const MIMO_FLASH = "https://mimo.mi.com/models/en-US/mimo-v2.6-flash";
const MIMO_PRICING = "https://mimo.mi.com/docs/price/pay-as-you-go";
const XFYUN_MAAS = "https://maas.xfyun.cn/";
const SILICONFLOW_DOCS = "https://docs.siliconflow.cn/";
const BAILIAN_MODELS = "https://help.aliyun.com/zh/model-studio/text-generation-model";
const BAILIAN_PRICING = "https://help.aliyun.com/zh/model-studio/billing-for-model-studio";

export const MARKET_MODELS: MarketModel[] = [
  {
    id: "deepseek-flash",
    provider: "deepseek",
    endpoint: "chat",
    recommended: true,
    tagline: "更快更省的文本模型，支持图像理解与思考模式。",
    tags: ["文本", "图像", "思考"],
    modalityIn: ["文本", "图像"],
    modalityOut: ["文本"],
    pricing: { kind: "tokens", inputPerM: 1, outputPerM: 4, cacheHitPerM: 0.02 },
    context: "1M",
    maxOutput: "384K",
    concurrency: 2500,
    capabilities: { ...NO_CAPS, thinking: true, toolCall: true, webSearch: true, structuredOutput: true, contextCache: true, vision: true, fim: true },
    officialUrl: DS_FLASH,
    versionNote: "当前服务版本 DeepSeek-V4.1-Flash-1017；官方推荐名 deepseek-flash（原 deepseek-v4-flash 为兼容别名）。",
    peakPricing: true,
  },
  {
    id: "deepseek-v4-pro",
    provider: "deepseek",
    endpoint: "chat",
    tagline: "文本旗舰，支持关闭 / 标准 / 极深三档思考深度。",
    tags: ["文本", "思考"],
    modalityIn: ["文本"],
    modalityOut: ["文本"],
    pricing: { kind: "tokens", inputPerM: 4.5, outputPerM: 13.5, cacheHitPerM: 0.15 },
    context: "1M",
    maxOutput: "384K",
    concurrency: 500,
    capabilities: { ...NO_CAPS, thinking: true, toolCall: true, webSearch: true, structuredOutput: true, contextCache: true, fim: true },
    officialUrl: DS_FLASH,
    versionNote: "当前服务版本 DeepSeek-V4-Pro-0813。",
    peakPricing: true,
  },
  {
    id: "mimo-v2.6-pro",
    provider: "mimo",
    endpoint: "chat",
    tagline: "小米全模态旗舰，文本 / 图像 / 视频 / 音频联合理解。",
    tags: ["全模态", "思考"],
    modalityIn: ["文本", "图像", "视频", "音频"],
    modalityOut: ["文本"],
    pricing: { kind: "tokens", inputPerM: 3, outputPerM: 6, cacheHitPerM: 0.025 },
    context: "1M",
    maxOutput: "128K",
    rpm: 100,
    tpm: "10M",
    capabilities: { ...NO_CAPS, thinking: true, toolCall: true, webSearch: true, structuredOutput: true, contextCache: true, vision: true },
    officialUrl: MIMO_PRO,
    versionNote: "万亿参数 MoE 旗舰；V2.5 文本系列已于 2026-10-21 下线。",
  },
  {
    id: "mimo-v2.6-flash",
    provider: "mimo",
    endpoint: "chat",
    tagline: "全模态、低成本推理模型，高频调用更省。",
    tags: ["全模态", "思考"],
    modalityIn: ["文本", "图像", "视频", "音频"],
    modalityOut: ["文本"],
    pricing: { kind: "tokens", inputPerM: 1, outputPerM: 2, cacheHitPerM: 0.02 },
    context: "1M",
    maxOutput: "128K",
    rpm: 100,
    tpm: "10M",
    capabilities: { ...NO_CAPS, thinking: true, toolCall: true, webSearch: true, structuredOutput: true, contextCache: true, vision: true },
    officialUrl: MIMO_FLASH,
  },
  {
    id: "xing4.0-29b",
    provider: "siliconflow",
    endpoint: "chat",
    tagline: "TeleAI 星辰 Xing4.0-29B：29B-A4B MoE，256K 上下文，复杂推理与长程任务。",
    tags: ["文本", "思考", "限时免费"],
    modalityIn: ["文本"],
    modalityOut: ["文本"],
    pricing: { kind: "note", note: "限时免费" },
    context: "256K",
    maxOutput: "—",
    rpm: 1000,
    tpm: "40K",
    capabilities: { ...NO_CAPS, thinking: true, toolCall: true },
    officialUrl: SILICONFLOW_DOCS,
    versionNote:
      "XingChenAGI/Xing4.0-29B（总参 29B、激活 4B 的全国产开源 MoE）。思考默认开启（实测响应含 reasoning_content）；经硅基流动接入，限时免费。",
  },
  {
    id: "qwen3.5-4b",
    provider: "siliconflow",
    endpoint: "chat",
    tagline: "Qwen3.5-4B：最轻量 Dense 多模态模型，256K 原生上下文，视觉输入。",
    tags: ["文本", "图像", "思考", "限时免费"],
    modalityIn: ["文本", "图像"],
    modalityOut: ["文本"],
    pricing: { kind: "note", note: "限时免费" },
    context: "256K",
    maxOutput: "—",
    rpm: 1000,
    tpm: "80K",
    capabilities: { ...NO_CAPS, thinking: true, toolCall: true, vision: true },
    officialUrl: SILICONFLOW_DOCS,
    versionNote:
      "Qwen/Qwen3.5-4B（门控 Delta 网络混合架构）。思考默认开启（实测响应含 reasoning_content）；视觉输入与工具调用为官方标称能力；经硅基流动接入，限时免费。",
  },
  {
    id: "deepseek-ocr",
    provider: "siliconflow",
    endpoint: "chat",
    tagline: "DeepSeek-OCR：专注光学字符识别与「上下文光学压缩」的 3B 视觉模型。",
    tags: ["OCR", "视觉", "限时免费"],
    modalityIn: ["文本", "图像"],
    modalityOut: ["文本"],
    pricing: { kind: "note", note: "限时免费" },
    context: "8K",
    maxOutput: "—",
    rpm: 1000,
    tpm: "80K",
    capabilities: { ...NO_CAPS, vision: true },
    officialUrl: SILICONFLOW_DOCS,
    versionNote:
      "deepseek-ai/DeepSeek-OCR（3B，视觉输入实测可用，base64 图片走标准 OpenAI 视觉格式）；输出 Markdown 等结构化文本；经硅基流动接入，限时免费。",
  },
  {
    id: "bge-m3",
    provider: "siliconflow",
    endpoint: "embedding",
    tagline: "BGE-M3：多语言多功能嵌入，支持密集 / 多向量 / 稀疏三种检索。",
    tags: ["嵌入", "多语言", "RAG"],
    modalityIn: ["文本"],
    modalityOut: ["向量"],
    pricing: { kind: "note", note: "限时免费" },
    context: "8K",
    maxOutput: "—",
    rpm: 2000,
    tpm: "500K",
    capabilities: NO_CAPS,
    officialUrl: SILICONFLOW_DOCS,
    versionNote: "BAAI/bge-m3（1024 维，100+ 语言，8192 词元）；经硅基流动 `/v1/embeddings` 调用，限时免费。",
  },
  {
    id: "bge-large-zh-v1.5",
    provider: "siliconflow",
    endpoint: "embedding",
    tagline: "BGE-Large-ZH v1.5：中文嵌入，C-MTEB 基准表现优异。",
    tags: ["嵌入", "中文", "RAG"],
    modalityIn: ["文本"],
    modalityOut: ["向量"],
    pricing: { kind: "note", note: "限时免费" },
    context: "512",
    maxOutput: "—",
    rpm: 2000,
    tpm: "500K",
    capabilities: NO_CAPS,
    officialUrl: SILICONFLOW_DOCS,
    versionNote: "BAAI/bge-large-zh-v1.5（1024 维，512 词元）；经硅基流动 `/v1/embeddings` 调用，限时免费。",
  },
  {
    id: "bge-reranker-v2-m3",
    provider: "siliconflow",
    endpoint: "rerank",
    tagline: "BGE-Reranker-v2-M3：轻量多语言重排序，查询-文档直接输出相关度。",
    tags: ["重排序", "多语言", "RAG"],
    modalityIn: ["文本"],
    modalityOut: ["相关度分数"],
    pricing: { kind: "note", note: "限时免费" },
    context: "8K",
    maxOutput: "—",
    rpm: 2000,
    tpm: "500K",
    capabilities: NO_CAPS,
    officialUrl: SILICONFLOW_DOCS,
    versionNote: "BAAI/bge-reranker-v2-m3（568M，Jina 兼容 `/v1/rerank` 格式）；经硅基流动接入，限时免费。",
  },
  {
    id: "spark-x2.6",
    provider: "xfyun",
    endpoint: "chat",
    tagline: "讯飞星火 X2.6 旗舰：293B-A30B MoE，1M 上下文，思考与工具调用达标。",
    tags: ["文本", "思考", "限时免费"],
    modalityIn: ["文本"],
    modalityOut: ["文本"],
    pricing: { kind: "note", note: "限时免费（2026-11-28 上游下架）" },
    context: "1M",
    maxOutput: "—",
    capabilities: { ...NO_CAPS, thinking: true, toolCall: true },
    officialUrl: XFYUN_MAAS,
    versionNote:
      "Spark-X2.6（293B-A30B MoE，2026-10-20 发布）。思考默认开启（响应含 reasoning_content）；工具调用已实测可用。上游限时免费、2026-11-28 下架，届时网关同步下线或替换。",
  },
  {
    id: "mimo-v2.5-asr",
    provider: "mimo",
    endpoint: "asr",
    tagline: "语音识别（ASR），按音频小时计费。",
    tags: ["语音识别"],
    modalityIn: ["音频"],
    modalityOut: ["文本"],
    pricing: { kind: "note", note: "¥0.5 / 音频小时" },
    context: "—",
    maxOutput: "—",
    capabilities: NO_CAPS,
    officialUrl: MIMO_PRICING,
  },
  {
    id: "mimo-v2.5-tts",
    provider: "mimo",
    endpoint: "tts",
    tagline: "语音合成（TTS），限时免费。",
    tags: ["语音合成"],
    modalityIn: ["文本"],
    modalityOut: ["音频"],
    pricing: { kind: "note", note: "限时免费" },
    context: "—",
    maxOutput: "—",
    capabilities: NO_CAPS,
    officialUrl: MIMO_PRICING,
  },
  {
    id: "mimo-v2.5-tts-voiceclone",
    provider: "mimo",
    endpoint: "tts",
    tagline: "语音合成 · 声音克隆，限时免费。",
    tags: ["语音合成", "克隆"],
    modalityIn: ["文本", "音频"],
    modalityOut: ["音频"],
    pricing: { kind: "note", note: "限时免费" },
    context: "—",
    maxOutput: "—",
    capabilities: NO_CAPS,
    officialUrl: MIMO_PRICING,
  },
  {
    id: "mimo-v2.5-tts-voicedesign",
    provider: "mimo",
    endpoint: "tts",
    tagline: "语音合成 · 声音设计，限时免费。",
    tags: ["语音合成", "设计"],
    modalityIn: ["文本"],
    modalityOut: ["音频"],
    pricing: { kind: "note", note: "限时免费" },
    context: "—",
    maxOutput: "—",
    capabilities: NO_CAPS,
    officialUrl: MIMO_PRICING,
  },
  // ---------- 阿里云百炼（2026-11-19 接入，价格为百炼华北2原价） ----------
  {
    id: "qwen4-max",
    provider: "bailian",
    endpoint: "chat",
    recommended: true,
    tagline: "千问旗舰：复杂推理与编程，1M 上下文，思考/非思考双模式。",
    tags: ["文本", "图像", "视频", "思考"],
    modalityIn: ["文本", "图像", "视频"],
    modalityOut: ["文本"],
    pricing: { kind: "tokens", inputPerM: 10, outputPerM: 30, cacheHitPerM: 0.5 },
    context: "1M",
    maxOutput: "128K（非思考）/ 256K（思考+输出）",
    capabilities: { ...NO_CAPS, thinking: true, toolCall: true, webSearch: true, structuredOutput: true, contextCache: true, vision: true },
    officialUrl: BAILIAN_MODELS,
    versionNote: "百炼官方价：输入 ¥10/M、输出 ¥30/M、缓存命中 ¥0.5/M（显式缓存创建另计）。单图 ≤16M 像素、视频 ≤2 小时/2GB。",
  },
  {
    id: "qwen3.8-flash",
    provider: "bailian",
    endpoint: "chat",
    tagline: "千问轻量旗舰：快速低成本，1M 上下文，支持图像/视频理解。",
    tags: ["文本", "图像", "视频", "思考"],
    modalityIn: ["文本", "图像", "视频"],
    modalityOut: ["文本"],
    pricing: { kind: "tokens", inputPerM: 0.8, outputPerM: 2.7, cacheHitPerM: 0.1 },
    context: "1M",
    maxOutput: "128K",
    rpm: 30000,
    tpm: "5M",
    capabilities: { ...NO_CAPS, thinking: true, toolCall: true, webSearch: true, structuredOutput: true, contextCache: true, vision: true },
    officialUrl: BAILIAN_MODELS,
  },
  {
    id: "kimi-k3.1-pro",
    provider: "bailian",
    endpoint: "chat",
    tagline: "月之暗面 Kimi K3.1 Pro：1M 上下文，默认开启思考，工具调用达标。",
    tags: ["文本", "思考"],
    modalityIn: ["文本"],
    modalityOut: ["文本"],
    pricing: { kind: "tokens", inputPerM: 13, outputPerM: 68, cacheHitPerM: 1.3 },
    context: "1M",
    maxOutput: "以百炼模型页为准",
    capabilities: { ...NO_CAPS, thinking: true, toolCall: true, structuredOutput: true, contextCache: true },
    officialUrl: "https://help.aliyun.com/zh/model-studio/kimi-k3-1-pro",
    versionNote: "思考默认开启；结构化输出支持 JSON Mode。百炼自营与月之暗面自营（kimi/kimi-k3.1-pro）同价。",
  },
  {
    id: "glm-5.3-flash",
    provider: "bailian",
    endpoint: "chat",
    tagline: "智谱 GLM-5.3-Flash：轻量快速，低成本日常对话与抽取。",
    tags: ["文本", "思考"],
    modalityIn: ["文本"],
    modalityOut: ["文本"],
    pricing: { kind: "tokens", inputPerM: 0.8, outputPerM: 2.8, cacheHitPerM: 0.08 },
    context: "以百炼模型页为准",
    maxOutput: "以百炼模型页为准",
    rpm: 500,
    tpm: "10M",
    capabilities: { ...NO_CAPS, thinking: true, contextCache: true },
    officialUrl: BAILIAN_PRICING,
    versionNote: "智谱自营托管（模型代码 ZHIPU/GLM-5.3-Flash），价格取自百炼模型广场。",
  },
  {
    id: "glm-5.3",
    provider: "bailian",
    endpoint: "chat",
    tagline: "智谱 GLM-5.3 旗舰：1M 上下文，仅思考模式。",
    tags: ["文本", "思考"],
    modalityIn: ["文本"],
    modalityOut: ["文本"],
    pricing: { kind: "tokens", inputPerM: 8, outputPerM: 28, cacheHitPerM: 2 },
    context: "1M",
    maxOutput: "以百炼模型页为准",
    rpm: 500,
    tpm: "5M",
    capabilities: { ...NO_CAPS, thinking: true, contextCache: true },
    officialUrl: BAILIAN_PRICING,
    versionNote: "智谱自营托管（模型代码 ZHIPU/GLM-5.3），仅思考模式；缓存命中 ¥2/M 取自百炼模型广场。",
  },
  {
    id: "minimax-m3.1-flash",
    provider: "bailian",
    endpoint: "chat",
    tagline: "MiniMax M3.1 Flash：1M 上下文，低成本快速响应。",
    tags: ["文本"],
    modalityIn: ["文本"],
    modalityOut: ["文本"],
    pricing: { kind: "tokens", inputPerM: 1, outputPerM: 4, cacheHitPerM: 1 },
    context: "1M",
    maxOutput: "以百炼模型页为准",
    capabilities: { ...NO_CAPS, contextCache: true },
    officialUrl: BAILIAN_PRICING,
    versionNote: "模型代码 MiniMax/MiniMax-M3.1-Flash。官方仅标「缓存享有折扣」未公布单价，网关暂按输入价计缓存命中，公布后同步。",
  },
  {
    id: "step-5-preview",
    provider: "bailian",
    endpoint: "chat",
    tagline: "阶跃星辰 Step-5 Preview：1M 上下文多模态旗舰预览版。",
    tags: ["文本", "思考"],
    modalityIn: ["文本"],
    modalityOut: ["文本"],
    pricing: { kind: "tokens", inputPerM: 7, outputPerM: 20, cacheHitPerM: 0 },
    context: "1M",
    maxOutput: "以百炼模型页为准",
    capabilities: { ...NO_CAPS, thinking: true },
    officialUrl: BAILIAN_PRICING,
    versionNote: "模型代码 stepfun/step-5-preview。官方未提供缓存价（无上下文缓存折扣）。",
  },
];

export function getMarketModel(id: string): MarketModel | undefined {
  return MARKET_MODELS.find((m) => m.id === id);
}

export const CHAT_MODEL_IDS = MARKET_MODELS.filter((m) => m.endpoint === "chat").map((m) => m.id);

export function providerLabel(p: MarketProvider): string {
  return p === "deepseek"
    ? "DeepSeek"
    : p === "xfyun"
      ? "讯飞星火"
      : p === "siliconflow"
        ? "硅基流动"
        : p === "bailian"
          ? "阿里云百炼"
          : "小米 MiMo";
}

export function providerVar(p: MarketProvider): string {
  return p === "deepseek"
    ? "var(--brand-deepseek)"
    : p === "xfyun"
      ? "var(--brand-xfyun)"
      : p === "siliconflow"
        ? "var(--brand-siliconflow)"
        : p === "bailian"
          ? "var(--brand-bailian)"
          : "var(--brand-mimo)";
}

/** 供应商品牌图标路径（web/public/brands/） */
export function providerLogo(p: MarketProvider): string {
  return p === "deepseek"
    ? "/brands/deepseek.ico"
    : p === "xfyun"
      ? "/brands/xfyun.ico"
      : p === "siliconflow"
        ? "/brands/siliconflow.png"
        : p === "bailian"
          ? "/brands/bailian.svg"
          : "/brands/mimo.png";
}

/** 峰时计费口径（与 gateway/deepseek_peak.py 一致：峰时 = 空闲价 ×2，回调自动计价）。 */
export const PEAK_PRICING_NOTE =
  "峰时窗口：北京时间周一至周五 09:00–12:00、14:00–18:00；周末与法定节假日全天错峰（节假日表每年维护）。峰时价格 = 错峰价 ×2，网关计费回调自动套用。";

/** 卡片价格行：¥x 输入 / ¥y 输出（每百万 token）；峰时模型追加 ×2 提示。 */
export function priceLine(m: MarketModel): string {
  if (m.pricing.kind === "note") return m.pricing.note;
  const base = `输入 ¥${m.pricing.inputPerM} / 输出 ¥${m.pricing.outputPerM} · 每百万 token`;
  return m.peakPricing ? `${base}（峰时 ×2）` : base;
}

export { DS_PRICING };
