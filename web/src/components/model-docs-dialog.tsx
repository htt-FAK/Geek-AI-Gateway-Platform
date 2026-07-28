"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMemo, useState } from "react";
import { buildModelCallSnippets, getModelDoc } from "@/lib/model-docs";

type Props = {
  model: string | null;
  gatewayUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ModelDocsDialog({ model, gatewayUrl, open, onOpenChange }: Props) {
  const [tab, setTab] = useState<"curl" | "python">("curl");
  const [copied, setCopied] = useState(false);

  const doc = useMemo(() => (model ? getModelDoc(model) : null), [model]);
  const snippets = useMemo(
    () => (model ? buildModelCallSnippets(model, gatewayUrl) : null),
    [model, gatewayUrl],
  );

  const activeCode = tab === "curl" ? snippets?.curl : snippets?.python;

  async function copy() {
    if (!activeCode) return;
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setTab("curl");
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[50] bg-[var(--overlay-scrim)]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[50] flex max-h-[min(88vh,720px)] w-[min(92vw,640px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 shadow-xl outline-none">
          <Dialog.Title className="text-lg font-medium text-[var(--text-primary)]">
            {model ? `${model} · 文档` : "模型文档"}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-[var(--text-secondary)]">
            经本网关调用的方式，以及官方能力说明。
          </Dialog.Description>

          {doc && snippets ? (
            <div className="mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
              <section className="space-y-2">
                <h3 className="text-[13px] font-medium text-[var(--text-primary)]">官方说明</h3>
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{doc.summary}</p>
                <p className="text-xs text-[var(--text-tertiary)]">模态：{doc.modality}</p>
                <ul className="list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  {doc.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
                <a
                  href={doc.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-[13px] text-[var(--accent-primary)] hover:underline"
                >
                  打开{doc.officialLabel} ↗
                </a>
              </section>

              <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[13px] font-medium text-[var(--text-primary)]">
                    调用示例 · {snippets.label}
                  </h3>
                  <div className="flex gap-1 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] p-0.5 text-[12px]">
                    <button
                      type="button"
                      className={`rounded-[var(--radius-sm)] px-2.5 py-1 ${
                        tab === "curl"
                          ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                          : "text-[var(--text-tertiary)]"
                      }`}
                      onClick={() => setTab("curl")}
                    >
                      cURL
                    </button>
                    <button
                      type="button"
                      className={`rounded-[var(--radius-sm)] px-2.5 py-1 ${
                        tab === "python"
                          ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                          : "text-[var(--text-tertiary)]"
                      }`}
                      onClick={() => setTab("python")}
                    >
                      Python
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-tertiary)]">
                  Base URL：<span className="mono text-[var(--text-secondary)]">{gatewayUrl}</span>
                </p>
                <pre className="mono max-h-[36vh] overflow-auto rounded-[var(--radius-md)] bg-[var(--bg-surface)] p-4 text-xs leading-relaxed text-[var(--text-primary)]">
                  {activeCode}
                </pre>
              </section>
            </div>
          ) : null}

          <div className="mt-4 flex shrink-0 justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
            <button type="button" className="btn btn-ghost" onClick={() => void copy()} disabled={!activeCode}>
              {copied ? "已复制" : "复制"}
            </button>
            <Dialog.Close asChild>
              <button type="button" className="btn">
                关闭
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
