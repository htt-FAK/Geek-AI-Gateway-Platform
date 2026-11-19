/**
 * DeepSeek 峰时计费（Asia/Shanghai）——与 gateway/deepseek_peak.py 同一套规则。
 *
 * 为什么 BFF 侧也要算一遍：LiteLLM 的 response_cost 在构造响应时就算好（hidden_params），
 * 自定义峰时回调在响应发出后才异步修改内部 spend。因此响应头 / payload 里的费用是空闲价，
 * 而余额扣减（网关用户级 spend）是峰时价。本地 SpendEvent 若直接采信响应费用，
 * 峰时看板会少记一半。此处对 DeepSeek 模型按同一规则补上倍率，两侧口径一致。
 *
 * 规则：北京时间周一至周五 09:00–12:00、14:00–18:00 为峰时（空闲价 ×2）；
 * 周末与中国法定节假日全天错峰。节假日表需按年维护（与 Python 侧同步）。
 */

const PEAK_WINDOWS: [number, number][] = [
  [9, 12],
  [14, 18],
];

function holidayRanges(): string[] {
  const ranges: [string, string][] = [
    // 2026 年安排（国办发明电〔2025〕7号）；补班日均在周末，仍错峰
    ["2026-01-01", "2026-01-03"], // 元旦
    ["2026-02-15", "2026-02-23"], // 春节
    ["2026-04-04", "2026-04-06"], // 清明
    ["2026-05-01", "2026-05-05"], // 劳动节
    ["2026-06-19", "2026-06-21"], // 端午
    ["2026-09-25", "2026-09-27"], // 中秋
    ["2026-10-01", "2026-10-07"], // 国庆
    // 2027 年安排（国办发明电〔2026〕10号，2026-11-05 公布）；
    // 补班 1/31、2/14、5/8、9/26、10/9 均在周末，仍错峰
    ["2027-01-01", "2027-01-03"], // 元旦
    ["2027-02-05", "2027-02-13"], // 春节（除夕 2/5 起）
    ["2027-04-03", "2027-04-05"], // 清明
    ["2027-05-01", "2027-05-05"], // 劳动节
    ["2027-06-09", "2027-06-09"], // 端午（周三，仅 1 天）
    ["2027-09-15", "2027-09-15"], // 中秋（周三，仅 1 天）
    ["2027-10-01", "2027-10-07"], // 国庆
  ];
  const out: string[] = [];
  for (const [start, end] of ranges) {
    const d = new Date(`${start}T00:00:00Z`);
    const last = new Date(`${end}T00:00:00Z`);
    while (d <= last) {
      out.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }
  return out;
}

const PUBLIC_HOLIDAYS = new Set(holidayRanges());

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function shanghaiParts(at: Date): { weekday: number; hour: number; minute: number; date: string } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(at)) parts[p.type] = p.value;
  return {
    weekday: WEEKDAYS.indexOf(parts.weekday),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    date: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

export function isPeakShanghai(at: Date = new Date()): boolean {
  const { weekday, hour, minute, date } = shanghaiParts(at);
  if (weekday === 0 || weekday === 6) return false;
  if (PUBLIC_HOLIDAYS.has(date)) return false;
  const t = hour + minute / 60;
  return PEAK_WINDOWS.some(([s, e]) => t >= s && t < e);
}

/** DeepSeek 模型峰时 ×2；其余模型 / 非峰时原样返回。 */
export function applyDeepSeekPeak(cost: number, model: string, at?: Date): number {
  if (cost <= 0 || !model.toLowerCase().includes("deepseek")) return cost;
  return isPeakShanghai(at) ? cost * 2 : cost;
}
