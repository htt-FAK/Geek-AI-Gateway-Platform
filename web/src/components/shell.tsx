"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { ThemeSettingsButton } from "@/components/theme-settings";
import { UserMenu } from "@/components/user-menu";
import { EntryAmbient } from "@/components/entry-ambient";

const NAV = [
  { href: "/playground", label: "调试台", icon: "/icons/nav-playground.png" },
  { href: "/dashboard", label: "看板", icon: "/icons/nav-dashboard.png" },
  { href: "/models", label: "模型", icon: "/icons/nav-models.png" },
  { href: "/keys", label: "密钥", icon: "/icons/nav-keys.png" },
] as const;

const GITHUB_REPO = "https://github.com/htt-FAK/Geek-AI-Gateway-Platform";
const SIDEBAR_KEY = "aigw.sidebar.collapsed";

function GitHubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.477 2 2 6.586 2 12.253c0 4.537 2.865 8.387 6.839 9.748.5.094.683-.222.683-.492 0-.243-.01-1.052-.014-1.91-2.782.618-3.369-1.208-3.369-1.208-.454-1.181-1.11-1.496-1.11-1.496-.908-.636.069-.623.069-.623 1.004.072 1.532 1.056 1.532 1.056.892 1.566 2.341 1.114 2.91.852.091-.662.35-1.114.636-1.37-2.22-.259-4.555-1.139-4.555-5.07 0-1.12.39-2.036 1.029-2.754-.103-.26-.447-1.302.098-2.714 0 0 .84-.275 2.75 1.05A9.35 9.35 0 0 1 12 7.12a9.35 9.35 0 0 1 2.504.345c1.909-1.325 2.748-1.05 2.748-1.05.547 1.412.203 2.454.1 2.714.64.718 1.028 1.634 1.028 2.754 0 3.94-2.339 4.808-4.566 5.063.359.317.679.942.679 1.9 0 1.372-.012 2.478-.012 2.815 0 .273.18.592.688.491C19.138 20.637 22 16.787 22 12.253 22 6.586 17.523 2 12 2Z" />
    </svg>
  );
}

function GeekWordmark({ height = 28 }: { height?: number }) {
  const width = Math.round(height * 3.55);
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 142 40"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M28.5 8.2C25.1 5.1 20.4 3.4 15.2 3.4 7.2 3.4 1 9.7 1 17.8c0 8.1 6.2 14.4 14.2 14.4 5.4 0 10.1-2.4 12.9-6.2l-4.1-3.1c-1.8 2.3-4.8 3.8-8.2 3.8-5.1 0-8.9-3.9-8.9-8.9s3.8-8.9 8.9-8.9c2.9 0 5.5 1.2 7.1 3.1v3.4h-7.4v5.2H33V16c0-3.1-1.6-5.9-4.5-7.8Z"
        fill="currentColor"
      />
      <path d="M40 5.2h18.6v4.8H45.2v5.1h11.8v4.7H45.2v5.4h13.8v4.8H40V5.2Z" fill="currentColor" />
      <path d="M66 5.2h18.6v4.8H71.2v5.1h11.8v4.7H71.2v5.4h13.8v4.8H66V5.2Z" fill="currentColor" />
      <path
        d="M92 5.2h5.4v12.1l12.8-12.1h6.6L103.2 17.6 117.2 30h-6.7L97.4 18.7V30H92V5.2Z"
        fill="currentColor"
      />
      <rect x="40" y="34.2" width="44.6" height="1.8" rx="0.4" fill="currentColor" className="opacity-40" />
    </svg>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  const docs = process.env.NEXT_PUBLIC_DOCS_BASE_URL;

  return (
    <div className="entry-shell relative min-h-screen overflow-hidden bg-[var(--bg-base)]">
      <EntryAmbient />

      <header className="relative z-10 flex h-[4.75rem] items-center justify-between px-8 md:px-16 lg:px-20">
        <div className="flex items-center gap-4">
          <GeekWordmark height={30} />
          <span className="hidden text-[13px] font-medium tracking-[0.06em] text-[var(--text-secondary)] sm:inline">
            高科极客
          </span>
        </div>
        <div className="flex items-center gap-4">
          {docs ? (
            <a
              href={docs}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              文档
            </a>
          ) : (
            <span className="text-[13px] text-[var(--text-secondary)]">文档</span>
          )}
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub 仓库"
            title="GitHub"
            className="inline-flex text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <GitHubIcon size={22} />
          </a>
        </div>
      </header>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function AppShell({
  children,
  phone,
}: {
  children: ReactNode;
  phone?: string;
}) {
  const pathname = usePathname();
  const docs = process.env.NEXT_PUBLIC_DOCS_BASE_URL;
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <div className="app-shell flex min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]" data-collapsed={collapsed ? "1" : "0"}>
      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-20 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-elevated)] transition-[width,margin,border-radius,top,bottom,left] duration-200 ease-out ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <div className="flex h-[52px] items-center gap-2 overflow-hidden border-b border-[var(--border-subtle)] px-2">
          <div className={`flex min-w-0 flex-1 items-center gap-2.5 ${collapsed ? "justify-center" : "px-1"}`}>
            {collapsed ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
                <path
                  d="M19.2 6.2C17 4.2 14.1 3 10.8 3 5.4 3 1 7.4 1 12.8S5.4 22.6 10.8 22.6c3.5 0 6.6-1.6 8.5-4.1l-2.9-2.1c-1.2 1.5-3.2 2.5-5.4 2.5-3.5 0-6.1-2.7-6.1-6.1S7.3 6.7 10.8 6.7c1.9 0 3.6.8 4.7 2v2.2H10.4v3.4h9.8v-4.2c0-2-1-3.9-3-5.1Z"
                  fill="currentColor"
                  className="text-[var(--text-primary)]"
                />
              </svg>
            ) : (
              <>
                <GeekWordmark height={18} />
                <span className="truncate text-[12px] font-medium tracking-tight text-[var(--text-secondary)]">
                  高科极客
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
            title={collapsed ? "展开" : "收起"}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              {collapsed ? (
                <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M10 3.5 5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`relative flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm transition-colors ${
                  collapsed ? "justify-center px-0" : ""
                } ${
                  active
                    ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span
                  className={`relative flex h-5 w-5 shrink-0 overflow-hidden rounded-sm ${
                    active ? "opacity-100" : "opacity-60"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.icon} alt="" width={20} height={20} className="object-cover" />
                </span>
                {!collapsed ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--border-subtle)] p-3 text-[13px] text-[var(--text-tertiary)]">
          {collapsed ? <div className="text-center">v0</div> : <div>v0.1.0</div>}
        </div>
      </aside>

      <div className={`app-main flex min-w-0 flex-1 flex-col transition-[margin] duration-200 ease-out ${collapsed ? "ml-16" : "ml-60"}`}>
        <header className="sticky top-0 z-10 flex h-[52px] shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-base)] px-5 md:px-6">
          <div className="text-[13px] font-medium tracking-tight text-[var(--text-secondary)]">
            高科极客 AI 网关平台
          </div>
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            {docs ? (
              <a href={docs} target="_blank" rel="noreferrer" className="hover:text-[var(--text-primary)]">
                文档
              </a>
            ) : null}
            <ThemeSettingsButton />
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub 仓库"
              title="GitHub"
              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
            >
              <GitHubIcon size={20} />
            </a>
            {phone ? <UserMenu phone={phone} /> : null}
          </div>
        </header>
        <main className="page-fade app-content min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
