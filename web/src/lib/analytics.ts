import { prisma } from "@/lib/db";
import { fetchKeySpendLogs, type NormalizedSpendLog } from "@/lib/litellm";

export type AnalyticsGranularity = "hour" | "day";
export type AnalyticsSource = "litellm" | "spend_event" | "mixed_fallback";

export type AnalyticsEvent = {
  at: Date;
  model: string;
  spendCny: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type SeriesPoint = {
  bucket: string;
  byModel: Record<string, number>;
};

export type AnalyticsKpis = {
  count: number;
  spendCny: number;
  tokens: number;
  rpm: number;
  tpm: number;
};

export type AnalyticsResult = {
  kpis: AnalyticsKpis;
  spendSeries: SeriesPoint[];
  callSeries: SeriesPoint[];
  source: AnalyticsSource;
};

function shanghaiParts(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
}

function part(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((p) => p.type === type)?.value ?? "00";
}

/** Bucket label in Asia/Shanghai wall time. */
export function bucketKey(d: Date, granularity: AnalyticsGranularity): string {
  const parts = shanghaiParts(d);
  const y = part(parts, "year");
  const m = part(parts, "month");
  const day = part(parts, "day");
  if (granularity === "day") {
    return `${y}-${m}-${day}`;
  }
  const hour = part(parts, "hour").padStart(2, "0");
  return `${y}-${m}-${day} ${hour}:00`;
}

function windowMinutes(from: Date, to: Date): number {
  return Math.max(1, (to.getTime() - from.getTime()) / 60_000);
}

function enumerateBuckets(
  from: Date,
  to: Date,
  granularity: AnalyticsGranularity,
): string[] {
  const stepMs = granularity === "day" ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  const keys: string[] = [];
  const seen = new Set<string>();
  // Walk UTC millis but label in Shanghai — start slightly before `from` to include edge.
  let t = from.getTime();
  const end = to.getTime();
  // Cap iterations to avoid runaway ranges
  const maxSteps = granularity === "day" ? 400 : 24 * 40;
  let steps = 0;
  while (t <= end && steps < maxSteps) {
    const key = bucketKey(new Date(t), granularity);
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
    t += stepMs;
    steps += 1;
  }
  const endKey = bucketKey(to, granularity);
  if (!seen.has(endKey)) {
    keys.push(endKey);
  }
  return keys;
}

export function aggregateEvents(
  events: AnalyticsEvent[],
  from: Date,
  to: Date,
  granularity: AnalyticsGranularity,
): Omit<AnalyticsResult, "source"> {
  const buckets = enumerateBuckets(from, to, granularity);
  const spendMap = new Map<string, Record<string, number>>();
  const callMap = new Map<string, Record<string, number>>();
  for (const b of buckets) {
    spendMap.set(b, {});
    callMap.set(b, {});
  }

  let count = 0;
  let spendCny = 0;
  let tokens = 0;

  for (const ev of events) {
    if (ev.at < from || ev.at > to) continue;
    count += 1;
    spendCny += ev.spendCny;
    tokens += ev.totalTokens;
    const key = bucketKey(ev.at, granularity);
    if (!spendMap.has(key)) {
      spendMap.set(key, {});
      callMap.set(key, {});
      buckets.push(key);
    }
    const model = ev.model || "unknown";
    const spendBucket = spendMap.get(key)!;
    const callBucket = callMap.get(key)!;
    spendBucket[model] = (spendBucket[model] ?? 0) + ev.spendCny;
    callBucket[model] = (callBucket[model] ?? 0) + 1;
  }

  const minutes = windowMinutes(from, to);
  const spendSeries: SeriesPoint[] = buckets.map((bucket) => ({
    bucket,
    byModel: spendMap.get(bucket) ?? {},
  }));
  const callSeries: SeriesPoint[] = buckets.map((bucket) => ({
    bucket,
    byModel: callMap.get(bucket) ?? {},
  }));

  return {
    kpis: {
      count,
      spendCny,
      tokens,
      rpm: count / minutes,
      tpm: tokens / minutes,
    },
    spendSeries,
    callSeries,
  };
}

function fromSpendLogs(rows: NormalizedSpendLog[]): AnalyticsEvent[] {
  return rows.map((r) => ({
    at: r.at,
    model: r.model,
    spendCny: r.spend,
    promptTokens: r.promptTokens,
    completionTokens: r.completionTokens,
    totalTokens: r.totalTokens,
  }));
}

export async function buildUserAnalytics(params: {
  userId: string;
  litellmKeyToken: string | null;
  from: Date;
  to: Date;
  granularity: AnalyticsGranularity;
}): Promise<AnalyticsResult> {
  const { userId, litellmKeyToken, from, to, granularity } = params;
  const usableVk =
    litellmKeyToken &&
    !litellmKeyToken.startsWith("__app_enforced__:") &&
    litellmKeyToken.length > 0;

  if (usableVk) {
    try {
      const logs = await fetchKeySpendLogs(litellmKeyToken, from, to);
      if (logs.length > 0) {
        return {
          ...aggregateEvents(fromSpendLogs(logs), from, to, granularity),
          source: "litellm",
        };
      }
    } catch {
      // fall through to SpendEvent
    }
  }

  const rows = await prisma.spendEvent.findMany({
    where: { userId, createdAt: { gte: from, lte: to } },
    select: {
      createdAt: true,
      model: true,
      costCny: true,
      promptTokens: true,
      completionTokens: true,
      totalTokens: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const events: AnalyticsEvent[] = rows.map((r) => ({
    at: r.createdAt,
    model: r.model,
    spendCny: r.costCny,
    promptTokens: r.promptTokens,
    completionTokens: r.completionTokens,
    totalTokens: r.totalTokens,
  }));

  return {
    ...aggregateEvents(events, from, to, granularity),
    source: usableVk ? "mixed_fallback" : "spend_event",
  };
}
