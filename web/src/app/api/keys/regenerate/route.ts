import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { isAppEnforcedKey, maskApiKey } from "@/lib/keys";
import { ensureLitellmUserAndKey, revokeLitellmKey } from "@/lib/litellm";

export async function POST() {
  try {
    const { user, session } = await requireUser();
    if (session.mustChangePassword || user.mustChangePassword) {
      return NextResponse.json({ error: "请先修改默认密码" }, { status: 403 });
    }

    if (user.litellmKeyTokenEnc) {
      try {
        const oldKey = decryptSecret(user.litellmKeyTokenEnc);
        if (!isAppEnforcedKey(oldKey)) {
          await revokeLitellmKey(oldKey);
        }
      } catch {
        // continue
      }
    }

    const issued = await ensureLitellmUserAndKey(user.phone);
    if (issued.mode === "app_enforced") {
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

    return NextResponse.json({
      key: issued.key,
      keyMasked: maskApiKey(issued.key),
      keyMode: issued.mode,
      keyRevealedAt: now.toISOString(),
      warning: "请立即复制完整密钥。关闭后无法再看明文；丢失请重新生成。",
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
