"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";
import {
  AppearanceSettings,
  AppearanceSkin,
  AppearanceTheme,
  DEFAULT_APPEARANCE,
  SKIN_OPTIONS,
  applyAppearance,
  coerceAppearance,
  getSkinThemePolicy,
  loadAppearance,
  saveAppearance,
} from "@/lib/appearance";

type OptionCardProps = {
  selected: boolean;
  onClick: () => void;
  label: string;
  children?: React.ReactNode;
  className?: string;
};

function OptionCard({ selected, onClick, label, children, className = "" }: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-1.5 rounded-[var(--radius-md)] border px-2 py-2.5 text-[12px] transition-colors ${
        selected
          ? "border-[var(--text-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
          : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-active)]"
      } ${className}`}
    >
      {selected ? (
        <span className="absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--text-primary)] text-[9px] text-[var(--text-inverse)]">
          ✓
        </span>
      ) : null}
      {children}
      <span>{label}</span>
    </button>
  );
}

const THEME_LABELS: Record<AppearanceTheme, string> = {
  system: "系统",
  light: "浅色",
  dark: "深色",
};

export function ThemeSettingsButton() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);

  useEffect(() => {
    const loaded = loadAppearance();
    setSettings(loaded);
    applyAppearance(loaded);
  }, []);

  const themeModes = useMemo(
    () => getSkinThemePolicy(settings.skin).modes,
    [settings.skin],
  );

  function commit(next: AppearanceSettings) {
    const coerced = coerceAppearance(next);
    saveAppearance(coerced);
    applyAppearance(coerced);
    setSettings(coerced);
  }

  function updateSkin(skin: AppearanceSkin) {
    commit({ ...settings, skin });
  }

  function updateTheme(theme: AppearanceTheme) {
    commit({ ...settings, theme });
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
        aria-label="主题设置"
        title="主题设置"
        onClick={() => setOpen(true)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          {/* 调色板：主题/皮肤设置 */}
          <path
            d="M12 3.5c-4.7 0-8.5 3.6-8.5 8.1 0 3.3 2.1 6.1 5.1 7.3.4.2.8-.1.8-.5v-.7c0-1.4 1.1-2.5 2.5-2.5h2.1c2.8 0 5.1-2.2 5.1-4.9C19.1 6.5 15.9 3.5 12 3.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="8.2" cy="10.2" r="1.15" fill="currentColor" />
          <circle cx="12" cy="8.4" r="1.15" fill="currentColor" />
          <circle cx="15.8" cy="10.2" r="1.15" fill="currentColor" />
          <circle cx="14.2" cy="13.6" r="1.15" fill="currentColor" />
        </svg>
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[50] bg-[var(--overlay-scrim)]" />
          <Dialog.Content className="fixed right-0 top-0 z-[50] flex h-full w-[min(100vw,420px)] flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-2xl outline-none">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
              <div>
                <Dialog.Title className="text-[16px] font-medium text-[var(--text-primary)]">主题设置</Dialog.Title>
                <Dialog.Description className="mt-1 text-[13px] text-[var(--text-secondary)]">
                  整套前端气质切换（按钮、侧栏、面板、字体）；布局结构不变。
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                  aria-label="关闭"
                >
                  ×
                </button>
              </Dialog.Close>
            </div>

            <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-5">
              <section className="space-y-3">
                <h3 className="text-[13px] font-medium text-[var(--text-primary)]">皮肤</h3>
                <div className="grid grid-cols-2 gap-2">
                  {SKIN_OPTIONS.map((p) => (
                    <OptionCard
                      key={p.id}
                      label={p.label}
                      selected={settings.skin === p.id}
                      onClick={() => updateSkin(p.id)}
                      className="items-stretch text-left"
                    >
                      <span className="h-10 w-full rounded-md" style={{ background: p.swatch }} />
                      <span className="w-full text-[11px] text-[var(--text-tertiary)]">{p.blurb}</span>
                    </OptionCard>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-[13px] font-medium text-[var(--text-primary)]">明暗</h3>
                {themeModes.length === 1 ? (
                  <p className="text-[12px] text-[var(--text-tertiary)]">此皮肤仅支持浅色模式。</p>
                ) : null}
                <div className={`grid gap-2 ${themeModes.length === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
                  {themeModes.map((id) => (
                    <OptionCard
                      key={id}
                      label={THEME_LABELS[id]}
                      selected={settings.theme === id}
                      onClick={() => updateTheme(id)}
                    >
                      <span className="h-8 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)]" />
                    </OptionCard>
                  ))}
                </div>
              </section>
            </div>

            <div className="border-t border-[var(--border-subtle)] px-5 py-3">
              <button
                type="button"
                className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  window.location.href = "/login";
                }}
              >
                退出登录
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
