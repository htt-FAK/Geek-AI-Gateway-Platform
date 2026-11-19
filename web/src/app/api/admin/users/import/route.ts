import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { hashKey } from "@/lib/keys";
import { ensureLitellmUserAndKey } from "@/lib/litellm";
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
      // 新用户初始余额 0：网关用户级 max_budget 必须立刻设为 0（同步失败会抛错进 errors），
      // 避免用户第一次打开控制台之前直连网关不限额。
      const issued = await ensureLitellmUserAndKey(phone, { grantedCny: 0, unlimited: false });
      // 网关 DB 不可用时拒绝创建：代持占位 Key 会让调试台走 Master Key，
      // 绕过用户级预算（此时 max_budget 0 也写不进网关）。宁可进 errors 让管理员重试。
      if (issued.mode !== "virtual_key") {
        errors.push({ phone, error: "网关密钥库不可用，未创建（避免落入代持模式）；请网关恢复后重试" });
        continue;
      }
      const createdUser = await prisma.user.create({
        data: {
          phone,
          passwordHash: defaultHash,
          mustChangePassword: true,
          litellmUserId: issued.userId,
          litellmKeyId: issued.keyId ?? null,
          litellmKeyTokenEnc: encryptSecret(issued.key),
        },
      });
      // 密钥页按本地副本查看/复制明文：导入的主 Key 必须留存，否则只能重新生成
      await prisma.apiKeyLocal.upsert({
        where: { litellmToken: hashKey(issued.key) },
        create: {
          userId: createdUser.id,
          litellmToken: hashKey(issued.key),
          keyName: issued.keyId ?? "primary",
          keyEnc: encryptSecret(issued.key),
        },
        update: { keyEnc: encryptSecret(issued.key), keyName: issued.keyId ?? "primary" },
      });
      created.push(phone);
    } catch (e) {
      errors.push({ phone, error: e instanceof Error ? e.message : "unknown" });
    }
  }

  return NextResponse.json({ created, skipped, errors });
}
