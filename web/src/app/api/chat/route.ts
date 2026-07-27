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

    const upstream = await chatCompletions({
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
      },
    });

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
      const cost =
        (!Number.isNaN(headerCost) && headerCost > 0
          ? headerCost
          : extractCostFromText(JSON.stringify(payload))) || 0;
      if (cost > 0) {
        await prisma.spendEvent.create({
          data: { userId: user.id, costCny: cost, model: parsed.data.model },
        });
      }
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
          if (cost > 0) {
            await prisma.spendEvent.create({
              data: { userId: user.id, costCny: cost, model: parsed.data.model },
            });
          }
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
