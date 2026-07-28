import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUser } from "@/lib/auth";
import { assertWithinBudget, BudgetError } from "@/lib/budget";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { GATEWAY_MODELS } from "@/lib/env";
import { chatCompletions } from "@/lib/litellm";

const bodySchema = z.object({
  model: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    }),
  ),
  stream: z.boolean().optional().default(true),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  thinking: z
    .object({
      type: z.enum(["enabled", "disabled"]),
    })
    .optional(),
  reasoning_effort: z.enum(["high", "max"]).optional(),
});

function extractCostFromText(text: string): number {
  const patterns = [
    /"response_cost"\s*:\s*([0-9.eE+-]+)/,
    /"x-litellm-response-cost"\s*:\s*"?([0-9.eE+-]+)"?/,
    /"cost"\s*:\s*([0-9.eE+-]+)/,
  ];
  let best = 0;
  for (const re of patterns) {
    const matches = text.matchAll(new RegExp(re.source, "g"));
    for (const m of matches) {
      const n = Number(m[1]);
      if (!Number.isNaN(n) && n > best) best = n;
    }
  }
  return best;
}

type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

function tokensFromUsage(usage: unknown): TokenUsage {
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

function extractUsageFromText(text: string): TokenUsage {
  let best: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  const re = /"usage"\s*:\s*\{([^}]*)\}/g;
  for (const m of text.matchAll(re)) {
    const block = m[1] ?? "";
    const prompt = Number(block.match(/"prompt_tokens"\s*:\s*([0-9]+)/)?.[1] ?? 0) || 0;
    const completion =
      Number(block.match(/"completion_tokens"\s*:\s*([0-9]+)/)?.[1] ?? 0) || 0;
    const total =
      Number(block.match(/"total_tokens"\s*:\s*([0-9]+)/)?.[1] ?? 0) || prompt + completion;
    if (total >= best.totalTokens) {
      best = { promptTokens: prompt, completionTokens: completion, totalTokens: total };
    }
  }
  return best;
}

export async function POST(req: Request) {
  try {
    const { user, session } = await requireUser();
    if (session.mustChangePassword || user.mustChangePassword) {
      return NextResponse.json({ error: "请先修改默认密码" }, { status: 403 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    if (!(GATEWAY_MODELS as readonly string[]).includes(parsed.data.model)) {
      return NextResponse.json({ error: "模型不可用" }, { status: 400 });
    }

    if (!user.litellmKeyTokenEnc) {
      return NextResponse.json({ error: "账号未开通 API Key" }, { status: 400 });
    }

    const apiKey = decryptSecret(user.litellmKeyTokenEnc);

    try {
      await assertWithinBudget({ userId: user.id, litellmKeyToken: apiKey });
    } catch (e) {
      if (e instanceof BudgetError) {
        return NextResponse.json({ error: e.message }, { status: 402 });
      }
      throw e;
    }

    let upstream: Response;
    try {
      upstream = await chatCompletions({
        apiKey,
        appEnforcedUserId: user.litellmUserId ?? undefined,
        body: {
          model: parsed.data.model,
          messages: parsed.data.messages,
          stream: parsed.data.stream,
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
      const msg = e instanceof Error ? e.message : "unknown";
      const cause = e instanceof Error && "cause" in e ? String((e as { cause?: unknown }).cause) : "";
      const offline =
        msg.includes("fetch failed") ||
        cause.includes("ECONNREFUSED") ||
        cause.includes("ENOTFOUND");
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
      return NextResponse.json(
        { error: "网关调用失败", detail: text.slice(0, 500) },
        { status: upstream.status },
      );
    }

    const headerCost = Number(upstream.headers.get("x-litellm-response-cost") ?? "0");

    if (!parsed.data.stream) {
      const payload = await upstream.json();
      const payloadText = JSON.stringify(payload);
      const cost =
        (!Number.isNaN(headerCost) && headerCost > 0
          ? headerCost
          : extractCostFromText(payloadText)) || 0;
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
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
        },
      });
      return NextResponse.json(payload);
    }

    const reader = upstream.body?.getReader();
    if (!reader) {
      return NextResponse.json({ error: "无流式响应" }, { status: 502 });
    }

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
        } finally {
          const cost =
            (!Number.isNaN(headerCost) && headerCost > 0
              ? headerCost
              : extractCostFromText(buffered)) || 0;
          const usage = extractUsageFromText(buffered);
          await prisma.spendEvent.create({
            data: {
              userId: user.id,
              costCny: cost,
              model: parsed.data.model,
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              totalTokens: usage.totalTokens,
            },
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    const authRes = authErrorResponse(e);
    if (authRes) return authRes;
    throw e;
  }
}
