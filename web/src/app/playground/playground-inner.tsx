"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ConsolePage, useMe } from "@/components/console";
import { envPublicGateway } from "@/lib/public-env";
import {
  defaultThinkingStop,
  getThinkingProfile,
  ThinkingStopId,
  thinkingStopToRequest,
} from "@/lib/thinking-depth";

type Msg = {
  role: "user" | "assistant" | "system";
  content: string;
  reasoningContent?: string;
};

export default function PlaygroundInner() {
  const { me, refresh } = useMe();
  const search = useSearchParams();
  const [model, setModel] = useState("deepseek-v4-flash");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [stream, setStream] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [tokens, setTokens] = useState({ in: 0, out: 0, total: 0 });
  const [thinkingStop, setThinkingStop] = useState<ThinkingStopId | null>(null);
  const [openReasoning, setOpenReasoning] = useState<Record<number, boolean>>({});
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const thinkingProfile = useMemo(() => getThinkingProfile(model), [model]);
  const thinkingFields = useMemo(
    () => thinkingStopToRequest(thinkingProfile, thinkingStop),
    [thinkingProfile, thinkingStop],
  );

  useEffect(() => {
    const q = search.get("model");
    if (q) setModel(q);
  }, [search]);

  useEffect(() => {
    if (me?.models[0] && !search.get("model")) {
      setModel((m) => (me.models.includes(m) ? m : me.models[0]));
    }
  }, [me, search]);

  useEffect(() => {
    const next = defaultThinkingStop(thinkingProfile);
    setThinkingStop(next);
  }, [thinkingProfile]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const gatewayBase = me?.gatewayUrl ?? envPublicGateway();

  const codeSnippet = useMemo(() => {
    const thinkingLines: string[] = [];
    if (thinkingFields.thinking) {
      thinkingLines.push(`    "thinking": ${JSON.stringify(thinkingFields.thinking)},`);
    }
    if (thinkingFields.reasoning_effort) {
      thinkingLines.push(`    "reasoning_effort": "${thinkingFields.reasoning_effort}",`);
    }
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
${thinkingLines.length ? `${thinkingLines.join("\n")}\n` : ""}    "stream": ${stream}
  }'`;
  }, [gatewayBase, model, systemPrompt, temperature, maxTokens, stream, thinkingFields]);

  function clearChat() {
    setMessages([]);
    setTokens({ in: 0, out: 0, total: 0 });
    setError("");
    setOpenReasoning({});
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }

  function toggleReasoning(index: number) {
    setOpenReasoning((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  function onPickFiles(list: FileList | null) {
    if (!list?.length) return;
    setPendingFiles((prev) => [...prev, ...Array.from(list)]);
    setUploadError("");
  }

  async function confirmUpload() {
    if (!pendingFiles.length) {
      setUploadOpen(false);
      return;
    }
    setUploadError("");
    try {
      const chunks: string[] = [];
      for (const file of pendingFiles) {
        const text = await file.text();
        chunks.push(`【附件: ${file.name}】\n${text}`);
      }
      const block = chunks.join("\n\n");
      setInput((prev) => (prev.trim() ? `${prev.trim()}\n\n${block}` : block));
      setPendingFiles([]);
      setUploadOpen(false);
    } catch {
      setUploadError("读取文件失败，请重试或改用纯文本文件。");
    }
  }

  async function onSend(e?: FormEvent) {
    e?.preventDefault();
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
    payloadMessages.push(
      ...history
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
    );

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
          ...thinkingFields,
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
        const reasoningContent = json.choices?.[0]?.message?.reasoning_content ?? "";
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content,
            ...(reasoningContent ? { reasoningContent } : {}),
          },
        ]);
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
      let reasoning = "";
      const assistantIndex = history.length;
      setMessages((m) => [...m, { role: "assistant", content: "", reasoningContent: "" }]);
      setOpenReasoning((prev) => ({ ...prev, [assistantIndex]: true }));
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
              choices?: Array<{
                delta?: { content?: string | null; reasoning_content?: string | null };
              }>;
              usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
            };
            const delta = json.choices?.[0]?.delta;
            const reasoningDelta = delta?.reasoning_content ?? "";
            const contentDelta = delta?.content ?? "";
            if (reasoningDelta) reasoning += reasoningDelta;
            if (contentDelta) assistant += contentDelta;
            if (reasoningDelta || contentDelta) {
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = {
                  role: "assistant",
                  content: assistant,
                  ...(reasoning ? { reasoningContent: reasoning } : {}),
                };
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
      setOpenReasoning((prev) => ({ ...prev, [assistantIndex]: false }));
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

  const stopIndex =
    thinkingProfile.kind === "none" || !thinkingStop
      ? -1
      : thinkingProfile.stops.findIndex((s) => s.id === thinkingStop);
  const stopLabel =
    thinkingProfile.kind !== "none" && thinkingStop
      ? thinkingProfile.stops.find((s) => s.id === thinkingStop)?.label
      : null;

  return (
    <ConsolePage phone={me?.phone} maxWidth={false}>
      <div className="flex h-[calc(100vh-52px-2.5rem)] min-h-[520px] flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
          <h1 className="text-[15px] font-medium tracking-tight text-[var(--text-primary)]">对话测试</h1>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-ghost py-1.5 text-[13px]" onClick={() => setCodeOpen(true)}>
              查看代码
            </button>
            <button type="button" className="btn btn-ghost py-1.5 text-[13px]" onClick={() => setAdvancedOpen(true)}>
              高级
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto py-5">
          {messages.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-[15px] text-[var(--text-secondary)]">还没有回合</p>
              <p className="mt-2 text-[13px] text-[var(--text-tertiary)]">在下方随便问一句；需要人设时打开「高级」。</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className="space-y-2">
                <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                  {m.role}
                </div>
                {m.role === "assistant" && m.reasoningContent ? (
                  <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] text-[var(--text-secondary)]"
                      onClick={() => toggleReasoning(i)}
                    >
                      <span>{loading && i === messages.length - 1 && !m.content ? "思考中…" : "思考过程"}</span>
                      <span className="text-[var(--text-tertiary)]">{openReasoning[i] ? "收起" : "展开"}</span>
                    </button>
                    {openReasoning[i] ? (
                      <pre className="whitespace-pre-wrap border-t border-[var(--border-subtle)] px-3 py-2 font-sans text-[13px] leading-relaxed text-[var(--text-tertiary)]">
                        {m.reasoningContent}
                      </pre>
                    ) : null}
                  </div>
                ) : null}
                <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-[var(--text-primary)]">
                  {m.content}
                  {loading && i === messages.length - 1 && m.role === "assistant" ? (
                    <span className="ml-0.5 inline-block animate-pulse text-[var(--text-secondary)]">▌</span>
                  ) : null}
                </pre>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={onSend} className="shrink-0 pt-2">
          {error ? <p className="mb-2 text-[13px] text-[var(--status-error)]">{error}</p> : null}
          <div className="playground-composer">
            <textarea
              className="playground-composer-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="随便问…"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onSend();
                }
              }}
            />
            <div className="playground-composer-bar">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-ghost py-1.5 text-[13px]"
                  onClick={() => {
                    setUploadError("");
                    setUploadOpen(true);
                  }}
                >
                  上传
                </button>
                <button type="button" className="btn btn-ghost py-1.5 text-[13px]" onClick={clearChat}>
                  清空
                </button>
                {thinkingProfile.kind !== "none" ? (
                  <div className="thinking-depth" title="思考深度">
                    <span className="thinking-depth-label">思考深度 · {stopLabel}</span>
                    <input
                      type="range"
                      className="thinking-depth-range"
                      min={0}
                      max={thinkingProfile.stops.length - 1}
                      step={1}
                      value={Math.max(0, stopIndex)}
                      onChange={(e) => {
                        const idx = Number(e.target.value);
                        const stop = thinkingProfile.stops[idx];
                        if (stop) setThinkingStop(stop.id);
                      }}
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="field !w-auto min-w-[10rem] py-1.5 text-[13px]"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {(me?.models ?? [model]).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                {loading ? (
                  <button type="button" className="btn py-1.5 text-[13px]" onClick={stop}>
                    停止
                  </button>
                ) : (
                  <button className="btn py-1.5 text-[13px]" type="submit" disabled={!input.trim()}>
                    发送
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="mt-2 text-[12px] tabular-nums text-[var(--text-tertiary)]">
            Tokens · in {tokens.in} · out {tokens.out} · total {tokens.total}
            {loading ? " · 生成中…" : ""}
          </div>
        </form>
      </div>

      <Dialog.Root
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) {
            setPendingFiles([]);
            setUploadError("");
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[50] bg-[var(--overlay-scrim)]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[50] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
            <Dialog.Title className="text-[15px] font-medium">上传文件</Dialog.Title>
            <Dialog.Description className="mt-1 text-[13px] text-[var(--text-secondary)]">
              选择文本类文件，确认后会插入到输入框，随下一次发送一并提交。
            </Dialog.Description>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                onPickFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="mt-4 space-y-3">
              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                选择文件
              </button>
              {pendingFiles.length ? (
                <ul className="max-h-40 space-y-1.5 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-[13px] text-[var(--text-secondary)]">
                  {pendingFiles.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2">
                      <span className="truncate">{f.name}</span>
                      <button
                        type="button"
                        className="shrink-0 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                        onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        移除
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-[var(--text-tertiary)]">尚未选择文件</p>
              )}
              {uploadError ? <p className="text-[13px] text-[var(--status-error)]">{uploadError}</p> : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" className="btn btn-ghost">
                  取消
                </button>
              </Dialog.Close>
              <button type="button" className="btn" onClick={() => void confirmUpload()} disabled={!pendingFiles.length}>
                插入输入框
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[50] bg-[var(--overlay-scrim)]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[50] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
            <Dialog.Title className="text-[15px] font-medium">高级</Dialog.Title>
            <Dialog.Description className="mt-1 text-[13px] text-[var(--text-secondary)]">
              参数在下次发送时生效。思考开启时，部分采样参数可能被上游忽略。
            </Dialog.Description>
            <div className="mt-4 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm text-[var(--text-secondary)]">System Prompt</span>
                <textarea
                  className="field min-h-[96px]"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="设定助手的角色、口吻与边界。"
                />
              </label>
              <label className="block space-y-1.5">
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
              <label className="block space-y-1.5">
                <span className="text-sm text-[var(--text-secondary)]">Max tokens</span>
                <input
                  className="field"
                  type="number"
                  min={1}
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value) || 1024)}
                />
              </label>
              <label className="flex items-start justify-between gap-4 text-[13px]">
                <span>
                  <span className="block text-[var(--text-secondary)]">流式输出</span>
                  <span className="mt-0.5 block text-[12px] text-[var(--text-tertiary)]">
                    开启后回答会逐字返回；关闭则等待完整结果一次展示。
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={stream}
                  onChange={(e) => setStream(e.target.checked)}
                  className="mt-1 accent-[var(--accent-primary)]"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end">
              <Dialog.Close asChild>
                <button type="button" className="btn">
                  完成
                </button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={codeOpen} onOpenChange={setCodeOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[50] bg-[var(--overlay-scrim)]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[50] w-[min(92vw,640px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6">
            <Dialog.Title className="text-lg font-medium">调用示例</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-[var(--text-secondary)]">
              指向本网关的 OpenAI 兼容请求，可直接粘贴到你的项目里。
            </Dialog.Description>
            <pre className="mono mt-4 max-h-[50vh] overflow-auto rounded-[var(--radius-md)] bg-[var(--bg-surface)] p-4 text-xs leading-relaxed">
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
