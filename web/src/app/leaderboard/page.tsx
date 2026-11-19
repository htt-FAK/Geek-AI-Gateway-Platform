"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
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
import {
  LEADERBOARD_FETCHED_AT,
  LEADERBOARD_ROWS,
  METRIC_TABS,
  bestOf,
  paretoFrontier,
  shortName,
  sortRows,
  type LeaderboardRow,
  type MetricKey,
} from "@/lib/leaderboard-data";

const fmt = (v: number | null, suffix = ""): string => (v === null ? "—" : `${v}${suffix}`);

const DISPLAY_NAME: Record<string, string> = {
  "deepseek-v4-pro": "DeepSeek V4 Pro",
  "deepseek-flash": "DeepSeek Flash",
  "mimo-v2.6-pro": "MiMo V2.6 Pro",
  "mimo-v2.6-flash": "MiMo V2.6 Flash",
};

const BRAND_LOGO: Record<string, string> = {
  deepseek: "/brands/deepseek.ico",
  mimo: "/brands/mimo.png",
};

const VARIANT_COLOR: Record<string, string> = {
  max: "var(--chart-3)",
  standard: "var(--chart-1)",
  off: "var(--text-tertiary)",
  on: "var(--chart-2)",
  default: "var(--chart-4)",
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

type ScatterPoint = { x: number; y: number; label: string; vendor: "deepseek" | "mimo"; cny: number };

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
        label: `${DISPLAY_NAME[r.model] ?? r.model}·${r.variantLabel}`,
        vendor: r.model.startsWith("deepseek") ? "deepseek" : "mimo",
        cny: r.costPerTaskCny as number,
      })),
    [],
  );

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
        .map((r) => ({ name: shortName(r), value: r.intelligence })),
    [],
  );

  return (
    <ConsolePage phone={me?.phone}>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">模型榜单</h1>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
          4 个聊天模型 × 思考档位 · 数据来自 AA 评测（智能指数 v5.0.1，版本与网关一致）· 采集于 {LEADERBOARD_FETCHED_AT}
        </p>
      </div>

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
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--brand-mimo)" }} />
            小米 MiMo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--brand-deepseek)" }} />
            DeepSeek
          </span>
        </div>

        <div className="mt-4 h-[460px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart margin={{ left: 28, right: 150, top: 20, bottom: 28 }}>
              <ReferenceArea
                x1={0.12}
                x2={0.53}
                y1={22.5}
                y2={35}
                fill="color-mix(in srgb, var(--status-success) 14%, transparent)"
                fillOpacity={1}
                strokeOpacity={0}
              />
              <ReferenceArea
                x1={0.53}
                x2={2.5}
                y1={10}
                y2={22.5}
                fill="var(--bg-hover)"
                fillOpacity={0.55}
                strokeOpacity={0}
              />
              <XAxis
                dataKey="x"
                type="number"
                scale="log"
                domain={[0.12, 2.5]}
                ticks={[0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 2]}
                tickFormatter={(v: number) => `$${v}`}
                axisLine={{ stroke: "var(--chart-axis)" }}
                tickLine={{ stroke: "var(--chart-axis)" }}
                tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                label={{ value: "单任务成本（美元，对数刻度）", position: "insideBottom", offset: -16, fill: "var(--text-secondary)", fontSize: 13 }}
              />
              <YAxis
                dataKey="y"
                type="number"
                domain={[10, 35]}
                ticks={[10, 15, 20, 25, 30, 35]}
                axisLine={{ stroke: "var(--chart-axis)" }}
                tickLine={{ stroke: "var(--chart-axis)" }}
                tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                label={{ value: "Artificial Analysis Intelligence Index", angle: -90, position: "insideLeft", offset: -8, fill: "var(--text-secondary)", fontSize: 13 }}
              />
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
                  <circle cx={props.cx} cy={props.cy} r={7} fill={props.fill} />
                )}
                isAnimationActive={false}
              >
                {scatterData.map((p, i) => (
                  <Cell key={i} fill={p.vendor === "deepseek" ? "var(--brand-deepseek)" : "var(--brand-mimo)"} />
                ))}
                <LabelList
                  dataKey="label"
                  position="right"
                  offset={12}
                  style={{ fill: "var(--text-primary)", fontSize: 12 }}
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

      <section className="panel mt-5 p-6">
        <h2 className="text-sm font-medium">智能指数对比</h2>
        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">AA 智能指数 v5.0.1 · 分数越高越聪明</p>
        <div className="mt-5 h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ left: 12, right: 36, top: 8, bottom: 8 }} barCategoryGap="32%">
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "var(--text-tertiary)", fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={150}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
              />
              <Tooltip cursor={{ fill: "var(--bg-hover)" }} contentStyle={tooltipStyle} />
              <Bar dataKey="value" name="智能指数" fill="var(--accent-primary)" radius={[4, 4, 4, 4]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <p className="mt-5 text-xs leading-relaxed text-[var(--text-tertiary)]">
        名词解释：AA = Artificial Analysis，第三方大模型评测机构；智能指数 = 其综合智能评分（Intelligence Index v5.0.1）；
        每任务成本 = 跑完一个评测任务的平均花费；首Token延迟 = 发出请求到收到第一个回答字元的等待时间；输出速度 = 每秒生成的 token 数。
        思考档位与调试台一致（DeepSeek Pro / Flash 关闭/标准/极深，MiMo 关闭/开启；Flash 档位控制台暂不暴露，榜单为评测数据）。
        价格列为本网关官方人民币定价（每百万 token，DeepSeek 峰时另计）。
        更新数据：编辑 web/src/lib/leaderboard-data.ts 并刷新采集日期。
      </p>
    </ConsolePage>
  );
}

/** 官网 logo 头像 + 展示名 + mono ID。 */
function ModelCell({ r }: { r: LeaderboardRow }) {
  const isDs = r.model.startsWith("deepseek");
  const brand = isDs ? "var(--brand-deepseek)" : "var(--brand-mimo)";
  return (
    <span className="flex items-center gap-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)]"
        style={{ background: `color-mix(in srgb, ${brand} 12%, transparent)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND_LOGO[isDs ? "deepseek" : "mimo"]} alt={isDs ? "DeepSeek" : "MiMo"} className="h-6 w-6 object-contain" />
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
