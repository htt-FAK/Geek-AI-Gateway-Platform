import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { isAppEnforcedKey } from "@/lib/keys";

/** Return plaintext virtual key for the signed-in owner (for copy / eye toggle). */
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
        { error: "当前为应用代持模式，无法作为外部 SDK 密钥复制" },
        { status: 400 },
      );
    }

    if (!user.keyRevealedAt) {
      await prisma.user.updateMany({
        where: { id: user.id, keyRevealedAt: null },
        data: { keyRevealedAt: new Date() },
      });
    }

    return NextResponse.json({ key: token });
  } catch (e) {
    const authRes = authErrorResponse(e);
    if (authRes) return authRes;
    throw e;
  }
}
