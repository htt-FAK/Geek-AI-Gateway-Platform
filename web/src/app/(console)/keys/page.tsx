"use client";

import { useState } from "react";
import { ConsolePage, useMe } from "@/components/console";
import { KeyRevealDialog } from "@/components/key-reveal-dialog";
import Link from "next/link";

export default function KeysPage() {
  const { me, refresh } = useMe();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [dialogTitle, setDialogTitle] = useState("获取 KEY");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPlain, setShowPlain] = useState(false);
  const [copied, setCopied] = useState(false);

  async function fetchPlainKey(): Promise<string | null> {
    if (plaintext) return plaintext;
    const res = await fetch("/api/keys/copy", { method: "POST" });
    const data = (await res.json()) as { key?: string; error?: string };
    if (!res.ok || !data.key) {
      setMsg(data.error ?? "获取密钥失败");
      return null;
    }
    setPlaintext(data.key);
    await refresh();
    return data.key;
  }

  async function toggleEye() {
    if (showPlain) {
      setShowPlain(false);
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const key = await fetchPlainKey();
      if (key) setShowPlain(true);
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    setBusy(true);
    setMsg("");
    try {
      const key = await fetchPlainKey();
      if (!key) return;
      await navigator.clipboard.writeText(key);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } finally {
      setBusy(false);
    }
  }

  async function reveal() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/keys/reveal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "获取失败");
        return;
      }
      setPlaintext(data.key);
      setShowPlain(true);
      setDialogTitle("获取 KEY");
      setDialogOpen(true);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    if (!confirm("重新生成后旧密钥立即失效。确定继续？")) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/keys/regenerate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "重新生成失败");
        await refresh();
        return;
      }
      setPlaintext(data.key);
      setShowPlain(true);
      setDialogTitle("新密钥");
      setDialogOpen(true);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const displayKey =
    showPlain && plaintext
      ? plaintext
      : (me?.keyMasked ?? "—");
  const canUseKeyActions = me?.keyMode === "virtual_key";

  return (
    <ConsolePage phone={me?.phone}>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">密钥</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          给人或给程序发一张进网关的通行证
        </p>
      </div>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3">
          <h2 className="text-sm font-medium">AI Gateway API Key</h2>
          <Link href="/models" className="text-sm text-[var(--accent-primary)] hover:underline">
            查看可用模型
          </Link>
        </div>
        <div className="space-y-4 bg-[var(--bg-base)]/40 px-5 py-5">
          <Row label="名称" value={me?.phone ?? "…"} />
          <Row label="URL" value={me?.gatewayUrl ?? "…"} mono />
          <div className="group flex flex-wrap items-center gap-3">
            <span className="w-16 shrink-0 text-sm text-[var(--text-secondary)]">KEY</span>
            <span className="mono min-w-0 flex-1 break-all text-sm">{displayKey}</span>
            {me?.keyMode === "app_enforced" ? (
              <span className="text-xs text-[var(--text-tertiary)]">应用代持，不可用于外部 SDK</span>
            ) : canUseKeyActions ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="btn btn-ghost px-2 py-1 text-sm"
                  disabled={busy}
                  onClick={() => void toggleEye()}
                  aria-label={showPlain ? "隐藏密钥" : "显示密钥"}
                  title={showPlain ? "隐藏" : "显示"}
                >
                  {showPlain ? "隐藏" : "显示"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost px-2 py-1 text-sm text-[var(--accent-primary)]"
                  disabled={busy}
                  onClick={() => void copyKey()}
                  aria-label="复制密钥"
                >
                  {copied ? "已复制" : "复制"}
                </button>
                {me?.canRevealKey ? (
                  <button
                    type="button"
                    className="text-sm text-[var(--accent-primary)]"
                    disabled={busy}
                    onClick={() => void reveal()}
                  >
                    获取 KEY
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-sm text-[var(--accent-primary)]"
                    disabled={busy || !me?.canRegenerateKey}
                    onClick={() => void regenerate()}
                  >
                    重新生成
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {msg ? <p className="mt-3 text-sm text-[var(--status-error)]">{msg}</p> : null}

      <KeyRevealDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o && !showPlain) setPlaintext(null);
        }}
        apiKey={plaintext}
        title={dialogTitle}
      />
    </ConsolePage>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-16 shrink-0 text-sm text-[var(--text-secondary)]">{label}</span>
      <span className={`flex-1 break-all text-sm ${mono ? "mono" : ""}`}>{value}</span>
    </div>
  );
}
