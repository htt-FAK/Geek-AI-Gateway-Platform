"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Label,
  LabelList,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ConsolePage, useMe } from "@/components/console";
import { PageHeader } from "@/components/page-header";
import {
  LEADERBOARD_FETCHED_AT,
  LEADERBOARD_ROWS,
  METRIC_TABS,
  bestOf,
  paretoFrontier,
  shortName,
  sortRows,
  vendorOf,
  type LeaderboardRow,
  type MetricKey,
  type VendorId,
} from "@/lib/leaderboard-data";

const fmt = (v: number | null, suffix = ""): string => (v === null ? "—" : `${v}${suffix}`);

const DISPLAY_NAME: Record<string, string> = {
  "deepseek-v4-pro": "DeepSeek V4 Pro",
  "deepseek-flash": "DeepSeek Flash",
  "mimo-v2.6-pro": "MiMo V2.6 Pro",
  "mimo-v2.6-flash": "MiMo V2.6 Flash",
  "qwen4-max": "Qwen4 Max",
  "qwen3.8-flash": "Qwen3.8 Flash",
  "kimi-k3.1-pro": "Kimi K3.1 Pro",
  "glm-5.3": "GLM-5.3",
  "glm-5.3-flash": "GLM-5.3 Flash",
  "minimax-m3.1-flash": "MiniMax M3.1 Flash",
};

const BRAND_LOGO: Record<string, string> = {
  deepseek: "/brands/deepseek.ico",
  mimo: "/brands/mimo.png",
};

/** 柱状图 x 轴用的厂商 logo（七家均有品牌图标）。 */
const VENDOR_LOGO: Record<VendorId, string> = {
  deepseek: "/brands/deepseek.ico",
  mimo: "/brands/mimo.png",
  alibaba: "/brands/qwen.svg",
  zai: "/brands/glm.svg",
  kimi: "/brands/kimi.svg",
  minimax: "/brands/minimax.svg",
  stepfun: "/brands/step.svg",
};

/** 每个模型的上榜档位数：多档位时柱状图标签带中文档位。 */
const MODEL_VARIANTS: Record<string, number> = LEADERBOARD_ROWS.reduce(
  (acc, r) => ({ ...acc, [r.model]: (acc[r.model] ?? 0) + 1 }),
  {} as Record<string, number>,
);

function axisLabel(r: LeaderboardRow): string {
  const base = DISPLAY_NAME[r.model] ?? r.model;
  return (MODEL_VARIANTS[r.model] ?? 1) > 1 ? `${base}（${r.variantLabel}）` : base;
}

/** 厂商配色（对齐 AA 截图图例；蓝/橙系做区分度偏移，避免同色难辨）。 */
const VENDOR: Record<VendorId, { label: string; color: string }> = {
  deepseek: { label: "DeepSeek", color: "var(--brand-deepseek)" },
  mimo: { label: "小米 MiMo", color: "var(--brand-mimo)" },
  alibaba: { label: "阿里 Qwen", color: "#f59e0b" },
  zai: { label: "智谱 GLM", color: "#38bdf8" },
  kimi: { label: "Kimi", color: "#a78bfa" },
  minimax: { label: "MiniMax", color: "#f472b6" },
  stepfun: { label: "阶跃 Step", color: "#2dd4bf" },
};

const VARIANT_COLOR: Record<string, string> = {
  max: "var(--chart-3)",
  standard: "var(--chart-1)",
  low: "var(--chart-5)",
  off: "var(--text-tertiary)",
  on: "var(--chart-2)",
  default: "var(--chart-4)",
};

/**
 * 散点标签相对圆点的偏移（复刻 AA 原图：右侧为主，拥挤处改放左/上/下避免压字）。
 * key 为 shortName() 的结果；anchor 为 text-anchor；dy 为基线偏移。
 */
type LabelPlacement = { dx: number; dy: number; anchor: "start" | "middle" | "end" };
const LABEL_RIGHT: LabelPlacement = { dx: 9, dy: 4, anchor: "start" };
const LABEL_POS: Record<string, LabelPlacement> = {
  // $0.47–$0.6 高密度簇：左/上/右/下四向错开
  "DS Flash·标准": { dx: -9, dy: 4, anchor: "end" },
  MiniMax: { dx: 8, dy: -4, anchor: "start" },
  "Qwen3.8 Flash": { dx: 9, dy: 8, anchor: "start" },
  "GLM Flash": { dx: 7, dy: 20, anchor: "start" },
  "MiMo Pro": { dx: 2, dy: -11, anchor: "middle" },
  // $1.6 / $1.8 同高度：左侧标签向右排，GLM 反向
  "GLM-5.3·低": { dx: -9, dy: 4, anchor: "end" },
  // 最右点：标签放左侧，避免越出绘图区
  "GLM-5.3·极深": { dx: -9, dy: 4, anchor: "end" },
};

