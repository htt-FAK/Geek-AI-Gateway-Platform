"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BalancePanel,
  ConsumptionChartPanel,
  ModelCallChartPanel,
  type SeriesPoint,
} from "@/components/charts";
import { ConsolePage, useMe } from "@/components/console";
import { PageHeader } from "@/components/page-header";
import { ChartBlockSkeleton } from "@/components/skeleton";
import { DashboardFilterDialog } from "@/components/dashboard-filter";
import { DashboardPrefsDialog } from "@/components/dashboard-prefs-dialog";
import {
  DEFAULT_PREFS,
  loadDashboardPrefs,
  rangeFromQuickDays,
  saveDashboardPrefs,
  type ConsumeChartMode,
  type DashboardPrefs,
  type Granularity,
  type ModelChartMode,
  type QuickRangeDays,
} from "@/lib/dashboard-prefs";

type AnalyticsPayload = {
  kpis: {
    count: number;
    spendCny: number;
    tokens: number;
    rpm: number;
    tpm: number;
  };
  spendSeries: SeriesPoint[];
  callSeries: SeriesPoint[];
  source?: string;
};

function formatNum(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "—";
  if (digits === 0) return Math.round(n).toLocaleString();
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default function DashboardPage() {
  const { me } = useMe();
  const [prefs, setPrefs] = useState<DashboardPrefs>(DEFAULT_PREFS);
  const [prefsReady, setPrefsReady] = useState(false);
  const [quickDays, setQuickDays] = useState<QuickRangeDays | null>(1);
  const [granularity, setGranularity] = useState<Granularity>("hour");
  const [from, setFrom] = useState(() => rangeFromQuickDays(1).from);
  const [to, setTo] = useState(() => rangeFromQuickDays(1).to);
  const [consumeMode, setConsumeMode] = useState<ConsumeChartMode>("柱状图");
  const [modelMode, setModelMode] = useState<ModelChartMode>("调用趋势");
  const [filterOpen, setFilterOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = loadDashboardPrefs();
    setPrefs(p);
    setQuickDays(p.quickDays);
    setGranularity(p.granularity);
    setConsumeMode(p.consumeMode);
    setModelMode(p.modelMode);
    const range = rangeFromQuickDays(p.quickDays);
    setFrom(range.from);
    setTo(range.to);
    setPrefsReady(true);
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
        granularity,
      });
      const res = await fetch(`/api/me/analytics?${qs.toString()}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "加载分析失败");
      }
      const data = (await res.json()) as AnalyticsPayload;
      setAnalytics(data);
    } catch (e) {
      setAnalytics(null);
      setError(e instanceof Error ? e.message : "加载分析失败");
    } finally {
      setLoading(false);
    }
  }, [from, to, granularity]);

  useEffect(() => {
    if (!prefsReady) return;
    void fetchAnalytics();
  }, [prefsReady, fetchAnalytics]);

  const kpis = analytics?.kpis;
  const hasData = (kpis?.count ?? 0) > 0;

  const kpiItems = useMemo(() => {
    if (loading && !analytics) {
      return [
        { label: "总数", value: "…" },
        { label: "总额度", value: "…" },
        { label: "总 TOKEN 数", value: "…" },
        { label: "平均 RPM", value: "…" },
        { label: "平均 TPM", value: "…" },
      ];
    }
    if (error && !analytics) {
      return [
        { label: "总数", value: "—" },
        { label: "总额度", value: "—" },
        { label: "总 TOKEN 数", value: "—" },
        { label: "平均 RPM", value: "—" },
        { label: "平均 TPM", value: "—" },
      ];
    }
    return [
      { label: "总数", value: formatNum(kpis?.count ?? 0) },
      { label: "总额度", value: `¥${formatNum(kpis?.spendCny ?? 0, 4)}` },
      { label: "总 TOKEN 数", value: formatNum(kpis?.tokens ?? 0) },
      { label: "平均 RPM", value: formatNum(kpis?.rpm ?? 0, 4) },
      { label: "平均 TPM", value: formatNum(kpis?.tpm ?? 0, 4) },
    ];
  }, [analytics, error, loading, kpis]);

  function handleSavePrefs(next: DashboardPrefs) {
    saveDashboardPrefs(next);
    setPrefs(next);
    setQuickDays(next.quickDays);
    setGranularity(next.granularity);
    setConsumeMode(next.consumeMode);
    setModelMode(next.modelMode);
    const range = rangeFromQuickDays(next.quickDays);
    setFrom(range.from);
    setTo(range.to);
  }

  return (
    <ConsolePage phone={me?.phone}>
      <PageHeader
        group="观测"
        title="看板"
        description="Token 调用分析 · 网关跑得怎样，一眼看完"
        actions={
          <>
            <button type="button" className="btn btn-ghost text-sm" onClick={() => setPrefsOpen(true)}>
              偏好设置
            </button>
            <button type="button" className="btn btn-ghost text-sm" onClick={() => setFilterOpen(true)}>
              筛选
            </button>
          </>
        }
      />

      <div className="space-y-5">
        {me ? (
          <BalancePanel
            balance={me.balance}
            metrics={kpiItems}
            metricsLoading={loading && !analytics}
          />
        ) : (
          <div className="panel" aria-busy="true">
            <p className="sr-only">加载中</p>
            <div className="p-5">
              <span className="skeleton block h-3 w-16" aria-hidden />
              <span className="skeleton mt-3 block h-8 w-36" aria-hidden />
            </div>
            <div className="grid grid-cols-2 border-t border-[var(--border-subtle)] md:grid-cols-5">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="px-5 py-4" aria-hidden>
                  <span className="skeleton block h-3 w-12" />
                  <span className="skeleton mt-2 block h-5 w-16" />
                </div>
              ))}
            </div>
          </div>
        )}

        {error ? (
          <p className="text-sm text-[var(--status-error)]">{error}</p>
        ) : null}

        {analytics?.source ? (
          <p className="text-xs text-[var(--text-tertiary)]">
            数据来源：
            {analytics.source === "litellm"
              ? "网关日志"
              : analytics.source === "litellm_truncated"
                ? "网关日志（仅最近 5000 条，数字可能偏小）"
                : analytics.source === "spend_event"
                  ? "应用记账"
                  : "应用记账（网关日志不可用）"}
            {loading ? " · 刷新中…" : ""}
          </p>
        ) : null}
        {analytics?.source === "litellm_truncated" ? (
          <p className="text-xs text-[var(--status-warning)]">
            日志量过大，仅统计最近 5000 条（source=litellm_truncated），曲线不完整。
          </p>
        ) : null}

        {loading && !analytics ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ChartBlockSkeleton />
            <ChartBlockSkeleton />
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <ConsumptionChartPanel
            series={analytics?.spendSeries ?? []}
            mode={consumeMode}
            onModeChange={setConsumeMode}
            totalSpendCny={kpis?.spendCny ?? 0}
          />
          <ModelCallChartPanel
            series={analytics?.callSeries ?? []}
            mode={modelMode}
            onModeChange={setModelMode}
            totalCount={kpis?.count ?? 0}
          />
        </div>
        )}

        {!loading && !hasData ? (
          <p className="text-sm text-[var(--text-tertiary)]">
            还没有数据？去{" "}
            <Link href="/playground" className="text-[var(--accent-primary)] hover:underline">
              调试台
            </Link>{" "}
            跑几轮，或等流量进来后再看。
          </p>
        ) : null}
      </div>

      <DashboardFilterDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        quickDays={quickDays}
        granularity={granularity}
        from={from}
        to={to}
        onApply={(next) => {
          setQuickDays(next.quickDays);
          setGranularity(next.granularity);
          setFrom(next.from);
          setTo(next.to);
        }}
      />
      <DashboardPrefsDialog
        open={prefsOpen}
        onOpenChange={setPrefsOpen}
        prefs={prefs}
        onSave={handleSavePrefs}
      />
    </ConsolePage>
  );
}
