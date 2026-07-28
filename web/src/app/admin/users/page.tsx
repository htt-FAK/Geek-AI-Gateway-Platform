"use client";

import { FormEvent, useCallback, useState } from "react";

type AdminUser = {
  phone: string;
  disabled: boolean;
  mustChangePassword: boolean;
  keyMode: "virtual_key" | "app_enforced" | "none";
  createdAt: string;
  updatedAt: string;
};

export default function AdminUsersPage() {
  const [adminToken, setAdminToken] = useState("");
  const [phonesText, setPhonesText] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [listError, setListError] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  const loadUsers = useCallback(async (token: string) => {
    setListError("");
    const res = await fetch("/api/admin/users", {
      headers: { "x-admin-token": token },
    });
    const data = await res.json();
    if (!res.ok) {
      setListError(data.error ?? "加载失败");
      setUsers([]);
      return;
    }
    setUsers(data.users ?? []);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setResult("");
    setLoading(true);
    const phones = phonesText
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const res = await fetch("/api/admin/users/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({ phones }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "导入失败");
        return;
      }
      setResult(JSON.stringify(data, null, 2));
      await loadUsers(adminToken);
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  async function runAction(
    path: string,
    body: Record<string, unknown>,
    okText: string,
  ) {
    if (!adminToken) {
      setActionMsg("请先填写 Admin Token");
      return;
    }
    setActionMsg("");
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": adminToken,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setActionMsg(data.error ?? "操作失败");
      return;
    }
    setActionMsg(okText);
    await loadUsers(adminToken);
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 bg-[var(--bg-base)] px-6 py-8 text-[var(--text-primary)]">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">用户管理</h1>
        <a href="/admin/usage" className="text-sm text-[var(--accent-primary)] hover:underline">
          全员用量
        </a>
      </div>
      <form onSubmit={onSubmit} className="panel space-y-4 p-6">
        <div>
          <h2 className="text-lg font-medium">导入用户</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            每行一个手机号。将创建账号、默认密码，并尝试签发 Virtual Key（日 ¥50 / 周 ¥200 / 月 ¥400）。
          </p>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm muted">Admin Token</span>
          <input
            className="field"
            type="password"
            value={adminToken}
            onChange={(e) => setAdminToken(e.target.value)}
            required
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm muted">手机号列表</span>
          <textarea
            className="field min-h-[120px] mono text-sm"
            value={phonesText}
            onChange={(e) => setPhonesText(e.target.value)}
            placeholder={"13800138000\n13900139000"}
            required
          />
        </label>
        {error ? (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        ) : null}
        <div className="flex gap-2 flex-wrap">
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "导入中…" : "导入并发卡"}
          </button>
          <button
            className="btn"
            type="button"
            disabled={!adminToken}
            onClick={() => loadUsers(adminToken)}
          >
            刷新用户列表
          </button>
        </div>
        {result ? (
          <pre className="mono text-xs overflow-auto p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--input)]">
            {result}
          </pre>
        ) : null}
      </form>

      <section className="panel p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">用户管理</h2>
          <p className="muted text-sm mt-1">禁用 / 重置密码 / 重发卡（需 Admin Token）</p>
        </div>
        {listError ? (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {listError}
          </p>
        ) : null}
        {actionMsg ? <p className="text-sm muted">{actionMsg}</p> : null}
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left muted border-b border-[var(--border)]">
                <th className="py-2 pr-3">手机号</th>
                <th className="py-2 pr-3">状态</th>
                <th className="py-2 pr-3">Key</th>
                <th className="py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 muted">
                    暂无数据，填写 Token 后点「刷新用户列表」
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.phone} className="border-b border-[var(--border)]">
                    <td className="py-2 pr-3 mono">{u.phone}</td>
                    <td className="py-2 pr-3">
                      {u.disabled ? "已禁用" : "正常"}
                      {u.mustChangePassword ? " · 待改密" : ""}
                    </td>
                    <td className="py-2 pr-3 mono">{u.keyMode}</td>
                    <td className="py-2 space-x-2 whitespace-nowrap">
                      <button
                        className="btn"
                        type="button"
                        onClick={() =>
                          runAction(
                            "/api/admin/users/disable",
                            { phone: u.phone, disabled: !u.disabled },
                            u.disabled ? `已启用 ${u.phone}` : `已禁用 ${u.phone}`,
                          )
                        }
                      >
                        {u.disabled ? "启用" : "禁用"}
                      </button>
                      <button
                        className="btn"
                        type="button"
                        onClick={() =>
                          runAction(
                            "/api/admin/users/reset-password",
                            { phone: u.phone },
                            `已重置密码 ${u.phone}`,
                          )
                        }
                      >
                        重置密码
                      </button>
                      <button
                        className="btn"
                        type="button"
                        onClick={() =>
                          runAction(
                            "/api/admin/users/reissue-key",
                            { phone: u.phone },
                            `已重发卡 ${u.phone}`,
                          )
                        }
                      >
                        重发卡
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
