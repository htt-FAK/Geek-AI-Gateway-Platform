"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorSlide, fieldInvalidClass, useErrorShake } from "@/components/field-error";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { shake, pulse } = useErrorShake();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirm) {
      setError("两次输入的新密码不一致");
      pulse();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "改密失败");
        pulse();
        return;
      }
      router.replace("/playground");
    } catch {
      setError("网络错误");
      pulse();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="panel w-full max-w-md p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-semibold">修改密码</h1>
          <p className="muted mt-1 text-sm">首次登录须修改默认密码后才能使用</p>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm muted">当前密码</span>
          <input
            className={`field ${fieldInvalidClass(Boolean(error), shake)}`}
            type="password"
            value={oldPassword}
            onChange={(e) => {
              setOldPassword(e.target.value);
              setError("");
            }}
            required
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm muted">新密码（至少 8 位）</span>
          <input
            className={`field ${fieldInvalidClass(Boolean(error), shake)}`}
            type="password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setError("");
            }}
            minLength={8}
            required
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm muted">确认新密码</span>
          <input
            className={`field ${fieldInvalidClass(Boolean(error), shake)}`}
            type="password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setError("");
            }}
            minLength={8}
            required
          />
        </label>
        {error ? (
          <ErrorSlide>
            <p className="text-sm text-[var(--status-error)]">{error}</p>
          </ErrorSlide>
        ) : null}
        <button className="btn w-full" type="submit" disabled={loading}>
          {loading ? "提交中…" : "保存并继续"}
        </button>
      </form>
    </main>
  );
}
