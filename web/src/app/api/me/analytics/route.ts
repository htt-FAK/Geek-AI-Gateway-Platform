import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth";
import {
  buildUserAnalytics,
  type AnalyticsGranularity,
} from "@/lib/analytics";
import { decryptSecret } from "@/lib/crypto";

function parseDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: Request) {
  try {
    const { user } = await requireUser();
    const url = new URL(req.url);
    const to = parseDate(url.searchParams.get("to")) ?? new Date();
    const from =
      parseDate(url.searchParams.get("from")) ??
      new Date(to.getTime() - 24 * 60 * 60 * 1000);
    const g = url.searchParams.get("granularity");
    const granularity: AnalyticsGranularity = g === "day" ? "day" : "hour";

    if (from.getTime() > to.getTime()) {
      return NextResponse.json({ error: "时间范围无效" }, { status: 400 });
    }
    // Guard extreme ranges (~40 days hourly / ~400 days daily already capped in agg)
    const maxMs = 40 * 24 * 60 * 60 * 1000;
    if (to.getTime() - from.getTime() > maxMs) {
      return NextResponse.json({ error: "时间范围过大（最多约 40 天）" }, { status: 400 });
    }

    const token = user.litellmKeyTokenEnc ? decryptSecret(user.litellmKeyTokenEnc) : null;
    const result = await buildUserAnalytics({
      userId: user.id,
      litellmKeyToken: token,
      from,
      to,
      granularity,
    });

    return NextResponse.json({
      from: from.toISOString(),
      to: to.toISOString(),
      granularity,
      ...result,
    });
  } catch (e) {
    const authRes = authErrorResponse(e);
    if (authRes) return authRes;
    throw e;
  }
}
