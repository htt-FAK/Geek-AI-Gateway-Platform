import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth";
import { getBudgetUsage } from "@/lib/budget";
import { decryptSecret } from "@/lib/crypto";
import { env, GATEWAY_MODELS } from "@/lib/env";
import { isAppEnforcedKey, maskApiKey, resolveKeyMode } from "@/lib/keys";

export async function GET() {
  try {
    const { user } = await requireUser();
    const token = user.litellmKeyTokenEnc ? decryptSecret(user.litellmKeyTokenEnc) : null;
    const budget = await getBudgetUsage({ userId: user.id, litellmKeyToken: token });
    const keyMode = resolveKeyMode(token);

    return NextResponse.json({
      phone: user.phone,
      mustChangePassword: user.mustChangePassword,
      disabled: user.disabled,
      models: GATEWAY_MODELS,
      budget,
      keyMode,
      keyMasked: maskApiKey(token),
      keyRevealedAt: user.keyRevealedAt?.toISOString() ?? null,
      gatewayUrl: `${env().publicGatewayBaseUrl}/v1`,
      canRevealKey: keyMode === "virtual_key" && !user.keyRevealedAt && !isAppEnforcedKey(token),
      canRegenerateKey: keyMode === "virtual_key",
    });
  } catch (e) {
    const authRes = authErrorResponse(e);
    if (authRes) return authRes;
    throw e;
  }
}
