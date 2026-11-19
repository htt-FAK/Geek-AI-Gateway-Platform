import { prisma } from "@/lib/db";
import { assertHasBalance } from "@/lib/budget";
import { getGatewayModels } from "@/lib/gateway-models";
import { chatCompletions } from "@/lib/litellm";
import {
  applyMemoryOps,
  isRejectedMemory,
  MEMORY_MODEL,
  memoryHash,
  parseMemoryOps,
  redactSecrets,
  type MemoryItem,
} from "@/lib/memory-policy";
import { messagesToSummarize } from "@/lib/context-pack";
import { parseImagePaths } from "@/lib/conversation-policy";
import { recordSpend } from "@/lib/spend";
import { costFromPayload, tokensFromUsage } from "@/lib/sse-usage";

const SUMMARY_SYSTEM = `你在维护一段会话的滚动摘要。把已有摘要和新滑出的消息合并成一段新摘要。
保留用户目标、决定、约束、关键事实和未完成事项。不要写入密钥、密码、验证码或 token。
用中文，不超过 800 字。只输出摘要正文。`;

const MEMORY_SYSTEM = `你从对话里抽取可以跨会话记住的稳定事实。只保留称呼、偏好、正在做的项目、明确约束。
不要记录一次性问题、闲聊、密钥、密码、验证码、token。
对照已有记忆，只输出 JSON，不要写解释：
{"ops":[{"op":"add","content":"..."},{"op":"update","match":"原句片段","content":"新句"},{"op":"drop","match":"原句片段"}]}
没有变化就输出 {"ops":[]}。每条 content 不超过 80 字。`;

type PostTurnInput = {
  userId: string;
  litellmUserId: string | null;
  apiKey: string;
  keyName: string | null;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
};

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

async function completePlain(input: PostTurnInput & {
  kind: "summary" | "memory";
  messages: { role: "system" | "user"; content: string }[];
  maxTokens: number;
}): Promise<string | null> {
  const models = await getGatewayModels();
  if (!models.includes(MEMORY_MODEL)) {
    console.error(`[playground-memory] ${MEMORY_MODEL} 不可用，跳过${input.kind}`);
    return null;
  }
  try {
    await assertHasBalance({
      userId: input.userId,
      litellmUserId: input.litellmUserId,
      litellmKeyToken: input.apiKey,
    });
  } catch {
    return null;
  }

  let upstream: Response;
  try {
    upstream = await chatCompletions({
      apiKey: input.apiKey,
      appEnforcedUserId: input.litellmUserId ?? undefined,
      body: {
        model: MEMORY_MODEL,
        messages: input.messages,
        stream: false,
        temperature: 0,
        max_tokens: input.maxTokens,
        metadata: { kind: input.kind },
      },
    });
  } catch (error) {
    console.error(
      `[playground-memory] ${input.kind} 请求失败`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
  if (!upstream.ok) {
    console.error(`[playground-memory] ${input.kind} 上游状态 ${upstream.status}`);
    return null;
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    return null;
  }
  const usage = tokensFromUsage(
    payload && typeof payload === "object" ? (payload as { usage?: unknown }).usage : undefined,
  );
  const cost = costFromPayload(payload);
  await recordSpend({
    userId: input.userId,
    model: MEMORY_MODEL,
    keyName: input.keyName,
    cost,
    usage,
    kind: input.kind,
  });
  const content =
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { choices?: unknown }).choices)
      ? (payload as { choices: Array<{ message?: { content?: unknown } }> }).choices[0]?.message?.content
      : "";
  return typeof content === "string" ? content : "";
}

async function syncMemories(userId: string, sourceConversationId: string, next: MemoryItem[]) {
  const kept = new Set<string>();
  for (const item of next) {
    if (isRejectedMemory(item.content)) continue;
    const clash = await prisma.userMemory.findUnique({
      where: { userId_contentHash: { userId, contentHash: item.hash } },
    });
    if (clash && clash.id !== item.id) {
      // 用户手动删过的记忆（status=deleted）不允许被后台抽取复活。
      if (clash.status === "deleted") continue;
      await prisma.userMemory.update({
        where: { id: clash.id },
        data: { status: "active", content: item.content, sourceConversationId },
      });
      kept.add(clash.id);
      if (item.id) {
        await prisma.userMemory.updateMany({
          where: { id: item.id, userId },
          data: { status: "dropped" },
        });
      }
      continue;
    }
    if (item.id) {
      // CAS：用户在后台整理期间删除/改过这条记忆时，不再覆盖。
      const updated = await prisma.userMemory.updateMany({
        where: {
          id: item.id,
          userId,
          ...(item.updatedAt ? { updatedAt: new Date(item.updatedAt) } : {}),
        },
        data: {
          content: item.content,
          contentHash: item.hash,
          status: "active",
          sourceConversationId,
        },
      });
      if (updated.count > 0) kept.add(item.id);
      continue;
    }
    const row = await prisma.userMemory.upsert({
      where: { userId_contentHash: { userId, contentHash: item.hash } },
      update: { status: "active", content: item.content, sourceConversationId },
      create: {
        userId,
        content: item.content,
        contentHash: item.hash,
        sourceConversationId,
        status: "active",
      },
    });
    kept.add(row.id);
  }

  if (kept.size === 0) {
    await prisma.userMemory.updateMany({
      where: { userId, status: "active" },
      data: { status: "dropped" },
    });
    return;
  }
  await prisma.userMemory.updateMany({
    where: { userId, status: "active", id: { notIn: [...kept] } },
    data: { status: "dropped" },
  });
}

