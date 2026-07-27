import { env, GATEWAY_MODELS } from "@/lib/env";

type KeyGenerateResult = {
  key: string;
  keyId?: string;
  userId: string;
  mode: "virtual_key" | "app_enforced";
};

async function gatewayFetch(path: string, init?: RequestInit): Promise<Response> {
  const { gatewayBaseUrl, litellmMasterKey } = env();
  return fetch(`${gatewayBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${litellmMasterKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export async function ensureLitellmUserAndKey(phone: string): Promise<KeyGenerateResult> {
  const userId = `phone:${phone}`;
  const { dailyBudgetCny } = env();

  const userRes = await gatewayFetch("/user/new", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
  if (!userRes.ok && userRes.status !== 400) {
    const text = await userRes.text();
    if (!text.includes("already") && !text.includes("exists")) {
      // continue — user may already exist or DB missing
    }
  }

  const keyRes = await gatewayFetch("/key/generate", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      key_alias: `user-${phone}`,
      models: [...GATEWAY_MODELS],
      max_budget: dailyBudgetCny,
      budget_duration: "24h",
    }),
  });

  if (keyRes.ok) {
    const data = (await keyRes.json()) as { key?: string; token?: string; key_name?: string };
    const key = data.key ?? data.token;
    if (!key) {
      throw new Error("LiteLLM key/generate returned no key");
    }
    return { key, keyId: data.key_name, userId, mode: "virtual_key" };
  }

  const errText = await keyRes.text();
  if (
    errText.includes("DB not connected") ||
    keyRes.status === 404 ||
    keyRes.status >= 500
  ) {
    return {
      key: `__app_enforced__:${userId}`,
      userId,
      mode: "app_enforced",
    };
  }
  throw new Error(`LiteLLM key/generate failed: ${keyRes.status} ${errText}`);
}

export async function fetchKeySpendLastDays(apiKey: string, days: number): Promise<number> {
  if (apiKey.startsWith("__app_enforced__:")) {
    return 0;
  }
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const qs = new URLSearchParams({
    api_key: apiKey,
    start_date: start.toISOString(),
    end_date: end.toISOString(),
  });
  const res = await gatewayFetch(`/spend/logs?${qs.toString()}`);
  if (!res.ok) {
    return 0;
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
      return sumSpend((data as { data: Array<{ spend?: number }> }).data);
    }
    return 0;
  }
  return sumSpend(data as Array<{ spend?: number }>);
}

function sumSpend(rows: Array<{ spend?: number }>): number {
  return rows.reduce((acc, row) => acc + (Number(row.spend) || 0), 0);
}

export async function chatCompletions(params: {
  apiKey: string;
  body: Record<string, unknown>;
  appEnforcedUserId?: string;
}): Promise<Response> {
  const { gatewayBaseUrl, litellmMasterKey } = env();
  const useMaster = params.apiKey.startsWith("__app_enforced__:");
  const authKey = useMaster ? litellmMasterKey : params.apiKey;
  const body = { ...params.body };
  if (useMaster && params.appEnforcedUserId) {
    body.user = params.appEnforcedUserId;
  }
  return fetch(`${gatewayBaseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/** Best-effort revoke. No-op for app_enforced placeholders or when LiteLLM DB is down. */
export async function revokeLitellmKey(apiKey: string): Promise<void> {
  if (!apiKey || apiKey.startsWith("__app_enforced__:")) {
    return;
  }
  try {
    const res = await gatewayFetch("/key/delete", {
      method: "POST",
      body: JSON.stringify({ keys: [apiKey] }),
    });
    if (res.ok) return;
    const text = await res.text();
    if (text.includes("DB not connected") || res.status === 404 || res.status >= 500) {
      return;
    }
  } catch {
    // ignore — reissue will still overwrite local encrypted key
  }
}
