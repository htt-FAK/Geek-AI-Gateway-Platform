"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import {
  AppearanceSkin,
  SKIN_OPTIONS,
  applyAppearance,
  coerceAppearance,
  loadAppearance,
  saveAppearance,
} from "@/lib/appearance";

export function StyleOnboarding() {
  const [open, setOpen] = useState(false);
  const [skin, setSkin] = useState<AppearanceSkin>("minimal");

  useEffect(() => {
    const s = loadAppearance();
    setSkin(s.skin);
    if (!s.onboarded) {
      setOpen(true);
    }
  }, []);

  function finish(nextSkin: AppearanceSkin) {
    const cur = loadAppearance();
    const next = coerceAppearance({ ...cur, skin: nextSkin, onboarded: true });
    saveAppearance(next);
    applyAppearance(next);
    setSkin(nextSkin);
    setOpen(false);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) finish("minimal");
        else setOpen(true);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-[var(--overlay-scrim)]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 shadow-[var(--panel-shadow,0_16px_48px_rgba(0,0,0,0.35))] outline-none">
          <Dialog.Title className="text-lg font-medium text-[var(--text-primary)]">选择控制台样式</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-[var(--text-secondary)]">
            皮肤会同时切换颜色与字体。可跳过，默认使用 Minimal；之后可在主题设置里更改。
          </Dialog.Description>

          <div className="mt-5 grid max-h-[min(50vh,360px)] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {SKIN_OPTIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSkin(p.id)}
                className={`rounded-[var(--radius-md)] border p-2 text-left transition-colors ${
                  skin === p.id
                    ? "border-[var(--text-primary)] bg-[var(--bg-surface)]"
                    : "border-[var(--border-subtle)] hover:border-[var(--border-active)]"
                }`}
              >
                <span className="block h-10 rounded-md" style={{ background: p.swatch }} />
                <span className="mt-2 block text-xs font-medium text-[var(--text-primary)]">{p.label}</span>
                <span className="mt-0.5 block text-[11px] text-[var(--text-tertiary)]">{p.blurb}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => finish("minimal")}>
              跳过
            </button>
            <button type="button" className="btn" onClick={() => finish(skin)}>
              使用此样式
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