async function refreshSummary(input: PostTurnInput) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, userId: input.userId },
    select: { summary: true, summaryThroughMessageId: true },
  });
  if (!conversation) return;

  const rows = await prisma.message.findMany({
    where: { conversationId: input.conversationId, status: { not: "error" } },
    orderBy: { seq: "asc" },
    select: { id: true, role: true, content: true, imagePaths: true },
  });
  const pending = messagesToSummarize(rows, conversation.summaryThroughMessageId);
  if (pending.length === 0) return;

  const lines = pending.map((message) => {
    const label = message.role === "user" ? "用户" : "助手";
    const images = parseImagePaths(message.imagePaths).length;
    const body = message.content.trim() || (images ? "（附带图片）" : "（空）");
    return `${label}：${clip(body, 4_000)}`;
  });
  const text = await completePlain({
    ...input,
    kind: "summary",
    maxTokens: 700,
    messages: [
      { role: "system", content: SUMMARY_SYSTEM },
      {
        role: "user",
        content: `已有摘要：\n${conversation.summary.trim() || "（无）"}\n\n新滑出的消息：\n${lines.join("\n")}`,
      },
    ],
  });
  if (!text || !text.trim()) return;

  const summary = clip(redactSecrets(text).trim(), 2_000);
  const through = pending[pending.length - 1]?.id;
  if (!through) return;
  // CAS：如果另一轮整理已经推进了摘要边界，丢弃这次结果，避免旧摘要覆盖新摘要。
  await prisma.conversation.updateMany({
    where: {
      id: input.conversationId,
      userId: input.userId,
      summaryThroughMessageId: conversation.summaryThroughMessageId,
    },
    data: { summary, summaryThroughMessageId: through },
  });
}

async function refreshMemories(input: PostTurnInput) {
  const assistant = await prisma.message.findFirst({
    where: { id: input.assistantMessageId, conversationId: input.conversationId },
    select: { content: true, status: true },
  });
  if (!assistant || assistant.status !== "complete" || !assistant.content.trim()) return;

  // 按本轮 userMessageId 取用户原话：并发发送时 assistant.seq 前一条不一定是本轮提问。
  const userMessage = await prisma.message.findFirst({
    where: {
      id: input.userMessageId,
      conversationId: input.conversationId,
      role: "user",
    },
    select: { content: true },
  });
  const existing = await prisma.userMemory.findMany({
    where: { userId: input.userId, status: "active" },
    orderBy: { createdAt: "asc" },
  });
  const known = existing.map((row) => `- ${row.content}`).join("\n") || "（无）";
  const text = await completePlain({
    ...input,
    kind: "memory",
    maxTokens: 500,
    messages: [
      { role: "system", content: MEMORY_SYSTEM },
      {
        role: "user",
        content: `已有记忆：\n${known}\n\n本轮：\n用户：${clip(userMessage?.content ?? "", 4_000)}\n助手：${clip(assistant.content, 4_000)}`,
      },
    ],
  });
  if (text == null) return;

  const ops = parseMemoryOps(text);
  if (ops.length === 0) return;
  const current: MemoryItem[] = existing.map((row) => ({
    id: row.id,
    content: row.content,
    hash: row.contentHash || memoryHash(row.content),
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }));
  const next = applyMemoryOps(current, ops, Date.now());
  await syncMemories(input.userId, input.conversationId, next);
}

/**
 * 同一会话的整理任务串行执行：连续两轮完成时，第二轮的摘要/记忆会等第一轮跑完，
 * 避免对同一段消息重复调用模型（重复计费）和记忆同步互相覆盖。
 * 单实例内存队列；多实例部署需换成持久化队列/分布式锁。
 */
const postTurnQueues = new Map<string, Promise<void>>();

export function schedulePostTurn(input: PostTurnInput) {
  const key = `${input.userId}:${input.conversationId}`;
  const previous = postTurnQueues.get(key) ?? Promise.resolve();
  const run = previous
    .catch(() => undefined)
    .then(() => runPostTurn(input))
    .catch((error) => {
      console.error(
        "[playground-memory] 事后整理失败",
        error instanceof Error ? error.message : error,
      );
    })
    .finally(() => {
      if (postTurnQueues.get(key) === run) postTurnQueues.delete(key);
    });
  postTurnQueues.set(key, run);
}

async function runPostTurn(input: PostTurnInput) {
  await refreshSummary(input);
  await refreshMemories(input);
}
