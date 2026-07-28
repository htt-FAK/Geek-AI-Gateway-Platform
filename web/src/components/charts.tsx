"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type SeriesPoint = {
  bucket: string;
  byModel: Record<string, number>;
};

const CHART_COLOR_VARS = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--chart-6",
  "--chart-7",
  "--chart-8",
] as const;

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function modelColors(models: string[]): Record<string, string> {
  const fallbacks = [
    "#4d6bfe",
    "#ff6b35",
    "#22c55e",
    "#a78bfa",
    "#38bdf8",
    "#f472b6",
    "#eab308",
    "#94a3b8",
  ];
  const out: Record<string, string> = {};
  models.forEach((m, i) => {
    out[m] = cssVar(CHART_COLOR_VARS[i % CHART_COLOR_VARS.length], fallbacks[i % fallbacks.length]);
  });
  return out;
}

function collectModels(series: SeriesPoint[]): string[] {
  const set = new Set<string>();
  for (const p of series) {
    for (const m of Object.keys(p.byModel)) set.add(m);
  }
  return Array.from(set).sort();
}

function toStackedRows(series: SeriesPoint[], models: string[]) {
  return series.map((p) => {
    const row: Record<string, string | number> = { bucket: p.bucket };
    let total = 0;
    for (const m of models) {
      const v = p.byModel[m] ?? 0;
      row[m] = v;
      total += v;
    }
    row.__total = total;
    return row;
  });
}

function hasAnyValue(series: SeriesPoint[]): boolean {
  return series.some((p) => Object.values(p.byModel).some((v) => v > 0));
}

function ChartEmpty() {
  return (
    <div className="relative flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-base)] min-h-[220px]">
      <div
        className="pointer-events-none absolute inset-4 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(var(--chart-grid) 1px, transparent 1px), linear-gradient(90deg, var(--chart-grid) 1px, transparent 1px)",
          backgroundSize: "100% 20%, 12.5% 100%",
        }}
      />
      <p className="relative text-sm text-[var(--text-tertiary)]">暂无数据</p>
    </div>
  );
}

function PanelChrome({
  title,
  totalLabel,
  toggles,
  activeToggle,
  onToggle,
  children,
}: {
  title: string;
  totalLabel: string;
  toggles: string[];
  activeToggle: string;
  onToggle: (t: string) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="panel flex min-h-[280px] flex-col p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-[var(--text-primary)]">{title}</h3>
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{totalLabel}</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--border-subtle)] p-0.5">
          {toggles.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onToggle(t)}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                activeToggle === t
                  ? "bg-[var(--accent-muted)] text-[var(--accent-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {children}
    </section>
  );
}

const tooltipStyle = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 8,
  fontSize: 12,
};

export function ConsumptionChartPanel({
  series,
  mode,
  onModeChange,
  totalSpendCny,
}: {
  series: SeriesPoint[];
  mode: "柱状图" | "面积图";
  onModeChange: (m: "柱状图" | "面积图") => void;
  totalSpendCny: number;
}) {
  const models = useMemo(() => collectModels(series), [series]);
  const colors = useMemo(() => modelColors(models), [models]);
  const rows = useMemo(() => toStackedRows(series, models), [series, models]);
  const empty = !hasAnyValue(series);

  return (
    <PanelChrome
      title="消耗分布"
      totalLabel={`总计: ¥${totalSpendCny.toFixed(4)}`}
      toggles={["柱状图", "面积图"]}
      activeToggle={mode}
      onToggle={(t) => onModeChange(t as "柱状图" | "面积图")}
    >
      {empty ? (
        <ChartEmpty />
      ) : (
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {mode === "柱状图" ? (
              <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="bucket"
                  tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border-subtle)" }}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) => [`¥${Number(value).toFixed(4)}`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {models.map((m) => (
                  <Bar key={m} dataKey={m} stackId="s" fill={colors[m]} />
                ))}
              </BarChart>
            ) : (
              <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="bucket"
                  tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border-subtle)" }}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) => [`¥${Number(value).toFixed(4)}`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {models.map((m) => (
                  <Area
                    key={m}
                    type="monotone"
                    dataKey={m}
                    stackId="s"
                    stroke={colors[m]}
                    fill={colors[m]}
                    fillOpacity={0.55}
                  />
                ))}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </PanelChrome>
  );
}

