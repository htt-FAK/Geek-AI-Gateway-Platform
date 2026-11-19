/**
 * 调试台上下文打包。
 * 顺序：用户 System Prompt → 长期记忆 → 滚动摘要 → 摘要还没盖住的缺口 → 最近原文。
 * 提示词预算与本轮 max_tokens 分开：补全额度由请求参数单独占，不塞进这 12000。
 */

export const RECENT_WINDOW = 6;
export const PROMPT_TOKEN_BUDGET = 12_000;

export const MEMORY_BLOCK_LEAD =
  "以下是关于这位用户的长期记忆。若与用户本轮原话冲突，以原话为准。";
export const SUMMARY_BLOCK_LEAD = "以下是当前会话更早内容的摘要。";

export type HistoryMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** 只有最新一条用户消息上的图会发给模型 */
  images?: string[];
};

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type PackedMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
};

/** 中文约 1 字 1 token，ASCII 约 4 字 1 token。 */
export function estimateTokens(text: string): number {
  let units = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    units += code > 0xff ? 1 : 0.25;
  }
  return Math.ceil(units);
}

export function messagesToSummarize<T extends { id: string }>(
  messages: readonly T[],
  summaryThroughMessageId: string | null,
): T[] {
  if (messages.length <= RECENT_WINDOW) return [];
  const recentStart = messages.length - RECENT_WINDOW;
  const older = messages.slice(0, recentStart);
  if (!summaryThroughMessageId) return older;
  const coveredAt = messages.findIndex((message) => message.id === summaryThroughMessageId);
  if (coveredAt < 0) return older;
  if (coveredAt >= recentStart) return [];
  return messages.slice(coveredAt + 1, recentStart);
}

function messageTokens(content: string | ContentPart[]): number {
  if (typeof content === "string") return estimateTokens(content);
  return content.reduce((sum, part) => {
    if (part.type === "text") return sum + estimateTokens(part.text);
    return sum + 256;
  }, 0);
}

function packTokens(messages: readonly PackedMessage[]): number {
  return messages.reduce((sum, message) => sum + messageTokens(message.content), 0);
}

function renderHistoryMessage(message: HistoryMessage, attachImages: boolean): string | ContentPart[] {
  if (attachImages && message.images && message.images.length > 0) {
    const text = message.content.trim() || "请描述这张图片";
    return [
      { type: "text", text },
      ...message.images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
    ];
  }
  return message.content;
}

export function packContext(input: {
  systemPrompt: string;
  memories: readonly string[];
  summary: string;
  summaryThroughMessageId: string | null;
  messages: readonly HistoryMessage[];
}): { messages: PackedMessage[]; summarized: boolean } {
  const history = input.messages;
  const latest = history[history.length - 1];
  const recentStart = Math.max(0, history.length - RECENT_WINDOW);
  let recent = history.slice(recentStart);
  let gap = messagesToSummarize(history, input.summaryThroughMessageId);
  let summaryText = input.summary;

  const build = (): PackedMessage[] => {
    const packed: PackedMessage[] = [];
    const systemPrompt = input.systemPrompt.trim();
    if (systemPrompt) {
      packed.push({ role: "system", content: systemPrompt });
    }
    const memories = input.memories.map((item) => item.trim()).filter(Boolean);
    if (memories.length > 0) {
      packed.push({
        role: "system",
        content: `${MEMORY_BLOCK_LEAD}\n${memories.map((item) => `- ${item}`).join("\n")}`,
      });
    }
    if (summaryText.trim()) {
      packed.push({
        role: "system",
        content: `${SUMMARY_BLOCK_LEAD}\n${summaryText.trim()}`,
      });
    }
    for (const message of [...gap, ...recent]) {
      const attachImages = Boolean(latest && message.id === latest.id && message.role === "user");
      packed.push({
        role: message.role,
        content: renderHistoryMessage(message, attachImages),
      });
    }
    return packed;
  };

  let packed = build();
  let guard = 0;
  while (packTokens(packed) > PROMPT_TOKEN_BUDGET && gap.length > 0 && guard < 100) {
    gap = gap.slice(1);
    packed = build();
    guard += 1;
  }
  while (packTokens(packed) > PROMPT_TOKEN_BUDGET && recent.length > 1 && guard < 200) {
    recent = recent.slice(1);
    if (latest && !recent.some((message) => message.id === latest.id)) {
      recent = [...recent, latest];
    }
    packed = build();
    guard += 1;
  }
  while (packTokens(packed) > PROMPT_TOKEN_BUDGET && summaryText.length > 200 && guard < 220) {
    summaryText = summaryText.slice(Math.ceil(summaryText.length * 0.3));
    packed = build();
    guard += 1;
  }

  const included = new Set([...gap, ...recent].map((message) => message.id));
  const omitted = history.some((message) => !included.has(message.id));
  return { messages: packed, summarized: omitted && summaryText.trim().length > 0 };
}
