import { env, GATEWAY_MODELS } from "@/lib/env";
import { kindFromUnknown, spendSeriesModel } from "@/lib/spend-kind";

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

/** 网关报错正文明确指向「数据库未连接」——app_enforced 占位 Key 的唯一合法触发条件。 */
export function isGatewayDbDownBody(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("db not connected") ||
    t.includes("no database") ||
    t.includes("database not connected") ||
    t.includes("not connected to db") ||
    t.includes("connect proxy to database") ||
    // PG 停机时管理端点（/key/list 等）的实测报错：引擎连不上库
    t.includes("all connection attempts failed")
  );
}

const USER_EXISTS_PATTERN = /already exists|already exist|duplicate|unique constraint/i;

export async function ensureLitellmUserAndKey(
  phone: string,
  budget?: { grantedCny: number; unlimited: boolean },
): Promise<KeyGenerateResult> {
  const userId = `phone:${phone}`;

  // 用户级终身预算 = 余额上限（不设 budget_duration → 永不重置，全部 Key 共享）
  const { gatewayUserRpmLimit, gatewayUserTpmLimit } = env();
  const userRes = await gatewayFetch("/user/new", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      // litellm 默认随 /user/new 附赠一把无别名 Key（auto_create_key=True）：
      // 它不落本地副本、不受轮换吊销管辖，却能花同一份预算——必须关掉，Key 只走 /key/generate。
      auto_create_key: false,
      max_budget: budget ? (budget.unlimited ? null : budget.grantedCny) : undefined,
      rpm_limit: gatewayUserRpmLimit,
      ...(gatewayUserTpmLimit !== undefined ? { tpm_limit: gatewayUserTpmLimit } : {}),
    }),
  });
  let gatewayDbDown = false;
  if (!userRes.ok) {
    const text = await userRes.text();
    if (isGatewayDbDownBody(text)) {
      // 网关数据库不可用 → 继续走 key/generate，由其返回 app_enforced 占位 Key
      gatewayDbDown = true;
    } else if (USER_EXISTS_PATTERN.test(text)) {
      // 用户已存在 → 继续，但仍要同步预算
    } else {
      throw new Error(`LiteLLM /user/new 失败：${userRes.status} ${text.slice(0, 200)}`);
    }
  }
  // 预算同步必须在拿到 Virtual Key 之前确认成功：
  // 同步失败直接抛错（导入进 errors），绝不签发一把没有用户级 max_budget 的 Key。
  if (budget && !gatewayDbDown) {
    const synced = await syncUserBudget(userId, budget.grantedCny, budget.unlimited);
    if (!synced) {
      throw new Error("网关用户预算同步失败（max_budget 未写入），已停止签发密钥");
    }
  }

  const keyRes = await gatewayFetch("/key/generate", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      key_alias: `user-${phone}`,
      models: [...GATEWAY_MODELS],
    }),
  });

  if (keyRes.ok) {
    const data = (await keyRes.json()) as { key?: string; token?: string; key_name?: string };
    const key = data.key ?? data.token;
    if (!key) {
      throw new Error("LiteLLM key/generate returned no key");
    }
    // 到这里 max_budget 已在上面同步成功，Key 不存在「无预算」窗口期
    return { key, keyId: data.key_name, userId, mode: "virtual_key" };
  }

  const errText = await keyRes.text();
  // app_enforced 只留给「网关数据库确实不可用」；404 和其它 5xx 一律抛错，禁止发占位 Key
  if (isGatewayDbDownBody(errText)) {
    return {
      key: `__app_enforced__:${userId}`,
      userId,
      mode: "app_enforced",
    };
  }
  throw new Error(`LiteLLM key/generate failed: ${keyRes.status} ${errText.slice(0, 200)}`);
}

/**
 * 只确保网关用户存在并写入用户级预算，**不签发密钥**。
 * 用于「新账号默认无 Key」：账号建好后由用户在密钥页自行创建 Key。
 * 网关 DB 不可用 / 预算同步失败时抛错（调用方进 errors），绝不建一个无预算约束的账号。
 */
