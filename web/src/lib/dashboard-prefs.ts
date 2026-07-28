export type ConsumeChartMode = "柱状图" | "面积图";
export type ModelChartMode = "调用趋势" | "调用次数分布" | "调用次数排行";
export type Granularity = "hour" | "day";
export type QuickRangeDays = 1 | 7 | 14 | 29;

export type DashboardPrefs = {
  quickDays: QuickRangeDays;
  granularity: Granularity;
  consumeMode: ConsumeChartMode;
  modelMode: ModelChartMode;
};

const STORAGE_KEY = "aigw.dashboard.prefs";

export const DEFAULT_PREFS: DashboardPrefs = {
  quickDays: 1,
  granularity: "hour",
  consumeMode: "柱状图",
  modelMode: "调用趋势",
};

export function suggestedGranularity(days: QuickRangeDays): Granularity {
  return days <= 7 ? "hour" : "day";
}

export function loadDashboardPrefs(): DashboardPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<DashboardPrefs>;
    const quickDays = ([1, 7, 14, 29] as const).includes(parsed.quickDays as QuickRangeDays)
      ? (parsed.quickDays as QuickRangeDays)
      : DEFAULT_PREFS.quickDays;
    return {
      quickDays,
      granularity: parsed.granularity === "day" ? "day" : "hour",
      consumeMode: parsed.consumeMode === "面积图" ? "面积图" : "柱状图",
      modelMode:
        parsed.modelMode === "调用次数分布" || parsed.modelMode === "调用次数排行"
          ? parsed.modelMode
          : "调用趋势",
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveDashboardPrefs(prefs: DashboardPrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function rangeFromQuickDays(days: QuickRangeDays): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from, to };
}
