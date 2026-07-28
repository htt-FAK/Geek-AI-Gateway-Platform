"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import {
  AppearanceDensity,
  AppearanceFont,
  AppearanceLayout,
  AppearancePreset,
  AppearanceRadius,
  AppearanceSettings,
  AppearanceSidebar,
  AppearanceTheme,
  applyAppearance,
  DEFAULT_APPEARANCE,
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

const PRESETS: Array<{ id: AppearancePreset; label: string; swatch: string }> = [
  { id: "default", label: "默认", swatch: "linear-gradient(135deg,#fafafa,#71717a)" },
  { id: "night", label: "暗夜", swatch: "linear-gradient(135deg,#111827,#374151)" },
  { id: "rose", label: "玫瑰花园", swatch: "linear-gradient(135deg,#fb7185,#9f1239)" },
  { id: "lake", label: "湖光", swatch: "linear-gradient(135deg,#38bdf8,#0ea5e9)" },
  { id: "sunset", label: "日落霞光", swatch: "linear-gradient(135deg,#fb923c,#ea580c)" },
  { id: "forest", label: "森林低语", swatch: "linear-gradient(135deg,#4ade80,#166534)" },
  { id: "sea", label: "海风", swatch: "linear-gradient(135deg,#2dd4bf,#0f766e)" },
  { id: "lavender", label: "薰衣草梦", swatch: "linear-gradient(135deg,#c084fc,#7e22ce)" },
];

export function ThemeSettingsButton() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);

  useEffect(() => {
    const loaded = loadAppearance();
    setSettings(loaded);
    applyAppearance(loaded);
  }, []);

  function update<K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveAppearance(next);
      applyAppearance(next);
      return next;
    });
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
          <path
            d="M12 3c-1.8 3.2-2.7 5.6-2.7 7.2a2.7 2.7 0 1 0 5.4 0C14.7 8.6 13.8 6.2 12 3Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M7.2 13.8c-1.1.4-2.2 1.3-3.2 2.7 1.9.2 3.3.7 4.3 1.5.7-1.6 1.2-3 1.4-4.1-.8 0-1.7-.1-2.5-.1Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M16.8 13.8c.8 0 1.7.1 2.5.1.2 1.1.7 2.5 1.4 4.1 1-.8 2.4-1.3 4.3-1.5-1-1.4-2.1-2.3-3.2-2.7Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
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
                  调整外观和布局以适应您的偏好。
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
                <h3 className="text-[13px] font-medium text-[var(--text-primary)]">主题</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["system", "系统"],
                      ["light", "浅色"],
                      ["dark", "深色"],
                    ] as Array<[AppearanceTheme, string]>
                  ).map(([id, label]) => (
                    <OptionCard key={id} label={label} selected={settings.theme === id} onClick={() => update("theme", id)}>
                      <span className="h-8 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)]" />
                    </OptionCard>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-[13px] font-medium text-[var(--text-primary)]">颜色预设</h3>
                <div className="grid grid-cols-4 gap-2">
                  {PRESETS.map((p) => (
                    <OptionCard
                      key={p.id}
                      label={p.label}
                      selected={settings.preset === p.id}
                      onClick={() => update("preset", p.id)}
                    >
                      <span className="h-8 w-full rounded-md" style={{ background: p.swatch }} />
                    </OptionCard>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-[13px] font-medium text-[var(--text-primary)]">字体</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["auto", "Auto", "Aa"],
                      ["sans", "Sans", "Aa"],
                      ["serif", "Serif", "Aa"],
                    ] as Array<[AppearanceFont, string, string]>
                  ).map(([id, label, sample]) => (
                    <OptionCard key={id} label={label} selected={settings.font === id} onClick={() => update("font", id)}>
                      <span className={`text-xl ${id === "serif" ? "font-display" : ""}`}>{sample}</span>
                    </OptionCard>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-[13px] font-medium text-[var(--text-primary)]">圆角</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["auto", "Auto"],
                      ["0", "0"],
                      ["0.3", "0.3"],
                      ["0.5", "0.5"],
                      ["0.75", "0.75"],
                      ["1", "1.0"],
                    ] as Array<[AppearanceRadius, string]>
                  ).map(([id, label]) => (
                    <OptionCard key={id} label={label} selected={settings.radius === id} onClick={() => update("radius", id)}>
                      <span
                        className="h-7 w-10 border border-[var(--border-active)] bg-[var(--bg-surface)]"
                        style={{ borderRadius: id === "auto" ? "0.75rem" : `${id}rem` }}
                      />
                    </OptionCard>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-[13px] font-medium text-[var(--text-primary)]">密度</h3>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      ["compact", "紧凑"],
                      ["default", "默认"],
                      ["loose", "宽松"],
                      ["xl", "超大"],
                    ] as Array<[AppearanceDensity, string]>
                  ).map(([id, label]) => (
                    <OptionCard key={id} label={label} selected={settings.density === id} onClick={() => update("density", id)}>
                      <span className="flex h-7 w-8 flex-col justify-center gap-0.5">
                        <span className="h-0.5 rounded-full bg-current" />
                        <span className="h-0.5 rounded-full bg-current opacity-70" />
                        <span className="h-0.5 rounded-full bg-current opacity-40" />
                      </span>
                    </OptionCard>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-[13px] font-medium text-[var(--text-primary)]">侧边栏</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["embedded", "内嵌"],
                      ["floating", "浮动"],
                      ["inset", "侧边栏"],
                    ] as Array<[AppearanceSidebar, string]>
                  ).map(([id, label]) => (
                    <OptionCard
                      key={id}
                      label={label}
                      selected={settings.sidebar === id}
                      onClick={() => update("sidebar", id)}
                    >
                      <span className="flex h-8 w-12 overflow-hidden rounded border border-[var(--border-subtle)]">
                        <span className={`bg-[var(--text-tertiary)] ${id === "floating" ? "m-0.5 w-2 rounded-sm" : "w-2.5"}`} />
                        <span className="flex-1 bg-[var(--bg-surface)]" />
                      </span>
                    </OptionCard>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-[13px] font-medium text-[var(--text-primary)]">布局</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["default", "默认"],
                      ["compact", "紧凑"],
                      ["full", "全屏布局"],
                    ] as Array<[AppearanceLayout, string]>
                  ).map(([id, label]) => (
                    <OptionCard key={id} label={label} selected={settings.layout === id} onClick={() => update("layout", id)}>
                      <span className="h-8 w-12 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)]" />
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
