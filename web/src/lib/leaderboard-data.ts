/**
 * 模型榜单数据（Artificial Analysis 式，模型 × 思考档位）。
 * 智能指数与每任务成本采集自 AA 排行榜对比图（2026-11-18 用户截图核对，v5.0.1 口径），
 * 版本与网关一致：DeepSeek V4.1 Flash 1017 / V4 Pro 0813、MiMo V2.6 系列。
 * 速度 / 延迟采集自 AA 模型页；价格列为本网关官方 CNY 价。
 * 每任务成本保留美元原值（散点图对数轴用）与人民币折算（1 USD = 6.68 CNY，2026-11-18）。
 * ⚠ 口径混排提示：存量 DeepSeek/MiMo 行为 2026-11-18 旧 v5.0.1 口径（12–32）；
 * 2026-11-19 从 AA /models 页 flight 数据解析出新口径智能指数＋输出速度，已填入
 * qwen4-max(42.9)/kimi-k3.1-pro(46.5)/glm-5.3(31.7)。AA 指数已改版，新旧口径勿直接比较。
 * 局限：/models 页仅「图表精选」模型有智能指数，其余（qwen3.8-flash/glm-5.3-flash/
 * minimax-m3.1-flash/step-5-preview 等）仍 null；每任务成本该页全为 null，散点图 X 轴待
 * AA leaderboard 页数据补全。更新方式：编辑本文件并更新 LEADERBOARD_FETCHED_AT。
 */

export type LeaderboardRow = {
  model: string;
  variantId: string;
  variantLabel: string;
  intelligence: number | null;
  speedTokS: number | null;
  ttftS: number | null;
  /** AA 每智能指数任务成本（美元原值，散点图对数轴用） */
  costPerTaskUsd: number | null;
  /** 人民币折算（表格 / 高亮卡用） */
  costPerTaskCny: number | null;
  inputPerM: number;
  outputPerM: number;
  context: string;
  maxOutput: string;
  source: string;
  sourceLabel: string;
  note?: string;
};

export const LEADERBOARD_FETCHED_AT = "2026-11-19";
export const USD_CNY_RATE = 6.68;

const AA_LEADERBOARD = "https://artificialanalysis.ai/zh/leaderboards/models";

