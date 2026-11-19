"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AdminConsole,
  Badge,
  ConfirmDialog,
  Toast,
  useToast,
} from "@/components/admin-console";
import { KeyRevealDialog } from "@/components/key-reveal-dialog";

type AdminUser = {
  phone: string;
  name?: string | null;
  disabled: boolean;
  role: string;
  mustChangePassword: boolean;
  keyMode: "virtual_key" | "app_enforced" | "none";
  balanceGrantedCny: number;
  balanceUnlimited: boolean;
  createdAt: string;
  updatedAt: string;
};

type ImportResult = {
  created: string[];
  skipped: string[];
  renamed?: string[];
  errors: Array<{ phone: string; error: string }>;
};

type PendingAction =
  | { kind: "unlimited"; user: AdminUser }
  | { kind: "disable"; user: AdminUser }
  | { kind: "reset-password"; user: AdminUser }
  | { kind: "reissue-key"; user: AdminUser };

const KEY_MODE_LABEL: Record<AdminUser["keyMode"], string> = {
  virtual_key: "虚拟 Key",
  app_enforced: "应用托管",
  none: "未创建",
};

export default function AdminUsersPage() {
  return (
    <AdminConsole
      active="users"
      title="成员管理"
      subtitle="账号导入 · 充值与预算 · 禁用与密钥运维"
    >
      {(token) => <UsersConsole token={token} />}
    </AdminConsole>
  );
}

