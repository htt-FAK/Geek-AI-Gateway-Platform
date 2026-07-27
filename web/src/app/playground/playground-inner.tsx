"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ConsolePage, useMe } from "@/components/console";
import { envPublicGateway } from "@/lib/public-env";

type Msg = { role: "user" | "assistant" | "system"; content: string };

export default function PlaygroundInner() {
  const { me, refresh } = useMe();
  const search = useSearchParams();
  const [model, setModel] = useState("deepseek-v4-flash");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [systemOpen, setSystemOpen] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [stream, setStream] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [tokens, setTokens] = useState({ in: 0, out: 0, total: 0 });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = search.get("model");
    if (q) setModel(q);
  }, [search]);

  useEffect(() => {
    if (me?.models[0] && !search.get("model")) {
      setModel((m) => (me.models.includes(m) ? m : me.models[0]));
    }
  }, [me, search]);

  const budgetText = useMemo(() => {
    if (!me) return "";
    const b = me.budget;
    return `今日 ¥${b.dailyUsed.toFixed(2)}/${b.dailyLimit} · 本周 ¥${b.weeklyUsed.toFixed(2)}/${b.weeklyLimit} · 本月 ¥${b.monthlyUsed.toFixed(2)}/${b.monthlyLimit}`;
  }, [me]);

  const gatewayBase = me?.gatewayUrl ?? envPublicGateway();

  const codeSnippet = useMemo(() => {
    return `curl ${gatewayBase}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $AI_GATEWAY_API_KEY" \\
  -d '{
    "model": "${model}",
    "messages": [
      ${systemPrompt.trim() ? `{"role": "system", "content": ${JSON.stringify(systemPrompt.trim())}},\n      ` : ""}{"role": "user", "content": "Hello"}
    ],
    "temperature": ${temperature},
    "max_tokens": ${maxTokens},
    "stream": ${stream}
  }'`;
  }, [gatewayBase, model, systemPrompt, temperature, maxTokens, stream]);

  function clearChat() {
    setMessages([]);
    setTokens({ in: 0, out: 0, total: 0 });
    setError("");
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    setError("");
    const userMsg: Msg = { role: "user", content: input.trim() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);

    const payloadMessages: Msg[] = [];
    if (systemPrompt.trim()) {
      payloadMessages.push({ role: "system", content: systemPrompt.trim() });
    }
    payloadMessages.push(...history.filter((m) => m.role !== "system"));

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          model,
          messages: payloadMessages,
          stream,
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `请求失败 (${res.status})`);
        setLoading(false);
        return;
      }

      if (!stream) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content ?? "";
        setMessages((m) => [...m, { role: "assistant", content }]);
        const usage = json.usage;
        if (usage) {
          setTokens({
            in: usage.prompt_tokens ?? 0,
            out: usage.completion_tokens ?? 0,
            total: usage.total_tokens ?? 0,
          });
        }
        await refresh();
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("无流式响应");
        setLoading(false);
        return;
      }

      let assistant = "";
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n");
        buffer = parts.pop() ?? "";
        for (const line of parts) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>;
              usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
            };
            const delta = json.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              assistant += delta;
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: assistant };
                return copy;
              });
            }
            if (json.usage) {
              setTokens({
                in: json.usage.prompt_tokens ?? 0,
                out: json.usage.completion_tokens ?? 0,
                total: json.usage.total_tokens ?? 0,
              });
            }
          } catch {
            // ignore partial
          }
        }
      }
      await refresh();
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("请求失败。检查密钥、模型名或网关是否在线。");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  return (
    <ConsolePage phone={me?.phone} maxWidth={false}>
      <div className="flex h-[calc(100vh-52px)] min-h-[520px]">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-[var(--border-subtle)] px-5 py-3">
            <button
              type="button"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:border-[var(--border-active)]"
              onClick={() => setSystemOpen((v) => !v)}
            >
              {systemOpen
                ? "System Prompt · 收起"
                : systemPrompt.trim()
                  ? `System Prompt · ${systemPrompt.trim().slice(0, 48)}${systemPrompt.trim().length > 48 ? "…" : ""}`
                  : "System Prompt · 点击编辑"}
            </button>
            {systemOpen ? (
              <textarea
                className="field mt-2 min-h-[100px]"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="设定助手的角色、口吻与边界。例如：你是严谨的 API 助手，回答简短、先给结论。"
              />
            ) : null}
          </div>

          <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-5 py-2">
            <button type="button" className="btn btn-ghost py-1 text-xs" onClick={clearChat}>
              清空
            </button>
            <button type="button" className="btn btn-ghost py-1 text-xs" onClick={() => setCodeOpen(true)}>
              查看代码
            </button>
            <span className="ml-auto text-xs text-[var(--text-tertiary)]">{budgetText}</span>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {messages.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-[var(--text-secondary)]">还没有回合</p>
                <p className="mt-2 text-sm text-[var(--text-tertiary)]">
                  在下方写一句 user 消息；需要人设时先展开 System Prompt。
                </p>
                <p className="mt-4 text-sm text-[var(--text-tertiary)]">
                  试试：「用一句话说明你是哪个模型。」
                </p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="mono text-[11px] uppercase tracking-wider text-[var(--text-tertiary)]">
                    {m.role}
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {m.content}
                    {loading && i === messages.length - 1 && m.role === "assistant" ? (
                      <span className="ml-0.5 inline-block animate-pulse text-[var(--accent-primary)]">▌</span>
                    ) : null}
                  </pre>
                </div>
              ))
            )}
          </div>

          <form onSubmit={onSend} className="border-t border-[var(--border-subtle)] px-5 py-3">
            {error ? <p className="mb-2 text-sm text-[var(--status-error)]">{error}</p> : null}
            <div className="flex gap-2">
              <textarea
                className="field min-h-[72px] flex-1"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入 user 消息…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void onSend(e as unknown as FormEvent);
                  }
                }}
              />
              {loading ? (
                <button type="button" className="btn self-end" onClick={stop}>
                  停止
                </button>
              ) : (
                <button className="btn self-end" type="submit" disabled={!input.trim()}>
                  发送
                </button>
              )}
            </div>
            <div className="mono mt-2 text-xs text-[var(--text-tertiary)]">
              Tokens · in {tokens.in} · out {tokens.out} · total {tokens.total}
              {loading ? " · 生成中…" : ""}
            </div>
          </form>
        </div>

        <aside className="hidden w-[300px] shrink-0 flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 md:flex">
          <p className="mb-4 text-xs uppercase tracking-wide text-[var(--text-tertiary)]">模型配置</p>
          <label className="mb-4 block space-y-1.5">
            <span className="text-sm text-[var(--text-secondary)]">模型</span>
            <select className="field" value={model} onChange={(e) => setModel(e.target.value)}>
              {(me?.models ?? [model]).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="mb-4 block space-y-1.5">
            <div className="flex justify-between text-sm text-[var(--text-secondary)]">
              <span>Temperature</span>
              <span className="tabular text-[var(--text-tertiary)]">{temperature.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={2}
              step={0.01}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full accent-[var(--accent-primary)]"
            />
          </label>
          <label className="mb-4 block space-y-1.5">
            <span className="text-sm text-[var(--text-secondary)]">Max tokens</span>
            <input
              className="field"
              type="number"
              min={1}
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value) || 1024)}
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Stream</span>
            <input
              type="checkbox"
              checked={stream}
              onChange={(e) => setStream(e.target.checked)}
              className="accent-[var(--accent-primary)]"
            />
          </label>
        </aside>
      </div>

      <Dialog.Root open={codeOpen} onOpenChange={setCodeOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[50] bg-[var(--overlay-scrim)]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[50] w-[min(92vw,640px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6">
            <Dialog.Title className="text-lg font-medium">调用示例</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-[var(--text-secondary)]">
              指向本网关的 OpenAI 兼容请求，可直接粘贴到你的项目里。
            </Dialog.Description>
            <pre className="mono mt-4 max-h-[50vh] overflow-auto rounded-lg bg-[var(--bg-surface)] p-4 text-xs leading-relaxed">
              {codeSnippet}
            </pre>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void navigator.clipboard.writeText(codeSnippet)}
              >
                复制
              </button>
              <Dialog.Close asChild>
                <button type="button" className="btn">
                  关闭
                </button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ConsolePage>
  );
}
