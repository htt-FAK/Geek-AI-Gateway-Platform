import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { ensureLitellmUser } from "@/lib/litellm";
import { hashPassword, normalizePhone } from "@/lib/password";

const bodySchema = z.object({
  phones: z.array(z.string()).min(1),
});

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }

  const defaultHash = await hashPassword(env().defaultUserPassword);
  const created: string[] = [];
  const skipped: string[] = [];
  const errors: Array<{ phone: string; error: string }> = [];

  for (const raw of parsed.data.phones) {
    const phone = normalizePhone(raw);
    if (!phone) {
      errors.push({ phone: raw, error: "手机号格式无效" });
      continue;
    }
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      skipped.push(phone);
      continue;
    }
    try {
      // 新账号默认无 Key：只建网关用户并写入 max_budget=0（同步失败抛错进 errors），
      // 密钥由用户登录后在「密钥管理」页自行创建。网关 DB 不可用时拒绝创建（无预算约束不安全）。
      const issued = await ensureLitellmUser(phone, { grantedCny: 0, unlimited: false });
      await prisma.user.create({
        data: {
          phone,
          passwordHash: defaultHash,
          mustChangePassword: true,
          litellmUserId: issued.userId,
          litellmKeyId: null,
          litellmKeyTokenEnc: null,
        },
      });
      created.push(phone);
    } catch (e) {
      errors.push({ phone, error: e instanceof Error ? e.message : "unknown" });
    }
  }

  return NextResponse.json({ created, skipped, errors });
}
