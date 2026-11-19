"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ConsolePage, useMe } from "@/components/console";
import { buildModelCallSnippets, getModelDoc } from "@/lib/model-docs";
import {
  getMarketModel,
  PEAK_PRICING_NOTE,
  providerLabel,
  providerLogo,
} from "@/lib/model-market";
import { envPublicGateway } from "@/lib/public-env";

export default function ModelDetailPage() {
  const { me } = useMe();
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id ?? "");
  const market = getMarketModel(id);
  const doc = useMemo(() => getModelDoc(id), [id]);
  const gatewayUrl = me?.gatewayUrl ?? envPublicGateway();
  const snippets = useMemo(() => buildModelCallSnippets(id, gatewayUrl), [id, gatewayUrl]);
  const [tab, setTab] = useState<"curl" | "python">("curl");
  const [copied, setCopied] = useState(false);

  if (!market) {
    return (
      <ConsolePage phone={me?.phone}>
        <section className="panel px-5 py-6">
          <p className="text-sm">未找到模型「{id}」。</p>
          <Link href="/models" className="mt-3 inline-block text-sm text-[var(--accent-primary)] hover:underline">
            ← 返回模型广场
          </Link>
        </section>
      </ConsolePage>
    );
  }

  const caps: [string, string, string][] = [
    ["输入模态", market.modalityIn.join(" / "), market.endpoint === "chat" ? "文本可试" : "仅 API"],
    ["输出模态", market.modalityOut.join(" / "), "—"],
    ["思考深度", market.capabilities.thinking ? "支持" : "—", market.id === "deepseek-flash" ? "默认开启" : market.capabilities.thinking ? "可试（档位滑杆）" : "—"],
    ["工具调用 Function Calling", market.capabilities.toolCall ? "✓" : "—", "仅 API"],
    ["联网搜索", market.capabilities.webSearch ? "✓" : "—", "仅 API"],
    ["结构化输出", market.capabilities.structuredOutput ? "✓" : "—", "仅 API"],
    ["上下文缓存", market.capabilities.contextCache ? "✓" : "—", "自动"],
    ["图像理解", market.capabilities.vision ? "✓" : "—", market.capabilities.vision ? "可试（附件上传图片）" : "—"],
    ["FIM 补全", market.capabilities.fim ? "✓（非思考模式）" : "—", "仅 API"],
  ];

  async function copy() {
    const code = tab === "curl" ? snippets.curl : snippets.python;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <ConsolePage phone={me?.phone}>
      <Link href="/models" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-primary)]">
        ← 模型广场
      </Link>

      <div className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={providerLogo(market.provider)}
              alt={providerLabel(market.provider)}
              className="h-5 w-5 object-contain"
            />
            {providerLabel(market.provider)}
          </div>
          <h1 className="mono mt-1 text-2xl font-semibold tracking-tight">{market.id}</h1>
          <div className="mt-2 flex flex-wrap gap-1">
            {market.tags.map((t) => (
              <span key={t} className="rounded-[var(--radius-sm)] bg-[var(--accent-muted)] px-1.5 py-0.5 text-[11px] text-[var(--accent-primary)]">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={market.officialUrl} target="_blank" rel="noreferrer" className="btn btn-ghost px-3 py-1.5 text-[13px]">
            官方文档 ↗
          </a>
          {market.endpoint === "chat" ? (
            <Link href={`/playground?model=${encodeURIComponent(market.id)}`} className="btn px-3 py-1.5 text-[13px]">
              立即体验
            </Link>
          ) : null}
        </div>
      </div>

      <div className="space-y-4">
        <section className="panel p-5">
          <h2 className="text-sm font-medium">模型介绍</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{doc.summary}</p>
          <ul className="mt-3 space-y-1.5 text-sm text-[var(--text-secondary)]">
            {doc.notes.map((n, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[var(--text-tertiary)]">·</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
          {market.versionNote ? (
            <p className="mt-3 text-xs text-[var(--text-tertiary)]">{market.versionNote}</p>
          ) : null}
        </section>

        <section className="panel p-5">
          <h2 className="text-sm font-medium">模型价格</h2>
          {market.pricing.kind === "tokens" ? (
            <>
              {market.peakPricing ? (
                <div className="mt-3 space-y-4">
                  <div>
                    <p className="mb-2 text-xs text-[var(--text-tertiary)]">错峰（空闲）价</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <PriceCard label="输入（缓存未命中）" value={`¥${market.pricing.inputPerM}`} />
                      <PriceCard label="输出" value={`¥${market.pricing.outputPerM}`} />
                      <PriceCard label="输入（缓存命中）" value={`¥${market.pricing.cacheHitPerM}`} />
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs text-[var(--status-warning)]">峰时价（×2）</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <PriceCard
                        label="输入（缓存未命中）"
                        value={`¥${market.pricing.inputPerM * 2}`}
                        tone="warning"
                      />
                      <PriceCard label="输出" value={`¥${market.pricing.outputPerM * 2}`} tone="warning" />
                      <PriceCard
                        label="输入（缓存命中）"
                        value={`¥${market.pricing.cacheHitPerM * 2}`}
                        tone="warning"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <PriceCard label="输入（缓存未命中）" value={`¥${market.pricing.inputPerM}`} />
                  <PriceCard label="输出" value={`¥${market.pricing.outputPerM}`} />
                  <PriceCard label="输入（缓存命中）" value={`¥${market.pricing.cacheHitPerM}`} />
                </div>
              )}
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">单位：人民币 / 百万 token</p>
              {market.peakPricing ? (
                <p className="mt-2 text-xs text-[var(--status-warning)]">{PEAK_PRICING_NOTE}</p>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-sm">{market.pricing.note}</p>
          )}
        </section>

        <section className="panel p-5">
          <h2 className="text-sm font-medium">限流与上下文</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="上下文窗口" value={market.context} />
            <Stat label="最大输出" value={market.maxOutput} />
            {market.concurrency ? <Stat label="并发上限" value={String(market.concurrency)} /> : null}
            {market.rpm ? <Stat label="RPM" value={String(market.rpm)} /> : null}
            {market.tpm ? <Stat label="TPM" value={market.tpm} /> : null}
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="text-sm font-medium">模型能力</h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-xs text-[var(--text-tertiary)]">
                <th className="py-2 pr-4 font-normal">能力</th>
                <th className="py-2 pr-4 font-normal">支持</th>
                <th className="py-2 font-normal">调试台</th>
              </tr>
            </thead>
            <tbody>
              {caps.map(([label, value, console_]) => (
                <tr key={label} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="py-2 pr-4 text-[var(--text-secondary)]">{label}</td>
                  <td className="py-2 pr-4">{value}</td>
                  <td className="py-2 text-[var(--text-tertiary)]">{console_}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">调用示例</h2>
            <div className="flex items-center gap-1">
              {(["curl", "python"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`btn px-2.5 py-1 text-xs ${tab === t ? "" : "btn-ghost"}`}
                  onClick={() => setTab(t)}
                >
                  {t === "curl" ? "cURL" : "Python"}
                </button>
              ))}
              <button type="button" className="btn btn-ghost px-2.5 py-1 text-xs" onClick={() => void copy()}>
                {copied ? "已复制" : "复制"}
              </button>
            </div>
          </div>
          <p className="mono mt-2 text-xs text-[var(--text-tertiary)]">Base URL: {gatewayUrl}</p>
          <pre className="mono mt-2 max-h-[40vh] overflow-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-[13px]">
            {tab === "curl" ? snippets.curl : snippets.python}
          </pre>
        </section>
      </div>
    </ConsolePage>
  );
}

function PriceCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
      <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
      <p
        className={`tabular mt-1 text-xl font-semibold ${
          tone === "warning" ? "text-[var(--status-warning)]" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
      <p className="tabular mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}
