import { NextResponse } from "next/server";

/**
 * 固定窗口限流 + 每用户在途请求计数。
 * 单进程内存实现：多副本各自计数、重启清零——与 SQLite 单写者同属单机边界，
 * 多副本部署前需把计数迁到 Redis/Postgres（见 README「计费与限流边界」）。
 */
const hits = new Map<string, { count: number; resetAt: number }>();

/** 过期项清扫阈值：防止长期运行后 Map 无界增长。 */
const SWEEP_THRESHOLD = 500;

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (hits.size > SWEEP_THRESHOLD) {
    for (const [k, v] of hits) {
      if (now >= v.resetAt) hits.delete(k);
    }
  }
  const cur = hits.get(key);
  if (!cur || now >= cur.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (cur.count >= limit) {
    return false;
  }
  cur.count += 1;
  return true;
}

export function tooManyRequests() {
  return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
}

/** 每用户同时在途的网关请求上限：余额门是调用前检查，并发会叠加超支，这里压住并发面。 */
export const INFLIGHT_LIMIT = 3;

const inflight = new Map<string, number>();

export function acquireInflight(key: string, limit: number = INFLIGHT_LIMIT): boolean {
  const cur = inflight.get(key) ?? 0;
  if (cur >= limit) return false;
  inflight.set(key, cur + 1);
  return true;
}

export function releaseInflight(key: string): void {
  const cur = inflight.get(key) ?? 0;
  if (cur <= 1) inflight.delete(key);
  else inflight.set(key, cur - 1);
}

export function inflightBusyResponse() {
  return NextResponse.json(
    { error: `同时进行的请求过多（上限 ${INFLIGHT_LIMIT} 个），请等上一轮完成再试` },
    { status: 429 },
  );
}