export const LEADERBOARD_ROWS: LeaderboardRow[] = [
  {
    model: "deepseek-flash",
    variantId: "off",
    variantLabel: "关闭",
    intelligence: 18.5,
    speedTokS: 222,
    ttftS: 0.89,
    costPerTaskUsd: 0.415,
    costPerTaskCny: 2.77,
    inputPerM: 1,
    outputPerM: 4,
    context: "1M",
    maxOutput: "384K",
    source: AA_LEADERBOARD,
    sourceLabel: "AA 评测",
    note: "V4.1 Flash 1017 非思考档；TTFT 0.89s 来自 AA 模型页非思考档。",
  },
  {
    model: "deepseek-flash",
    variantId: "standard",
    variantLabel: "标准",
    intelligence: 28.7,
    speedTokS: 222,
    ttftS: 36.67,
    costPerTaskUsd: 0.47,
    costPerTaskCny: 3.14,
    inputPerM: 1,
    outputPerM: 4,
    context: "1M",
    maxOutput: "384K",
    source: AA_LEADERBOARD,
    sourceLabel: "AA 评测",
    note: "V4.1 Flash 1017 high 档；控制台默认不暴露 Flash 思考档位，此行为评测数据。",
  },
  {
    model: "deepseek-flash",
    variantId: "max",
    variantLabel: "极深",
    intelligence: 32.3,
    speedTokS: 222,
    ttftS: 36.67,
    costPerTaskUsd: 0.6,
    costPerTaskCny: 4.01,
    inputPerM: 1,
    outputPerM: 4,
    context: "1M",
    maxOutput: "384K",
    source: AA_LEADERBOARD,
    sourceLabel: "AA 评测",
    note: "V4.1 Flash 1017 max 档，全场最高智能指数。",
  },
  {
    model: "deepseek-v4-pro",
    variantId: "off",
    variantLabel: "关闭",
    intelligence: 12.3,
    speedTokS: 83,
    ttftS: 2.7,
    costPerTaskUsd: 0.96,
    costPerTaskCny: 6.41,
    inputPerM: 4.5,
    outputPerM: 13.5,
    context: "1M",
    maxOutput: "384K",
    source: AA_LEADERBOARD,
    sourceLabel: "AA 评测",
  },
  {
    model: "deepseek-v4-pro",
    variantId: "standard",
    variantLabel: "标准",
    intelligence: 20.8,
    speedTokS: 53,
    ttftS: 81.64,
    costPerTaskUsd: 0.84,
    costPerTaskCny: 5.61,
    inputPerM: 4.5,
    outputPerM: 13.5,
    context: "1M",
    maxOutput: "384K",
    source: AA_LEADERBOARD,
    sourceLabel: "AA 评测",
  },
  {
    model: "deepseek-v4-pro",
    variantId: "max",
    variantLabel: "极深",
    intelligence: 23,
    speedTokS: 95,
    ttftS: 54.98,
    costPerTaskUsd: 1.8,
    costPerTaskCny: 12.02,
    inputPerM: 4.5,
    outputPerM: 13.5,
    context: "1M",
    maxOutput: "384K",
    source: AA_LEADERBOARD,
    sourceLabel: "AA 评测",
  },
  {
    model: "mimo-v2.6-pro",
    variantId: "on",
    variantLabel: "开启",
    intelligence: 29.9,
    speedTokS: 58,
    ttftS: 41.52,
    costPerTaskUsd: 0.265,
    costPerTaskCny: 1.77,
    inputPerM: 3,
    outputPerM: 6,
    context: "1M",
    maxOutput: "128K",
    source: AA_LEADERBOARD,
    sourceLabel: "AA 评测",
    note: "小米官网引用 46.32 为旧版指数口径；此处统一采用 AA Intelligence Index v5.0.1。",
  },
  {
    model: "mimo-v2.6-flash",
    variantId: "on",
    variantLabel: "开启",
    intelligence: 26.8,
    speedTokS: 40,
    ttftS: 31.44,
    costPerTaskUsd: 0.205,
    costPerTaskCny: 1.37,
    inputPerM: 1,
    outputPerM: 2,
    context: "1M",
    maxOutput: "128K",
    source: AA_LEADERBOARD,
    sourceLabel: "AA 评测",
    note: "全场最低每任务成本。",
  },
  // ---------- 阿里云百炼（2026-11-19 上榜） ----------
  // AA 于 2026-11-19 前后改版指数口径（旧 v5.0.1 范围 12–32，新图范围约 40–61）。
  // 上方存量行为旧口径；新模型智能指数待新口径数据补齐（null → 页面显示"—"，图表自动跳过）。
  // 已知新口径锚点（用户截图清晰标注）：Qwen3.8 Max 58.1 / Qwen3.8 2.4T A95B 57.7 / Qwen3.8 27B xhigh 52.0。
  {
    model: "qwen4-max",
    variantId: "default",
    variantLabel: "默认",
    intelligence: 42.9,
    speedTokS: 57,
    ttftS: null,
    costPerTaskUsd: null,
    costPerTaskCny: null,
    inputPerM: 10,
    outputPerM: 30,
    context: "1M",
    maxOutput: "128K / 256K（思考）",
    source: AA_LEADERBOARD,
    sourceLabel: "AA 评测",
    note: "AA Intelligence Index 42.9（xhigh 档，2026-11-19 /models 页数据）；输出 57 tok/s。每任务成本 AA 未提供，散点图暂不显示。",
  },
  {
    model: "qwen3.8-flash",
    variantId: "default",
    variantLabel: "默认",
    intelligence: null,
    speedTokS: null,
    ttftS: null,
    costPerTaskUsd: null,
    costPerTaskCny: null,
    inputPerM: 0.8,
    outputPerM: 2.7,
    context: "1M",
    maxOutput: "128K",
    source: AA_LEADERBOARD,
    sourceLabel: "AA 评测（待补）",
    note: "百炼轻量旗舰；智能指数待 AA 新口径数据。",
  },
  {
    model: "kimi-k3.1-pro",
    variantId: "default",
    variantLabel: "默认",
    intelligence: 46.5,
    speedTokS: 31,
    ttftS: null,
    costPerTaskUsd: null,
    costPerTaskCny: null,
    inputPerM: 13,
    outputPerM: 68,
    context: "1M",
    maxOutput: "以百炼模型页为准",
    source: AA_LEADERBOARD,
    sourceLabel: "AA 评测",
    note: "AA Intelligence Index 46.5（2026-11-19 /models 页数据）；输出 31 tok/s，思考默认开启。每任务成本 AA 未提供。",
  },
  {
    model: "glm-5.3-flash",
    variantId: "default",
    variantLabel: "默认",
    intelligence: null,
    speedTokS: null,
    ttftS: null,
    costPerTaskUsd: null,
    costPerTaskCny: null,
    inputPerM: 0.8,
    outputPerM: 2.8,
    context: "以百炼模型页为准",
    maxOutput: "以百炼模型页为准",
    source: AA_LEADERBOARD,
    sourceLabel: "AA 评测（待补）",
    note: "智谱自营托管；智能指数待 AA 新口径数据。",
  },
  {
    model: "glm-5.3",
    variantId: "default",
    variantLabel: "默认",
    intelligence: 31.7,
    speedTokS: 81,
    ttftS: null,
    costPerTaskUsd: null,
    costPerTaskCny: null,
    inputPerM: 8,
    outputPerM: 28,
    context: "1M",
    maxOutput: "以百炼模型页为准",
    source: AA_LEADERBOARD,
    sourceLabel: "AA 评测",
    note: "AA Intelligence Index 31.7（Max 档，2026-11-19 /models 页数据）；输出 81 tok/s，仅思考模式。每任务成本 AA 未提供。",
  },
  {
    model: "minimax-m3.1-flash",
    variantId: "default",
    variantLabel: "默认",
    intelligence: null,
    speedTokS: null,
    ttftS: null,
    costPerTaskUsd: null,
    costPerTaskCny: null,
    inputPerM: 1,
    outputPerM: 4,
    context: "1M",
    maxOutput: "以百炼模型页为准",
    source: AA_LEADERBOARD,
    sourceLabel: "AA 评测（待补）",
    note: "缓存折扣价官方未公布，暂按输入价；智能指数待 AA 新口径数据。",
  },
  {
    model: "step-5-preview",
    variantId: "default",
    variantLabel: "默认",
    intelligence: null,
    speedTokS: null,
    ttftS: null,
    costPerTaskUsd: null,
    costPerTaskCny: null,
    inputPerM: 7,
    outputPerM: 20,
    context: "1M",
    maxOutput: "以百炼模型页为准",
    source: AA_LEADERBOARD,
    sourceLabel: "AA 评测（待补）",
    note: "预览版；智能指数待 AA 新口径数据。",
  },
];

