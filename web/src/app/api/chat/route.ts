import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUser } from "@/lib/auth";
import { assertHasBalance, BudgetError } from "@/lib/budget";
import { validateImageDataUrl } from "@/lib/chat-payload";
import { MAX_COMPLETION_TOKENS, MAX_REQUEST_TEXT_CHARS } from "@/lib/conversation-policy";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getGatewayModels } from "@/lib/gateway-models";
import { chatCompletions } from "@/lib/litellm";
import { getMarketModel } from "@/lib/model-market";
import { applyDeepSeekPeak } from "@/lib/peak-pricing";
import {
  acquireInflight,
  inflightBusyResponse,
  rateLimit,
  releaseInflight,
  tooManyRequests,
} from "@/lib/rate-limit";
import { costFromPayload, parseSseTotals, tokensFromUsage, type TokenUsage } from "@/lib/sse-usage";

/** OpenAI vision 消息内容：纯文本或 文本/图片 混合 parts。 */
const contentPartSchema = z.union([
  z.object({ type: z.literal("text"), text: z.string().max(MAX_REQUEST_TEXT_CHARS) }),
  z.object({
    type: z.literal("image_url"),
    image_url: z.object({ url: z.string().max(7_000_000) }),
  }),
]);

// 与调试台同一套上限（conversation-policy 常量）：这条旧代理挂在登录态后面、
// 用同一把用户 Key 计费，不能允许调试台路径不允许的超长请求。
const bodySchema = z.object({
  model: z.string(),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.union([
          z.string().max(MAX_REQUEST_TEXT_CHARS),
          z.array(contentPartSchema).min(1).max(8),
        ]),
      }),
    )
    .min(1)
    .max(100),
  stream: z.boolean().optional().default(true),
  max_tokens: z.number().int().positive().max(MAX_COMPLETION_TOKENS).optional(),
  temperature: z.number().min(0).max(2).optional(),
  thinking: z
    .object({
      type: z.enum(["enabled", "disabled"]),
    })
    .optional(),
  reasoning_effort: z.enum(["high", "max"]).optional(),
});

type ChatMessage = z.infer<typeof bodySchema>["messages"][number];

/** 校验图片 parts：仅视觉模型可用，单请求 ≤4 张，且每张 URL 合法。 */
function validateVision(model: string, messages: ChatMessage[]): string | null {
  const imageCount = messages.reduce((n, m) => {
    if (typeof m.content === "string") return n;
    return n + m.content.filter((p) => p.type === "image_url").length;
  }, 0);
  if (imageCount === 0) return null;
  if (imageCount > 4) return "单次最多 4 张图片";
  for (const m of messages) {
    if (typeof m.content === "string") continue;
    for (const p of m.content) {
      if (p.type !== "image_url") continue;
      const err = validateImageDataUrl(p.image_url.url);
      if (err) return err;
    }
  }
  const market = getMarketModel(model);
  if (!market?.capabilities.vision) {
    return `模型 ${model} 不支持图像输入`;
  }
  return null;
}

/** 全部消息文本总长（含 parts 里的 text），与调试台正文上限同口径。 */
function totalTextChars(messages: ChatMessage[]): number {
  return messages.reduce((n, m) => {
    if (typeof m.content === "string") return n + m.content.length;
    return n + m.content.reduce((k, p) => (p.type === "text" ? k + p.text.length : k), 0);
  }, 0);
}

