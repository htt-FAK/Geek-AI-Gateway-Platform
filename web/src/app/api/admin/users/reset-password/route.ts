import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { generateInitialPassword, hashPassword, normalizePhone } from "@/lib/password";

const bodySchema = z.object({
  phone: z.string().min(1),
});

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: "手机号格式无效" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  // 一次性随机密码（不再重置为共享默认密码）：仅本次响应返回，供管理员分发。
  const initialPassword = generateInitialPassword();
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(initialPassword),
      mustChangePassword: true,
      passwordVersion: { increment: 1 },
    },
  });

  return NextResponse.json({
    ok: true,
    phone: updated.phone,
    mustChangePassword: updated.mustChangePassword,
    passwordVersion: updated.passwordVersion,
    initialPassword,
  });
}
