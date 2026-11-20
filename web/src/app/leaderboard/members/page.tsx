"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConsolePage, useMe } from "@/components/console";
import { PageHeader } from "@/components/page-header";

type RankRow = {
  phone?: string;
  phoneMasked: string;
  name?: string | null;
  spendCny: number;
  tokens: number;
  requests: number;
  isMe: boolean;
};

type Payload = {
  days: number;
  source: string;
  isAdmin: boolean;
  rows: RankRow[];
};

type Metric = "spend" | "tokens";
type Range = 1 | 7 | 30;

const RANGES: [Range, string][] = [
  [1, "今天"],
  [7, "近 7 天"],
  [30, "近 30 天"],
];

function money(n: number): string {
  return `¥${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function tokens(n: number): string {
  return n.toLocaleString();
}

function labelOf(row: RankRow): string {
  if (row.name) return row.name;
  return row.phone ?? row.phoneMasked;
}

export default function MemberRankPage() {
  const { me } = useMe();
  const [days, setDays] = useState<Range>(7);
  const [metric, setMetric] = useState<Metric>("spend");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/members/rank?days=${days}`);
      const body = (await res.json()) as Payload & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "加载排行失败");
      setData(body);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "加载排行失败");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const ranked = useMemo(() => {
    const rows = [...(data?.rows ?? [])];
    rows.sort((a, b) => (metric === "spend" ? b.spendCny - a.spendCny : b.tokens - a.tokens));
    return rows;
  }, [data, metric]);

  const max = ranked.reduce((m, r) => Math.max(m, metric === "spend" ? r.spendCny : r.tokens), 0);

  return (
    <ConsolePage phone={me?.phone}>
      <PageHeader
        group="观测"
        title="成员榜"
        description="全员花费与 Token 排行。管理员看完整手机号，成员看打码号。"
        actions={
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex gap-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-0.5">
              {RANGES.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-[13px] ${
                    days === key
                      ? "bg-[var(--accent-muted)] text-[var(--accent-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                  onClick={() => setDays(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="inline-flex gap-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-0.5">
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-[13px] ${
                  metric === "spend"
                    ? "bg-[var(--accent-muted)] text-[var(--accent-primary)]"
                    : "text-[var(--text-secondary)]"
                }`}
                onClick={() => setMetric("spend")}
              >
                花费
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-[13px] ${
                  metric === "tokens"
                    ? "bg-[var(--accent-muted)] text-[var(--accent-primary)]"
                    : "text-[var(--text-secondary)]"
                }`}
                onClick={() => setMetric("tokens")}
              >
                Token
              </button>
            </div>
          </div>
        }
      />

      {error ? <p className="text-sm text-[var(--status-error)]">{error}</p> : null}
      {loading && !data ? (
        <div className="panel space-y-3 p-5" aria-busy="true">
          <p className="sr-only">加载中</p>
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="skeleton block h-10 w-full" aria-hidden />
          ))}
        </div>
      ) : error ? null : (
        <ol className="panel divide-y divide-[var(--border-subtle)] overflow-hidden">
          {ranked.length === 0 ? (
            <li className="px-5 py-8 text-sm text-[var(--text-tertiary)]">这段时间还没有成员用量。</li>
          ) : (
            ranked.map((row, index) => {
              const value = metric === "spend" ? row.spendCny : row.tokens;
              const width = max > 0 ? Math.max(4, (value / max) * 100) : 0;
              return (
                <li
                  key={row.phone ?? row.phoneMasked}
                  className={`flex items-center gap-4 px-5 py-3.5 ${row.isMe ? "bg-[var(--accent-muted)]" : ""}`}
                >
                  <span
                    className={`w-8 shrink-0 text-center text-[15px] font-semibold tabular ${
                      index < 3 ? "text-[var(--accent-primary)]" : "text-[var(--text-tertiary)]"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">
                      {labelOf(row)}
                      {row.isMe ? <span className="ml-2 text-[12px] text-[var(--accent-primary)]">我</span> : null}
                    </p>
                    <p className="mono truncate text-[12px] text-[var(--text-tertiary)]">
                      {row.phone ?? row.phoneMasked}
                      {` · ${row.requests.toLocaleString()} 次`}
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent-solid,var(--accent-primary))]"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular text-[14px] font-semibold">{metric === "spend" ? money(row.spendCny) : tokens(row.tokens)}</p>
                    <p className="tabular text-[12px] text-[var(--text-tertiary)]">
                      {metric === "spend" ? `${tokens(row.tokens)} token` : money(row.spendCny)}
                    </p>
                  </div>
                </li>
              );
            })
          )}
        </ol>
      )}
    </ConsolePage>
  );
}
