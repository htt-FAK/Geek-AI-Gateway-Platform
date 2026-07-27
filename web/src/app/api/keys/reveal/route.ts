import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { isAppEnforcedKey } from "@/lib/keys";

export async function POST() {
  try {
    const { user, session } = await requireUser();
    if (session.mustChangePassword || user.mustChangePassword) {
      return NextResponse.json({ error: "请先修改默认密码" }, { status: 403 });
    }
    if (!user.litellmKeyTokenEnc) {
      return NextResponse.json({ error: "账号未开通 API Key" }, { status: 400 });
    }

    const token = decryptSecret(user.litellmKeyTokenEnc);
    if (isAppEnforcedKey(token)) {
      return NextResponse.json(
        { error: "当前为应用代持模式，无法作为外部 SDK 密钥获取" },
        { status: 400 },
      );
    }
    if (user.keyRevealedAt) {
      return NextResponse.json(
        { error: "密钥已揭示过，关闭后无法再看。如需新密钥请重新生成。" },
        { status: 409 },
      );
    }

    const now = new Date();
    const updated = await prisma.user.updateMany({
      where: { id: user.id, keyRevealedAt: null },
      data: { keyRevealedAt: now },
    });
    if (updated.count === 0) {
      return NextResponse.json(
        { error: "密钥已揭示过，关闭后无法再看。如需新密钥请重新生成。" },
        { status: 409 },
      );
    }

    return NextResponse.json({
      key: token,
      keyRevealedAt: now.toISOString(),
      warning: "请立即复制完整密钥。关闭后无法再看明文；丢失请重新生成。",
    });
  } catch (e) {
    const authRes = authErrorResponse(e);
    if (authRes) return authRes;
    throw e;
  }
}
