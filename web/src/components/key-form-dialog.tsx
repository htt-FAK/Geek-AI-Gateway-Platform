"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ErrorSlide, fieldInvalidClass, useErrorShake } from "@/components/field-error";

export type KeyRow = {
  token: string;
  keyName: string;
  hasLocalCopy: boolean;
  keyAlias: string | null;
  userId: string | null;
  models: string[];
  maxBudget: number | null;
  spend: number;
  budgetDuration: string | null;
  expires: string | null;
  allowedIps: string[];
  createdAt: string | null;
  blocked: boolean;
  isPrimary: boolean;
};

/** 阿里云百炼式 API Key 创建 / 编辑表单。 */
export function KeyFormDialog({
  open,
  onOpenChange,
  chatModels,
  editing,
  onCreated,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatModels: string[];
  editing: KeyRow | null;
  onCreated: (key: string, keyName: string) => void;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState("");
  const [expiryMode, setExpiryMode] = useState<"forever" | "custom">("forever");
  const [days, setDays] = useState("30");
  const [permMode, setPermMode] = useState<"all" | "custom">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const { shake, pulse } = useErrorShake();

  function fail(text: string) {
    setMsg(text);
    pulse();
  }

  useEffect(() => {
    if (!open) return;
    setMsg("");
    if (editing) {
      setDescription(editing.keyAlias ?? "");
      if (editing.expires) {
        const remain = Math.max(1, Math.ceil((new Date(editing.expires).getTime() - Date.now()) / 86400000));
        setExpiryMode("custom");
        setDays(String(remain));
      } else {
        setExpiryMode("forever");
        setDays("30");
      }
      const isAll = chatModels.every((m) => editing.models.includes(m));
      setPermMode(isAll ? "all" : "custom");
      setSelected(editing.models.filter((m) => chatModels.includes(m)));
    } else {
      setDescription("");
      setExpiryMode("forever");
      setDays("30");
      setPermMode("all");
      setSelected([]);
    }
  }, [open, editing, chatModels]);

  function toggleModel(m: string) {
    setSelected((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]));
  }

  async function submit() {
    setBusy(true);
    setMsg("");
    try {
      const models = permMode === "all" ? chatModels : selected;
      if (models.length === 0) {
        fail("请至少选择一个模型");
        return;
      }
      const body: Record<string, unknown> = {
        description: description.trim() || undefined,
        models,
        expiresInDays: expiryMode === "custom" ? Number(days) : null,
      };
      if (expiryMode === "custom" && (!Number.isFinite(Number(days)) || Number(days) < 1)) {
        fail("有效天数需为正整数");
        return;
      }
      const url = editing ? `/api/keys/${encodeURIComponent(editing.token)}` : "/api/keys";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { key?: string; keyName?: string; error?: string };
      if (!res.ok) {
        fail(data.error ?? "保存失败");
        return;
      }
      if (!editing && data.key) {
        onCreated(data.key, data.keyName ?? "");
      } else {
        onSaved();
      }
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="motion-overlay fixed inset-0 z-[50] bg-[var(--overlay-scrim)]" />
        <Dialog.Content className="motion-dialog z-[50] max-h-[min(88vh,720px)] w-[min(92vw,520px)] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 shadow-[var(--panel-shadow,0_8px_24px_rgba(0,0,0,0.35))]">
          <Dialog.Title className="text-lg font-medium">
            {editing ? "编辑 API Key" : "创建 API Key"}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-[var(--text-secondary)]">
            {editing ? "修改描述、权限、有效期等设置" : "创建后即可用于 OpenAI 兼容 SDK 调用网关"}
          </Dialog.Description>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm text-[var(--text-secondary)]">描述</span>
              <input
                className={`field w-full ${fieldInvalidClass(Boolean(msg), shake)}`}
                value={description}
                maxLength={100}
                placeholder="例如：生产环境 / 本地调试"
                onChange={(e) => {
                  setDescription(e.target.value);
                  setMsg("");
                }}
              />
            </label>

            <div>
              <span className="mb-1 block text-sm text-[var(--text-secondary)]">有效期</span>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="radio" checked={expiryMode === "forever"} onChange={() => setExpiryMode("forever")} />
                  永久
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="radio" checked={expiryMode === "custom"} onChange={() => setExpiryMode("custom")} />
                  自定义
                </label>
                {expiryMode === "custom" ? (
                  <span className="flex items-center gap-1 text-sm">
                    <input
                      className={`field w-20 py-1 ${fieldInvalidClass(Boolean(msg), shake)}`}
                      type="number"
                      min={1}
                      value={days}
                      onChange={(e) => {
                        setDays(e.target.value);
                        setMsg("");
                      }}
                    />
                    天
                  </span>
                ) : null}
              </div>
            </div>

            <div>
              <span className="mb-1 block text-sm text-[var(--text-secondary)]">权限 · 可访问模型</span>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="radio" checked={permMode === "all"} onChange={() => setPermMode("all")} />
                  全部
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="radio" checked={permMode === "custom"} onChange={() => setPermMode("custom")} />
                  自定义
                </label>
              </div>
              {permMode === "custom" ? (
                <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {chatModels.map((m) => (
                    <label key={m} className="mono flex items-center gap-1.5 text-[13px]">
                      <input type="checkbox" checked={selected.includes(m)} onChange={() => toggleModel(m)} />
                      {m}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>

            <p className="text-xs text-[var(--text-tertiary)]">
              花费从账户余额扣除（余额在「看板」查看，管理员充值）；密钥本身不再单设预算。
            </p>
          </div>

          {msg ? (
            <ErrorSlide>
              <p className="mt-3 text-sm text-[var(--status-error)]">{msg}</p>
            </ErrorSlide>
          ) : null}

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button type="button" className="btn btn-ghost">取消</button>
            </Dialog.Close>
            <button type="button" className="btn" disabled={busy} onClick={() => void submit()}>
              {busy ? "保存中…" : editing ? "保存" : "创建"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