const tooltipStyle = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 10,
  boxShadow: "var(--panel-shadow, 0 8px 24px rgba(0,0,0,0.35))",
  color: "var(--text-primary)",
  fontSize: 13,
  padding: "8px 12px",
};

type ScatterPoint = { x: number; y: number; label: string; vendor: VendorId; cny: number };

export default function LeaderboardPage() {
  const { me } = useMe();
  const [metric, setMetric] = useState<MetricKey>("intelligence");
  const rows = useMemo(() => sortRows(LEADERBOARD_ROWS, metric), [metric]);

  const highlights = useMemo(
    () =>
      (["intelligence", "cost", "speed", "latency"] as MetricKey[])
        .map((key) => ({ key, row: bestOf(LEADERBOARD_ROWS, key) }))
        .filter((h) => h.row),
    [],
  );

  const scatterData: ScatterPoint[] = useMemo(
    () =>
      LEADERBOARD_ROWS.filter((r) => r.costPerTaskUsd !== null && r.intelligence !== null).map((r) => ({
        x: r.costPerTaskUsd as number,
        y: r.intelligence as number,
        label: shortName(r),
        vendor: vendorOf(r.model),
        cny: r.costPerTaskCny as number,
      })),
    [],
  );

  const vendorsPresent = useMemo(
    () => [...new Set(LEADERBOARD_ROWS.map((r) => vendorOf(r.model)))],
    [],
  );

  const modelCount = useMemo(() => new Set(LEADERBOARD_ROWS.map((r) => r.model)).size, []);

  const paretoData = useMemo(
    () =>
      paretoFrontier(LEADERBOARD_ROWS).map((r) => ({
        x: r.costPerTaskUsd as number,
        y: r.intelligence as number,
      })),
    [],
  );

  const barData = useMemo(
    () =>
      LEADERBOARD_ROWS.filter((r) => r.intelligence !== null)
        .sort((a, b) => (b.intelligence ?? 0) - (a.intelligence ?? 0))
        .map((r) => ({
          name: shortName(r),
          label: axisLabel(r),
          value: r.intelligence as number,
          vendor: vendorOf(r.model),
        })),
    [],
  );

  return (
    <ConsolePage phone={me?.phone}>
      <PageHeader
        group="观测"
        title="模型榜单"
        description={`${modelCount} 个聊天模型 × 思考档位 · 数据来自 AA 评测（Intelligence Index，版本与网关一致）· 采集于 ${LEADERBOARD_FETCHED_AT}`}
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {highlights.map((h) => (
          <button
            key={h.key}
            type="button"
            onClick={() => setMetric(h.key)}
            className={`panel px-5 py-4 text-left transition-colors hover:border-[var(--border-active)] ${metric === h.key ? "border-[var(--accent-primary)]" : ""}`}
          >
            <p className="text-xs text-[var(--text-tertiary)]">
              {h.key === "intelligence" ? "最高智能" : h.key === "cost" ? "最低每任务成本" : h.key === "speed" ? "最快输出" : "最低首Token延迟"}
            </p>
            <p className="mono mt-1.5 truncate text-[13px] font-medium" title={`${h.row!.model} · ${h.row!.variantLabel}`}>
              {h.row!.model} · {h.row!.variantLabel}
            </p>
            <p className="tabular mt-1 text-xl font-semibold">
              {h.key === "intelligence"
                ? fmt(h.row!.intelligence)
                : h.key === "cost"
                  ? `¥${h.row!.costPerTaskCny}`
                  : h.key === "speed"
                    ? fmt(h.row!.speedTokS, " token/秒")
                    : fmt(h.row!.ttftS, " 秒")}
            </p>
          </button>
        ))}
      </div>

      {/* 复刻 AA 官网：Intelligence Index vs 每任务成本（对数轴散点 + 最优区域 + 帕累托线） */}
      <section className="panel relative mt-2 p-6">
        <span className="font-display pointer-events-none absolute right-6 top-5 text-sm text-[var(--text-tertiary)] opacity-70">
          Artificial Analysis
        </span>
        <h2 className="font-display text-lg font-semibold tracking-tight">Intelligence Index 与每项任务的成本</h2>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          Artificial Analysis Intelligence Index · 每任务加权平均成本（美元，对数刻度）
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--text-secondary)]">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[3px]" style={{ background: "color-mix(in srgb, var(--status-success) 22%, transparent)" }} />
            最优区域（高智能 · 低成本）
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 border-t-2 border-dotted border-[var(--text-primary)]" />
            帕累托前沿
          </span>
          {vendorsPresent.map((v) => (
            <span key={v} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: VENDOR[v].color }} />
              {VENDOR[v].label}
            </span>
          ))}
        </div>

        <div className="mt-4 h-[460px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart margin={{ left: 28, right: 56, top: 20, bottom: 34 }}>
              <ReferenceArea
                x1={0.1}
                x2={0.7}
                y1={27.5}
                y2={50}
                fill="color-mix(in srgb, var(--status-success) 14%, transparent)"
                fillOpacity={1}
                strokeOpacity={0}
              />
              <ReferenceArea
                x1={0.7}
                x2={5.3}
                y1={5}
                y2={27.5}
                fill="var(--bg-hover)"
                fillOpacity={0.55}
                strokeOpacity={0}
              />
              <XAxis
                dataKey="x"
                type="number"
                scale="log"
                domain={[0.1, 5.3]}
                ticks={[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1, 2, 3, 4, 5]}
                tickFormatter={(v: number) => `$${v}`}
                axisLine={{ stroke: "var(--chart-axis)" }}
                tickLine={{ stroke: "var(--chart-axis)" }}
                tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                label={{ value: "单任务成本（美元，对数刻度）", position: "insideBottom", offset: -22, fill: "var(--text-secondary)", fontSize: 13 }}
              />
              <YAxis
                dataKey="y"
                type="number"
                domain={[5, 50]}
                ticks={[5, 10, 15, 20, 25, 30, 35, 40, 45, 50]}
                axisLine={{ stroke: "var(--chart-axis)" }}
                tickLine={{ stroke: "var(--chart-axis)" }}
                tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
              >
                <Label
                  content={(props: { viewBox?: unknown }) => {
                    const vb = (props.viewBox ?? {}) as { x?: number; y?: number; height?: number };
                    const cx = Number(vb.x ?? 0) + 14;
                    const cy = Number(vb.y ?? 0) + Number(vb.height ?? 0) / 2;
                    return (
                      <text
                        x={cx}
                        y={cy}
                        transform={`rotate(-90 ${cx} ${cy})`}
                        textAnchor="middle"
                        fill="var(--text-secondary)"
                        fontSize={13}
                      >
                        Artificial Analysis Intelligence Index
                      </text>
                    );
                  }}
                />
              </YAxis>
              <Tooltip
                cursor={{ strokeDasharray: "3 3", stroke: "var(--border-active)" }}
                contentStyle={tooltipStyle}
                content={({ payload }) => {
                  const p = payload?.[0]?.payload as ScatterPoint | undefined;
                  if (!p) return null;
                  return (
                    <div>
                      <p className="font-medium">{p.label}</p>
                      <p className="mt-1 text-[var(--text-secondary)]">智能指数：{p.y}</p>
                      <p className="text-[var(--text-secondary)]">每任务成本：${p.x} ≈ ¥{p.cny}</p>
                    </div>
                  );
                }}
              />
              <Line
                data={paretoData}
                dataKey="y"
                stroke="var(--text-primary)"
                strokeWidth={1.5}
                strokeDasharray="2 5"
                dot={false}
                activeDot={false}
                legendType="none"
                tooltipType="none"
                isAnimationActive={false}
              />
              <Scatter
                data={scatterData}
                dataKey="y"
                shape={(props: { cx?: number; cy?: number; fill?: string }) => (
                  <circle cx={props.cx} cy={props.cy} r={5.5} fill={props.fill} />
                )}
                isAnimationActive={false}
              >
                {scatterData.map((p, i) => (
                  <Cell key={i} fill={VENDOR[p.vendor].color} />
                ))}
                <LabelList
                  dataKey="label"
                  content={(props: { x?: number | string; y?: number | string; value?: string | number }) => {
                    const place = LABEL_POS[String(props.value ?? "")] ?? LABEL_RIGHT;
                    return (
                      <text
                        x={Number(props.x ?? 0) + place.dx}
                        y={Number(props.y ?? 0) + place.dy}
                        textAnchor={place.anchor}
                        fill="var(--text-primary)"
                        stroke="var(--bg-elevated)"
                        strokeWidth={3}
                        strokeLinejoin="round"
                        paintOrder="stroke"
                        fontSize={12}
                        style={{ pointerEvents: "none" }}
                      >
                        {props.value}
                      </text>
                    );
                  }}
                />
              </Scatter>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-xs text-[var(--text-tertiary)]">
          左上绿色区域 = 智能高且成本低的「最优象限」；虚线为帕累托前沿（更便宜或更聪明的边界）。
          每任务成本人民币折算见下方表格（1 美元 ≈ 6.68 元，{LEADERBOARD_FETCHED_AT}）。
        </p>
      </section>

      <div className="mb-4 mt-6 flex flex-wrap items-center gap-2">
        {METRIC_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`btn px-3.5 py-1.5 text-[13px] ${metric === t.key ? "" : "btn-ghost"}`}
            onClick={() => setMetric(t.key)}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-[var(--text-tertiary)]">
          共 {LEADERBOARD_ROWS.length} 条 · 点击列头排序
        </span>
      </div>

      {/* GAP Console 式能力矩阵表格 */}
      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-xs text-[var(--text-tertiary)]">
                <th className="px-5 py-3 font-normal">模型</th>
                <th className="px-4 py-3 font-normal">思考档位</th>
                <ColHead label="智能指数" active={metric === "intelligence"} onClick={() => setMetric("intelligence")} />
                <ColHead label="每任务成本 ¥" active={metric === "cost"} onClick={() => setMetric("cost")} />
                <ColHead label="速度 token/秒" active={metric === "speed"} onClick={() => setMetric("speed")} />
                <ColHead label="首Token延迟 秒" active={metric === "latency"} onClick={() => setMetric("latency")} />
                <ColHead label="价格 入/出 ¥/百万" active={metric === "price"} onClick={() => setMetric("price")} />
                <th className="px-4 py-3 font-normal">上下文 / 最大输出</th>
                <th className="px-5 py-3 font-normal">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.model}-${r.variantId}`} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-hover)]">
                  <td className="px-5 py-3.5">
                    <ModelCell r={r} />
                  </td>
                  <td className="px-4 py-3.5">
                    <VariantPill r={r} />
                  </td>
                  <Cell2 v={fmt(r.intelligence)} active={metric === "intelligence"} strong />
                  <Cell2 v={r.costPerTaskCny === null ? "—" : `¥${r.costPerTaskCny}`} active={metric === "cost"} />
                  <Cell2 v={fmt(r.speedTokS)} active={metric === "speed"} />
                  <Cell2 v={fmt(r.ttftS)} active={metric === "latency"} />
                  <Cell2 v={`¥${r.inputPerM} / ¥${r.outputPerM}`} active={metric === "price"} />
                  <td className="tabular px-4 py-3.5 text-[var(--text-secondary)]">
                    {r.context} / {r.maxOutput}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-3 text-[13px]">
                      <Link href={`/models/${encodeURIComponent(r.model)}`} className="text-[var(--accent-primary)] hover:underline">
                        查看
                      </Link>
                      <a href={r.source} target="_blank" rel="noreferrer" className="text-[var(--text-tertiary)] hover:text-[var(--accent-primary)]" title={r.sourceLabel}>
                        AA ↗
                      </a>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel relative mt-5 p-6">
        <span className="font-display pointer-events-none absolute right-6 top-5 text-sm text-[var(--text-tertiary)] opacity-70">
          Artificial Analysis
        </span>
        <h2 className="font-display text-lg font-semibold tracking-tight">Artificial Analysis Intelligence Index</h2>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          智能指数 v5.0.1 · 分数越高越聪明 · 按档位从高到低（共 {barData.length} 个）
        </p>
        <div className="mt-6 h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 22, right: 10, bottom: 0, left: 10 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke="color-mix(in srgb, var(--text-primary) 12%, transparent)" strokeDasharray="2 4" />
              <XAxis
                dataKey="name"
                interval={0}
                axisLine={false}
                tickLine={false}
                height={168}
                tick={(props: { x?: number | string; y?: number | string; payload?: { index?: number } }) => {
                  const p = barData[Number(props.payload?.index ?? 0)];
                  const x = Number(props.x ?? 0);
                  const y = Number(props.y ?? 0);
                  if (!p) return <g />;
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <image
                        href={VENDOR_LOGO[p.vendor]}
                        x={-10}
                        y={6}
                        width={20}
                        height={20}
                        preserveAspectRatio="xMidYMid meet"
                      />
                      <text
                        x={0}
                        y={52}
                        transform="rotate(-50 0 52)"
                        textAnchor="end"
                        fill="var(--text-secondary)"
                        fontSize={11.5}
                      >
                        {p.label}
                      </text>
                    </g>
                  );
                }}
              />
              <YAxis
                type="number"
                domain={[0, 50]}
                ticks={[10, 20, 30, 40, 50]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 0, fill: "transparent" }}
                width={8}
              />
              <Tooltip
                cursor={{ fill: "var(--bg-hover)" }}
                contentStyle={tooltipStyle}
                content={({ payload }) => {
                  const p = payload?.[0]?.payload as (typeof barData)[number] | undefined;
                  if (!p) return null;
                  return (
                    <div>
                      <p className="font-medium">{p.label}</p>
                      <p className="mt-1 text-[var(--text-secondary)]">智能指数：{p.value}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" name="智能指数" isAnimationActive={false} radius={[3, 3, 0, 0]}>
                {barData.map((p, i) => (
                  <Cell key={i} fill={VENDOR[p.vendor].color} />
                ))}
                <LabelList
                  dataKey="value"
                  content={(props: {
                    x?: number | string;
                    y?: number | string;
                    width?: number | string;
                    height?: number | string;
                    value?: number | string;
                  }) => {
                    const cx = Number(props.x ?? 0) + Number(props.width ?? 0) / 2;
                    const top = Number(props.y ?? 0);
                    const h = Number(props.height ?? 0);
                    // 高柱数值统一在距基线 88px 处（AA 原图效果）；矮柱自动上移到柱内 16px。
                    const offset = Math.min(88, Math.max(16, h - 16));
                    return (
                      <text
                        x={cx}
                        y={top + h - offset}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize={13}
                        fontWeight={600}
                        style={{ fontVariantNumeric: "tabular-nums", pointerEvents: "none" }}
                      >
                        {props.value}
                      </text>
                    );
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <p className="mt-5 text-xs leading-relaxed text-[var(--text-tertiary)]">
        名词解释：AA = Artificial Analysis，第三方大模型评测机构；智能指数 = 其综合智能评分（Intelligence Index）；
        每任务成本 = 跑完一个评测任务的平均花费；首Token延迟 = 发出请求到收到第一个回答字元的等待时间；输出速度 = 每秒生成的 token 数。
        思考档位与调试台一致（DeepSeek Pro / Flash 关闭/标准/极深，MiMo 关闭/开启；Flash 与 GLM 档位控制台暂不暴露，榜单为评测数据）。
        标「截图估读」的行：指数 / 成本按 {LEADERBOARD_FETCHED_AT} AA 散点截图估读（成本约 ±15%），精确值待 AA 公布；— 表示 AA 暂未提供。
        价格列为本网关官方人民币定价（每百万 token，DeepSeek 峰时另计）。
        更新数据：编辑 web/src/lib/leaderboard-data.ts 并刷新采集日期。
      </p>
    </ConsolePage>
  );
}

/** 官网 logo 头像（DS/MiMo）或厂商色首字母块 + 展示名 + mono ID。 */
function ModelCell({ r }: { r: LeaderboardRow }) {
  const vendor = vendorOf(r.model);
  const brand = VENDOR[vendor].color;
  const logo = BRAND_LOGO[vendor];
  const displayName = DISPLAY_NAME[r.model] ?? r.model;
  return (
    <span className="flex items-center gap-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)]"
        style={{ background: `color-mix(in srgb, ${brand} 12%, transparent)` }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={VENDOR[vendor].label} className="h-6 w-6 object-contain" />
        ) : (
          <span className="text-[15px] font-semibold" style={{ color: brand }}>
            {displayName.slice(0, 1)}
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{DISPLAY_NAME[r.model] ?? r.model}</span>
        <span className="mono block truncate text-xs text-[var(--text-tertiary)]">{r.model}</span>
      </span>
      {r.note ? (
        <span className="cursor-help text-[var(--status-warning)]" title={r.note}>ⓘ</span>
      ) : null}
    </span>
  );
}

function VariantPill({ r }: { r: LeaderboardRow }) {
  const c = VARIANT_COLOR[r.variantId] ?? "var(--text-tertiary)";
  return (
    <span
      className="inline-block rounded-[var(--radius-sm)] px-2 py-0.5 text-[11px] font-medium"
      style={{ background: `color-mix(in srgb, ${c} 15%, transparent)`, color: c }}
    >
      {r.variantLabel}
    </span>
  );
}

function ColHead({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <th className="px-4 py-3 font-normal">
      <button
        type="button"
        onClick={onClick}
        className={`hover:text-[var(--accent-primary)] ${active ? "text-[var(--accent-primary)]" : ""}`}
      >
        {label} {active ? "↓" : ""}
      </button>
    </th>
  );
}

function Cell2({ v, active, strong }: { v: string; active: boolean; strong?: boolean }) {
  return (
    <td className={`tabular px-4 py-3.5 ${active ? "font-semibold text-[var(--accent-primary)]" : strong ? "font-medium" : "text-[var(--text-secondary)]"}`}>
      {v}
    </td>
  );
}