export async function ensureLitellmUser(
  phone: string,
  budget?: { grantedCny: number; unlimited: boolean },
): Promise<{ userId: string }> {
  const userId = `phone:${phone}`;
  const { gatewayUserRpmLimit, gatewayUserTpmLimit } = env();
  const userRes = await gatewayFetch("/user/new", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      // 同 ensureLitellmUserAndKey：禁止 /user/new 附赠孤儿 Key（导入账号只建用户，不发 Key）
      auto_create_key: false,
      max_budget: budget ? (budget.unlimited ? null : budget.grantedCny) : undefined,
      rpm_limit: gatewayUserRpmLimit,
      ...(gatewayUserTpmLimit !== undefined ? { tpm_limit: gatewayUserTpmLimit } : {}),
    }),
  });
  if (!userRes.ok) {
    const text = await userRes.text();
    if (!USER_EXISTS_PATTERN.test(text)) {
      throw new Error(`LiteLLM /user/new 失败：${userRes.status} ${text.slice(0, 200)}`);
    }
  }
  if (budget) {
    const synced = await syncUserBudget(userId, budget.grantedCny, budget.unlimited);
    if (!synced) {
      throw new Error("网关用户预算同步失败（max_budget 未写入），已停止创建账号");
    }
  }
  return { userId };
}

