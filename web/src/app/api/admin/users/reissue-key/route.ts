import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
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

  if (user.litellmKeyTokenEnc) {
    try {
      const oldKey = decryptSecret(user.litellmKeyTokenEnc);
      await revokeLitellmKey(oldKey);
    } catch {
      // continue — still attempt reissue
    }
  }

  try {
    const issued = await ensureLitellmUserAndKey(phone);
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
