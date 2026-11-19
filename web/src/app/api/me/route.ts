import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth";
import { getBalance } from "@/lib/budget";
import { decryptSecret } from "@/lib/crypto";
import { env } from "@/lib/env";
import { getGatewayModels } from "@/lib/gateway-models";
import { isAppEnforcedKey, maskApiKey, resolveKeyMode } from "@/lib/keys";
import { syncUserBudget } from "@/lib/litellm";

export async function GET() {
  try {
    const { user } = await requireUser();
    const token = user.litellmKeyTokenEnc ? decryptSecret(user.litellmKeyTokenEnc) : null;
    const balance = await getBalance({
      userId: user.id,
      litellmUserId: user.litellmUserId,
      litellmKeyToken: token,
    });
    const keyMode = resolveKeyMode(token);
    const models = await getGatewayModels();

    // 自愈对账：把本地余额推平到网关用户级预算（best-effort，不阻塞响应）
    if (keyMode === "virtual_key" && user.litellmUserId) {
      void syncUserBudget(user.litellmUserId, user.balanceGrantedCny, user.balanceUnlimited);
    }

    return NextResponse.json({
      phone: user.phone,
      mustChangePassword: user.mustChangePassword,
      disabled: user.disabled,
      models,
      balance,
      keyMode,
      keyMasked: maskApiKey(token),
      keyRevealedAt: user.keyRevealedAt?.toISOString() ?? null,
      gatewayUrl: `${env().publicGatewayBaseUrl}/v1`,
      canRevealKey: keyMode === "virtual_key" && !isAppEnforcedKey(token),
      canRegenerateKey: keyMode === "virtual_key",
    });
  } catch (e) {
    const authRes = authErrorResponse(e);
    if (authRes) return authRes;
    throw e;
  }
}
