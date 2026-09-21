import type { User } from "@prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { isAppEnforcedKey } from "@/lib/keys";
import { ensureLitellmUserAndKey, revokeLitellmKey } from "@/lib/litellm";

export type ReissuedKey = {
  issued: Awaited<ReturnType<typeof ensureLitellmUserAndKey>>;
  updated: User;
  revealedAt: Date | null;
};

export async function reissueVirtualKey(user: User): Promise<ReissuedKey> {
  if (user.litellmKeyTokenEnc) {
    try {
      const oldKey = decryptSecret(user.litellmKeyTokenEnc);
      if (!isAppEnforcedKey(oldKey)) {
        await revokeLitellmKey(oldKey);
      }
    } catch (e) {
      console.warn("[keys] revoke previous key failed; continuing reissue", {
        userId: user.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const issued = await ensureLitellmUserAndKey(user.phone);
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
  return { issued, updated, revealedAt };
}
