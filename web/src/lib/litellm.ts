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
  const rows = await fetchKeySpendLogs(apiKey, start, end);
  return rows.reduce((acc, row) => acc + row.spend, 0);
}

export type NormalizedSpendLog = {
  at: Date;
  model: string;
  spend: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function pickNumber(...vals: unknown[]): number {
  for (const v of vals) {
    const n = Number(v);
    if (!Number.isNaN(n) && Number.isFinite(n)) return n;
  }
  return 0;
}

function pickString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "unknown";
}

function pickDate(...vals: unknown[]): Date | null {
  for (const v of vals) {
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
    if (typeof v === "string" || typeof v === "number") {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function normalizeSpendLogRow(raw: unknown): NormalizedSpendLog | null {
  const row = asRecord(raw);
  if (!row) return null;
  const at =
    pickDate(
      row.startTime,
      row.endTime,
      row.start_time,
      row.end_time,
      row.timestamp,
      row.created_at,
      row.request_start_time,
    ) ?? null;
  if (!at) return null;
  const model = pickString(row.model, row.model_group, row.model_id, row.call_type);
  const spend = pickNumber(row.spend, row.total_cost, row.cost, row.response_cost);
  const promptTokens = pickNumber(row.prompt_tokens, row.promptTokens);
  const completionTokens = pickNumber(row.completion_tokens, row.completionTokens);
  const totalTokens =
    pickNumber(row.total_tokens, row.totalTokens) || promptTokens + completionTokens;
  return { at, model, spend, promptTokens, completionTokens, totalTokens };
}

function extractSpendLogArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const obj = asRecord(data);
  if (!obj) return [];
  if (Array.isArray(obj.data)) return obj.data;
  if (Array.isArray(obj.logs)) return obj.logs;
  if (Array.isArray(obj.results)) return obj.results;
  return [];
}

/** Fetch per-request spend logs for a virtual key in [start, end]. */
export async function fetchKeySpendLogs(
  apiKey: string,
  start: Date,
  end: Date,
): Promise<NormalizedSpendLog[]> {
  if (!apiKey || apiKey.startsWith("__app_enforced__:")) {
    return [];
  }
  const qs = new URLSearchParams({
    api_key: apiKey,
    start_date: start.toISOString(),
    end_date: end.toISOString(),
  });
  const res = await gatewayFetch(`/spend/logs?${qs.toString()}`);
  if (!res.ok) {
    return [];
  }
  const data = (await res.json()) as unknown;
  const rows: NormalizedSpendLog[] = [];
  for (const raw of extractSpendLogArray(data)) {
    const n = normalizeSpendLogRow(raw);
    if (n) rows.push(n);
  }
  return rows;
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
