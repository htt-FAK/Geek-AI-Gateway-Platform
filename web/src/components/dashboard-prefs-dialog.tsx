"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type {
  ConsumeChartMode,
  DashboardPrefs,
  Granularity,
  ModelChartMode,
  QuickRangeDays,
} from "@/lib/dashboard-prefs";
import { suggestedGranularity } from "@/lib/dashboard-prefs";

export function DashboardPrefsDialog({
  open,
  onOpenChange,
  prefs,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: DashboardPrefs;
  onSave: (prefs: DashboardPrefs) => void;
}) {
  const [local, setLocal] = React.useState<DashboardPrefs>(prefs);

  React.useEffect(() => {
    if (open) setLocal(prefs);
  }, [open, prefs]);

  function save() {
    onSave(local);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[50] bg-[var(--overlay-scrim)]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[50] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 shadow-[var(--panel-shadow,0_8px_24px_rgba(0,0,0,0.35))]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-medium">看板偏好设置</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-[var(--text-secondary)]">
                选择模型调用分析的默认图表、范围与时间粒度。
              </Dialog.Description>
            </div>
            <Dialog.Close className="btn btn-ghost px-2 py-1 text-[var(--text-tertiary)]">
              ✕
            </Dialog.Close>
          </div>

          <label className="mt-5 block text-xs text-[var(--text-tertiary)]">
            默认范围
            <select
              value={local.quickDays}
              onChange={(e) => {
                const quickDays = Number(e.target.value) as QuickRangeDays;
                setLocal((p) => ({
                  ...p,
                  quickDays,
                  granularity: suggestedGranularity(quickDays),
                }));
              }}
              className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              <option value={1}>1天</option>
              <option value={7}>7天</option>
              <option value={14}>14天</option>
              <option value={29}>29天</option>
            </select>
          </label>

          <label className="mt-3 block text-xs text-[var(--text-tertiary)]">
            默认时间粒度
            <select
              value={local.granularity}
              onChange={(e) =>
                setLocal((p) => ({ ...p, granularity: e.target.value as Granularity }))
              }
              className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              <option value="hour">小时</option>
              <option value="day">天</option>
            </select>
          </label>

          <label className="mt-3 block text-xs text-[var(--text-tertiary)]">
            默认消耗分布图
            <select
              value={local.consumeMode}
              onChange={(e) =>
                setLocal((p) => ({
                  ...p,
                  consumeMode: e.target.value as ConsumeChartMode,
                }))
              }
              className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              <option value="柱状图">柱状图</option>
              <option value="面积图">面积图</option>
            </select>
          </label>

          <label className="mt-3 block text-xs text-[var(--text-tertiary)]">
            默认模型调用图
            <select
              value={local.modelMode}
              onChange={(e) =>
                setLocal((p) => ({
                  ...p,
                  modelMode: e.target.value as ModelChartMode,
                }))
              }
              className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              <option value="调用趋势">调用趋势</option>
              <option value="调用次数分布">调用次数分布</option>
              <option value="调用次数排行">调用次数排行</option>
            </select>
          </label>

          <div className="mt-6 flex justify-end">
            <button type="button" className="btn" onClick={save}>
              保存偏好设置
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