export async function POST(req: Request) {
  try {
    const { user, session } = await requireUser();
    if (session.mustChangePassword || user.mustChangePassword) {
      return NextResponse.json({ error: "请先修改默认密码" }, { status: 403 });
    }
    // 每用户 60 次/分钟，防刷量烧钱（在解析请求体前计数，恶意空请求也受限）
    if (!rateLimit(`chat:${user.id}`, 60, 60_000)) {
      return tooManyRequests();
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    const availableModels = await getGatewayModels();
    if (!availableModels.includes(parsed.data.model)) {
      return NextResponse.json({ error: "模型不可用" }, { status: 400 });
    }
    const visionError = validateVision(parsed.data.model, parsed.data.messages);
    if (visionError) {
      return NextResponse.json({ error: visionError }, { status: 400 });
    }
    if (totalTextChars(parsed.data.messages) > MAX_REQUEST_TEXT_CHARS) {
      return NextResponse.json(
        { error: `请求正文总长超过 ${MAX_REQUEST_TEXT_CHARS} 字符上限` },
        { status: 400 },
      );
    }

    if (!user.litellmKeyTokenEnc) {
      return NextResponse.json({ error: "账号未开通 API Key" }, { status: 400 });
    }

    const apiKey = decryptSecret(user.litellmKeyTokenEnc);

    try {
      await assertHasBalance({
        userId: user.id,
        litellmUserId: user.litellmUserId,
        litellmKeyToken: apiKey,
      });
    } catch (e) {
      if (e instanceof BudgetError) {
        return NextResponse.json({ error: e.message }, { status: 402 });
      }
      throw e;
    }

    // 在途并发上限：与调试台共用 chat:<userId> 槽位池。余额门是调用前检查，
    // 没有预扣，并发会叠加超支——这里压住并发面（post-turn 后台整理豁免）。
    const inflightKey = `chat:${user.id}`;
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
      // 客户端断开（浏览器停止生成）时同步中止上游，上游费用不再继续累计
      const abortController = new AbortController();
      if (req.signal.aborted) {
        abortController.abort();
      } else {
        req.signal.addEventListener("abort", () => abortController.abort(), { once: true });
      }

      let upstream: Response;
      try {
        upstream = await chatCompletions({
          apiKey,
          appEnforcedUserId: user.litellmUserId ?? undefined,
          signal: abortController.signal,
          body: {
            model: parsed.data.model,
            messages: parsed.data.messages,
            stream: parsed.data.stream,
            // 流式必须显式请求 usage，否则上游不回 usage 块，SpendEvent 会记 0
            ...(parsed.data.stream ? { stream_options: { include_usage: true } } : {}),
            max_tokens: parsed.data.max_tokens ?? 1024,
            ...(parsed.data.temperature !== undefined
              ? { temperature: parsed.data.temperature }
              : {}),
            ...(parsed.data.thinking ? { thinking: parsed.data.thinking } : {}),
            ...(parsed.data.reasoning_effort
              ? { reasoning_effort: parsed.data.reasoning_effort }
              : {}),
          },
        });
      } catch (e) {
        if (abortController.signal.aborted) {
          releaseInflightOnce();
          return NextResponse.json({ error: "请求已取消" }, { status: 499 });
        }
        const msg = e instanceof Error ? e.message : "unknown";
        const cause = e instanceof Error && "cause" in e ? String((e as { cause?: unknown }).cause) : "";
        const offline =
          msg.includes("fetch failed") ||
          cause.includes("ECONNREFUSED") ||
          cause.includes("ENOTFOUND");
        releaseInflightOnce();
        return NextResponse.json(
          {
            error: offline
              ? "网关未启动或无法连接，请先启动 LiteLLM（GATEWAY_BASE_URL）"
              : "网关请求失败",
            detail: cause || msg,
          },
          { status: 502 },
        );
      }

      if (!upstream.ok) {
        const text = await upstream.text();
        // 429 分三种：网关用户预算硬闸 / 用户级 RPM 限额 / 上游共享 Key 限流。
        // 上游限流原文是英文长报错，直接透传体验差，这里翻译成可操作的提示。
        if (upstream.status === 429) {
          const budgetHit = /budget/i.test(text);
          const userRpmHit = !budgetHit && /rpm|rate.?limit/i.test(text);
          releaseInflightOnce();
          if (budgetHit) {
            return NextResponse.json(
              { error: "网关预算已用尽，请联系管理员充值", detail: text.slice(0, 300) },
              { status: 429 },
            );
          }
          if (userRpmHit) {
            return NextResponse.json(
              {
                error: `您的账号请求频率已达上限（每分钟 ${env().gatewayUserRpmLimit} 次），请约 1 分钟后重试`,
                detail: text.slice(0, 300),
              },
              { status: 429 },
            );
          }
          return NextResponse.json(
            {
              error: "上游模型服务限流，请约 1 分钟后重试",
              detail:
                "上游按共享 Key 限制每分钟请求数（全体用户共用同一额度），窗口约 1 分钟重置；高峰期持续出现需提升上游档位。",
            },
            { status: 429 },
          );
        }
        releaseInflightOnce();
        return NextResponse.json(
          { error: "网关调用失败", detail: text.slice(0, 500) },
          { status: upstream.status },
        );
      }

      // 流式响应的响应头在内容生成前就已发出，x-litellm-response-cost 多半为空；
      // 费用以 SSE 末块 response_cost 为准，头部非空时优先
      const headerCostRaw = Number(upstream.headers.get("x-litellm-response-cost") ?? "");
      const headerCost = Number.isFinite(headerCostRaw) ? headerCostRaw : 0;
      const resolveCost = (sseCost: number): number => (headerCost > 0 ? headerCost : sseCost);

      if (!parsed.data.stream) {
        let payload: unknown;
        try {
          payload = await upstream.json();
        } catch (e) {
          if (abortController.signal.aborted) {
            releaseInflightOnce();
            return NextResponse.json({ error: "请求已取消" }, { status: 499 });
          }
          throw e;
        }
        // 响应费用是空闲价口径，峰时倍率在此补齐（与网关回调一致，见 peak-pricing.ts）
        const cost = applyDeepSeekPeak(resolveCost(costFromPayload(payload)), parsed.data.model);
        const usage = tokensFromUsage(
          payload && typeof payload === "object"
            ? (payload as { usage?: unknown }).usage
            : undefined,
        );
        await prisma.spendEvent.create({
          data: {
            userId: user.id,
            costCny: cost,
            model: parsed.data.model,
            keyName: user.litellmKeyId,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            kind: "chat",
          },
        });
        releaseInflightOnce();
        return NextResponse.json(payload);
      }

      const reader = upstream.body?.getReader();
      if (!reader) {
        releaseInflightOnce();
        return NextResponse.json({ error: "无流式响应" }, { status: 502 });
      }

      const recordSpend = async (rawCost: number, usage: TokenUsage) => {
        await prisma.spendEvent.create({
          data: {
            userId: user.id,
            costCny: applyDeepSeekPeak(rawCost, parsed.data.model),
            model: parsed.data.model,
            keyName: user.litellmKeyId,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            kind: "chat",
          },
        });
      };

      const stream = new ReadableStream({
        async start(controller) {
          const decoder = new TextDecoder();
          let buffered = "";
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffered += decoder.decode(value, { stream: true });
              controller.enqueue(value);
            }
            buffered += decoder.decode();
            // 正常读完：无论费用是否解析得到都记一条（与旧行为一致）
            const { usage, cost } = parseSseTotals(buffered);
            await recordSpend(resolveCost(cost), usage);
            controller.close();
          } catch {
            // 客户端中止 / 上游中断：已解析到的费用可以记账；
            // 没有费用就不要写一条 0 元把请求数灌进去
            const { usage, cost } = parseSseTotals(buffered);
            const finalCost = resolveCost(cost);
            if (finalCost > 0) {
              await recordSpend(finalCost, usage);
            }
            try {
              controller.close();
            } catch {
              // 流已被消费方取消，close 会抛错，忽略
            }
          } finally {
            releaseInflightOnce();
          }
        },
        cancel() {
          // 消费方主动取消（浏览器 abort fetch）→ 中止上游
          abortController.abort();
          releaseInflightOnce();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": upstream.headers.get("Content-Type") ?? "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    } catch (e) {
      releaseInflightOnce();
      throw e;
    }
  } catch (e) {
    const authRes = authErrorResponse(e);
    if (authRes) return authRes;
    throw e;
  }
}