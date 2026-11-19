import { env, GATEWAY_MODELS } from "@/lib/env";

type Cache = { at: number; models: string[] };
const globalForModels = globalThis as unknown as { gatewayModels?: Cache };

/**
 * 动态模型列表：拉网关 /v1/models（60s 缓存），失败回退静态 GATEWAY_MODELS。
 * 网关增删模型后控制台无需改代码。
 */
export async function getGatewayModels(): Promise<string[]> {
  const cached = globalForModels.gatewayModels;
  if (cached && Date.now() - cached.at < 60_000) {
    return cached.models;
  }
  try {
    const { gatewayBaseUrl, litellmMasterKey } = env();
    const res = await fetch(`${gatewayBaseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${litellmMasterKey}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = (await res.json()) as { data?: { id?: string }[] };
      const ids = (data.data ?? [])
        .map((m) => m.id)
        .filter((x): x is string => typeof x === "string" && x.length > 0);
      if (ids.length > 0) {
        globalForModels.gatewayModels = { at: Date.now(), models: ids };
        return ids;
      }
    }
  } catch {
    // 网关离线 → 静态兜底
  }
  return [...GATEWAY_MODELS];
}
