export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export function tokensFromUsage(usage: unknown): TokenUsage {
  if (!usage || typeof usage !== "object") {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }
  const u = usage as Record<string, unknown>;
  const promptTokens = Number(u.prompt_tokens ?? u.promptTokens ?? 0) || 0;
  const completionTokens = Number(u.completion_tokens ?? u.completionTokens ?? 0) || 0;
  const totalTokens =
    Number(u.total_tokens ?? u.totalTokens ?? 0) || promptTokens + completionTokens;
  return { promptTokens, completionTokens, totalTokens };
}

/** 非流式：直接读 JSON 顶层 response_cost（LiteLLM 代理回包字段）。 */
export function costFromPayload(payload: unknown): number {
  if (!payload || typeof payload !== "object") return 0;
  const n = Number((payload as Record<string, unknown>).response_cost);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 流式：按 SSE 行解析 JSON，取最后一条带 usage 的对象和费用。
 * LiteLLM 把费用放在末块 usage.cost（老版本顶层 response_cost 也认）。
 */
export function parseSseTotals(text: string): { usage: TokenUsage; cost: number } {
  let usage: TokenUsage | null = null;
  let cost = 0;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    let chunk: unknown;
    try {
      chunk = JSON.parse(data);
    } catch {
      continue;
    }
    if (!chunk || typeof chunk !== "object") continue;
    const rec = chunk as Record<string, unknown>;
    if (rec.usage && typeof rec.usage === "object") {
      usage = tokensFromUsage(rec.usage);
      const usageCost = Number((rec.usage as Record<string, unknown>).cost);
      if (Number.isFinite(usageCost) && usageCost > 0) cost = usageCost;
    }
    const n = Number(rec.response_cost);
    if (Number.isFinite(n) && n > 0) cost = n;
  }
  return { usage: usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, cost };
}

export type SseFold = {
  content: string;
  reasoning: string;
  usage: TokenUsage;
  cost: number;
  buffer: string;
};

export function createSseFold(): SseFold {
  return {
    content: "",
    reasoning: "",
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    cost: 0,
    buffer: "",
  };
}

/** 边转发边累计助手正文、思考过程和 usage，供中止时落库。 */
export function foldSseText(state: SseFold, chunk: string): void {
  state.buffer += chunk;
  const parts = state.buffer.split("\n");
  state.buffer = parts.pop() ?? "";
  for (const line of parts) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    let json: unknown;
    try {
      json = JSON.parse(data);
    } catch {
      continue;
    }
    if (!json || typeof json !== "object") continue;
    const rec = json as Record<string, unknown>;
    const choices = rec.choices;
    if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
      const choice = choices[0] as Record<string, unknown>;
      const delta = choice.delta;
      const message = choice.message;
      const source =
        delta && typeof delta === "object"
          ? (delta as Record<string, unknown>)
          : message && typeof message === "object"
            ? (message as Record<string, unknown>)
            : null;
      if (source) {
        if (typeof source.content === "string") state.content += source.content;
        if (typeof source.reasoning_content === "string") state.reasoning += source.reasoning_content;
        // 商汤日日新等上游用 reasoning 字段输出思考内容（非 reasoning_content）
        else if (typeof source.reasoning === "string") state.reasoning += source.reasoning;
      }
    }
    if (rec.usage && typeof rec.usage === "object") {
      state.usage = tokensFromUsage(rec.usage);
      const usageCost = Number((rec.usage as Record<string, unknown>).cost);
      if (Number.isFinite(usageCost) && usageCost > 0) state.cost = usageCost;
    }
    const topCost = Number(rec.response_cost);
    if (Number.isFinite(topCost) && topCost > 0) state.cost = topCost;
  }
}
