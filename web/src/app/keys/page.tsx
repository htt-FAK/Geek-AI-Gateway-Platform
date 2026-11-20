"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ConsolePage, useMe } from "@/components/console";
import { KeyRevealDialog } from "@/components/key-reveal-dialog";
import { KeyFormDialog, type KeyRow } from "@/components/key-form-dialog";
import { PageHeader } from "@/components/page-header";

export default function KeysPage() {
  const { me, refresh } = useMe();
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [chatModels, setChatModels] = useState<string[]>([]);
  const [dbDown, setDbDown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<KeyRow | null>(null);
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const [revealTitle, setRevealTitle] = useState("API Key");
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [copiedGateway, setCopiedGateway] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/keys");
      const data = (await res.json()) as {
        keys?: KeyRow[];
        chatModels?: string[];
        error?: string;
        dbDown?: boolean;
      };
      if (res.status === 503 && data.dbDown) {
        setDbDown(true);
        setKeys([]);
        return;
      }
      if (!res.ok) {
        setMsg(data.error ?? "加载密钥失败");
        return;
      }
      setDbDown(false);
      setKeys(data.keys ?? []);
      setChatModels(data.chatModels ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function reveal(k: KeyRow): Promise<string | null> {
    const res = await fetch(`/api/keys/${encodeURIComponent(k.token)}/reveal`, { method: "POST" });
    const data = (await res.json()) as { key?: string; error?: string };
    if (!res.ok || !data.key) {
      setMsg(data.error ?? "获取密钥失败");
      return null;
    }
    return data.key;
  }

  async function viewKey(k: KeyRow) {
    const key = await reveal(k);
    if (key) {
      setRevealTitle(k.keyAlias || "API Key");
      setRevealKey(key);
    }
  }

  async function copyKey(k: KeyRow) {
    const key = await reveal(k);
    if (!key) return;
    await navigator.clipboard.writeText(key);
    setCopiedName(k.keyName);
    window.setTimeout(() => setCopiedName(null), 2000);
  }

  async function removeKey(k: KeyRow) {
    if (!confirm(`删除密钥「${k.keyAlias || k.keyName}」？使用它的程序将立即失效。`)) return;
    const res = await fetch(`/api/keys/${encodeURIComponent(k.token)}`, { method: "DELETE" });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMsg(data.error ?? "删除失败");
      return;
    }
    await load();
    await refresh();
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(k: KeyRow) {
    setEditing(k);
    setFormOpen(true);
  }

  return (
    <ConsolePage phone={me?.phone}>
      <PageHeader
        group="资源"
        title="API Key"
        description="给人或给程序发一张进网关的通行证"
        actions={
          <button type="button" className="btn" disabled={dbDown} onClick={openCreate}>
            创建 API Key
          </button>
        }
      />

      {/* 网关地址单独一行，可复制 */}
      <div className="mb-5 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-[var(--text-tertiary)]">网关地址</span>
        <code className="mono max-w-full truncate rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-[12px]">
          {me?.gatewayUrl ?? "…"}
        </code>
        {me?.gatewayUrl ? (
          <button
            type="button"
            className="text-[var(--accent-primary)] hover:underline"
            onClick={() => {
              void navigator.clipboard.writeText(me.gatewayUrl ?? "");
              setCopiedGateway(true);
              window.setTimeout(() => setCopiedGateway(false), 2000);
            }}
          >
            {copiedGateway ? "已复制" : "复制"}
          </button>
        ) : null}
      </div>

      {dbDown ? (
        <section className="panel border-[var(--status-warning)] px-5 py-4">
          <p className="text-sm text-[var(--status-warning)]">
            网关密钥库未连接：多密钥管理需要本地 Postgres 与网关 DB 模式。
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            启动方式：<span className="mono">./scripts/local-postgres.sh start</span> 后重启网关。
            当前仍为应用代持模式，调试台可正常使用。
          </p>
        </section>
      ) : (
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3">
            <h2 className="text-sm font-medium">我的密钥（{keys.length}）</h2>
            <Link href="/models" className="text-sm text-[var(--accent-primary)] hover:underline">
              查看可用模型
            </Link>
          </div>
          {loading ? (
            <p className="px-5 py-6 text-sm text-[var(--text-tertiary)]">加载中…</p>
          ) : keys.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[var(--text-tertiary)]">
              还没有密钥，点击右上角「创建 API Key」。
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-left text-xs text-[var(--text-tertiary)]">
                    <th className="px-4 py-2.5 font-normal">描述</th>
                    <th className="px-4 py-2.5 font-normal">API Key</th>
                    <th className="px-4 py-2.5 font-normal">归属账号</th>
                    <th className="px-4 py-2.5 font-normal">创建时间</th>
                    <th className="px-4 py-2.5 font-normal">有效期</th>
                    <th className="px-4 py-2.5 font-normal">可访问模型</th>
                    <th className="px-4 py-2.5 font-normal">已花费</th>
                    <th className="px-4 py-2.5 font-normal">状态</th>
                    <th className="px-4 py-2.5 font-normal">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.keyName} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-hover)]">
                      <td className="px-4 py-3.5">
                        <span className="flex items-center gap-1.5">
                          {k.keyAlias || <span className="text-[var(--text-tertiary)]">—</span>}
                          {k.isPrimary ? (
                            <span className="rounded-[var(--radius-sm)] bg-[var(--accent-muted)] px-1.5 py-0.5 text-[11px] text-[var(--accent-primary)]">
                              主密钥
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="mono px-4 py-3.5 text-[13px]">{k.keyName}</td>
                      <td className="px-4 py-3.5">{me?.phone ?? "…"}</td>
                      <td className="px-4 py-3.5 text-[var(--text-secondary)]">
                        {k.createdAt ? new Date(k.createdAt).toLocaleDateString("zh-CN") : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-[var(--text-secondary)]">
                        {k.expires ? new Date(k.expires).toLocaleDateString("zh-CN") : "永久"}
                      </td>
                      <td className="px-4 py-3.5">
                        <ModelTags models={k.models} all={chatModels} />
                      </td>
                      <td className="tabular px-4 py-3.5 text-[var(--text-secondary)]">
                        ¥{k.spend.toFixed(4)}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge k={k} />
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="flex items-center gap-2 text-[13px]">
                          <button
                            type="button"
                            className="text-[var(--accent-primary)] hover:underline disabled:cursor-not-allowed disabled:text-[var(--text-tertiary)]"
                            disabled={!k.hasLocalCopy}
                            title={k.hasLocalCopy ? undefined : "创建时未留存明文，无法查看"}
                            onClick={() => void viewKey(k)}
                          >
                            查看
                          </button>
                          <button
                            type="button"
                            className="text-[var(--accent-primary)] hover:underline disabled:cursor-not-allowed disabled:text-[var(--text-tertiary)]"
                            disabled={!k.hasLocalCopy}
                            title={k.hasLocalCopy ? undefined : "创建时未留存明文，无法复制"}
                            onClick={() => void copyKey(k)}
                          >
                            {copiedName === k.keyName ? "已复制" : "复制"}
                          </button>
                          <button
                            type="button"
                            className="text-[var(--accent-primary)] hover:underline disabled:cursor-not-allowed disabled:text-[var(--text-tertiary)]"
                            disabled={!k.hasLocalCopy}
                            onClick={() => openEdit(k)}
                          >
                            编辑
                          </button>
                          <button type="button" className="text-[var(--status-error)] hover:underline" onClick={() => void removeKey(k)}>
                            删除
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {msg ? <p className="mt-3 text-sm text-[var(--status-error)]">{msg}</p> : null}

      <KeyFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        chatModels={chatModels}
        editing={editing}
        onCreated={(key) => {
          setRevealTitle("新密钥 · 请立即保存");
          setRevealKey(key);
          void load();
          void refresh();
        }}
        onSaved={() => {
          void load();
          void refresh();
        }}
      />

      <KeyRevealDialog
        open={revealKey !== null}
        onOpenChange={(o) => {
          if (!o) setRevealKey(null);
        }}
        apiKey={revealKey}
        title={revealTitle}
      />
    </ConsolePage>
  );
}

function ModelTags({ models, all }: { models: string[]; all: string[] }) {
  const isAll = all.length > 0 && all.every((m) => models.includes(m));
  if (isAll) return <span className="text-[var(--text-secondary)]">全部</span>;
  const shown = models.slice(0, 2);
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((m) => (
        <span key={m} className="mono rounded-[var(--radius-sm)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[11px]">
          {m}
        </span>
      ))}
      {models.length > 2 ? (
        <span className="text-[11px] text-[var(--text-tertiary)]">+{models.length - 2}</span>
      ) : null}
    </span>
  );
}

function StatusBadge({ k }: { k: KeyRow }) {
  const expired = k.expires !== null && new Date(k.expires).getTime() < Date.now();
  const [label, color] = k.blocked
    ? ["已禁用", "var(--status-error)"]
    : expired
      ? ["已过期", "var(--status-warning)"]
      : ["正常", "var(--status-success)"];
  return (
    <span className="flex items-center gap-1.5 text-[13px]" style={{ color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
