import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { hashKey, isAppEnforcedKey, maskApiKey } from "@/lib/keys";
import { ensureLitellmUserAndKey, revokeLitellmKey } from "@/lib/litellm";

export async function POST() {
  try {
    const { user, session } = await requireUser();
    if (session.mustChangePassword || user.mustChangePassword) {
      return NextResponse.json({ error: "请先修改默认密码" }, { status: 403 });
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
          await revokeLitellmKey(oldKey);
          revokedRealKey = true;
        } catch (e) {
          // 旧 Key 吊销失败就绝不能签发新 Key，否则旧 Key 还能花同一份余额
          return NextResponse.json(
            { error: e instanceof Error ? e.message : "吊销旧密钥失败；未签发新 Key" },
            { status: 502 },
          );
        }
      }
    }

    const issued = await ensureLitellmUserAndKey(user.phone, {
      grantedCny: user.balanceGrantedCny,
      unlimited: user.balanceUnlimited,
    });
    if (issued.mode === "app_enforced") {
      // 真 VK 已吊销后网关 DB 抖动落入代持：绝不把占位 Key 写进账号
      // （调试台会改用 Master Key，绕过该用户的网关级 max_budget）。
      if (revokedRealKey) {
        return NextResponse.json(
          { error: "网关密钥库不可用：旧 Key 已吊销，新 Key 未签发；请网关恢复后重试" },
          { status: 503 },
        );
      }
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          litellmUserId: issued.userId,
          litellmKeyId: issued.keyId ?? null,
          litellmKeyTokenEnc: encryptSecret(issued.key),
          keyRevealedAt: null,
        },
      });
      return NextResponse.json(
        {
          error: "网关未签发 Virtual Key（应用代持模式），无法提供外部 SDK 密钥",
          keyMode: issued.mode,
          keyMasked: maskApiKey(issued.key),
          keyRevealedAt: updated.keyRevealedAt,
        },
        { status: 503 },
      );
    }

    const now = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        litellmUserId: issued.userId,
        litellmKeyId: issued.keyId ?? null,
        litellmKeyTokenEnc: encryptSecret(issued.key),
        keyRevealedAt: now,
      },
    });
    await prisma.apiKeyLocal.upsert({
      where: { litellmToken: hashKey(issued.key) },
      create: {
        userId: user.id,
        litellmToken: hashKey(issued.key),
        keyName: issued.keyId ?? "primary",
        keyEnc: encryptSecret(issued.key),
      },
      update: { keyEnc: encryptSecret(issued.key) },
    });

    return NextResponse.json({
      key: issued.key,
      keyMasked: maskApiKey(issued.key),
      keyMode: issued.mode,
      keyRevealedAt: now.toISOString(),
      warning: "请妥善保管密钥明文；可随时在密钥页再次查看 / 复制。",
    });
  } catch (e) {
    const authRes = authErrorResponse(e);
    if (authRes) return authRes;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "重新生成失败" },
      { status: 500 },
    );
  }
}