function UsersConsole({ token }: { token: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [search, setSearch] = useState("");
  const { toast, show } = useToast();

  // 导入对话框
  const [importOpen, setImportOpen] = useState(false);
  const [phonesText, setPhonesText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // 充值对话框
  const [topupUser, setTopupUser] = useState<AdminUser | null>(null);
  const [topupAmount, setTopupAmount] = useState("50");
  const [topupNote, setTopupNote] = useState("");
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupError, setTopupError] = useState("");

  // 危险操作确认
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // 重发卡后的明文密钥（仅此次可见）
  const [reissuedKey, setReissuedKey] = useState<string | null>(null);

  // 任一操作进行中时，锁住行内按钮防重复提交
  const busy = confirmBusy || topupBusy || importBusy;

  const headers = useMemo(
    () => ({ "Content-Type": "application/json", "x-admin-token": token }),
    [token],
  );

  const loadUsers = useCallback(async () => {
    setListError("");
    try {
      const res = await fetch("/api/admin/users", { headers: { "x-admin-token": token } });
      const data = await res.json();
      if (!res.ok) {
        setListError(data.error ?? "加载失败");
        setUsers([]);
        return;
      }
      setUsers(data.users ?? []);
    } catch {
      setListError("网络错误，加载失败");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function api(path: string, body: Record<string, unknown>) {
    const res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "操作失败");
    return data;
  }

  async function onImport(e: FormEvent) {
    e.preventDefault();
    setImportError("");
    setImportResult(null);
    // 每行「手机号」或「手机号 姓名 / 手机号,姓名」
    const contacts = phonesText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[\s,;]+/).filter(Boolean);
        return { phone: parts[0], name: parts.slice(1).join(" ") || undefined };
      })
      .filter((c) => c.phone);
    if (contacts.length === 0) {
      setImportError("请至少填写一个手机号");
      return;
    }
    setImportBusy(true);
    try {
      const data = (await api("/api/admin/users/import", { contacts })) as ImportResult;
      setImportResult(data);
      await loadUsers();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "导入失败");
    } finally {
      setImportBusy(false);
    }
  }

  async function onTopup(e: FormEvent) {
    e.preventDefault();
    if (!topupUser) return;
    const n = Number(topupAmount);
    if (!Number.isFinite(n) || n <= 0) {
      setTopupError("充值金额需为正数");
      return;
    }
    setTopupBusy(true);
    setTopupError("");
    try {
      await api("/api/admin/users/topup", {
        phone: topupUser.phone,
        amountCny: n,
        note: topupNote.trim() || undefined,
      });
      show(`已充值 ¥${n} → ${topupUser.phone}`);
      setTopupUser(null);
      await loadUsers();
    } catch (err) {
      setTopupError(err instanceof Error ? err.message : "充值失败");
    } finally {
      setTopupBusy(false);
    }
  }

  async function onConfirm() {
    if (!pending) return;
    const { kind, user } = pending;
    setConfirmBusy(true);
    try {
      if (kind === "unlimited") {
        const next = !user.balanceUnlimited;
        await api("/api/admin/users/topup", { phone: user.phone, unlimited: next });
        show(next ? `已设为不限额 ${user.phone}` : `已取消不限额 ${user.phone}`);
      } else if (kind === "disable") {
        const next = !user.disabled;
        await api("/api/admin/users/disable", { phone: user.phone, disabled: next });
        show(next ? `已禁用 ${user.phone}` : `已启用 ${user.phone}`);
      } else if (kind === "reset-password") {
        await api("/api/admin/users/reset-password", { phone: user.phone });
        show(`已重置密码 ${user.phone}（初始密码，首登需改密）`);
      } else {
        const data = await api("/api/admin/users/reissue-key", { phone: user.phone });
        if (data.key) {
          setReissuedKey(data.key);
        } else {
          show(`已重发卡 ${user.phone}（应用托管模式）`);
        }
      }
      setPending(null);
      await loadUsers();
    } catch (err) {
      show(err instanceof Error ? err.message : "操作失败", "err");
      setPending(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return users;
    return users.filter((u) => u.phone.includes(q) || (u.name ?? "").includes(q));
  }, [users, search]);

  const stats = useMemo(() => {
    const disabled = users.filter((u) => u.disabled).length;
    const unlimited = users.filter((u) => u.balanceUnlimited).length;
    const noKey = users.filter((u) => u.keyMode === "none").length;
    return { total: users.length, active: users.length - disabled, disabled, unlimited, noKey };
  }, [users]);

  const confirmMeta = pending ? buildConfirmMeta(pending) : null;

  return (
    <div className="space-y-5">
      {/* 概览 + 工具条 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-secondary)]">
          <span>
            共 <span className="tabular font-medium text-[var(--text-primary)]">{stats.total}</span> 人
          </span>
          <span aria-hidden>·</span>
          <span>
            正常 <span className="tabular">{stats.active}</span>
          </span>
          {stats.disabled > 0 ? (
            <>
              <span aria-hidden>·</span>
              <span>
                禁用 <span className="tabular text-[var(--status-error)]">{stats.disabled}</span>
              </span>
            </>
          ) : null}
          {stats.unlimited > 0 ? (
            <>
              <span aria-hidden>·</span>
              <span>
                不限额 <span className="tabular">{stats.unlimited}</span>
              </span>
            </>
          ) : null}
          {stats.noKey > 0 ? (
            <>
              <span aria-hidden>·</span>
              <span>
                未建 Key <span className="tabular">{stats.noKey}</span>
              </span>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="field w-48 py-1.5 text-[13px]"
            placeholder="搜索手机号"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-ghost py-1.5 text-[13px]"
            onClick={() => void loadUsers()}
            disabled={loading}
          >
            刷新
          </button>
          <button
            type="button"
            className="btn py-1.5 text-[13px]"
            onClick={() => {
              setImportResult(null);
              setImportError("");
              setImportOpen(true);
            }}
          >
            导入成员
          </button>
        </div>
      </div>

      {/* 成员表 */}
      <section className="panel overflow-hidden">
        {listError ? (
          <p className="px-4 py-3 text-sm text-[var(--status-error)]" role="alert">
            {listError}
          </p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[13px] text-[var(--text-tertiary)]">
              <tr>
                <th className="px-4 py-3 font-normal">手机号</th>
                <th className="px-4 py-3 font-normal">姓名</th>
                <th className="px-4 py-3 font-normal">状态</th>
                <th className="px-4 py-3 font-normal">密钥</th>
                <th className="px-4 py-3 font-normal">累计充值</th>
                <th className="px-4 py-3 font-normal">注册时间</th>
                <th className="px-4 py-3 font-normal">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[var(--text-tertiary)]">
                    加载中…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[var(--text-tertiary)]">
                    {users.length === 0 ? "暂无成员，点右上角「导入成员」开始" : "没有匹配的手机号"}
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.phone} className="border-t border-[var(--border-subtle)]">
                    <td className="mono px-4 py-3">{u.phone}</td>
                    <td className="px-4 py-3">{u.name ?? <span className="text-[var(--text-tertiary)]">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {u.disabled ? <Badge tone="err">已禁用</Badge> : <Badge tone="ok">正常</Badge>}
                        {u.role === "admin" ? <Badge tone="accent">管理员</Badge> : null}
                        {u.mustChangePassword ? <Badge tone="warn">待改密</Badge> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[var(--text-secondary)]">
                      {KEY_MODE_LABEL[u.keyMode]}
                    </td>
                    <td className="tabular whitespace-nowrap px-4 py-3">
                      ¥{u.balanceGrantedCny.toFixed(2)}
                      {u.balanceUnlimited ? (
                        <span className="ml-1.5 align-middle">
                          <Badge tone="accent">不限额</Badge>
                        </span>
                      ) : null}
                    </td>
                    <td className="tabular whitespace-nowrap px-4 py-3 text-[13px] text-[var(--text-tertiary)]">
                      {u.createdAt.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <RowBtn
                          label="充值"
                          disabled={busy}
                          onClick={() => {
                            setTopupUser(u);
                            setTopupAmount("50");
                            setTopupNote("");
                            setTopupError("");
                          }}
                        />
                        <RowBtn
                          label={u.balanceUnlimited ? "取消不限额" : "不限额"}
                          disabled={busy}
                          onClick={() => setPending({ kind: "unlimited", user: u })}
                        />
                        <RowBtn
                          label={u.disabled ? "启用" : "禁用"}
                          disabled={busy}
                          onClick={() => setPending({ kind: "disable", user: u })}
                        />
                        <RowBtn
                          label="重置密码"
                          disabled={busy}
                          onClick={() => setPending({ kind: "reset-password", user: u })}
                        />
                        <RowBtn
                          label="重发卡"
                          disabled={busy}
                          onClick={() => setPending({ kind: "reissue-key", user: u })}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 导入成员 */}
      <Dialog.Root open={importOpen} onOpenChange={setImportOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[50] bg-[var(--overlay-scrim)]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[50] max-h-[85vh] w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 outline-none">
            <Dialog.Title className="text-[15px] font-medium">导入成员</Dialog.Title>
            <Dialog.Description className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
              每行一个手机号（也可用逗号 / 空格分隔）。将创建账号并设初始密码（首次登录强制改密），初始余额
              ¥0；密钥由成员登录后在「密钥」页自行创建。
            </Dialog.Description>
            <form onSubmit={onImport} className="mt-4 space-y-3">
              <textarea
                className="field mono min-h-[120px] text-sm"
                value={phonesText}
                onChange={(e) => setPhonesText(e.target.value)}
                placeholder={"13800138000\n13900139000"}
                autoFocus
              />
              {importError ? (
                <p className="text-sm text-[var(--status-error)]" role="alert">
                  {importError}
                </p>
              ) : null}
              {importResult ? (
                <div className="space-y-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-[13px]">
                  <p>
                    <span className="text-[var(--status-success)]">新建 {importResult.created.length}</span>
                    <span className="mx-1.5 text-[var(--text-tertiary)]">·</span>
                    <span className="text-[var(--text-secondary)]">已存在跳过 {importResult.skipped.length}</span>
                    <span className="mx-1.5 text-[var(--text-tertiary)]">·</span>
                    <span className={importResult.errors.length > 0 ? "text-[var(--status-error)]" : "text-[var(--text-secondary)]"}>
                      失败 {importResult.errors.length}
                    </span>
                  </p>
                  {importResult.created.length > 0 ? (
                    <p className="mono break-all text-[12px] text-[var(--text-tertiary)]">
                      新建：{importResult.created.join("、")}
                    </p>
                  ) : null}
                  {importResult.errors.map((er) => (
                    <p key={er.phone} className="text-[12px] text-[var(--status-error)]">
                      <span className="mono">{er.phone}</span>：{er.error}
                    </p>
                  ))}
                </div>
              ) : null}
              <div className="flex justify-end gap-2 pt-1">
                <Dialog.Close asChild>
                  <button type="button" className="btn btn-ghost">
                    {importResult ? "完成" : "取消"}
                  </button>
                </Dialog.Close>
                <button className="btn" type="submit" disabled={importBusy}>
                  {importBusy ? "导入中…" : "导入"}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* 充值 */}
      <Dialog.Root open={topupUser !== null} onOpenChange={(o) => !o && setTopupUser(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[50] bg-[var(--overlay-scrim)]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[50] w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 outline-none">
            <Dialog.Title className="text-[15px] font-medium">
              充值 · <span className="mono">{topupUser?.phone}</span>
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-[13px] text-[var(--text-secondary)]">
              当前累计充值 ¥{(topupUser?.balanceGrantedCny ?? 0).toFixed(2)}
              {topupUser?.balanceUnlimited ? "（不限额）" : ""}。充值实时同步网关预算。
            </Dialog.Description>
            <form onSubmit={onTopup} className="mt-4 space-y-3">
              <label className="block space-y-1.5">
                <span className="text-[13px] text-[var(--text-secondary)]">金额（¥）</span>
                <input
                  className="field tabular"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  autoFocus
                />
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[10, 50, 100, 200, 500].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
                      Number(topupAmount) === n
                        ? "border-[var(--border-focus)] bg-[var(--accent-muted)] text-[var(--accent-primary)]"
                        : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                    onClick={() => setTopupAmount(String(n))}
                  >
                    ¥{n}
                  </button>
                ))}
              </div>
              <label className="block space-y-1.5">
                <span className="text-[13px] text-[var(--text-secondary)]">备注（可选）</span>
                <input
                  className="field"
                  value={topupNote}
                  onChange={(e) => setTopupNote(e.target.value)}
                  maxLength={200}
                  placeholder="如：11 月活动赠送"
                />
              </label>
              {topupError ? (
                <p className="text-sm text-[var(--status-error)]" role="alert">
                  {topupError}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-1">
                <Dialog.Close asChild>
                  <button type="button" className="btn btn-ghost" disabled={topupBusy}>
                    取消
                  </button>
                </Dialog.Close>
                <button className="btn" type="submit" disabled={topupBusy}>
                  {topupBusy ? "充值中…" : "确认充值"}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* 危险操作确认 */}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && !confirmBusy && setPending(null)}
        title={confirmMeta?.title ?? ""}
        description={confirmMeta?.description ?? ""}
        confirmLabel={confirmMeta?.confirmLabel}
        danger={confirmMeta?.danger}
        busy={confirmBusy}
        onConfirm={() => void onConfirm()}
      />

      {/* 重发卡：明文密钥仅此次可见 */}
      <KeyRevealDialog
        open={reissuedKey !== null}
        onOpenChange={(o) => !o && setReissuedKey(null)}
        apiKey={reissuedKey}
        title="新密钥已签发"
        description="旧密钥已吊销。请立即复制并转交给该成员——关闭后管理端与用户端都无法再看明文。"
      />

      <Toast toast={toast} />
    </div>
  );
}

function RowBtn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="whitespace-nowrap rounded-md border border-[var(--border-subtle)] px-2 py-1 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function buildConfirmMeta(p: PendingAction): {
  title: string;
  description: string;
  confirmLabel: string;
  danger: boolean;
} {
  const phone = p.user.phone;
  switch (p.kind) {
    case "unlimited":
      return p.user.balanceUnlimited
        ? {
            title: `取消不限额 · ${phone}`,
            description: "取消后该账号恢复余额约束：累计充值减去已消费即为可用额度，网关预算同步收紧。",
            confirmLabel: "取消不限额",
            danger: false,
          }
        : {
            title: `设为不限额 · ${phone}`,
            description: "设为不限额后，该账号消费不再受余额限制（网关预算放开）。请确认是内部 / 演示账号。",
            confirmLabel: "设为不限额",
            danger: true,
          };
    case "disable":
      return p.user.disabled
        ? {
            title: `启用账号 · ${phone}`,
            description: "启用后网关 Key 解封，并按当前余额恢复预算，账号可正常调用。",
            confirmLabel: "启用",
            danger: false,
          }
        : {
            title: `禁用账号 · ${phone}`,
            description: "禁用后该账号所有 Key 立即在网关封禁，无法继续调用；余额与数据保留，可随时启用。",
            confirmLabel: "禁用",
            danger: true,
          };
    case "reset-password":
      return {
        title: `重置密码 · ${phone}`,
        description: "密码将重置为系统初始密码，该成员下次登录会被强制改密；已登录会话随密码版本失效。",
        confirmLabel: "重置密码",
        danger: true,
      };
    case "reissue-key":
      return {
        title: `重发卡 · ${phone}`,
        description: "旧密钥将被吊销并立即失效，新密钥明文只显示这一次（请及时复制转交）。余额不受影响。",
        confirmLabel: "重发卡",
        danger: true,
      };
  }
}