import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizePhone, verifyPassword } from "@/lib/password";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { setSessionCookie } from "@/lib/session";

const bodySchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
  remember: z.boolean().optional(),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: "手机号格式无效" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`login:phone:${phone}`, 10, 60_000) || !rateLimit(`login:ip:${ip}`, 30, 60_000)) {
    return tooManyRequests();
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "手机号或密码错误" }, { status: 401 });
  }
  if (user.disabled) {
    return NextResponse.json({ error: "账号已禁用" }, { status: 403 });
  }

  await setSessionCookie(
    {
      userId: user.id,
      phone: user.phone,
      mustChangePassword: user.mustChangePassword,
      passwordVersion: user.passwordVersion,
    },
    { remember: Boolean(parsed.data.remember) },
  );

  return NextResponse.json({
    ok: true,
    requirePasswordChange: user.mustChangePassword,
    phone: user.phone,
  });
}
