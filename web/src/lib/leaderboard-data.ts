/**
 * 模型榜单数据（Artificial Analysis 式，模型 × 思考档位）。
 * 2026-11-19 按用户提供的 AA 散点截图（Intelligence Index vs 每任务成本，
 * 「19 of 759 models」选中视图）补全：全部网关聊天模型的智能指数＋每任务成本均已上榜。
 * - 存量 DeepSeek/MiMo 精确值（2026-11-18 AA 数据核对）与截图一致，保留原值。
 * - qwen4-max(42.9)/kimi-k3.1-pro(46.5)/glm-5.3 max(31.7) 智能指数来自 AA /models 页
 *   flight 数据，与截图吻合；其每任务成本为截图估读（对数轴，约 ±15%）。
 * - minimax/qwen3.8-flash/glm-5.3-flash/step-5-preview/glm-5.3 low 的指数与成本
 *   均为截图估读（sourceLabel 标「截图估读」），AA 精确值待补。
 * - AA 截图标签为 Qwen3.8-Flash-Next，对应网关 qwen3.8-flash；GLM-5.3 按截图拆 low/max 两档。
 * - 截图中帕累托线上的灰色匿名点为未选中的他厂模型（Anthropic/OpenAI/Meta 等），不入榜。
 * 速度 / 延迟采集自 AA 模型页（新模型暂缺，显示 —）；价格列为本网关官方 CNY 价。
 * 每任务成本保留美元原值（散点图对数轴用）与人民币折算（1 USD = 6.68 CNY）。
 * 更新方式：编辑本文件并更新 LEADERBOARD_FETCHED_AT。
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
    note: "V4.1 Flash 1017 max 档，DeepSeek 系列最高智能指数。",
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
  // ---------- 阿里云百炼 / 智谱 / MiniMax / 阶跃（2026-11-19 截图补全） ----------
  {
    model: "qwen4-max",
    variantId: "default",
    variantLabel: "默认",
    intelligence: 42.9,
    speedTokS: 57,
    ttftS: null,
    costPerTaskUsd: 3.3,
    costPerTaskCny: 22.04,
    inputPerM: 10,
    outputPerM: 30,
    context: "1M",
    maxOutput: "128K / 256K（思考）",
    source: AA_LEADERBOARD,
    sourceLabel: "AA 评测",
    note: "AA Intelligence Index 42.9（xhigh 档，2026-11-19 /models 页数据）；输出 57 tok/s。每任务成本 $3.3 为 2026-11-19 AA 散点截图估读（约 ±15%）。",
  },
  {
    model: "qwen3.8-flash",
    variantId: "default",
    variantLabel: "默认",
    intelligence: 28.5,
    speedTokS: null,
    ttftS: null,
    costPerTaskUsd: 0.57,
    costPerTaskCny: 3.81,
    inputPerM: 0.8,
    outputPerM: 2.7,
    context: "1M",
    maxOutput: "128K",
    source: AA_LEADERBOARD,
    sourceLabel: "AA 评测（截图估读）",
    note: "AA 截图标签为 Qwen3.8-Flash-Next，对应网关 qwen3.8-flash。指数 28.5 / 成本 $0.57 为 2026-11-19 截图估读。",
  },
  {
    model: "kimi-k3.1-pro",
    variantId: "default",
    variantLabel: "默认",
    intelligence: 46.5,
    speedTokS: 31,
    ttftS: null,
    costPerTaskUsd: 3.7,
    costPerTaskCny: 24.72,
    inputPerM: 13,
    outputPerM: 68,
    context: "1M",
    maxOutput: "以官方模型页为准",
    source: AA_LEADERBOARD,
    sourceLabel: "AA 评测",
    note: "AA Intelligence Index 46.5（2026-11-19 /models 页数据），全场最高；输出 31 tok/s，思考默认开启。每任务成本 $3.7 为截图估读（约 ±15%）。",
  },
  {
    model: "glm-5.3-flash",
    variantId: "default",
    variantLabel: "默认",
    intelligence: 27.5,
    speedTokS: null,
    ttftS: null,
    costPerTaskUsd: 0.57,
    costPerTaskCny: 3.81,
    inputPerM: 0.8,
    outputPerM: 2.8,
    context: "以官方模型页为准",
    maxOutput: "以官方模型页为准",
    source: AA_LEADERBOARD,
    sourceLabel: "AA 评测（截图估读）",
    note: "智谱自营托管。指数 27.5 / 成本 $0.57 为 2026-11-19 AA 散点截图估读。",
  },
  {
    model: "glm-5.3",
    variantId: "max",
    variantLabel: "极深",
    intelligence: 31.7,
    speedTokS: 81,
    ttftS: null,
    costPerTaskUsd: 5,
    costPerTaskCny: 33.4,
    inputPerM: 8,
    outputPerM: 28,
    context: "1M",
    maxOutput: "以官方模型页为准",
    source: AA_LEADERBOARD,
    sourceLabel: "AA 评测",
    note: "AA Intelligence Index 31.7（Max 档，2026-11-19 /models 页数据）；输出 81 tok/s，仅思考模式。每任务成本 $5 为截图估读，全场最贵。",
  },
  {
    model: "glm-5.3",
    variantId: "low",
    variantLabel: "低",
    intelligence: 23,
    speedTokS: null,
    ttftS: null,
    costPerTaskUsd: 1.6,
    costPerTaskCny: 10.69,
    inputPerM: 8,
    outputPerM: 28,
    context: "1M",
    maxOutput: "以官方模型页为准",
    source: AA_LEADERBOARD,
    sourceLabel: "AA 评测（截图估读）",
    note: "AA 截图 GLM-5.3 (low) 档：指数 23 / 成本 $1.6 为估读；速度未提供。控制台不暴露 GLM 档位，此行为评测数据。",
  },
  {
    model: "minimax-m3.1-flash",
    variantId: "default",
    variantLabel: "默认",
    intelligence: 29,
    speedTokS: null,
    ttftS: null,
    costPerTaskUsd: 0.5,
    costPerTaskCny: 3.34,
    inputPerM: 1,
    outputPerM: 4,
    context: "1M",
    maxOutput: "以官方模型页为准",
    source: AA_LEADERBOARD,
    sourceLabel: "AA 评测（截图估读）",
    note: "缓存折扣价官方未公布，暂按输入价。指数 29 / 成本 $0.5 为 2026-11-19 AA 散点截图估读。",
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
const SHORT_BASE: Record<string, string> = {
  "deepseek-v4-pro": "DS Pro",
  "deepseek-flash": "DS Flash",
  "mimo-v2.6-pro": "MiMo Pro",
  "mimo-v2.6-flash": "MiMo Flash",
  "qwen4-max": "Qwen4 Max",
  "qwen3.8-flash": "Qwen3.8 Flash",
  "kimi-k3.1-pro": "Kimi K3.1",
  "glm-5.3": "GLM-5.3",
  "glm-5.3-flash": "GLM Flash",
  "minimax-m3.1-flash": "MiniMax",
};

/** 每个模型的上榜档位数（1 = 单档位，标签省略档位后缀）。 */
const VARIANT_COUNT: Record<string, number> = LEADERBOARD_ROWS.reduce(
  (acc, r) => ({ ...acc, [r.model]: (acc[r.model] ?? 0) + 1 }),
  {} as Record<string, number>,
);

export function shortName(r: LeaderboardRow): string {
  const base = SHORT_BASE[r.model] ?? r.model;
  // 单档位模型不显示「·默认/·开启」等后缀（对齐 AA 原图只写模型名），多档位保留以示区分。
  return (VARIANT_COUNT[r.model] ?? 1) > 1 ? `${base}·${r.variantLabel}` : base;
}

export type VendorId = "deepseek" | "mimo" | "alibaba" | "zai" | "kimi" | "minimax" | "stepfun";

/** 模型 → 厂商（散点配色 / 图例用）。 */
export function vendorOf(model: string): VendorId {
  if (model.startsWith("deepseek")) return "deepseek";
  if (model.startsWith("mimo")) return "mimo";
  if (model.startsWith("qwen")) return "alibaba";
  if (model.startsWith("glm")) return "zai";
  if (model.startsWith("kimi")) return "kimi";
  if (model.startsWith("minimax")) return "minimax";
  return "stepfun";
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
