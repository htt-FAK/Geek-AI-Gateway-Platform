import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { hashKey } from "@/lib/keys";
import {
  GatewayDbError,
  deleteGatewayKeys,
  ensureLitellmUserAndKey,
  listGatewayKeys,
} from "@/lib/litellm";
import { normalizePhone } from "@/lib/password";
import { withUserLock } from "@/lib/user-lock";

const bodySchema = z.object({
  phone: z.string().min(1),
});

/**
 * 管理端重发卡：与用户侧重新生成同一流程——吊销该用户全部网关 Key、清本地副本、
 * 签发一把新主 Key。网关密钥库不可用时绝不把 __app_enforced__ 哨兵写进账号
 * （哨兵 = Master Key 代发 = 绕过该用户 max_budget，与删除主 Key 路径同一约束）。
 */
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

  try {
    return await withUserLock(user.id, async () => {
      const fresh = await prisma.user.findUnique({
        where: { id: user.id },
        select: { balanceGrantedCny: true, balanceUnlimited: true },
      });
      const grantedCny = fresh?.balanceGrantedCny ?? user.balanceGrantedCny;
      const unlimited = fresh?.balanceUnlimited ?? user.balanceUnlimited;

      let revokedAny = false;
      if (user.litellmUserId) {
        let existing;
        try {
          existing = await listGatewayKeys(user.litellmUserId);
        } catch (e) {
          // 吊销失败（网关不可达等）时不得签发新 Key：旧 Key 还能花同一份余额
          if (e instanceof GatewayDbError) {
            return NextResponse.json(
              { error: "网关密钥库不可用：无法确认吊销旧 Key，未签发新 Key；请网关恢复后重试重发" },
              { status: 503 },
            );
          }
          return NextResponse.json(
            { error: e instanceof Error ? e.message : "列出旧密钥失败；未签发新 Key" },
            { status: 502 },
          );
        }
        if (existing.length > 0) {
          try {
            await deleteGatewayKeys(existing.map((k) => k.token));
          } catch (e) {
            return NextResponse.json(
              { error: e instanceof Error ? e.message : "吊销旧密钥失败；未签发新 Key" },
              { status: 502 },
            );
          }
          await prisma.apiKeyLocal.deleteMany({ where: { userId: user.id } });
          revokedAny = true;
        }
      }

      const issued = await ensureLitellmUserAndKey(phone, { grantedCny, unlimited });
      if (issued.mode !== "virtual_key") {
        // 代持结果一律不落库：保留旧值并报错，网关恢复后重试即可。
        return NextResponse.json(
          {
            error: revokedAny
              ? "网关密钥库不可用：旧 Key 已吊销，新 Key 未签发；请网关恢复后重试重发"
              : "网关密钥库不可用：未签发 Virtual Key，也未写入占位 Key；请网关恢复后重试重发",
          },
          { status: 503 },
        );
      }

      const now = new Date();
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          litellmUserId: issued.userId,
          litellmKeyId: issued.keyId ?? null,
          litellmKeyTokenEnc: encryptSecret(issued.key),
          keyRevealedAt: now,
        },
      });
      // 密钥页按本地副本查看明文，重发卡必须留存
      await prisma.apiKeyLocal.upsert({
        where: { litellmToken: hashKey(issued.key) },
        create: {
          userId: user.id,
          litellmToken: hashKey(issued.key),
          keyName: issued.keyId ?? "primary",
          keyEnc: encryptSecret(issued.key),
        },
        update: { keyEnc: encryptSecret(issued.key), keyName: issued.keyId ?? "primary" },
      });

      return NextResponse.json({
        ok: true,
        phone: updated.phone,
        keyMode: issued.mode,
        key: issued.key,
        keyRevealedAt: now.toISOString(),
        warning: "请立即复制完整密钥转交成员；成员也可在密钥页再次查看/复制（管理端仅此次显示）。",
      });
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "重发卡失败" },
      { status: 500 },
    );
  }
}