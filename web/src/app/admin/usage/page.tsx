"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ConsumptionChartPanel,
  MetricStrip,
  ModelCallChartPanel,
  type SeriesPoint,
} from "@/components/charts";
import { AdminConsole, Badge } from "@/components/admin-console";

type UsagePayload = {
  source: "litellm" | "litellm_truncated" | "spend_event";
  remainingSource?: "litellm" | "spend_event_fallback";
  from: string;
  to: string;
  granularity: string;
  kpis: {
    totalRequests: number;
    totalAmountCny: number;
    totalTokens: number;
    avgRpm: number;
    avgTpm: number;
  };
  consumptionSeries: SeriesPoint[];
  modelInvocationSeries: SeriesPoint[];
  members: Array<{
    phone?: string;
    name?: string | null;
    spendCny?: number;
    requests?: number;
    tokens?: number;
    grantedCny?: number;
    unlimited?: boolean;
    remainingCny?: number | null;
  }>;
};

type QuickRange = 1 | 7 | 30;

const RANGE_LABEL: Record<QuickRange, string> = { 1: "今天", 7: "近 7 天", 30: "近 30 天" };

function formatNum(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default function AdminUsagePage() {
  return (
    <AdminConsole
      active="usage"
      title="成员用量"
      subtitle="全员视角 · 费用、调用与余额一览"
    >
      {() => <UsageConsole />}
    </AdminConsole>
  );
}

function UsageConsole() {
  const [data, setData] = useState<UsagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quickDays, setQuickDays] = useState<QuickRange>(7);
  const [search, setSearch] = useState("");
  const [consumeToggle, setConsumeToggle] = useState<"柱状图" | "面积图">("柱状图");
  const [modelToggle, setModelToggle] = useState<"调用趋势" | "调用次数分布" | "调用次数排行">(
    "调用趋势",
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const to = new Date();
      const from = new Date(to.getTime() - quickDays * 24 * 60 * 60 * 1000);
      const granularity = quickDays >= 30 ? "day" : "hour";
      const qs = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
        granularity,
      });
      const res = await fetch(`/api/admin/usage?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "加载失败");
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError("网络错误，加载失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [quickDays]);

  useEffect(() => {
    void load();
  }, [load]);

  const members = useMemo(() => {
    const list = data?.members ?? [];
    const q = search.trim();
    if (!q) return list;
    return list.filter((m) => (m.phone ?? "").includes(q) || (m.name ?? "").includes(q));
  }, [data, search]);

  const sourceLabel =
    data?.source === "litellm" || data?.source === "litellm_truncated"
      ? "网关日志"
      : data?.source === "spend_event"
        ? "应用记账"
        : "";

  return (
    <div className="space-y-5">
      {/* 工具条：时间范围 + 数据来源 + 刷新 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-0.5">
          {([1, 7, 30] as QuickRange[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setQuickDays(d)}
              className={`rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                quickDays === d
                  ? "bg-[var(--accent-muted)] font-medium text-[var(--accent-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {RANGE_LABEL[d]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[13px] text-[var(--text-tertiary)]">
          {sourceLabel ? <span>数据来源：{sourceLabel}{loading ? " · 刷新中…" : ""}</span> : null}
          <button
            type="button"
            className="btn btn-ghost py-1.5 text-[13px]"
            onClick={() => void load()}
            disabled={loading}
          >
            刷新
          </button>
        </div>
      </div>

      {error ? (
        <div className="panel flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm text-[var(--status-error)]" role="alert">
            {error}
          </p>
          <button type="button" className="btn btn-ghost py-1.5 text-[13px]" onClick={() => void load()}>
            重试
          </button>
        </div>
      ) : null}

      {/*
        加载失败（接口 503 / source=error）时不渲染任何 0 值面板，
        只显示上面的错误提示，避免「看起来像没流量」。
      */}
      {data?.source === "litellm_truncated" ? (
        <p className="text-xs text-[var(--status-warning)]">
          日志量过大，仅统计最近 5000 条（source=litellm_truncated），数字可能偏小。
        </p>
      ) : null}
      {data?.remainingSource === "spend_event_fallback" ? (
        <p className="text-xs text-[var(--status-warning)]">
          网关不可达，部分成员的剩余余额按本地记账回退计算，可能不含 Virtual Key 直连花费。
        </p>
      ) : null}

      {loading && !data ? (
        <div className="panel p-8 text-sm text-[var(--text-tertiary)]">加载中…</div>
      ) : data ? (
        <>
          <MetricStrip
            metrics={[
              { label: "总请求", value: formatNum(data.kpis.totalRequests) },
              { label: "总费用", value: `¥${formatNum(data.kpis.totalAmountCny, 4)}` },
              { label: "总 Token", value: formatNum(data.kpis.totalTokens) },
              { label: "平均 RPM", value: formatNum(data.kpis.avgRpm, 2) },
              { label: "平均 TPM", value: formatNum(Math.round(data.kpis.avgTpm)) },
            ]}
          />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ConsumptionChartPanel
              series={data.consumptionSeries}
              mode={consumeToggle}
              onModeChange={setConsumeToggle}
              totalSpendCny={data.kpis.totalAmountCny}
            />
            <ModelCallChartPanel
              series={data.modelInvocationSeries}
              mode={modelToggle}
              onModeChange={setModelToggle}
              totalCount={data.kpis.totalRequests}
            />
          </div>

          <section className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
              <span className="text-sm font-medium">成员明细</span>
              <input
                className="field w-44 py-1 text-[13px]"
                placeholder="搜索手机号"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[13px] text-[var(--text-tertiary)]">
                  <tr>
                    <th className="px-4 py-3 font-normal">手机号</th>
                    <th className="px-4 py-3 font-normal">姓名</th>
                    <th className="px-4 py-3 font-normal">累计充值</th>
                    <th className="px-4 py-3 font-normal">剩余余额</th>
                    <th className="px-4 py-3 font-normal">本期费用</th>
                    <th className="px-4 py-3 font-normal">请求</th>
                    <th className="px-4 py-3 font-normal">Token</th>
                  </tr>
                </thead>
                <tbody>
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-[var(--text-tertiary)]">
                        {(data.members.length ?? 0) === 0 ? "暂无成员" : "没有匹配的手机号或姓名"}
                      </td>
                    </tr>
                  ) : (
                    members.map((m, i) => (
                      <tr key={m.phone ?? i} className="border-t border-[var(--border-subtle)]">
                        <td className="mono px-4 py-3">{m.phone}</td>
                        <td className="px-4 py-3">{m.name ?? <span className="text-[var(--text-tertiary)]">—</span>}</td>
                        <td className="tabular px-4 py-3">¥{(m.grantedCny ?? 0).toFixed(2)}</td>
                        <td className="tabular px-4 py-3">
                          {m.unlimited ? (
                            <Badge tone="accent">不限额</Badge>
                          ) : (m.remainingCny ?? 0) <= 0 ? (
                            <span className="inline-flex items-center gap-1.5">
                              ¥0.00 <Badge tone="err">余额用尽</Badge>
                            </span>
                          ) : (
                            <>¥{(m.remainingCny ?? 0).toFixed(2)}</>
                          )}
                        </td>
                        <td className="tabular px-4 py-3">¥{(m.spendCny ?? 0).toFixed(2)}</td>
                        <td className="tabular px-4 py-3">{formatNum(m.requests ?? 0)}</td>
                        <td className="tabular px-4 py-3">{formatNum(m.tokens ?? 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}