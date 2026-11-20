import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { z } from "zod";
import { assertHasBalance, BudgetError } from "@/lib/budget";
import { validateImageDataUrls } from "@/lib/chat-payload";
import { packContext, type HistoryMessage } from "@/lib/context-pack";
import {
  conversationTitleFrom,
  decideAssistantRecord,
  DEFAULT_CONVERSATION_TITLE,
  isPlaygroundChatModel,
  MAX_COMPLETION_TOKENS,
  MAX_REQUEST_TEXT_CHARS,
  ownedConversationWhere,
  truncateMessage,
} from "@/lib/conversation-policy";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getGatewayModels } from "@/lib/gateway-models";
import { chatCompletions } from "@/lib/litellm";
import { saveMessageImages } from "@/lib/playground-files";
import { schedulePostTurn } from "@/lib/post-turn";
import { acquireInflight, inflightBusyResponse, releaseInflight } from "@/lib/rate-limit";
import { recordSpend } from "@/lib/spend";
import { costFromPayload, createSseFold, foldSseText, tokensFromUsage, type TokenUsage } from "@/lib/sse-usage";
import {
  getThinkingProfile,
  thinkingStopToRequest,
  type ThinkingStopId,
} from "@/lib/thinking-depth";

const settingsShape = {
  model: z.string().min(1),
  systemPrompt: z.string().max(20_000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(MAX_COMPLETION_TOKENS).optional(),
  stream: z.boolean().optional(),
  thinkingStop: z.enum(["off", "standard", "max", "on", "low"]).nullable().optional(),
};

export const createConversationSchema = z.object(settingsShape);
export const sendMessageSchema = z.object({
  ...settingsShape,
  content: z.string().max(MAX_REQUEST_TEXT_CHARS).optional().default(""),
  images: z.array(z.string().max(7_000_000)).max(4).optional().default([]),
});

export async function playgroundModelError(model: string): Promise<string | null> {
  if (!isPlaygroundChatModel(model)) return "该模型不能在调试台对话";
  const available = await getGatewayModels();
  if (!available.includes(model)) return "模型不可用";
  return null;
}

export async function findOwnedConversation(userId: string, conversationId: string) {
  return prisma.conversation.findFirst({
    where: ownedConversationWhere(userId, conversationId),
  });
}

/** 同一会话并发发送时，seq 用 max+1 分配，撞唯一索引/写锁就重试几次。 */
const SEQ_RETRY_LIMIT = 5;

function isRetryableWrite(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const rec = error as { code?: unknown; message?: unknown };
  const code = typeof rec.code === "string" ? rec.code : "";
  if (
    code === "P2002" ||
    code === "P2034" ||
    code === "SQLITE_BUSY" ||
    code === "SQLITE_CONSTRAINT_UNIQUE"
  ) {
    return true;
  }
  const message = typeof rec.message === "string" ? rec.message : "";
  return /unique constraint|database is locked|write conflict/i.test(message);
}

async function retryWrite<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < SEQ_RETRY_LIMIT; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (!isRetryableWrite(error) || attempt === SEQ_RETRY_LIMIT - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
    }
  }
  throw new Error("unreachable");
}

function upstreamFailure(status: number, text: string): { error: string; detail?: string; status: number } {
  if (status === 429) {
    // 429 分三种：网关用户预算硬闸 / 用户级 RPM 限额 / 上游共享 Key 限流。
    const budgetHit = /budget/i.test(text);
    const userRpmHit = !budgetHit && /rpm|rate.?limit/i.test(text);
    if (budgetHit) {
      return { status: 429, error: "网关预算已用尽，请联系管理员充值", detail: text.slice(0, 300) };
    }
    if (userRpmHit) {
      return {
        status: 429,
        error: `您的账号请求频率已达上限（每分钟 ${env().gatewayUserRpmLimit} 次），请约 1 分钟后重试`,
        detail: text.slice(0, 300),
      };
    }
    return {
      status: 429,
      error: "上游模型服务限流，请约 1 分钟后重试",
      detail:
        "上游按共享 Key 限制每分钟请求数（全体用户共用同一额度），窗口约 1 分钟重置；高峰期持续出现需提升上游档位。",
    };
  }
  return { status, error: "网关调用失败", detail: text.slice(0, 500) };
}

