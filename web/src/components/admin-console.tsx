"use client";

import Link from "next/link";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ConsolePage, useMe } from "@/components/console";

/**
 * 管理台共享骨架：与全站一致的 AppShell（侧边栏 / 顶栏 / 退出）。
 * 浏览器只认 role=admin 的登录会话（requireAdmin 校验密码版本与强制改密）；
 * Admin Token 仅供服务端脚本使用，页面不再输入/存储 Token（sessionStorage 可被 XSS 读取）。
 * 设管理员＝数据库把 User.role 改为 admin，无 UI 入口。
 */

/** 管理页会话：未登录跳 /login；返回 me（含 role）与加载态。 */
export function useAdminSession() {
  const { me } = useMe();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (me) setReady(true);
  }, [me]);
  return { me, ready, isAdmin: me?.role === "admin" };
}

/** 非管理员：无权限面板（不再有 Token 临时通道）。 */
function AdminDenied({ phone }: { phone: string }) {
  return (
    <div className="panel mx-auto mt-10 max-w-md space-y-4 p-6">
      <div>
        <h2 className="text-lg font-medium">需要管理员权限</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          当前账号 <span className="mono">{phone}</span> 不是管理员。
          请退出后改用管理员账号登录（管理员角色由数据库设置）。
        </p>
      </div>
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
      <div className="min-w-0">
        <p className="text-[12px] leading-none text-[var(--text-tertiary)]">管理</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">{subtitle}</p>
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

/** 管理台页面骨架：管理员会话门 + 统一容器。请求靠会话 Cookie 鉴权，不带 Token 头。 */
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
  children: () => ReactNode;
}) {
  const { me, ready, isAdmin } = useAdminSession();

  return (
    <ConsolePage phone={me?.phone}>
      <AdminPageHeader active={active} title={title} subtitle={subtitle} actions={isAdmin ? actions : undefined} />
      {!ready ? (
        <div className="panel space-y-3 p-5" aria-busy="true">
          <p className="sr-only">加载中</p>
          <span className="skeleton block h-4 w-32" aria-hidden />
          <span className="skeleton block h-24 w-full" aria-hidden />
        </div>
      ) : isAdmin ? (
        children()
      ) : (
        <AdminDenied phone={me?.phone ?? ""} />
      )}
    </ConsolePage>
  );
}

/** 轻量 Toast：操作结果反馈，自动消失。 */
export type ToastMsg = { id: number; text: string; kind: "ok" | "err" } | null;

const TOAST_MS = 3600;

export function useToast() {
  const [toast, setToast] = useState<ToastMsg>(null);
  const timer = useRef<number | null>(null);
  const seq = useRef(0);
  const show = useCallback((text: string, kind: "ok" | "err" = "ok") => {
    seq.current += 1;
    setToast({ id: seq.current, text, kind });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  return { toast, show };
}

export function Toast({ toast }: { toast: ToastMsg }) {
  const reduce = useReducedMotion();
  const color = toast?.kind === "ok" ? "var(--status-success)" : "var(--status-error)";
  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          key={toast.id}
          role="status"
          initial={{ opacity: 0, y: reduce ? 0 : 8, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: reduce ? 0 : 8, x: "-50%" }}
          transition={{ duration: reduce ? 0 : 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          className="fixed bottom-6 left-1/2 z-[60] max-w-[min(92vw,420px)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm shadow-xl"
          style={{ borderLeft: `3px solid ${color}` }}
        >
          {toast.text}
          <span aria-hidden className="toast-progress" style={{ color }} />
        </motion.div>
      ) : null}
    </AnimatePresence>
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
        <Dialog.Overlay className="motion-overlay fixed inset-0 z-[50] bg-[var(--overlay-scrim)]" />
        <Dialog.Content className="motion-dialog z-[50] w-[min(92vw,400px)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 outline-none">
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