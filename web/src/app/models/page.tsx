"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BrandBadge } from "@/components/brand-badge";
import { ConsolePage, useMe } from "@/components/console";
import { ModelDocsDialog } from "@/components/model-docs-dialog";
import { PageHeader } from "@/components/page-header";
import { envPublicGateway } from "@/lib/public-env";
import {
  MARKET_MODELS,
  showcaseOrder,
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
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState<Category>("all");
  const [docsModel, setDocsModel] = useState<string | null>(null);

  const mounted = me?.models ?? [];
  const cards = MARKET_MODELS.filter(
    (m) =>
      mounted.includes(m.id) &&
      (filter === "all" || modelBrand(m.id).key === filter) &&
      (category === "all" || categoryOf(m.endpoint) === category),
  ).sort((a, b) => showcaseOrder(a) - showcaseOrder(b));

  return (
    <ConsolePage phone={me?.phone}>
      <PageHeader
        group="资源"
        title="模型广场"
        description={`当前网关已接入 ${mounted.length} 个上游能力 · 价格单位：人民币 / 百万 token`}
      />

      {/* 用途筛选：分段控件 */}
      <div className="mb-3">
        <div className="relative inline-flex flex-wrap gap-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-0.5">
          {CATEGORY_TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`relative rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                category === key
                  ? "text-[var(--accent-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              onClick={() => setCategory(key)}
            >
              {category === key ? (
                <motion.span
                  layoutId="model-category"
                  className="absolute inset-0 rounded-md bg-[var(--accent-muted)]"
                  transition={{ duration: reduceMotion ? 0 : 0.15, ease: [0.2, 0.8, 0.2, 1] }}
                />
              ) : null}
              <span className="relative z-[1]">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 品牌筛选：细线芯片，选中才填淡靛蓝 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {BRAND_FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`rounded-full px-2.5 py-1 text-[13px] transition-colors ${
              filter === key
                ? "bg-[var(--accent-muted)] text-[var(--accent-primary)]"
                : "border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-active)] hover:text-[var(--text-primary)]"
            }`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <motion.div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
        {cards.map((m, index) => (
          <motion.article
            layout={!reduceMotion}
            key={m.id}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{
              layout: { duration: reduceMotion ? 0 : 0.18, ease: [0.2, 0.8, 0.2, 1] },
              opacity: { duration: reduceMotion ? 0 : 0.15, delay: reduceMotion || index >= 8 ? 0 : index * 0.04 },
            }}
            className="model-card panel group relative flex cursor-pointer flex-col p-5"
            onClick={(e) => {
              const action = (e.target as HTMLElement).closest("[data-card-action]");
              if (action) return;
              router.push(`/models/${encodeURIComponent(m.id)}`);
            }}
          >
            <div className="pointer-events-none relative z-[2] flex flex-1 flex-col">
              <div className="absolute right-0 top-0 flex flex-col items-end gap-1">
                {m.recommended ? (
                  <span className="text-[11px] font-medium leading-4 text-[var(--accent-primary)]">推荐</span>
                ) : null}
                {isFreeModel(m) ? (
                  <span className="text-[11px] font-medium leading-4 text-[var(--status-success)]">{freeLabel(m)}</span>
                ) : null}
              </div>
              <BrandBadge id={m.id} />
              <h2 className="mt-3 truncate text-[17px] font-semibold tracking-[-0.03em]" title={m.id}>
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
              <p className="mt-3 line-clamp-2 flex-1 text-sm leading-relaxed text-[var(--text-secondary)]">{m.tagline}</p>
            </div>
            <div className="pointer-events-none relative z-[2] mt-4 min-h-[4.5rem]">
              <div className="model-card-specs space-y-1 border-t border-[var(--border-subtle)] pt-3 text-[13px]">
                <p className={`tabular font-medium ${isFreeModel(m) ? "text-[var(--status-success)]" : ""}`}>
                  {priceLine(m)}
                </p>
                <p className="text-[var(--text-tertiary)]">
                  上下文 {m.context}
                  {m.maxOutput !== "—" ? ` · 最大输出 ${m.maxOutput}` : ""}
                </p>
              </div>
              <div className="model-card-actions z-[3] flex items-center gap-2 border-t border-transparent pt-3">
                {m.endpoint === "chat" && m.id !== "deepseek-ocr" ? (
                  <span className="model-tip">
                    <Link
                      href={`/playground?model=${encodeURIComponent(m.id)}`}
                      data-card-action="play"
                      className="btn px-3 py-1.5 text-[13px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      体验
                    </Link>
                    <span className="model-tip-bubble" role="tooltip">
                      {m.tagline}
                    </span>
                  </span>
                ) : null}
                {m.endpoint !== "embedding" && m.endpoint !== "rerank" ? (
                  <button
                    type="button"
                    data-card-action="docs"
                    className="btn btn-ghost px-3 py-1.5 text-[13px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDocsModel(m.id);
                    }}
                  >
                    API 参考
                  </button>
                ) : (
                  <Link
                    href={`/models/${encodeURIComponent(m.id)}`}
                    data-card-action="docs"
                    className="btn btn-ghost px-3 py-1.5 text-[13px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    API 参考
                  </Link>
                )}
              </div>
            </div>
          </motion.article>
        ))}
        </AnimatePresence>
      </motion.div>

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
