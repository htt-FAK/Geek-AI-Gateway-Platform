import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

/** Empty analytics skeleton for admin all-members usage (series filled in a later change). */
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  return NextResponse.json({
    range: "7d",
    kpis: {
      totalRequests: 0,
      totalAmountCny: 0,
      totalTokens: 0,
      avgRpm: 0,
      avgTpm: 0,
    },
    consumptionSeries: [],
    modelInvocationSeries: [],
    members: [],
  });
}
