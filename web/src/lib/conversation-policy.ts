/** 单条消息入库前的字数上限，避免一次粘贴撑爆后续上下文。 */
export const MAX_MESSAGE_CHARS = 16_000;

/** 单次补全 token 上限：调试台与 /api/chat 共用，防止一条请求烧穿余额。 */
export const MAX_COMPLETION_TOKENS = 128_000;

/** 单次请求正文总字数上限：调试台与 /api/chat 共用。 */
export const MAX_REQUEST_TEXT_CHARS = 200_000;

export const DEFAULT_CONVERSATION_TITLE = "新对话";

export type AssistantRecordStatus = "complete" | "aborted" | "error";

export function ownedConversationWhere(userId: string, conversationId: string) {
  return { id: conversationId, userId };
}

export function selectOwnedConversation<T extends { id: string; userId: string }>(
  rows: readonly T[],
  userId: string,
  conversationId: string,
): T | null {
  const where = ownedConversationWhere(userId, conversationId);
  return rows.find((row) => row.id === where.id && row.userId === where.userId) ?? null;
}

/**
 * 助手消息始终落库。停止生成时保留已经吐出的半段，状态标 aborted。
 */
export function decideAssistantRecord(input: {
  aborted: boolean;
  failed: boolean;
  content: string;
}): { status: AssistantRecordStatus; content: string; shouldPersist: true } {
  if (input.aborted) {
    return { status: "aborted", content: input.content, shouldPersist: true };
  }
  if (input.failed) {
    return { status: "error", content: input.content, shouldPersist: true };
  }
  return { status: "complete", content: input.content, shouldPersist: true };
}

export function conversationTitleFrom(content: string): string {
  const flat = content.replace(/\s+/g, " ").trim();
  if (!flat) return DEFAULT_CONVERSATION_TITLE;
  return Array.from(flat).slice(0, 20).join("");
}

export function truncateMessage(content: string): { text: string; truncated: boolean } {
  if (content.length <= MAX_MESSAGE_CHARS) {
    return { text: content, truncated: false };
  }
  return {
    text: `${content.slice(0, MAX_MESSAGE_CHARS)}\n\n[内容过长，已截断]`,
    truncated: true,
  };
}

/** 调试台只接受文本对话模型。语音、嵌入、重排序留给网关 API。 */
export function isPlaygroundChatModel(model: string): boolean {
  if (model.includes("-asr") || model.includes("-tts")) return false;
  if (/^bge-|rerank|embed/i.test(model)) return false;
  return true;
}

export function parseImagePaths(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {
    return [];
  }
}

export function imagePublicPath(conversationId: string, messageId: string, index: number): string {
  return `/api/conversations/${conversationId}/images/${messageId}/${index}`;
}
