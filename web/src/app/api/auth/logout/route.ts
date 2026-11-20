import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}

/** 服务端跳转用：清掉失效会话后再回到登录页，避免和页面重定向打转。 */
export async function GET() {
  await clearSessionCookie();
  // 用相对 Location：容器内 req.url 是 http://0.0.0.0:3000，拼绝对地址会把用户送到 0.0.0.0。
  return new NextResponse(null, { status: 307, headers: { Location: "/login" } });
}
