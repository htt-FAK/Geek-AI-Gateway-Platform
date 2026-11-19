"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ConsumptionChartPanel,
  KpiRow,
  ModelCallChartPanel,
  type SeriesPoint,
} from "@/components/charts";

type UsagePayload = {
  source: "litellm" | "litellm_truncated" | "spend_event";
  kpis: {
    totalRequests: number;
    totalAmountCny: number;
    totalTokens: number;
    avgRpm: number;
    avgTpm: number;
  };
  consumptionSeries: SeriesPoint[];
  modelInvocationSeries: SeriesPoint[];
  members: Array<{
    phone?: string;
    spendCny?: number;
    requests?: number;
    tokens?: number;
  }>;
};

export default function AdminUsagePage() {
  const [adminToken, setAdminToken] = useState("");
  const [sessionAdmin, setSessionAdmin] = useState(false);
  const [data, setData] = useState<UsagePayload | null>(null);
  const [error, setError] = useState("");
  const [consumeToggle, setConsumeToggle] = useState<"柱状图" | "面积图">("柱状图");
  const [modelToggle, setModelToggle] = useState<"调用趋势" | "调用次数分布" | "调用次数排行">(
    "调用趋势",
  );

  async function load(e?: FormEvent) {
    e?.preventDefault();
    setError("");
    const token = adminToken || sessionStorage.getItem("admin_token") || "";
    if (!token && !sessionAdmin) {
      setError("请填写 Admin Token，或以管理员身份登录");
      return;
    }
    if (token) {
      sessionStorage.setItem("admin_token", token);
      setAdminToken(token);
    }
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

  // 已登录管理员凭会话自动加载，无需 Token
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const meRes = await fetch("/api/me");
        if (!meRes.ok) return;
        const me = await meRes.json();
        if (!alive || me.role !== "admin") return;
        setSessionAdmin(true);
        const res = await fetch("/api/admin/usage", { headers: { "x-admin-token": "" } });
        if (!res.ok) return;
        const json = await res.json();
        if (alive) setData(json);
      } catch { /* 未登录走 Token 模式 */ }
    })();
    return () => { alive = false; };
  }, []);

  const hasData = data !== null;

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

        {sessionAdmin ? (
          <p className="text-sm" style={{ color: "var(--accent-primary)" }}>
            管理员会话（凭登录身份查看全员用量，无需 Token）
          </p>
        ) : (
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
        )}
        {error ? (
          <p className="text-sm text-[var(--status-error)]" role="alert">
            {error}
          </p>
        ) : null}

        {/*
          加载失败（接口 503 / source=error）时不渲染任何 0 值面板，
          只显示上面的错误提示，避免「看起来像没流量」。
        */}
        {hasData && data.source === "litellm_truncated" ? (
          <p className="text-xs text-[var(--status-warning)]">
            日志量过大，仅统计最近 5000 条（source=litellm_truncated），数字可能偏小。
          </p>
        ) : null}

        {hasData ? (
          <>
            <KpiRow
              items={[
                { label: "总数", value: String(data.kpis.totalRequests), hint: "统计计数" },
                {
                  label: "总额度",
                  value: `¥${data.kpis.totalAmountCny.toFixed(4)}`,
                  hint: "统计金额",
                },
                {
                  label: "总 TOKEN 数",
                  value: String(data.kpis.totalTokens),
                  hint: "统计 Token 数",
                },
                { label: "平均 RPM", value: data.kpis.avgRpm.toFixed(2), hint: "每分钟请求数" },
                {
                  label: "平均 TPM",
                  value: String(Math.round(data.kpis.avgTpm)),
                  hint: "每分钟 Token 数",
                },
              ]}
            />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <ConsumptionChartPanel
                series={data.consumptionSeries}
                mode={consumeToggle}
                onModeChange={setConsumeToggle}
                totalSpendCny={data.kpis.totalAmountCny}
              />
              <ModelCallChartPanel
                series={data.modelInvocationSeries}
                mode={modelToggle}
                onModeChange={setModelToggle}
                totalCount={data.kpis.totalRequests}
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
                    {data.members.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-[var(--text-tertiary)]">
                          暂无成员用量数据
                        </td>
                      </tr>
                    ) : (
                      data.members.map((m, i) => (
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
          </>
        ) : null}
      </div>
    </main>
  );
}