export type MetricKey = "intelligence" | "cost" | "speed" | "latency" | "price";

export const METRIC_TABS: { key: MetricKey; label: string }[] = [
  { key: "intelligence", label: "智能" },
  { key: "cost", label: "成本" },
  { key: "speed", label: "速度" },
  { key: "latency", label: "延迟" },
  { key: "price", label: "价格" },
];

/** 图表用短名。 */
export function shortName(r: LeaderboardRow): string {
  const base =
    r.model === "deepseek-v4-pro"
      ? "DS Pro"
      : r.model === "deepseek-flash"
        ? "DS Flash"
        : r.model === "mimo-v2.6-pro"
          ? "MiMo Pro"
          : "MiMo Flash";
  return `${base}·${r.variantLabel}`;
}

/** 各指标排序方向：智能/速度降序，成本/延迟/价格升序；null 永远排最后。 */
export function sortRows(rows: LeaderboardRow[], metric: MetricKey): LeaderboardRow[] {
  const val = (r: LeaderboardRow): number | null => {
    if (metric === "intelligence") return r.intelligence;
    if (metric === "cost") return r.costPerTaskCny;
    if (metric === "speed") return r.speedTokS;
    if (metric === "latency") return r.ttftS;
    return r.inputPerM;
  };
  const desc = metric === "intelligence" || metric === "speed";
  return [...rows].sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return desc ? vb - va : va - vb;
  });
}

export function bestOf(rows: LeaderboardRow[], metric: MetricKey): LeaderboardRow | undefined {
  return sortRows(rows, metric).find((r) => {
    if (metric === "intelligence") return r.intelligence !== null;
    if (metric === "cost") return r.costPerTaskCny !== null;
    if (metric === "speed") return r.speedTokS !== null;
    if (metric === "latency") return r.ttftS !== null;
    return true;
  });
}

/** 帕累托前沿：按成本升序，智能指数创新高的点序列。 */
export function paretoFrontier(rows: LeaderboardRow[]): LeaderboardRow[] {
  const sorted = rows
    .filter((r) => r.costPerTaskUsd !== null && r.intelligence !== null)
    .sort((a, b) => (a.costPerTaskUsd ?? 0) - (b.costPerTaskUsd ?? 0));
  const out: LeaderboardRow[] = [];
  let best = -Infinity;
  for (const r of sorted) {
    if ((r.intelligence ?? 0) > best) {
      out.push(r);
      best = r.intelligence ?? 0;
    }
  }
  return out;
}
