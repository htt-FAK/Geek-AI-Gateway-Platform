"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandBadge } from "@/components/brand-badge";
import { ConsolePage, useMe } from "@/components/console";
import { ModelDocsDialog } from "@/components/model-docs-dialog";
import { envPublicGateway } from "@/lib/public-env";
import {
  MARKET_MODELS,
  freeLabel,
  isFreeModel,
  modelBrand,
  priceLine,
} from "@/lib/model-market";

type Filter = "all" | string;
type Category = "all" | "text" | "voice" | "vector";

/** 品牌筛选（按模型自家厂商，而非托管平台）。 */
const BRAND_FILTERS: [Filter, string][] = [
  ["all", "全部"],
  ["deepseek", "DeepSeek"],
  ["mimo", "小米 MiMo"],
  ["qwen", "千问 Qwen"],
  ["kimi", "Kimi"],
  ["glm", "智谱 GLM"],
  ["minimax", "MiniMax"],
  ["step", "阶跃星辰"],
  ["xfyun", "讯飞星火"],
  ["siliconflow", "硅基流动"],
];

/** 按用途分类：文本模型(chat) / 语音模型(asr+tts) / 知识库向量(embedding+rerank)。 */
function categoryOf(endpoint: string): Exclude<Category, "all"> {
  if (endpoint === "asr" || endpoint === "tts") return "voice";
  if (endpoint === "embedding" || endpoint === "rerank") return "vector";
  return "text";
}

const CATEGORY_TABS: [Category, string][] = [
  ["all", "全部"],
  ["text", "文本模型"],
  ["voice", "语音模型"],
  ["vector", "知识库向量"],
];

export default function ModelsPage() {
  const { me } = useMe();
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState<Category>("all");
  const [docsModel, setDocsModel] = useState<string | null>(null);

  const mounted = me?.models ?? [];
  const cards = MARKET_MODELS.filter(
    (m) =>
      mounted.includes(m.id) &&
      (filter === "all" || modelBrand(m.id).key === filter) &&
      (category === "all" || categoryOf(m.endpoint) === category),
  );

  return (
    <ConsolePage phone={me?.phone}>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">模型广场</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          当前网关已接入 {mounted.length} 个上游能力 · 价格单位：人民币 / 百万 token
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {CATEGORY_TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`btn px-3 py-1.5 text-[13px] ${category === key ? "" : "btn-ghost"}`}
            onClick={() => setCategory(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {BRAND_FILTERS.map(([key, label]) => (
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
            <div className="absolute right-4 top-4 flex flex-col items-end gap-1">
              {m.recommended ? (
                <span className="rounded-full bg-gradient-to-r from-[var(--brand-deepseek)] to-[#8296ff] px-2.5 py-0.5 text-[11px] font-medium leading-5 text-white shadow-sm">
                  推荐
                </span>
              ) : null}
              {isFreeModel(m) ? (
                <span className="rounded-full bg-gradient-to-r from-[#15803d] to-[#22c55e] px-2.5 py-0.5 text-[11px] font-semibold leading-5 text-white shadow-sm">
                  {freeLabel(m)}
                </span>
              ) : null}
            </div>
            <BrandBadge id={m.id} />
            <h2 className="mono mt-2 truncate text-[15px] font-medium" title={m.id}>
              {m.id}
            </h2>
            <div className="mt-2 flex flex-wrap gap-1">
              {m.tags.filter((t) => !/免费/.test(t)).map((t) => (
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
              <p className={`tabular ${isFreeModel(m) ? "font-semibold text-[#16a34a]" : ""}`}>{priceLine(m)}</p>
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
              {/* 嵌入 / 重排序模型不弹文档对话框，调用示例见详情页 */}
              {m.endpoint !== "embedding" && m.endpoint !== "rerank" ? (
                <button
                  type="button"
                  className="btn btn-ghost px-3 py-1.5 text-[13px]"
                  onClick={() => setDocsModel(m.id)}
                >
                  文档
                </button>
              ) : null}
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
