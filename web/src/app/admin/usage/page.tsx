"use client";

import { FormEvent, useState } from "react";
import { EmptyChartPanel, KpiRow } from "@/components/charts";

type UsagePayload = {
  kpis: {
    totalRequests: number;
    totalAmountCny: number;
    totalTokens: number;
    avgRpm: number;
    avgTpm: number;
  };
  members: Array<{
    phone?: string;
    spendCny?: number;
    requests?: number;
    tokens?: number;
  }>;
};

export default function AdminUsagePage() {
  const [adminToken, setAdminToken] = useState("");
  const [data, setData] = useState<UsagePayload | null>(null);
  const [error, setError] = useState("");
  const [consumeToggle, setConsumeToggle] = useState("柱状图");
  const [modelToggle, setModelToggle] = useState("调用趋势");

  async function load(e?: FormEvent) {
    e?.preventDefault();
    setError("");
    const token = adminToken || sessionStorage.getItem("admin_token") || "";
    if (!token) {
      setError("请填写 Admin Token");
      return;
    }
    sessionStorage.setItem("admin_token", token);
    setAdminToken(token);
    const res = await fetch("/api/admin/usage", {
      headers: { "x-admin-token": token },
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "加载失败");
      setData(null);
      return;
    }
    setData(json);
  }

  return (
    <main className="min-h-screen bg-[var(--bg-base)] px-6 py-8 text-[var(--text-primary)]">
      <div className="mx-auto max-w-console space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">全员用量</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Admin Token 门 · 全体成员视角</p>
          </div>
          <a href="/admin/users" className="text-sm text-[var(--accent-primary)] hover:underline">
            用户管理
          </a>
        </div>

        <form onSubmit={(e) => void load(e)} className="panel flex flex-wrap items-end gap-3 p-4">
          <label className="min-w-[240px] flex-1 space-y-1">
            <span className="text-sm text-[var(--text-secondary)]">Admin Token</span>
            <input
              className="field"
              type="password"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              placeholder="x-admin-token"
            />
          </label>
          <button className="btn" type="submit">
            加载
          </button>
        </form>
        {error ? <p className="text-sm text-[var(--status-error)]">{error}</p> : null}

        <KpiRow
          items={[
            { label: "总数", value: String(data?.kpis.totalRequests ?? 0), hint: "统计计数" },
            {
              label: "总额度",
              value: `¥${data?.kpis.totalAmountCny ?? 0}`,
              hint: "统计金额",
            },
            { label: "总 TOKEN 数", value: String(data?.kpis.totalTokens ?? 0), hint: "统计 Token 数" },
            { label: "平均 RPM", value: String(data?.kpis.avgRpm ?? 0), hint: "每分钟请求数" },
            { label: "平均 TPM", value: String(data?.kpis.avgTpm ?? 0), hint: "每分钟 Token 数" },
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

        <section className="panel overflow-hidden">
          <div className="border-b border-[var(--border-subtle)] px-4 py-3 text-sm font-medium">
            成员排行
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[13px] text-[var(--text-tertiary)]">
                <tr>
                  <th className="px-4 py-3 font-normal">手机号</th>
                  <th className="px-4 py-3 font-normal">费用</th>
                  <th className="px-4 py-3 font-normal">请求</th>
                  <th className="px-4 py-3 font-normal">Token</th>
                </tr>
              </thead>
              <tbody>
                {(data?.members?.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-[var(--text-tertiary)]">
                      暂无成员用量数据
                    </td>
                  </tr>
                ) : (
                  data!.members.map((m, i) => (
                    <tr key={i} className="border-t border-[var(--border-subtle)]">
                      <td className="px-4 py-3 mono">{m.phone}</td>
                      <td className="px-4 py-3 tabular">¥{(m.spendCny ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-3 tabular">{m.requests ?? 0}</td>
                      <td className="px-4 py-3 tabular">{m.tokens ?? 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
