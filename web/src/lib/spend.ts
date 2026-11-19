import { prisma } from "@/lib/db";
import { applyDeepSeekPeak } from "@/lib/peak-pricing";
import type { SpendKind } from "@/lib/spend-kind";
import type { TokenUsage } from "@/lib/sse-usage";

/** 记一笔本地花费。传入的 cost 是网关空闲价，这里补上 DeepSeek 峰时倍率。 */
export async function recordSpend(input: {
  userId: string;
  model: string;
  keyName: string | null;
  cost: number;
  usage: TokenUsage;
  kind: SpendKind;
}): Promise<number> {
  const costCny = applyDeepSeekPeak(input.cost, input.model);
  await prisma.spendEvent.create({
    data: {
      userId: input.userId,
      costCny,
      model: input.model,
      keyName: input.keyName,
      promptTokens: input.usage.promptTokens,
      completionTokens: input.usage.completionTokens,
      totalTokens: input.usage.totalTokens,
      kind: input.kind,
    },
  });
  return costCny;
}
