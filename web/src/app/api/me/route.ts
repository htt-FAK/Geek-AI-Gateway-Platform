import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth";
import { getBalance } from "@/lib/budget";
import { decryptSecret } from "@/lib/crypto";
import { env } from "@/lib/env";
import { getGatewayModels } from "@/lib/gateway-models";
import { isAppEnforcedKey, maskApiKey, resolveKeyMode } from "@/lib/keys";
import { syncUserBudget } from "@/lib/litellm";

/**
 * 对外 API 基地址。优先 PUBLIC_GATEWAY_BASE_URL；没配时，只有配置里是
 * Docker 内部服务名（http://litellm:4000）才用浏览器访问的 Host 推导，
 * 本机直连（127.0.0.1:4000）保持原样。
 */
function publicGatewayBase(req: Request): string {
  const explicit = process.env.PUBLIC_GATEWAY_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "").replace(/\/v1$/i, "");
  const configured = env().publicGatewayBaseUrl;
  if (!/^https?:\/\/litellm(:|\/|$)/i.test(configured)) return configured;
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
    .split(",")[0]
    .trim();
  if (!proto || !host || /^(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(host)) {
    return configured;
  }
  return `${proto}://${host}`;
}

export async function GET(req: Request) {
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
      role: user.role,
      models,
      balance,
      keyMode,
      keyMasked: maskApiKey(token),
      keyRevealedAt: user.keyRevealedAt?.toISOString() ?? null,
      gatewayUrl: `${publicGatewayBase(req)}/v1`,
      canRevealKey: keyMode === "virtual_key" && !isAppEnforcedKey(token),
      canRegenerateKey: keyMode === "virtual_key",
    });
  } catch (e) {
    const authRes = authErrorResponse(e);
    if (authRes) return authRes;
    throw e;
  }
}
