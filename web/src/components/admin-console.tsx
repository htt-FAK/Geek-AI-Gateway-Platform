"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ConsolePage, useMe } from "@/components/console";

/**
 * 管理台共享骨架：与全站一致的 AppShell（侧边栏 / 顶栏 / 退出），
 * 管理员会话自动放行；非管理员账号可用 Admin Token 临时进入（向后兼容脚本场景）。
 */

const TOKEN_KEY = "admin_token";

export function readStoredAdminToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function storeAdminToken(token: string) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

/** 管理页会话：未登录跳 /login；返回 me（含 role）与加载态。 */
export function useAdminSession() {
  const { me } = useMe();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (me) setReady(true);
  }, [me]);
  return { me, ready, isAdmin: me?.role === "admin" };
}

/** 非管理员的 Token 门：验证通过后才渲染管理内容。 */
export function AdminTokenGate({
  phone,
  onVerified,
}: {
  phone: string;
  onVerified: (token: string) => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        headers: { "x-admin-token": value.trim() },
      });
      if (!res.ok) {
        setError(res.status === 401 ? "Token 无效，请核对后重试" : "验证失败，请稍后重试");
        return;
      }
      storeAdminToken(value.trim());
      onVerified(value.trim());
    } catch {
      setError("网络错误，请重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel mx-auto mt-10 max-w-md space-y-4 p-6">
      <div>
        <h2 className="text-lg font-medium">需要管理员权限</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          当前账号 <span className="mono">{phone}</span> 不是管理员。
          可输入 Admin Token 临时进入，或退出后改用管理员账号登录。
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-sm text-[var(--text-secondary)]">Admin Token</span>
          <input
            className="field"
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="x-admin-token"
            autoFocus
          />
        </label>
        {error ? (
          <p className="text-sm text-[var(--status-error)]" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          <button className="btn" type="submit" disabled={busy || !value.trim()}>
            {busy ? "验证中…" : "验证并进入"}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
          >
            退出并切换账号
          </button>
        </div>
      </form>
    </div>
  );
}

/** 页头：标题 + 副标题 + 右侧「成员管理 / 成员用量」分段切换。 */
export function AdminPageHeader({
  active,
  title,
  subtitle,
  actions,
}: {
  active: "users" | "usage";
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  const tabs = [
    { href: "/admin/users", label: "成员管理", id: "users" as const },
    { href: "/admin/usage", label: "成员用量", id: "usage" as const },
  ];
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        <div className="flex gap-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-0.5">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={t.href}
              className={`rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                active === t.id
                  ? "bg-[var(--accent-muted)] font-medium text-[var(--accent-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 管理台页面骨架：会话门 + Token 门 + 统一容器。authorized 渲染函数拿到有效 token（会话模式为 ""）。 */
export function AdminConsole({
  active,
  title,
  subtitle,
  actions,
  children,
}: {
  active: "users" | "usage";
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: (token: string) => ReactNode;
}) {
  const { me, ready, isAdmin } = useAdminSession();
  const [token, setToken] = useState("");
  const [tokenReady, setTokenReady] = useState(false);

  // 非管理员：尝试沿用 sessionStorage 里的 Token（静默验证一次）
  useEffect(() => {
    if (!ready || isAdmin) return;
    const stored = readStoredAdminToken();
    if (!stored) {
      setTokenReady(true);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/users", { headers: { "x-admin-token": stored } });
        if (!alive) return;
        if (res.ok) setToken(stored);
        else storeAdminToken("");
      } catch {
        if (alive) storeAdminToken("");
      } finally {
        if (alive) setTokenReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [ready, isAdmin]);

  const authorized = isAdmin || (tokenReady && Boolean(token));
  const effectiveToken = isAdmin ? "" : token;

  return (
    <ConsolePage phone={me?.phone}>
      <AdminPageHeader active={active} title={title} subtitle={subtitle} actions={authorized ? actions : undefined} />
      {!ready ? (
        <div className="panel p-8 text-sm text-[var(--text-tertiary)]">加载中…</div>
      ) : authorized ? (
        children(effectiveToken)
      ) : tokenReady ? (
        <AdminTokenGate phone={me?.phone ?? ""} onVerified={(t) => setToken(t)} />
      ) : (
        <div className="panel p-8 text-sm text-[var(--text-tertiary)]">正在验证身份…</div>
      )}
    </ConsolePage>
  );
}

/** 轻量 Toast：操作结果反馈，自动消失。 */
export type ToastMsg = { text: string; kind: "ok" | "err" } | null;

export function useToast() {
  const [toast, setToast] = useState<ToastMsg>(null);
  const timer = useRef<number | null>(null);
  const show = useCallback((text: string, kind: "ok" | "err" = "ok") => {
    setToast({ text, kind });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3600);
  }, []);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  return { toast, show };
}

export function Toast({ toast }: { toast: ToastMsg }) {
  if (!toast) return null;
  const color = toast.kind === "ok" ? "var(--status-success)" : "var(--status-error)";
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm shadow-xl"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      {toast.text}
    </div>
  );
}

/** 危险操作二次确认（禁用 / 重置密码 / 重发卡）。 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "确认",
  danger = false,
  busy = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[50] bg-[var(--overlay-scrim)]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[50] w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 outline-none">
          <Dialog.Title className="text-[15px] font-medium">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {description}
          </Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button type="button" className="btn btn-ghost" disabled={busy}>
                取消
              </button>
            </Dialog.Close>
            <button
              type="button"
              className="btn"
              style={danger ? { background: "var(--status-error)", color: "#fff" } : undefined}
              disabled={busy}
              onClick={onConfirm}
            >
              {busy ? "处理中…" : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** 状态小徽章。 */
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "err" | "accent";
}) {
  const tones: Record<string, { color: string; bg: string }> = {
    neutral: { color: "var(--text-secondary)", bg: "var(--bg-surface)" },
    ok: { color: "var(--status-success)", bg: "color-mix(in srgb, var(--status-success) 12%, transparent)" },
    warn: { color: "var(--status-warning)", bg: "color-mix(in srgb, var(--status-warning) 14%, transparent)" },
    err: { color: "var(--status-error)", bg: "color-mix(in srgb, var(--status-error) 12%, transparent)" },
    accent: { color: "var(--accent-primary)", bg: "var(--accent-muted)" },
  };
  const t = tones[tone];
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4"
      style={{ color: t.color, background: t.bg }}
    >
      {children}
    </span>
  );
}