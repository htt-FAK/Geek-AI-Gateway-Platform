import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { readSession } from "@/lib/session";

/**
 * 管理员鉴权：两条通道任一通过即可——
 * ① x-admin-token 头等于 ADMIN_TOKEN（仅限服务端脚本；浏览器不再使用/存储 Token）；
 * ② 已登录会话且用户 role=admin，并与 requireUser 同等校验：
 *    禁用、密码版本（重置密码后旧 Cookie 立即失效）、强制改密未完成一律拒绝。
 */
export async function requireAdmin(req: Request): Promise<NextResponse | null> {
  const token = req.headers.get("x-admin-token");
  if (token && token === env().adminToken) return null;

  const session = await readSession();
  if (session) {
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (user && !user.disabled && user.role === "admin") {
      if (session.passwordVersion !== Number(user.passwordVersion ?? 0)) {
        return NextResponse.json({ error: "会话已失效，请重新登录" }, { status: 401 });
      }
      if (user.mustChangePassword) {
        return NextResponse.json({ error: "请先修改默认密码" }, { status: 403 });
      }
      return null;
    }
  }
  return NextResponse.json({ error: "未授权" }, { status: 401 });
}