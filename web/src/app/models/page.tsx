"use client";

import Link from "next/link";
import { useState } from "react";
import { ConsolePage, useMe } from "@/components/console";
import { ModelDocsDialog } from "@/components/model-docs-dialog";
import { envPublicGateway } from "@/lib/public-env";
import {
  MARKET_MODELS,
  priceLine,
  providerLabel,
  providerLogo,
  type MarketProvider,
} from "@/lib/model-market";

type Filter = "all" | MarketProvider;

export default function ModelsPage() {
  const { me } = useMe();
  const [filter, setFilter] = useState<Filter>("all");
  const [docsModel, setDocsModel] = useState<string | null>(null);

  const mounted = me?.models ?? [];
  const cards = MARKET_MODELS.filter(
    (m) => mounted.includes(m.id) && (filter === "all" || m.provider === filter),
  );

  return (
    <ConsolePage phone={me?.phone}>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">模型广场</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          当前网关已接入 {mounted.length} 个上游能力 · 价格单位：人民币 / 百万 token
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "全部"],
            ["deepseek", "DeepSeek"],
            ["mimo", "小米 MiMo"],
            ["bailian", "阿里云百炼"],
            ["xfyun", "讯飞星火"],
            ["siliconflow", "硅基流动"],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`btn px-3 py-1.5 text-[13px] ${filter === key ? "" : "btn-ghost"}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((m) => (
          <article key={m.id} className="panel group relative flex flex-col p-5 transition-colors hover:border-[var(--border-active)]">
            {m.recommended ? (
              <span className="absolute right-4 top-4 rounded-full bg-gradient-to-r from-[var(--brand-deepseek)] to-[#8296ff] px-2.5 py-0.5 text-[11px] font-medium leading-5 text-white shadow-sm">
                推荐
              </span>
            ) : null}
            <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={providerLogo(m.provider)}
                alt={providerLabel(m.provider)}
                className="h-4 w-4 object-contain"
              />
              {providerLabel(m.provider)}
            </div>
            <h2 className="mono mt-2 truncate text-[15px] font-medium" title={m.id}>
              {m.id}
            </h2>
            <div className="mt-2 flex flex-wrap gap-1">
              {m.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-[var(--radius-sm)] bg-[var(--accent-muted)] px-1.5 py-0.5 text-[11px] text-[var(--accent-primary)]"
                >
                  {t}
                </span>
              ))}
            </div>
            <p className="mt-3 line-clamp-2 flex-1 text-sm text-[var(--text-secondary)]">{m.tagline}</p>
            <div className="mt-4 space-y-1 border-t border-[var(--border-subtle)] pt-3 text-[13px]">
              <p className="tabular">{priceLine(m)}</p>
              {m.peakPricing ? (
                <p className="text-[var(--status-warning)]">
                  峰时：工作日 09–12、14–18 ×2 · 节假日错峰
                </p>
              ) : null}
              <p className="text-[var(--text-tertiary)]">
                上下文 {m.context}
                {m.maxOutput !== "—" ? ` · 最大输出 ${m.maxOutput}` : ""}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              {m.endpoint === "chat" ? (
                <Link href={`/playground?model=${encodeURIComponent(m.id)}`} className="btn px-3 py-1.5 text-[13px]">
                  体验
                </Link>
              ) : null}
              <Link href={`/models/${encodeURIComponent(m.id)}`} className="btn btn-secondary px-3 py-1.5 text-[13px]">
                详情
              </Link>
              <button
                type="button"
                className="btn btn-ghost px-3 py-1.5 text-[13px]"
                onClick={() => setDocsModel(m.id)}
              >
                文档
              </button>
            </div>
          </article>
        ))}
      </div>

      {cards.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--text-tertiary)]">该筛选下暂无已接入模型。</p>
      ) : null}

      <ModelDocsDialog
        model={docsModel}
        gatewayUrl={me?.gatewayUrl ?? envPublicGateway()}
        open={docsModel !== null}
        onOpenChange={(o) => {
          if (!o) setDocsModel(null);
        }}
      />
    </ConsolePage>
  );
}
