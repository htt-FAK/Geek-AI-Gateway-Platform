"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

export function KeyRevealDialog({
  open,
  onOpenChange,
  apiKey,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiKey: string | null;
  title: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[50] bg-[var(--overlay-scrim)]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[50] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 shadow-[var(--panel-shadow,0_8px_24px_rgba(0,0,0,0.35))]">
          <Dialog.Title className="text-lg font-medium">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-[var(--status-warning)]">
            请立即复制并妥善保存。关闭后列表默认仍以星号隐藏中间；可用「显示 / 复制」再次取用。
          </Dialog.Description>
          <pre className="mono mt-4 break-all rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-sm">
            {apiKey}
          </pre>
          <div className="mt-5 flex justify-end gap-2">
            <CopyButton apiKey={apiKey} />
            <Dialog.Close asChild>
              <button type="button" className="btn">
                我已保存
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CopyButton({ apiKey }: { apiKey: string | null }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" className="btn btn-ghost" onClick={() => void copy()}>
      {copied ? "已复制" : "复制"}
    </button>
  );
}
