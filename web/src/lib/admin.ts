import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { readSession } from "@/lib/session";

/**
 * 管理员鉴权：两条通道任一通过即可——
 * ① x-admin-token 头等于 ADMIN_TOKEN（脚本 / 无会话场景，向后兼容）；
 * ② 已登录会话且用户 role=admin（手机号管理员登录管理页）。
 */
export async function requireAdmin(req: Request): Promise<NextResponse | null> {
  const token = req.headers.get("x-admin-token");
  if (token && token === env().adminToken) return null;

  const session = await readSession();
  if (session) {
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (user && !user.disabled && user.role === "admin") return null;
  }
  return NextResponse.json({ error: "未授权" }, { status: 401 });
}