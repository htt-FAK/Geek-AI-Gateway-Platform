import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { ensureLitellmUser } from "@/lib/litellm";
import { generateInitialPassword, hashPassword, normalizePhone } from "@/lib/password";

const contactSchema = z.object({
  phone: z.string().min(1),
  name: z.string().max(50).optional(),
});
const bodySchema = z.object({
  phones: z.array(z.string()).optional(),
  contacts: z.array(contactSchema).optional(),
});

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }
  const entries = [
    ...(parsed.data.contacts ?? []),
    ...(parsed.data.phones ?? []).map((p) => ({ phone: p, name: undefined as string | undefined })),
  ];
  if (entries.length === 0) {
    return NextResponse.json({ error: "缺少手机号" }, { status: 400 });
  }

  const created: string[] = [];
  const skipped: string[] = [];
  const renamed: string[] = [];
  const errors: Array<{ phone: string; error: string }> = [];
  /** 一次性初始密码：每人一把，仅本次响应返回，供管理员分发（首登强制改密）。 */
  const initialPasswords: Array<{ phone: string; password: string }> = [];

  for (const entry of entries) {
    const phone = normalizePhone(entry.phone);
    if (!phone) {
      errors.push({ phone: entry.phone, error: "手机号格式无效" });
      continue;
    }
    const name = entry.name?.trim() || undefined;
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      // 已有账号：只补/更新姓名，绝不动余额、Key、密码
      if (name && existing.name !== name) {
        await prisma.user.update({ where: { id: existing.id }, data: { name } });
        renamed.push(phone);
      } else {
        skipped.push(phone);
      }
      continue;
    }
    try {
      // 新账号默认无 Key：只建网关用户并写入 max_budget=0（同步失败抛错进 errors），
      // 密钥由用户登录后在「密钥管理」页自行创建。网关 DB 不可用时拒绝创建（无预算约束不安全）。
      const issued = await ensureLitellmUser(phone, { grantedCny: 0, unlimited: false });
      const initialPassword = generateInitialPassword();
      await prisma.user.create({
        data: {
          phone,
          name: name ?? null,
          passwordHash: await hashPassword(initialPassword),
          mustChangePassword: true,
          litellmUserId: issued.userId,
          litellmKeyId: null,
          litellmKeyTokenEnc: null,
        },
      });
      created.push(phone);
      initialPasswords.push({ phone, password: initialPassword });
    } catch (e) {
      errors.push({ phone, error: e instanceof Error ? e.message : "unknown" });
    }
  }

  return NextResponse.json({ created, skipped, renamed, errors, initialPasswords });
}
