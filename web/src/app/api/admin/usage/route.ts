import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { aggregateEvents, type AnalyticsEvent } from "@/lib/analytics";
import { getBalance } from "@/lib/budget";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { fetchAllSpendLogs } from "@/lib/litellm";
import { spendSeriesModel } from "@/lib/spend-kind";

/** 全员用量：网关全量 spend logs 优先（覆盖直连），回退本地 SpendEvent。 */
export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : new Date();
  const from = url.searchParams.get("from")
    ? new Date(url.searchParams.get("from")!)
    : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const granularity = url.searchParams.get("granularity") === "day" ? "day" : "hour";

  let events: AnalyticsEvent[] = [];
  let source: "litellm" | "litellm_truncated" | "spend_event" = "litellm";
  const page = await fetchAllSpendLogs(from, to);
  if (page === null) {
    // 网关日志接口失败 ≠ 没有流量：直接报错，绝不能画成一串 0
    return NextResponse.json(
      { error: "网关花费日志不可用（/spend/logs 拉取失败），请稍后重试", source: "error" },
      { status: 503 },
    );
  }
  if (page.logs.length > 0) {
    source = page.truncated ? "litellm_truncated" : "litellm";
    events = page.logs.map((r) => ({
      at: r.at,
      model: r.model,
      spendCny: r.spend,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      totalTokens: r.totalTokens,
      userId: r.userId,
    }));
  } else {
    source = "spend_event";
    const rows = await prisma.spendEvent.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: {
        createdAt: true,
        model: true,
        costCny: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        userId: true,
        kind: true,
      },
      orderBy: { createdAt: "asc" },
    });
    events = rows.map((r) => ({
      at: r.createdAt,
      model: spendSeriesModel(r.model, r.kind),
      spendCny: r.costCny,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      totalTokens: r.totalTokens,
      userId: r.userId,
    }));
  }

  const agg = aggregateEvents(events, from, to, granularity);

  // 成员表：按网关 user_id / 本地 userId 分组，join 手机号
  const users = await prisma.user.findMany({
    select: {
      id: true,
      phone: true,
      name: true,
      litellmUserId: true,
      litellmKeyTokenEnc: true,
      balanceGrantedCny: true,
      balanceUnlimited: true,
    },
  });
  const phoneByGwId = new Map(users.filter((u) => u.litellmUserId).map((u) => [u.litellmUserId!, u.phone]));
  const phoneById = new Map(users.map((u) => [u.id, u.phone]));
  // 本期（date range）用量按手机号分组
  const byUser = new Map<string, { spendCny: number; requests: number; tokens: number }>();
  for (const ev of events) {
    const uid = ev.userId ?? "unknown";
    const phone = phoneByGwId.get(uid) ?? phoneById.get(uid) ?? uid;
    const cur = byUser.get(phone) ?? { spendCny: 0, requests: 0, tokens: 0 };
    cur.spendCny += ev.spendCny;
    cur.requests += 1;
    cur.tokens += ev.totalTokens;
    byUser.set(phone, cur);
  }
  // 剩余余额与 /api/me 同一本账：复用 getBalance（网关用户级 spend 优先，离线回退本地）。
  // 直连不写本地 SpendEvent，只用本地流水减充值会把剩余算高。
  const balances = await Promise.all(
    users.map(async (u) => {
      let token: string | null = null;
      try {
        token = u.litellmKeyTokenEnc ? decryptSecret(u.litellmKeyTokenEnc) : null;
      } catch {
        token = null;
      }
      const balance = await getBalance({
        userId: u.id,
        litellmUserId: u.litellmUserId,
        litellmKeyToken: token,
      });
      const gatewayBacked =
        Boolean(u.litellmUserId) && Boolean(token) && !token!.startsWith("__app_enforced__:");
      return { phone: u.phone, balance, gatewayBacked };
    }),
  );
  const balanceByPhone = new Map(balances.map((b) => [b.phone, b.balance]));
  const remainingSource = balances.some(
    (b) => b.gatewayBacked && b.balance.spendSource === "spend_event",
  )
    ? "spend_event_fallback"
    : "litellm";
  // 覆盖全部账号（含零用量），左 join 本期用量＋余额
  const members = users
    .map((u) => {
      const s = byUser.get(u.phone) ?? { spendCny: 0, requests: 0, tokens: 0 };
      return {
        phone: u.phone,
        name: u.name,
        spendCny: s.spendCny,
        requests: s.requests,
        tokens: s.tokens,
        grantedCny: u.balanceGrantedCny,
        unlimited: u.balanceUnlimited,
        remainingCny: balanceByPhone.get(u.phone)?.balanceCny ?? null,
      };
    })
    .sort((a, b) => b.spendCny - a.spendCny);

  return NextResponse.json({
    range: `${Math.round((to.getTime() - from.getTime()) / 86400000)}d`,
    from: from.toISOString(),
    to: to.toISOString(),
    granularity,
    source,
    /** 剩余余额口径：litellm=网关用户级 spend；spend_event_fallback=有网关账号回退了本地流水。 */
    remainingSource,
    kpis: {
      totalRequests: agg.kpis.count,
      totalAmountCny: agg.kpis.spendCny,
      totalTokens: agg.kpis.tokens,
      avgRpm: agg.kpis.rpm,
      avgTpm: agg.kpis.tpm,
    },
    consumptionSeries: agg.spendSeries,
    modelInvocationSeries: agg.callSeries,
    members,
  });
}
