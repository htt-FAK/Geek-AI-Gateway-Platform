import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export function requireAdmin(req: Request): NextResponse | null {
  const admin = req.headers.get("x-admin-token");
  if (!admin || admin !== env().adminToken) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  return null;
}
