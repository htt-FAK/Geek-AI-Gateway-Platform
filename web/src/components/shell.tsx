"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

const NAV = [
  { href: "/playground", label: "调试台", icon: "/icons/nav-playground.png" },
  { href: "/dashboard", label: "看板", icon: "/icons/nav-dashboard.png" },
  { href: "/models", label: "模型", icon: "/icons/nav-models.png" },
  { href: "/keys", label: "密钥", icon: "/icons/nav-keys.png" },
] as const;

const ENTRY_BACKGROUNDS = [
  "/brand/entry-bg-anime.jpg",
  "/brand/entry-bg.jpg",
] as const;

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
      {/* G */}
      <path
        d="M28.5 8.2C25.1 5.1 20.4 3.4 15.2 3.4 7.2 3.4 1 9.7 1 17.8c0 8.1 6.2 14.4 14.2 14.4 5.4 0 10.1-2.4 12.9-6.2l-4.1-3.1c-1.8 2.3-4.8 3.8-8.2 3.8-5.1 0-8.9-3.9-8.9-8.9s3.8-8.9 8.9-8.9c2.9 0 5.5 1.2 7.1 3.1v3.4h-7.4v5.2H33V16c0-3.1-1.6-5.9-4.5-7.8Z"
        fill="#F3F3F8"
      />
      {/* E */}
      <path d="M40 5.2h18.6v4.8H45.2v5.1h11.8v4.7H45.2v5.4h13.8v4.8H40V5.2Z" fill="#F3F3F8" />
      {/* E */}
      <path d="M66 5.2h18.6v4.8H71.2v5.1h11.8v4.7H71.2v5.4h13.8v4.8H66V5.2Z" fill="#F3F3F8" />
      {/* K */}
      <path
        d="M92 5.2h5.4v12.1l12.8-12.1h6.6L103.2 17.6 117.2 30h-6.7L97.4 18.7V30H92V5.2Z"
        fill="#F3F3F8"
      />
      {/* Accent bar under EE */}
      <rect x="40" y="34.2" width="44.6" height="1.8" rx="0.4" fill="#9EB4D8" opacity="0.85" />
    </svg>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  const docs = process.env.NEXT_PUBLIC_DOCS_BASE_URL;
  const [bgSrc, setBgSrc] = useState<string>(ENTRY_BACKGROUNDS[0]);

  useEffect(() => {
    const i = Math.floor(Math.random() * ENTRY_BACKGROUNDS.length);
    setBgSrc(ENTRY_BACKGROUNDS[i]);
  }, []);

  return (
    <div className="entry-shell relative min-h-screen overflow-hidden bg-[#080814]">
      <div
        className="entry-bg pointer-events-none absolute inset-0 bg-cover bg-[center_30%] bg-no-repeat opacity-[0.88]"
        style={{ backgroundImage: `url(${bgSrc})` }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,20,0.48)_0%,rgba(8,8,20,0.22)_48%,rgba(8,8,20,0.52)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,20,0.28)_0%,rgba(8,8,20,0.08)_36%,rgba(8,8,20,0.22)_72%,rgba(8,8,20,0.58)_100%)]" />
      <div className="entry-stars pointer-events-none absolute inset-0" aria-hidden />

      <header className="relative z-10 flex h-[4.75rem] items-center justify-between px-8 md:px-16 lg:px-20">
        <div className="flex items-center gap-4">
          <GeekWordmark height={32} />
          <span className="hidden text-[13px] font-medium tracking-[0.08em] text-[#A8B0C4] sm:inline">
            高科极客
          </span>
        </div>
        {docs ? (
          <a
            href={docs}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] text-[#A8A8B8] transition-colors hover:text-[#E8E8EC]"
          >
            文档
          </a>
        ) : (
          <span className="text-[13px] text-[#A8A8B8]">文档</span>
        )}
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
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const docs = process.env.NEXT_PUBLIC_DOCS_BASE_URL;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <aside
        className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-base)] transition-[width] duration-200 ease-out ${
          expanded ? "w-60" : "w-16"
        }`}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        <div className="flex h-[52px] items-center gap-2.5 overflow-hidden border-b border-[var(--border-subtle)] px-3">
          {expanded ? (
            <GeekWordmark height={18} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
              <path
                d="M19.2 6.2C17 4.2 14.1 3 10.8 3 5.4 3 1 7.4 1 12.8S5.4 22.6 10.8 22.6c3.5 0 6.6-1.6 8.5-4.1l-2.9-2.1c-1.2 1.5-3.2 2.5-5.4 2.5-3.5 0-6.1-2.7-6.1-6.1S7.3 6.7 10.8 6.7c1.9 0 3.6.8 4.7 2v2.2H10.4v3.4h9.8v-4.2c0-2-1-3.9-3-5.1Z"
                fill="#E8E8EC"
              />
            </svg>
          )}
          {expanded ? (
            <span className="truncate text-[12px] font-medium tracking-tight text-[var(--text-secondary)]">
              高科极客
            </span>
          ) : null}
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                }`}
              >
                {active ? (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[var(--accent-primary)] opacity-60" />
                ) : null}
                <span
                  className={`relative flex h-5 w-5 shrink-0 overflow-hidden rounded-sm ${
                    active ? "opacity-100" : "opacity-60"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.icon} alt="" width={20} height={20} className="object-cover" />
                </span>
                {expanded ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--border-subtle)] p-3 text-[13px] text-[var(--text-tertiary)]">
          {expanded ? <div>v0.1.0</div> : <div className="text-center">v0</div>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-5 md:px-6">
          <div className="text-[13px] font-medium tracking-tight text-[var(--text-secondary)]">
            高科极客 AI 网关平台
          </div>
          <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
            {docs ? (
              <a href={docs} target="_blank" rel="noreferrer" className="hover:text-[var(--text-primary)]">
                文档
              </a>
            ) : null}
            {phone ? <span className="mono text-xs">{phone}</span> : null}
            <button type="button" className="btn btn-ghost py-1.5 text-xs" onClick={() => void logout()}>
              退出
            </button>
          </div>
        </header>
        <main className="page-fade min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
