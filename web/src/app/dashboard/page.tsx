"use client";

import { useState } from "react";
import Link from "next/link";
import { BudgetColumns, EmptyChartPanel, KpiRow } from "@/components/charts";
import { ConsolePage, useMe } from "@/components/console";

export default function DashboardPage() {
  const { me } = useMe();
  const [consumeToggle, setConsumeToggle] = useState("柱状图");
  const [modelToggle, setModelToggle] = useState("调用趋势");

  return (
    <ConsolePage phone={me?.phone}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">看板</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">网关跑得怎样，一眼看完</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/keys" className="text-[var(--accent-primary)] hover:underline">
            密钥
          </Link>
          <Link href="/models" className="text-[var(--accent-primary)] hover:underline">
            模型
          </Link>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <h2 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">限额消耗情况</h2>
          {me ? (
            <BudgetColumns budget={me.budget} />
          ) : (
            <div className="panel p-8 text-sm text-[var(--text-tertiary)]">加载中…</div>
          )}
        </div>

        <KpiRow
          items={[
            { label: "总数", value: "0", hint: "统计计数" },
            { label: "总额度", value: "¥0", hint: "统计金额" },
            { label: "总 TOKEN 数", value: "0", hint: "统计 Token 数" },
            { label: "平均 RPM", value: "0", hint: "每分钟请求数" },
            { label: "平均 TPM", value: "0", hint: "每分钟 Token 数" },
          ]}
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <EmptyChartPanel
            title="消耗分布"
            totalLabel="总计: ¥0"
            toggles={["柱状图", "面积图"]}
            activeToggle={consumeToggle}
            onToggle={setConsumeToggle}
          />
          <EmptyChartPanel
            title="模型调用分析"
            totalLabel="总计: 0"
            toggles={["调用趋势", "调用次数分布", "调用次数排行"]}
            activeToggle={modelToggle}
            onToggle={setModelToggle}
          />
        </div>

        <p className="text-sm text-[var(--text-tertiary)]">
          还没有数据？去{" "}
          <Link href="/playground" className="text-[var(--accent-primary)] hover:underline">
            调试台
          </Link>{" "}
          跑几轮，或等流量进来后再看。
        </p>
      </div>
    </ConsolePage>
  );
}
