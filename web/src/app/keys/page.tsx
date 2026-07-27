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
      setDialogTitle("新密钥");
      setDialogOpen(true);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

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
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-16 shrink-0 text-sm text-[var(--text-secondary)]">KEY</span>
            <span className="mono flex-1 text-sm">{me?.keyMasked ?? "—"}</span>
            {me?.keyMode === "app_enforced" ? (
              <span className="text-xs text-[var(--text-tertiary)]">应用代持，不可用于外部 SDK</span>
            ) : me?.canRevealKey ? (
              <button type="button" className="text-sm text-[var(--accent-primary)]" disabled={busy} onClick={() => void reveal()}>
                获取 KEY
              </button>
            ) : (
              <button type="button" className="text-sm text-[var(--accent-primary)]" disabled={busy || !me?.canRegenerateKey} onClick={() => void regenerate()}>
                重新生成
              </button>
            )}
          </div>
        </div>
      </section>

      {me?.canRegenerateKey && !me.canRevealKey && me.keyMode === "virtual_key" ? (
        <p className="mt-3 text-sm text-[var(--text-tertiary)]">
          密钥已揭示过。若遗失，请重新生成（旧密钥立即失效）。
        </p>
      ) : null}
      {msg ? <p className="mt-3 text-sm text-[var(--status-error)]">{msg}</p> : null}

      <KeyRevealDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setPlaintext(null);
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
      <span className={`flex-1 text-sm ${mono ? "mono" : ""}`}>{value}</span>
    </div>
  );
}
