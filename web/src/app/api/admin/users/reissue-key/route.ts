import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { hashKey, isAppEnforcedKey } from "@/lib/keys";
import { ensureLitellmUserAndKey, revokeLitellmKey } from "@/lib/litellm";
import { normalizePhone } from "@/lib/password";

const bodySchema = z.object({
  phone: z.string().min(1),
});

export async function POST(req: Request) {
  const denied = requireAdmin(req);
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

  let revokedRealKey = false;
  if (user.litellmKeyTokenEnc) {
    let oldKey: string;
    try {
      oldKey = decryptSecret(user.litellmKeyTokenEnc);
    } catch {
      return NextResponse.json(
        { error: "旧密钥解密失败，无法确认吊销；未签发新 Key" },
        { status: 502 },
      );
    }
    if (!isAppEnforcedKey(oldKey)) {
      try {
        // 吊销失败（网关不可达等）时不得签发新 Key：旧 Key 还能花同一份余额
        await revokeLitellmKey(oldKey);
        revokedRealKey = true;
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "吊销旧密钥失败；未签发新 Key" },
          { status: 502 },
        );
      }
    }
  }

  try {
    const issued = await ensureLitellmUserAndKey(phone, {
      grantedCny: user.balanceGrantedCny,
      unlimited: user.balanceUnlimited,
    });
    // 真 VK 已吊销后若网关 DB 抖动落入代持模式：绝不能把占位 Key 写进账号
    // （调试台会改用 Master Key，绕过该用户的网关级 max_budget）。保留旧值并报错，
    // 网关恢复后重试即可；旧 Key 已吊销，不会被继续消费。
    if (issued.mode !== "virtual_key" && revokedRealKey) {
      return NextResponse.json(
        { error: "网关密钥库不可用：旧 Key 已吊销，新 Key 未签发；请网关恢复后重试重发" },
        { status: 502 },
      );
    }
    const now = new Date();
    const revealedAt = issued.mode === "virtual_key" ? now : null;
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        litellmUserId: issued.userId,
        litellmKeyId: issued.keyId ?? null,
        litellmKeyTokenEnc: encryptSecret(issued.key),
        keyRevealedAt: revealedAt,
      },
    });
    if (issued.mode === "virtual_key") {
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
    }

    return NextResponse.json({
      ok: true,
      phone: updated.phone,
      keyMode: issued.mode,
      key: issued.mode === "virtual_key" ? issued.key : undefined,
      keyRevealedAt: revealedAt?.toISOString() ?? null,
      warning:
        issued.mode === "virtual_key"
          ? "请立即复制完整密钥。关闭后用户端无法再看明文。"
          : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "重发卡失败" },
      { status: 500 },
    );
  }
}