export function ModelCallChartPanel({
  series,
  mode,
  onModeChange,
  totalCount,
}: {
  series: SeriesPoint[];
  mode: "调用趋势" | "调用次数分布" | "调用次数排行";
  onModeChange: (m: "调用趋势" | "调用次数分布" | "调用次数排行") => void;
  totalCount: number;
}) {
  const models = useMemo(() => collectModels(series), [series]);
  const colors = useMemo(() => modelColors(models), [models]);
  const rows = useMemo(() => toStackedRows(series, models), [series, models]);
  const empty = !hasAnyValue(series);

  const totals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of series) {
      for (const [m, v] of Object.entries(p.byModel)) {
        map[m] = (map[m] ?? 0) + v;
      }
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [series]);

  return (
    <PanelChrome
      title="模型调用分析"
      totalLabel={`总计: ${totalCount.toLocaleString()}`}
      toggles={["调用趋势", "调用次数分布", "调用次数排行"]}
      activeToggle={mode}
      onToggle={(t) => onModeChange(t as typeof mode)}
    >
      {empty ? (
        <ChartEmpty />
      ) : mode === "调用趋势" ? (
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="bucket"
                tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "var(--border-subtle)" }}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={36}
                allowDecimals={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {models.map((m) => (
                <Area
                  key={m}
                  type="monotone"
                  dataKey={m}
                  stackId="s"
                  stroke={colors[m]}
                  fill={colors[m]}
                  fillOpacity={0.55}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : mode === "调用次数分布" ? (
        <div className="flex min-h-[240px] flex-col items-center gap-4 sm:flex-row">
          <ul className="w-full shrink-0 space-y-1.5 text-xs sm:w-40">
            {totals.map((t) => (
              <li key={t.name} className="flex items-center gap-2 text-[var(--text-secondary)]">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: colors[t.name] }}
                />
                <span className="truncate">{t.name}</span>
              </li>
            ))}
          </ul>
          <div className="h-[220px] w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={totals}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={1}
                >
                  {totals.map((t) => (
                    <Cell key={t.name} fill={colors[t.name]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) => {
                    const pct = totalCount > 0 ? ((Number(value) / totalCount) * 100).toFixed(0) : "0";
                    return [`${value} (${pct}%)`, name];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={totals}
              layout="vertical"
              margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
            >
              <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: "right", fill: "var(--text-secondary)", fontSize: 11 }}>
                {totals.map((t) => (
                  <Cell key={t.name} fill={colors[t.name]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </PanelChrome>
  );
}

/** Empty chrome used by admin usage skeleton (no live series). */
export function EmptyChartPanel({
  title,
  totalLabel,
  toggles,
  activeToggle,
  onToggle,
}: {
  title: string;
  totalLabel: string;
  toggles: string[];
  activeToggle: string;
  onToggle: (t: string) => void;
}) {
  return (
    <PanelChrome
      title={title}
      totalLabel={totalLabel}
      toggles={toggles}
      activeToggle={activeToggle}
      onToggle={onToggle}
    >
      <ChartEmpty />
    </PanelChrome>
  );
}

export function BudgetColumns({
  budget,
}: {
  budget: {
    dailyUsed: number;
    weeklyUsed: number;
    monthlyUsed: number;
    dailyLimit: number;
    weeklyLimit: number;
    monthlyLimit: number;
  };
}) {
  const cols = [
    { label: "日限额", used: budget.dailyUsed, limit: budget.dailyLimit },
    { label: "周限额", used: budget.weeklyUsed, limit: budget.weeklyLimit },
    { label: "月限额", used: budget.monthlyUsed, limit: budget.monthlyLimit },
  ];
  return (
    <div className="panel grid grid-cols-1 divide-y divide-[var(--border-subtle)] md:grid-cols-3 md:divide-x md:divide-y-0">
      {cols.map((c) => {
        const pct = c.limit > 0 ? Math.min(100, (c.used / c.limit) * 100) : 0;
        return (
          <div key={c.label} className="p-5">
            <div className="text-sm text-[var(--text-secondary)]">{c.label}</div>
            <div className="mt-2 tabular text-lg font-semibold text-[var(--accent-primary)]">
              {pct.toFixed(1)}%
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface)]">
              <div
                className="h-full rounded-full bg-[var(--accent-primary)] transition-[width] duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-2 tabular text-xs text-[var(--text-tertiary)]">
              ¥{c.used.toFixed(2)} / ¥{c.limit.toFixed(2)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function KpiRow({
  items,
}: {
  items: Array<{ label: string; value: string; hint: string }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="panel p-4">
          <div className="text-xs text-[var(--text-tertiary)]">{item.label}</div>
          <div className="mt-2 tabular text-2xl font-semibold tracking-tight">{item.value}</div>
          <div className="mt-1 text-xs text-[var(--text-secondary)]">{item.hint}</div>
        </div>
      ))}
    </div>
  );
}
