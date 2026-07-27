"use client";

import Link from "next/link";
import { ConsolePage, useMe } from "@/components/console";

function providerOf(model: string): "deepseek" | "mimo" | "other" {
  if (model.toLowerCase().includes("deepseek")) return "deepseek";
  if (model.toLowerCase().includes("mimo")) return "mimo";
  return "other";
}

function hint(model: string): string {
  if (model.includes("flash")) return "更快、更省的文本模型 · 上下文视上游";
  if (model.includes("pro") && model.includes("ultraspeed")) return "文本旗舰 · 更高速度档";
  if (model.includes("pro")) return "文本旗舰";
  if (model.includes("asr")) return "语音识别";
  if (model.includes("tts")) return "语音合成";
  if (model === "mimo-v2.5") return "全模态";
  return "网关已挂载能力";
}

export default function ModelsPage() {
  const { me } = useMe();
  const models = me?.models ?? [];

  return (
    <ConsolePage phone={me?.phone}>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">模型</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">当前网关已挂上的上游能力</p>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">
          {models.length ? `已接入 ${models.length} 个模型` : "加载中…"}
        </p>
      </div>

      <ul className="space-y-2">
        {models.map((model) => {
          const p = providerOf(model);
          const color =
            p === "deepseek"
              ? "var(--brand-deepseek)"
              : p === "mimo"
                ? "var(--brand-mimo)"
                : "var(--text-tertiary)";
          return (
            <li
              key={model}
              className="group panel flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:border-[var(--border-active)]"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                <div className="min-w-0">
                  <div className="mono truncate text-sm font-medium">{model}</div>
                  <div className="mt-0.5 text-xs text-[var(--text-secondary)]">{hint(model)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                <span className="text-xs text-[var(--status-success)]">正常</span>
                <Link
                  href={`/playground?model=${encodeURIComponent(model)}`}
                  className="text-xs text-[var(--accent-primary)] hover:underline"
                >
                  在调试台试用
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </ConsolePage>
  );
}
