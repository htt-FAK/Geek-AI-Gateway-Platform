"use client";

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
      <div className="relative flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-base)]">
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
    </section>
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