export async function sendConversationMessage(input: {
  req: Request;
  user: User;
  conversationId: string;
}): Promise<Response> {
  const conversation = await findOwnedConversation(input.user.id, input.conversationId);
  if (!conversation) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }
  const owned = conversation;

  const parsed = sendMessageSchema.safeParse(await input.req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }

  const model = parsed.data.model;
  const modelError = await playgroundModelError(model);
  if (modelError) {
    return NextResponse.json({ error: modelError }, { status: 400 });
  }

  const images = parsed.data.images;
  const visionError = validateImageDataUrls(model, images);
  if (visionError) {
    return NextResponse.json({ error: visionError }, { status: 400 });
  }

  const rawContent = parsed.data.content.trim();
  if (!rawContent && images.length === 0) {
    return NextResponse.json({ error: "请输入内容" }, { status: 400 });
  }
  const { text: content } = truncateMessage(rawContent);

  if (!input.user.litellmKeyTokenEnc) {
    return NextResponse.json({ error: "账号未开通 API Key" }, { status: 400 });
  }
  const apiKey = decryptSecret(input.user.litellmKeyTokenEnc);

  try {
    await assertHasBalance({
      userId: input.user.id,
      litellmUserId: input.user.litellmUserId,
      litellmKeyToken: apiKey,
    });
  } catch (error) {
    if (error instanceof BudgetError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }
    throw error;
  }

  // 在途并发上限：与 /api/chat 共用 chat:<userId> 槽位池，压住并发超支面。
  // 必须在写用户消息之前抢槽：槽满 429 时库里不能留下孤儿消息（页面按「未保存」回滚输入框）。
  // 非流式在每个出口释放；流式在流结束/取消时释放；意外抛错由外层 catch 兜底。
  const inflightKey = `chat:${input.user.id}`;
  if (!acquireInflight(inflightKey)) {
    return inflightBusyResponse();
  }
  let inflightHeld = true;
  const releaseInflightOnce = () => {
    if (inflightHeld) {
      inflightHeld = false;
      releaseInflight(inflightKey);
    }
  };

  try {
    const systemPrompt = parsed.data.systemPrompt ?? conversation.systemPrompt;
    const temperature = parsed.data.temperature ?? conversation.temperature;
    const maxTokens = parsed.data.maxTokens ?? conversation.maxTokens;
    const stream = parsed.data.stream ?? conversation.stream;
    const thinkingStop =
      parsed.data.thinkingStop === undefined ? conversation.thinkingStop : parsed.data.thinkingStop;
    const title =
      conversation.title === DEFAULT_CONVERSATION_TITLE
        ? conversationTitleFrom(rawContent || "图片")
        : conversation.title;

    const userMessage = await retryWrite(() =>
      prisma.$transaction(async (tx) => {
        const last = await tx.message.findFirst({
          where: { conversationId: conversation.id },
          orderBy: { seq: "desc" },
          select: { seq: true },
        });
        const created = await tx.message.create({
          data: {
            conversationId: conversation.id,
            role: "user",
            content,
            status: "complete",
            seq: (last?.seq ?? 0) + 1,
            imagePaths: "[]",
          },
        });
        await tx.conversation.update({
          where: { id: conversation.id },
          data: {
            model,
            systemPrompt,
            temperature,
            maxTokens,
            stream,
            thinkingStop,
            title,
            status: "active",
          },
        });
        return created;
      }),
    );

    if (images.length > 0) {
      try {
        const rels = await saveMessageImages({
          userId: input.user.id,
          conversationId: conversation.id,
          messageId: userMessage.id,
          dataUrls: images,
        });
        await prisma.message.update({
          where: { id: userMessage.id },
          data: { imagePaths: JSON.stringify(rels) },
        });
      } catch {
        await prisma.message.delete({ where: { id: userMessage.id } });
        releaseInflightOnce();
        return NextResponse.json({ error: "图片保存失败", saved: false }, { status: 400 });
      }
    }

    const stored = await prisma.message.findMany({
      where: { conversationId: conversation.id, status: { not: "error" } },
      orderBy: { seq: "asc" },
      select: { id: true, role: true, content: true },
    });
    const memories = await prisma.userMemory.findMany({
      where: { userId: input.user.id, status: "active" },
      orderBy: { createdAt: "asc" },
      select: { content: true },
    });
    const fresh = await prisma.conversation.findFirst({
      where: ownedConversationWhere(input.user.id, conversation.id),
      select: { summary: true, summaryThroughMessageId: true, systemPrompt: true },
    });

    const history: HistoryMessage[] = stored
      .filter((row) => row.role === "user" || row.role === "assistant")
      .map((row) => ({
        id: row.id,
        role: row.role as "user" | "assistant",
        content: row.content,
        images: row.id === userMessage.id && images.length > 0 ? images : undefined,
      }));
    const packed = packContext({
      systemPrompt: fresh?.systemPrompt ?? systemPrompt,
      memories: memories.map((item) => item.content),
      summary: fresh?.summary ?? "",
      summaryThroughMessageId: fresh?.summaryThroughMessageId ?? null,
      messages: history,
    });

    const thinking = thinkingStopToRequest(
      getThinkingProfile(model),
      (thinkingStop as ThinkingStopId | null) ?? null,
    );

    const abortController = new AbortController();
    if (input.req.signal.aborted) abortController.abort();
    else input.req.signal.addEventListener("abort", () => abortController.abort(), { once: true });

    let saved = false;
    async function persistAssistant(args: {
      aborted: boolean;
      failed: boolean;
      content: string;
      reasoning: string;
      usage: TokenUsage;
      cost: number;
    }) {
      if (saved) return;
      saved = true;
      const decision = decideAssistantRecord({
        aborted: args.aborted,
        failed: args.failed,
        content: args.content,
      });
      // 并发发送时不能再用 userMessage.seq + 1（可能已被另一轮占用），
      // 统一在事务里按 max(seq)+1 追加。
      const assistant = await retryWrite(() =>
        prisma.$transaction(async (tx) => {
          const last = await tx.message.findFirst({
            where: { conversationId: owned.id },
            orderBy: { seq: "desc" },
            select: { seq: true },
          });
          return tx.message.create({
            data: {
              conversationId: owned.id,
              role: "assistant",
              content: decision.content,
              reasoningContent: args.reasoning,
              status: decision.status,
              seq: (last?.seq ?? 0) + 1,
              promptTokens: args.usage.promptTokens,
              completionTokens: args.usage.completionTokens,
              totalTokens: args.usage.totalTokens,
              costCny: 0,
            },
          });
        }),
      );
      const recordCost = decision.status === "complete" || args.cost > 0;
      if (recordCost) {
        try {
          const peaked = await recordSpend({
            userId: input.user.id,
            model,
            keyName: input.user.litellmKeyId,
            cost: args.cost,
            usage: args.usage,
            kind: "chat",
          });
          await prisma.message.update({
            where: { id: assistant.id },
            data: { costCny: peaked },
          });
        } catch (error) {
          console.error("[playground] 记花费失败", error instanceof Error ? error.message : error);
        }
      }
      await prisma.conversation.update({
        where: { id: owned.id },
        data: {
          status: decision.status === "complete" ? "active" : decision.status,
          promptTokens: { increment: args.usage.promptTokens },
          completionTokens: { increment: args.usage.completionTokens },
          totalTokens: { increment: args.usage.totalTokens },
        },
      });
      if (decision.status === "complete") {
        schedulePostTurn({
          userId: input.user.id,
          litellmUserId: input.user.litellmUserId,
          apiKey,
          keyName: input.user.litellmKeyId,
          conversationId: owned.id,
          userMessageId: userMessage.id,
          assistantMessageId: assistant.id,
        });
      }
    }

    const emptyUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    let upstream: Response;
    try {
      upstream = await chatCompletions({
        apiKey,
        appEnforcedUserId: input.user.litellmUserId ?? undefined,
        signal: abortController.signal,
        body: {
          model,
          messages: packed.messages,
          stream,
          ...(stream ? { stream_options: { include_usage: true } } : {}),
          max_tokens: maxTokens,
          temperature,
          ...thinking,
          metadata: { kind: "chat" },
        },
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        await persistAssistant({
          aborted: true,
          failed: false,
          content: "",
          reasoning: "",
          usage: emptyUsage,
          cost: 0,
        });
        releaseInflightOnce();
        return NextResponse.json({ error: "请求已取消", saved: true }, { status: 499 });
      }
      const message = error instanceof Error ? error.message : "unknown";
      const cause =
        error instanceof Error && "cause" in error ? String((error as { cause?: unknown }).cause) : "";
      const offline =
        message.includes("fetch failed") || cause.includes("ECONNREFUSED") || cause.includes("ENOTFOUND");
      const errorText = offline ? "网关未启动或无法连接，请先启动 LiteLLM（GATEWAY_BASE_URL）" : "网关请求失败";
      await persistAssistant({
        aborted: false,
        failed: true,
        content: errorText,
        reasoning: "",
        usage: emptyUsage,
        cost: 0,
      });
      releaseInflightOnce();
      return NextResponse.json({ error: errorText, detail: cause || message, saved: true }, { status: 502 });
    }

    if (!upstream.ok) {
      const text = await upstream.text();
      const failure = upstreamFailure(upstream.status, text);
      await persistAssistant({
        aborted: false,
        failed: true,
        content: failure.error,
        reasoning: "",
        usage: emptyUsage,
        cost: 0,
      });
      releaseInflightOnce();
      return NextResponse.json({ error: failure.error, detail: failure.detail, saved: true }, { status: failure.status });
    }

    const headerCostRaw = Number(upstream.headers.get("x-litellm-response-cost") ?? "");
    const headerCost = Number.isFinite(headerCostRaw) ? headerCostRaw : 0;
    const resolveCost = (bodyCost: number) => (headerCost > 0 ? headerCost : bodyCost);

    if (!stream) {
      let payload: unknown;
      try {
        payload = await upstream.json();
      } catch {
        if (abortController.signal.aborted) {
          await persistAssistant({
            aborted: true,
            failed: false,
            content: "",
            reasoning: "",
            usage: emptyUsage,
            cost: 0,
          });
          releaseInflightOnce();
          return NextResponse.json({ error: "请求已取消", saved: true }, { status: 499 });
        }
        // 上游 200 但 body 不是合法 JSON：必须落一条 error 助手消息，
        // 否则库里只有用户消息，前端却会回滚并在重发时写出重复消息。
        await persistAssistant({
          aborted: false,
          failed: true,
          content: "网关返回格式异常",
          reasoning: "",
          usage: emptyUsage,
          cost: 0,
        });
        releaseInflightOnce();
        return NextResponse.json(
          { error: "网关返回格式异常", detail: "上游响应不是合法 JSON", saved: true },
          { status: 502 },
        );
      }
      const message =
        payload && typeof payload === "object"
          ? (payload as { choices?: Array<{ message?: { content?: unknown; reasoning_content?: unknown; reasoning?: unknown } }> })
              .choices?.[0]?.message
          : undefined;
      const usage = tokensFromUsage(
        payload && typeof payload === "object" ? (payload as { usage?: unknown }).usage : undefined,
      );
      const cost = resolveCost(costFromPayload(payload));
      await persistAssistant({
        aborted: false,
        failed: false,
        content: typeof message?.content === "string" ? message.content : "",
        // 商汤日日新等上游用 reasoning 字段输出思考内容（非 reasoning_content）
        reasoning:
          typeof message?.reasoning_content === "string"
            ? message.reasoning_content
            : typeof message?.reasoning === "string"
              ? message.reasoning
              : "",
        usage,
        cost,
      });
      releaseInflightOnce();
      return NextResponse.json(payload);
    }

    const reader = upstream.body?.getReader();
    if (!reader) {
      await persistAssistant({
        aborted: false,
        failed: true,
        content: "无流式响应",
        reasoning: "",
        usage: emptyUsage,
        cost: 0,
      });
      releaseInflightOnce();
      return NextResponse.json({ error: "无流式响应", saved: true }, { status: 502 });
    }

    const fold = createSseFold();
    const decoder = new TextDecoder();
    const body = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            foldSseText(fold, decoder.decode(value, { stream: true }));
            controller.enqueue(value);
          }
          foldSseText(fold, decoder.decode());
          await persistAssistant({
            aborted: abortController.signal.aborted,
            failed: false,
            content: fold.content,
            reasoning: fold.reasoning,
            usage: fold.usage,
            cost: resolveCost(fold.cost),
          });
          controller.close();
        } catch {
          await persistAssistant({
            aborted: abortController.signal.aborted,
            failed: !abortController.signal.aborted,
            content: fold.content || (abortController.signal.aborted ? "" : "生成中断"),
            reasoning: fold.reasoning,
            usage: fold.usage,
            cost: resolveCost(fold.cost),
          });
          try {
            controller.close();
          } catch {
            // 调用方已取消
          }
        } finally {
          releaseInflightOnce();
        }
      },
      cancel() {
        abortController.abort();
        releaseInflightOnce();
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    releaseInflightOnce();
    throw error;
  }
}
