"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { Granularity, QuickRangeDays } from "@/lib/dashboard-prefs";
import { suggestedGranularity } from "@/lib/dashboard-prefs";

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DashboardFilterDialog({
  open,
  onOpenChange,
  quickDays,
  granularity,
  from,
  to,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quickDays: QuickRangeDays | null;
  granularity: Granularity;
  from: Date;
  to: Date;
  onApply: (next: {
    quickDays: QuickRangeDays | null;
    granularity: Granularity;
    from: Date;
    to: Date;
  }) => void;
}) {
  const [localQuick, setLocalQuick] = React.useState<QuickRangeDays | null>(quickDays);
  const [localGranularity, setLocalGranularity] = React.useState<Granularity>(granularity);
  const [localFrom, setLocalFrom] = React.useState(toLocalInputValue(from));
  const [localTo, setLocalTo] = React.useState(toLocalInputValue(to));

  React.useEffect(() => {
    if (!open) return;
    setLocalQuick(quickDays);
    setLocalGranularity(granularity);
    setLocalFrom(toLocalInputValue(from));
    setLocalTo(toLocalInputValue(to));
  }, [open, quickDays, granularity, from, to]);

  function applyQuick(days: QuickRangeDays) {
    setLocalQuick(days);
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    setLocalFrom(toLocalInputValue(start));
    setLocalTo(toLocalInputValue(end));
    setLocalGranularity(suggestedGranularity(days));
  }

  function reset() {
    applyQuick(1);
  }

  function apply() {
    const f = new Date(localFrom);
    const t = new Date(localTo);
    if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime()) || f > t) return;
    onApply({
      quickDays: localQuick,
      granularity: localGranularity,
      from: f,
      to: t,
    });
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[50] bg-[var(--overlay-scrim)]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[50] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 shadow-[var(--panel-shadow,0_8px_24px_rgba(0,0,0,0.35))]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-medium">筛选仪表板</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-[var(--text-secondary)]">
                设置筛选器以自定义看板统计与图表。
              </Dialog.Description>
            </div>
            <Dialog.Close className="btn btn-ghost px-2 py-1 text-[var(--text-tertiary)]">
              ✕
            </Dialog.Close>
          </div>

          <div className="mt-5">
            <div className="text-xs text-[var(--text-tertiary)]">快速范围</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {([1, 7, 14, 29] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => applyQuick(d)}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    localQuick === d
                      ? "bg-[var(--accent-primary)] text-[var(--text-inverse)]"
                      : "border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {d}天
                </button>
              ))}
            </div>
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
            <div className="h-px flex-1 bg-[var(--border-subtle)]" />
            自定义时间范围
            <div className="h-px flex-1 bg-[var(--border-subtle)]" />
          </div>

          <label className="block text-xs text-[var(--text-tertiary)]">
            起始时间
            <input
              type="datetime-local"
              value={localFrom}
              onChange={(e) => {
                setLocalQuick(null);
                setLocalFrom(e.target.value);
              }}
              className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </label>
          <label className="mt-3 block text-xs text-[var(--text-tertiary)]">
            结束时间
            <input
              type="datetime-local"
              value={localTo}
              onChange={(e) => {
                setLocalQuick(null);
                setLocalTo(e.target.value);
              }}
              className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </label>

          <div className="my-5 flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
            <div className="h-px flex-1 bg-[var(--border-subtle)]" />
            图表设置
            <div className="h-px flex-1 bg-[var(--border-subtle)]" />
          </div>

          <label className="block text-xs text-[var(--text-tertiary)]">
            时间粒度
            <select
              value={localGranularity}
              onChange={(e) => setLocalGranularity(e.target.value as Granularity)}
              className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              <option value="hour">小时</option>
              <option value="day">天</option>
            </select>
          </label>

          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={reset}>
              重置
            </button>
            <button type="button" className="btn" onClick={apply}>
              应用筛选
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
