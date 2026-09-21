import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { isAppEnforcedKey } from "@/lib/keys";
import { fetchKeySpendLogs } from "@/lib/litellm";

export async function getAppSpendSince(userId: string, since: Date): Promise<number> {
  const agg = await prisma.spendEvent.aggregate({
    where: { userId, createdAt: { gte: since } },
    _sum: { costCny: true },
  });
  return agg._sum.costCny ?? 0;
}

/** Start of current calendar month in Asia/Shanghai, as a Date (UTC instant). */
export function startOfMonthShanghai(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  // Shanghai is UTC+8 year-round: month start 00:00 CST = previous day 16:00 UTC
  return new Date(Date.UTC(y, m - 1, 1, -8, 0, 0));
}

export type BudgetUsage = {
  dailyUsed: number;
  weeklyUsed: number;
  monthlyUsed: number;
  dailyLimit: number;
  weeklyLimit: number;
  monthlyLimit: number;
};

export async function getBudgetUsage(params: {
  userId: string;
  litellmKeyToken: string | null;
}): Promise<BudgetUsage> {
  const { dailyBudgetCny, weeklyBudgetCny, monthlyBudgetCny } = env();
  const nowMs = Date.now();
  const now = new Date(nowMs);
  const dayAgo = new Date(nowMs - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(nowMs - 7 * 24 * 60 * 60 * 1000);
  const monthStart = startOfMonthShanghai(now);
  const earliest = weekAgo < monthStart ? weekAgo : monthStart;

  const hasGatewayKey = Boolean(params.litellmKeyToken) && !isAppEnforcedKey(params.litellmKeyToken);

  const [rows, gwLogs] = await Promise.all([
    prisma.spendEvent.findMany({
      where: { userId: params.userId, createdAt: { gte: earliest } },
      select: { createdAt: true, costCny: true },
    }),
    hasGatewayKey
      ? fetchKeySpendLogs(params.litellmKeyToken as string, weekAgo, now)
      : Promise.resolve([]),
  ]);

  let appDaily = 0;
  let appWeekly = 0;
  let appMonthly = 0;
  for (const row of rows) {
    const cost = row.costCny ?? 0;
    if (row.createdAt >= monthStart) appMonthly += cost;
    if (row.createdAt >= weekAgo) appWeekly += cost;
    if (row.createdAt >= dayAgo) appDaily += cost;
  }

  let gwDaily = 0;
  let gwWeekly = 0;
  for (const log of gwLogs) {
    gwWeekly += log.spend;
    if (log.at >= dayAgo) gwDaily += log.spend;
  }

  return {
    dailyUsed: Math.max(appDaily, gwDaily),
    weeklyUsed: Math.max(appWeekly, gwWeekly),
    monthlyUsed: appMonthly,
    dailyLimit: dailyBudgetCny,
    weeklyLimit: weeklyBudgetCny,
    monthlyLimit: monthlyBudgetCny,
  };
}

export async function assertWithinBudget(params: {
  userId: string;
  litellmKeyToken: string | null;
}): Promise<void> {
  const usage = await getBudgetUsage(params);
  const isAppEnforced = !params.litellmKeyToken || isAppEnforcedKey(params.litellmKeyToken);

  if (isAppEnforced && usage.dailyUsed >= usage.dailyLimit) {
    throw new BudgetError(`日限额已用尽（¥${usage.dailyLimit}/天）`);
  }
  if (usage.weeklyUsed >= usage.weeklyLimit) {
    throw new BudgetError(`周限额已用尽（¥${usage.weeklyLimit}/周）`);
  }
  if (usage.monthlyUsed >= usage.monthlyLimit) {
    throw new BudgetError(`月限额已用尽（¥${usage.monthlyLimit}/月）`);
  }
}

export class BudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetError";
  }
}
