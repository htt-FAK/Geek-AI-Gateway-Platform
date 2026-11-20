import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import type { AnalyticsEvent } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { fetchAllSpendLogs } from "@/lib/litellm";
import { spendSeriesModel } from "@/lib/spend-kind";

function maskPhone(phone: string): string {
  const digits = phone.replace(/\s/g, "");
  if (digits.length < 7) return "成员";
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

/** 登录即可看的成员花费 / Token 排行。管理员看完整手机号，成员看打码号。 */
export async function GET(req: Request) {
  try {
    const { user } = await requireUser();
    const isAdmin = user.role === "admin";
    const url = new URL(req.url);
    const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") ?? 7) || 7));
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

    let events: AnalyticsEvent[] = [];
    let source: "litellm" | "litellm_truncated" | "spend_event" = "litellm";
    const page = await fetchAllSpendLogs(from, to);
    if (page === null) {
      return NextResponse.json(
        { error: "网关花费日志不可用，请稍后重试" },
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

    const users = await prisma.user.findMany({
      select: { id: true, phone: true, name: true, litellmUserId: true, disabled: true },
    });
    const phoneByGwId = new Map(users.filter((u) => u.litellmUserId).map((u) => [u.litellmUserId!, u.phone]));
    const phoneById = new Map(users.map((u) => [u.id, u.phone]));
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

    const rows = users
      .filter((u) => !u.disabled)
      .map((u) => {
        const s = byUser.get(u.phone) ?? { spendCny: 0, requests: 0, tokens: 0 };
        return {
          phone: isAdmin ? u.phone : undefined,
          phoneMasked: maskPhone(u.phone),
          name: u.name,
          spendCny: s.spendCny,
          tokens: s.tokens,
          requests: s.requests,
          isMe: u.id === user.id,
        };
      })
      .sort((a, b) => b.spendCny - a.spendCny || b.tokens - a.tokens);

    return NextResponse.json({
      days,
      source,
      isAdmin,
      rows,
    });
  } catch (e) {
    const { authErrorResponse } = await import("@/lib/auth");
    const authRes = authErrorResponse(e);
    if (authRes) return authRes;
    throw e;
  }
}