export type NormalizedSpendLog = {
  at: Date;
  model: string;
  spend: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  userId: string | null;
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

/** LiteLLM 日志 startTime 形如 "2026-11-18 15:14:01.774"（UTC 但无时区标记）→ 补 Z 避免按本地时区解析。 */
function parseLogDate(v: unknown): Date | null {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(v)) {
    const d = new Date(v.replace(" ", "T") + "Z");
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return pickDate(v);
}

function normalizeSpendLogRow(raw: unknown): NormalizedSpendLog | null {
  const row = asRecord(raw);
  if (!row) return null;
  const at =
    parseLogDate(row.startTime) ??
    pickDate(
      row.endTime,
      row.start_time,
      row.end_time,
      row.timestamp,
      row.created_at,
      row.request_start_time,
    ) ??
    null;
  if (!at) return null;
  // 去掉 provider 前缀（deepseek/xxx、openai/xxx），与本地 SpendEvent 口径一致
  const rawModel = pickString(row.model, row.model_group, row.model_id, row.call_type).replace(
    /^(deepseek|openai)\//,
    "",
  );
  const meta = row.metadata ?? row.request_tags;
  const model = spendSeriesModel(rawModel, kindFromUnknown(meta));
  const spend = pickNumber(row.spend, row.total_cost, row.cost, row.response_cost);
  const promptTokens = pickNumber(row.prompt_tokens, row.promptTokens);
  const completionTokens = pickNumber(row.completion_tokens, row.completionTokens);
  const totalTokens =
    pickNumber(row.total_tokens, row.totalTokens) || promptTokens + completionTokens;
  const userId = typeof row.user === "string" ? row.user : typeof row.user_id === "string" ? row.user_id : null;
  return { at, model, spend, promptTokens, completionTokens, totalTokens, userId };
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

/** 一次花费日志查询的结果：truncated 表示超过页数上限，日志没拉全。 */
export type SpendLogsPage = {
  logs: NormalizedSpendLog[];
  truncated: boolean;
};

/** /spend/logs/v2 单页上限 100 条；最多拉 50 页（5000 条），超出标记 truncated。 */
const SPEND_LOGS_PAGE_SIZE = 100;
const SPEND_LOGS_MAX_PAGES = 50;

/** 上海时区日历日 YYYY-MM-DD。/spend/logs 的日期参数按 UTC 0 点解析，用上海日历日避免当天被切掉。 */
function shanghaiDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * 分页拉完 /spend/logs/v2（LiteLLM v1.83 的 /spend/logs 本体不分页且已弃用）。
 * HTTP 失败 / 解析失败返回 null（调用方不得当成 0 花费）；空数组只表示网关明确没有日志。
 */
async function fetchSpendLogsPaged(query: URLSearchParams): Promise<SpendLogsPage | null> {
  const logs: NormalizedSpendLog[] = [];
  let truncated = false;
  let page = 1;
  while (true) {
    const pageQs = new URLSearchParams(query);
    pageQs.set("page", String(page));
    pageQs.set("page_size", String(SPEND_LOGS_PAGE_SIZE));
    let res: Response;
    try {
      res = await gatewayFetch(`/spend/logs/v2?${pageQs.toString()}`);
    } catch {
      return null;
    }
    if (!res.ok) {
      return null;
    }
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return null;
    }
    for (const raw of extractSpendLogArray(data)) {
      const n = normalizeSpendLogRow(raw);
      if (n) logs.push(n);
    }
    const obj = asRecord(data);
    const totalPages = Number(obj?.total_pages ?? 1);
    if (!Number.isFinite(totalPages) || totalPages <= page) {
      break;
    }
    if (page >= SPEND_LOGS_MAX_PAGES) {
      truncated = true;
      break;
    }
    page += 1;
  }
  return { logs, truncated };
}

/**
 * 按网关 user_id 拉 [start, end] 的逐条花费日志——覆盖该用户全部 Key（控制台 + 直连），
 * 与 getBalance 的用户级 spend 同一口径。只拿主 Key 的 api_key 过滤会漏掉其它 Key 的直连。
 */
export async function fetchUserSpendLogs(
  litellmUserId: string,
  start: Date,
  end: Date,
): Promise<SpendLogsPage | null> {
  if (!litellmUserId) {
    return { logs: [], truncated: false };
  }
  // end_date 解析为当天 00:00 UTC，按上海日历日 +1 天才能含当天
  const qs = new URLSearchParams({
    user_id: litellmUserId,
    start_date: shanghaiDateKey(start),
    end_date: shanghaiDateKey(new Date(end.getTime() + 86400000)),
  });
  return fetchSpendLogsPaged(qs);
}

/** 网关用户级累计 spend（覆盖控制台 + 直连）。失败返回 null → 调用方回退本地口径。 */
export async function fetchUserSpend(litellmUserId: string): Promise<number | null> {
  try {
    const qs = new URLSearchParams({ user_id: litellmUserId });
    const res = await gatewayFetch(`/user/info?${qs.toString()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const info = asRecord(data.user_info) ?? data;
    const spend = Number(info.spend);
    return Number.isFinite(spend) ? spend : null;
  } catch {
    return null;
  }
}

/**
 * 把本地余额推平到网关用户级 max_budget（终身、全 Key 共享），
 * 同时带上用户级 rpm/tpm 限额（覆盖该用户全部 Key 含直连，存量用户经此自动获得限额）。
 * 调用方必须持有 withUserLock 或处于互斥流程内，避免旧快照盖掉充值后的新预算。
 */
export async function syncUserBudget(
  litellmUserId: string,
  grantedCny: number,
  unlimited: boolean,
): Promise<boolean> {
  const { gatewayUserRpmLimit, gatewayUserTpmLimit } = env();
  try {
    const res = await gatewayFetch("/user/update", {
      method: "POST",
      body: JSON.stringify({
        user_id: litellmUserId,
        max_budget: unlimited ? null : grantedCny,
        rpm_limit: gatewayUserRpmLimit,
        ...(gatewayUserTpmLimit !== undefined ? { tpm_limit: gatewayUserTpmLimit } : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 读网关用户当前 max_budget（number；null=不限额）。查询失败返回 undefined。
 * 充值回滚用：仅当网关仍等于本次写入值时才推回旧值，避免盖掉并发新充值。
 */
export async function fetchUserMaxBudget(
  litellmUserId: string,
): Promise<{ ok: true; maxBudget: number | null } | { ok: false }> {
  try {
    const qs = new URLSearchParams({ user_id: litellmUserId });
    const res = await gatewayFetch(`/user/info?${qs.toString()}`);
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as Record<string, unknown>;
    const info = asRecord(data.user_info) ?? data;
    const raw = info.max_budget;
    if (raw === null || raw === undefined) return { ok: true, maxBudget: null };
    const n = Number(raw);
    return Number.isFinite(n) ? { ok: true, maxBudget: n } : { ok: false };
  } catch {
    return { ok: false };
  }
}

/**
 * 封禁 / 解封某网关用户的全部 Virtual Key（LiteLLM v1.83 用户表没有 blocked 字段，
 * 只能按 Key 封禁：/key/block、/key/unblock）。任一 Key 失败即返回 false。
 * 用于管理端禁用账号——Web 的 disabled 之外，还要管住已经发出的 Key。
 */
export async function setUserKeysBlocked(
  litellmUserId: string,
  blocked: boolean,
): Promise<boolean> {
  let keys: GatewayKeyInfo[];
  try {
    keys = await listGatewayKeys(litellmUserId);
  } catch {
    return false;
  }
  for (const k of keys) {
    try {
      const res = await gatewayFetch(blocked ? "/key/block" : "/key/unblock", {
        method: "POST",
        body: JSON.stringify({ key: k.token }),
      });
      if (!res.ok) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/** 全量 spend logs（master key，不按 key 过滤）——管理端全员用量用。 */
export async function fetchAllSpendLogs(start: Date, end: Date): Promise<SpendLogsPage | null> {
  const qs = new URLSearchParams({
    start_date: shanghaiDateKey(start),
    end_date: shanghaiDateKey(new Date(end.getTime() + 86400000)),
  });
  return fetchSpendLogsPaged(qs);
}

export async function chatCompletions(params: {
  apiKey: string;
  body: Record<string, unknown>;
  appEnforcedUserId?: string;
  /** 客户端断开时中止上游请求，避免继续烧上游费用 */
  signal?: AbortSignal;
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
    signal: params.signal,
  });
}

// ---------- 多密钥管理（LiteLLM DB 在线时可用） ----------

export class GatewayDbError extends Error {
  constructor(message = "网关密钥库未连接") {
    super(message);
    this.name = "GatewayDbError";
  }
}

export type GatewayKeyInfo = {
  /** LiteLLM 哈希 token，用作操作标识（/key/info、/key/delete 认它） */
  token: string;
  /** LiteLLM key_name（sk-… 掩码形式），用于展示 */
  keyName: string;
  keyAlias: string | null;
  userId: string | null;
  models: string[];
  maxBudget: number | null;
  spend: number;
  budgetDuration: string | null;
  expires: string | null;
  allowedIps: string[];
  createdAt: string | null;
  blocked: boolean;
};

function isDbDown(text: string): boolean {
  // 只认正文明确指向数据库未连接的报错；404 / 其它 5xx 走各自的错误分支
  return isGatewayDbDownBody(text);
}

function normalizeKeyInfo(raw: unknown): GatewayKeyInfo | null {
  const row = asRecord(raw);
  if (!row) return null;
  const token = pickString(row.token);
  const keyName = pickString(row.key_name, row.key);
  if (!token || !keyName) return null;
  const models = Array.isArray(row.models) ? row.models.map((m) => String(m)) : [];
  const allowedIps = Array.isArray(row.allowed_ips) ? row.allowed_ips.map((m) => String(m)) : [];
  const maxBudget = row.max_budget === null || row.max_budget === undefined ? null : Number(row.max_budget);
  return {
    token,
    keyName,
    keyAlias: typeof row.key_alias === "string" ? row.key_alias : null,
    userId: typeof row.user_id === "string" ? row.user_id : null,
    models,
    maxBudget: maxBudget !== null && Number.isFinite(maxBudget) ? maxBudget : null,
    spend: pickNumber(row.spend),
    budgetDuration: typeof row.budget_duration === "string" ? row.budget_duration : null,
    expires: typeof row.expires === "string" ? row.expires : null,
    allowedIps,
    createdAt: pickDate(row.created_at, row.createdAt)?.toISOString() ?? null,
    blocked: Boolean(row.blocked),
  };
}

/** /key/list 单页上限与页数上限：超出宁可抛错（封禁/轮换必须失败 closed），不可静默截断。 */
const KEY_LIST_PAGE_SIZE = 100;
const KEY_LIST_MAX_PAGES = 50;

/**
 * 列出某网关用户的全部密钥（不含明文），按 total_pages 翻页拉完。
 * DB 未连接时抛 GatewayDbError；超过页数上限抛错（绝不返回不完整的列表）。
 */
export async function listGatewayKeys(userId: string): Promise<GatewayKeyInfo[]> {
  const out: GatewayKeyInfo[] = [];
  let page = 1;
  while (true) {
    const qs = new URLSearchParams({
      user_id: userId,
      page: String(page),
      page_size: String(KEY_LIST_PAGE_SIZE),
      return_full_object: "true",
    });
    const res = await gatewayFetch(`/key/list?${qs.toString()}`);
    const text = await res.text();
    if (!res.ok) {
      if (isDbDown(text)) throw new GatewayDbError();
      throw new Error(`key/list 失败：${res.status} ${text.slice(0, 200)}`);
    }
    const data = JSON.parse(text) as unknown;
    const obj = asRecord(data);
    const arr = Array.isArray(data) ? data : Array.isArray(obj?.keys) ? obj.keys : [];
    for (const raw of arr) {
      const k = normalizeKeyInfo(raw);
      if (k) out.push(k);
    }
    const totalPages = Number(obj?.total_pages ?? 1);
    if (!Number.isFinite(totalPages) || totalPages <= page) break;
    if (page >= KEY_LIST_MAX_PAGES) {
      throw new Error(`key/list 超过 ${KEY_LIST_MAX_PAGES} 页上限，密钥列表不完整`);
    }
    page += 1;
  }
  return out;
}

/** 用 key_name 或完整 key 取回完整明文 key（master key 权限）。 */
export async function getGatewayKeyFull(keyNameOrToken: string): Promise<{ key: string; info: GatewayKeyInfo | null }> {
  const qs = new URLSearchParams({ key: keyNameOrToken });
  const res = await gatewayFetch(`/key/info?${qs.toString()}`);
  const text = await res.text();
  if (!res.ok) {
    if (isDbDown(text)) throw new GatewayDbError();
    throw new Error(`key/info 失败：${res.status} ${text.slice(0, 200)}`);
  }
  const data = JSON.parse(text) as Record<string, unknown>;
  const key = typeof data.key === "string" ? data.key : keyNameOrToken;
  return { key, info: normalizeKeyInfo(data.info ?? data) };
}

export type GenerateKeyParams = {
  userId: string;
  keyAlias?: string;
  models: string[];
  /** LiteLLM duration 参数，例如 "30d"；不传 = 永久 */
  duration?: string;
  expires?: string;
  allowedIps?: string[];
};

/** 创建密钥，返回一次性明文。预算继承用户级余额，不在 Key 上单设。 */
export async function generateGatewayKey(params: GenerateKeyParams): Promise<{ key: string; keyName: string }> {
  const body: Record<string, unknown> = {
    user_id: params.userId,
    models: params.models,
    key_alias: params.keyAlias || undefined,
    duration: params.duration,
    expires: params.expires,
    allowed_ips: params.allowedIps?.length ? params.allowedIps : undefined,
  };
  const res = await gatewayFetch("/key/generate", { method: "POST", body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) {
    if (isDbDown(text)) throw new GatewayDbError();
    throw new Error(`key/generate 失败：${res.status} ${text.slice(0, 200)}`);
  }
  const data = JSON.parse(text) as Record<string, unknown>;
  const key = typeof data.key === "string" ? data.key : "";
  if (!key) throw new Error("key/generate 未返回密钥");
  return { key, keyName: typeof data.key_name === "string" ? data.key_name : key };
}

/**
 * 更新密钥元数据（描述/模型/有效期）。需完整 key。
 * duration 传 null = 永久：LiteLLM v1.83 的 /key/update 把显式 null 的 duration
 * 转成 expires=None（永不失效），见 prepare_key_update_data。
 * 预算不在 Key 上单设——统一走用户级 max_budget。
 */
export async function updateGatewayKey(
  fullKey: string,
  patch: { keyAlias?: string; models?: string[]; duration?: string | null },
): Promise<void> {
  const body: Record<string, unknown> = { key: fullKey };
  if (patch.keyAlias !== undefined) body.key_alias = patch.keyAlias;
  if (patch.models !== undefined) body.models = patch.models;
  if (patch.duration !== undefined) body.duration = patch.duration;
  const res = await gatewayFetch("/key/update", { method: "POST", body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) {
    if (isDbDown(text)) throw new GatewayDbError();
    throw new Error(`key/update 失败：${res.status} ${text.slice(0, 200)}`);
  }
}

/** 删除密钥（批量，可传完整 Key 或哈希 token）。「No keys found」= 已不存在，视为成功。 */
export async function deleteGatewayKeys(fullKeys: string[]): Promise<void> {
  if (fullKeys.length === 0) return;
  const res = await gatewayFetch("/key/delete", { method: "POST", body: JSON.stringify({ keys: fullKeys }) });
  const text = await res.text();
  if (!res.ok) {
    if (text.includes("No keys found")) return;
    if (isDbDown(text)) throw new GatewayDbError();
    throw new Error(`key/delete 失败：${res.status} ${text.slice(0, 200)}`);
  }
}

/** 吊销失败：旧 Key 仍可能继续花钱，调用方必须中止后续签发。 */
export class KeyRevokeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeyRevokeError";
  }
}

/**
 * 吊销网关密钥。失败抛 KeyRevokeError（旧 Key 还能花同一份余额，不得继续签发新 Key）。
 * 占位 Key 无需吊销；网关返回「No keys found」说明 Key 已不存在，视为成功。
 */
export async function revokeLitellmKey(apiKey: string): Promise<void> {
  if (!apiKey || apiKey.startsWith("__app_enforced__:")) {
    return;
  }
  let res: Response;
  try {
    res = await gatewayFetch("/key/delete", {
      method: "POST",
      body: JSON.stringify({ keys: [apiKey] }),
    });
  } catch (e) {
    throw new KeyRevokeError(
      `吊销旧密钥失败：网关不可达（${e instanceof Error ? e.message : "unknown"}）`,
    );
  }
  if (res.ok) return;
  const text = await res.text();
  if (text.includes("No keys found")) {
    return; // LiteLLM v1.83 对不存在的 Key 返回 404 {"error": "No keys found"}
  }
  throw new KeyRevokeError(`吊销旧密钥失败：${res.status} ${text.slice(0, 200)}`);
}
