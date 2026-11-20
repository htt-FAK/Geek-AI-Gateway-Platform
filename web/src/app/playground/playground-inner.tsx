"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ConsolePage, useMe } from "@/components/console";
import { isPlaygroundChatModel } from "@/lib/conversation-policy";
import { getMarketModel } from "@/lib/model-market";
import { envPublicGateway } from "@/lib/public-env";
import {
  defaultThinkingStop,
  getThinkingProfile,
  ThinkingStopId,
  thinkingStopToRequest,
} from "@/lib/thinking-depth";

type Msg = {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  reasoningContent?: string;
  /** 用户消息附带的图片（data URL 或已保存图片地址） */
  images?: string[];
  status?: string;
};

type ConversationListItem = {
  id: string;
  title: string;
  model: string;
  status: string;
  totalTokens: number;
  updatedAt: string;
  hasSummary: boolean;
};

type MemoryView = { id: string; content: string };

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** 调试台只做文本对话：ASR/TTS 语音与嵌入/重排序模型不进下拉（网关 API 侧仍可调用）。 */
function isChatModel(model: string): boolean {
  return isPlaygroundChatModel(model);
}

export default function PlaygroundInner() {
  const { me, refresh } = useMe();
  const search = useSearchParams();
  const [model, setModel] = useState("deepseek-flash");
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
  const [images, setImages] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [tokens, setTokens] = useState({ in: 0, out: 0, total: 0 });
  const [thinkingStop, setThinkingStop] = useState<ThinkingStopId | null>(null);
  const [openReasoning, setOpenReasoning] = useState<Record<number, boolean>>({});
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [convCursor, setConvCursor] = useState<string | null>(null);
  const [convLoadingMore, setConvLoadingMore] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [hasSummary, setHasSummary] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memories, setMemories] = useState<MemoryView[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const conversationIdRef = useRef<string | null>(null);
  const viewGen = useRef(0);
  const sendingRef = useRef(false);
  const thinkingHold = useRef(false);

  const chatModels = useMemo(() => (me?.models ?? []).filter(isChatModel), [me]);
  const thinkingProfile = useMemo(() => getThinkingProfile(model), [model]);
  const thinkingFields = useMemo(
    () => thinkingStopToRequest(thinkingProfile, thinkingStop),
    [thinkingProfile, thinkingStop],
  );

  useEffect(() => {
    const q = search.get("model");
    if (q && isChatModel(q)) setModel(q);
  }, [search]);

  useEffect(() => {
    const first = chatModels[0];
    if (first && !search.get("model")) {
      setModel((m) => (chatModels.includes(m) ? m : first));
    }
  }, [chatModels, search]);

  useEffect(() => {
    if (thinkingHold.current) {
      thinkingHold.current = false;
      return;
    }
    setThinkingStop(defaultThinkingStop(thinkingProfile));
  }, [thinkingProfile]);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    void fetch("/api/conversations")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.conversations) {
          setConversations(data.conversations);
          setConvCursor(data.nextCursor ?? null);
        }
      })
      .catch(() => undefined);
  }, []);

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
    // 多数上游的思考开关走 extra_body（顶层未知参数会被网关 drop_params 丢弃）
    if (thinkingFields.extra_body) {
      thinkingLines.push(`    "extra_body": ${JSON.stringify(thinkingFields.extra_body)},`);
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

  function newChat() {
    viewGen.current += 1;
    if (abortRef.current) stop();
    setConversationId(null);
    setMessages([]);
    setImages([]);
    setTokens({ in: 0, out: 0, total: 0 });
    setError("");
    setOpenReasoning({});
    setHasSummary(false);
  }

  function applyConversationList(list: ConversationListItem[], id: string | null) {
    setConversations(list);
    if (!id) return;
    const found = list.find((item) => item.id === id);
    if (found) setHasSummary(found.hasSummary);
  }

  async function refreshConversations(id: string | null = conversationIdRef.current): Promise<boolean> {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) return false;
      const data = await res.json();
      const list = (data.conversations ?? []) as ConversationListItem[];
      applyConversationList(list, id);
      setConvCursor(data.nextCursor ?? null);
      if (!id) return false;
      return Boolean(list.find((item) => item.id === id)?.hasSummary);
    } catch {
      return false;
    }
  }

  /** 侧栏「加载更多」：按 cursor 追加更早的会话（刷新列表时重置回首屏）。 */
  async function loadMoreConversations() {
    if (!convCursor || convLoadingMore) return;
    setConvLoadingMore(true);
    try {
      const res = await fetch(`/api/conversations?cursor=${encodeURIComponent(convCursor)}`);
      if (!res.ok) return;
      const data = await res.json();
      const list = (data.conversations ?? []) as ConversationListItem[];
      setConversations((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...list.filter((c) => !seen.has(c.id))];
      });
      setConvCursor(data.nextCursor ?? null);
    } catch {
      // 网络错误保持现状，可再点
    } finally {
      setConvLoadingMore(false);
    }
  }

  function watchSummary(id: string) {
    // 摘要由后台 deepseek-flash 生成，通常 2–10 秒；只等 2.5s 会经常错过，
    // 导致「更早内容已压缩」要刷新页面才出现。分档退避，出现摘要即停。
    const delays = [2500, 6000, 12000];
    const tick = (index: number) => {
      if (index >= delays.length) return;
      window.setTimeout(async () => {
        if (conversationIdRef.current !== id) return;
        const summarized = await refreshConversations(id);
        if (!summarized) tick(index + 1);
      }, delays[index]);
    };
    tick(0);
  }

  async function openConversation(id: string) {
    const gen = ++viewGen.current;
    if (abortRef.current) stop();
    const res = await fetch(`/api/conversations/${id}`);
    const data = await res.json().catch(() => ({}));
    if (viewGen.current !== gen) return;
    if (!res.ok) {
      setError(data.error ?? "无法打开对话");
      return;
    }
    if (data.conversation.model !== model) thinkingHold.current = true;
    setConversationId(data.conversation.id);
    setModel(data.conversation.model);
    setSystemPrompt(data.conversation.systemPrompt ?? "");
    setTemperature(data.conversation.temperature);
    setMaxTokens(data.conversation.maxTokens);
    setStream(data.conversation.stream);
    setThinkingStop(data.conversation.thinkingStop ?? null);
    setHasSummary(Boolean(data.conversation.hasSummary));
    setMessages(
      (data.messages ?? []).flatMap((message: {
        id: string;
        role: string;
        content: string;
        reasoningContent?: string;
        status?: string;
        images?: string[];
      }) => {
        if (message.role !== "user" && message.role !== "assistant") return [];
        return [
          {
            id: message.id,
            role: message.role,
            content: message.content,
            ...(message.reasoningContent ? { reasoningContent: message.reasoningContent } : {}),
            ...(message.images?.length ? { images: message.images } : {}),
            status: message.status,
          },
        ];
      }),
    );
    setTokens({
      in: data.lastUsage?.promptTokens ?? 0,
      out: data.lastUsage?.completionTokens ?? 0,
      total: data.lastUsage?.totalTokens ?? 0,
    });
    setOpenReasoning({});
    setError("");
  }

  async function commitTitle(id: string) {
    const title = editingTitle.trim();
    setEditingId(null);
    if (!title) return;
    const res = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "改名失败");
      return;
    }
    setConversations((prev) => prev.map((item) => (item.id === id ? { ...item, title } : item)));
  }

  async function removeConversation(id: string) {
    if (!window.confirm("删除这场对话？删除后无法恢复。")) return;
    const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "删除失败");
      return;
    }
    setConversations((prev) => prev.filter((item) => item.id !== id));
    if (conversationIdRef.current === id) newChat();
  }

  async function loadMemories() {
    const res = await fetch("/api/memories");
    if (!res.ok) return;
    const data = await res.json();
    setMemories(data.memories ?? []);
  }

  async function deleteMemory(id: string) {
    const res = await fetch(`/api/memories?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) return;
    setMemories((prev) => prev.filter((item) => item.id !== id));
  }

  async function clearMemories() {
    if (!window.confirm("清空全部长期记忆？")) return;
    const res = await fetch("/api/memories?all=1", { method: "DELETE" });
    if (!res.ok) return;
    setMemories([]);
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
      const imgFiles = pendingFiles.filter((f) => f.type.startsWith("image/"));
      const txtFiles = pendingFiles.filter((f) => !f.type.startsWith("image/"));

      if (imgFiles.length) {
        if (!getMarketModel(model)?.capabilities.vision) {
          setUploadError(`模型 ${model} 不支持图像输入，请换 deepseek-flash 或 MiMo v2.6 系列`);
          return;
        }
        if (images.length + imgFiles.length > MAX_IMAGES) {
          setUploadError(`单次对话最多 ${MAX_IMAGES} 张图片`);
          return;
        }
        for (const file of imgFiles) {
          if (file.size > MAX_IMAGE_BYTES) {
            setUploadError(`图片 ${file.name} 超过 5MB 限制`);
            return;
          }
          const url = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("read failed"));
            reader.readAsDataURL(file);
          });
          setImages((prev) => [...prev, url]);
        }
      }

      if (txtFiles.length) {
        const chunks: string[] = [];
        for (const file of txtFiles) {
          const text = await file.text();
          chunks.push(`【附件: ${file.name}】\n${text}`);
        }
        const block = chunks.join("\n\n");
        setInput((prev) => (prev.trim() ? `${prev.trim()}\n\n${block}` : block));
      }
      setPendingFiles([]);
      setUploadOpen(false);
    } catch {
      setUploadError("读取文件失败，请重试或改用纯文本文件。");
    }
  }

  async function onSend(e?: FormEvent) {
    e?.preventDefault();
    if ((!input.trim() && images.length === 0) || loading || sendingRef.current) return;
    setError("");
    const vision = getMarketModel(model)?.capabilities.vision ?? false;
    if (images.length > 0 && !vision) {
      setError(`模型 ${model} 不支持图像输入，请换 deepseek-flash 或 MiMo v2.6 系列`);
      return;
    }
    sendingRef.current = true;
    const gen = ++viewGen.current;
    const userMsg: Msg = {
      role: "user",
      content: input.trim(),
      ...(images.length ? { images: [...images] } : {}),
    };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setImages([]);
    setLoading(true);

    const settings = {
      model,
      systemPrompt,
      temperature,
      maxTokens,
      stream,
      thinkingStop,
    };
    const ac = new AbortController();
    abortRef.current = ac;

    const rollback = () => {
      if (viewGen.current !== gen) return;
      setInput(userMsg.content);
      setImages(userMsg.images ?? []);
      setMessages((prev) => prev.slice(0, -1));
    };

    try {
      let id = conversationId;
      if (!id) {
        const created = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify(settings),
        });
        const createdBody = await created.json().catch(() => ({}));
        if (viewGen.current !== gen) return;
        if (!created.ok) {
          setError(createdBody.error ?? "无法开始对话");
          rollback();
          return;
        }
        id = createdBody.conversation.id as string;
        setConversationId(id);
        conversationIdRef.current = id;
        void refreshConversations(id);
      }

      const res = await fetch(`/api/conversations/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          ...settings,
          content: userMsg.content,
          images: userMsg.images ?? [],
        }),
      });

      if (viewGen.current !== gen) return;

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `请求失败 (${res.status})`);
        if (data.saved) {
          await openConversation(id);
        } else {
          rollback();
        }
        return;
      }

      if (!stream) {
        const json = await res.json();
        if (viewGen.current !== gen) return;
        const content = json.choices?.[0]?.message?.content ?? "";
        // 商汤日日新等上游用 reasoning 字段输出思考内容（非 reasoning_content）
        const reasoningContent =
          json.choices?.[0]?.message?.reasoning_content ?? json.choices?.[0]?.message?.reasoning ?? "";
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
        await refreshConversations(id);
        watchSummary(id);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("无流式响应");
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
        if (done || viewGen.current !== gen) break;
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
                delta?: { content?: string | null; reasoning_content?: string | null; reasoning?: string | null };
              }>;
              usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
            };
            const delta = json.choices?.[0]?.delta;
            // 商汤日日新等上游用 reasoning 字段输出思考内容（非 reasoning_content）
            const reasoningDelta = delta?.reasoning_content ?? delta?.reasoning ?? "";
            const contentDelta = delta?.content ?? "";
            if (reasoningDelta) reasoning += reasoningDelta;
            if (contentDelta) assistant += contentDelta;
            if ((reasoningDelta || contentDelta) && viewGen.current === gen) {
              setMessages((m) => {
                const copy = [...m];
                const last = copy[copy.length - 1];
                if (!last || last.role !== "assistant") return m;
                copy[copy.length - 1] = {
                  role: "assistant",
                  content: assistant,
                  ...(reasoning ? { reasoningContent: reasoning } : {}),
                };
                return copy;
              });
            }
            if (json.usage && viewGen.current === gen) {
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
      if (viewGen.current !== gen) return;
      setOpenReasoning((prev) => ({ ...prev, [assistantIndex]: false }));
      await refresh();
      await refreshConversations(id);
      watchSummary(id);
    } catch (err) {
      if (viewGen.current === gen && (err as Error).name !== "AbortError") {
        setError("请求失败。检查密钥、模型名或网关是否在线。");
      }
    } finally {
      sendingRef.current = false;
      if (viewGen.current === gen) {
        setLoading(false);
        abortRef.current = null;
      }
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
  /** 滑块填充百分比（0–100），由当前档位索引换算。 */
  const stopPct =
    thinkingProfile.kind !== "none" && thinkingProfile.stops.length > 1 && stopIndex >= 0
      ? (stopIndex / (thinkingProfile.stops.length - 1)) * 100
      : 0;

  return (
    <ConsolePage phone={me?.phone} maxWidth={false}>
      <div className="flex h-[calc(100vh-52px-2.5rem)] min-h-[520px] gap-4">
        {historyOpen ? (
          <aside className="flex min-h-0 w-56 shrink-0 flex-col overflow-hidden border-r border-[var(--border-subtle)] pr-3">
            <div className="flex items-center justify-between pb-3">
              <span className="text-[13px] font-medium text-[var(--text-primary)]">历史对话</span>
              <button
                type="button"
                className="text-[12px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                onClick={newChat}
              >
                新对话
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <p className="px-1 py-6 text-[12px] text-[var(--text-tertiary)]">还没有保存的对话</p>
              ) : (
                conversations.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-[var(--radius-md)] px-2 py-2 ${item.id === conversationId ? "bg-[var(--nav-active-bg)]" : ""}`}
                  >
                    {editingId === item.id ? (
                      <input
                        className="field py-1 text-[13px]"
                        value={editingTitle}
                        autoFocus
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => void commitTitle(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="block w-full text-left"
                        onClick={() => void openConversation(item.id)}
                      >
                        <span className="block truncate text-[13px] text-[var(--text-primary)]">{item.title}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-[var(--text-tertiary)]">
                          {item.model} · {formatWhen(item.updatedAt)}
                          {item.status === "error" ? " · 失败" : item.status === "aborted" ? " · 已停止" : ""}
                        </span>
                      </button>
                    )}
                    <div className="mt-1 flex gap-2">
                      <button
                        type="button"
                        className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                        onClick={() => {
                          setEditingId(item.id);
                          setEditingTitle(item.title);
                        }}
                      >
                        改名
                      </button>
                      <button
                        type="button"
                        className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                        onClick={() => void removeConversation(item.id)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))
              )}
              {convCursor ? (
                <button
                  type="button"
                  className="block w-full px-2 py-2 text-center text-[12px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
                  onClick={() => void loadMoreConversations()}
                  disabled={convLoadingMore}
                >
                  {convLoadingMore ? "加载中…" : "加载更多"}
                </button>
              ) : null}
            </div>
          </aside>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
          <h1 className="text-[15px] font-medium tracking-tight text-[var(--text-primary)]">对话测试</h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              onClick={() => setHistoryOpen((open) => !open)}
            >
              {historyOpen ? "收起历史" : "历史"}
            </button>
            <button
              type="button"
              className="text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              onClick={() => {
                setMemoryOpen(true);
                void loadMemories();
              }}
            >
              记忆
            </button>
            <button
              type="button"
              className="text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              onClick={() => setCodeOpen(true)}
            >
              查看代码
            </button>
            <button
              type="button"
              className="text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              onClick={() => setAdvancedOpen(true)}
            >
              高级
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto py-5">
          {hasSummary ? (
            <p className="text-[12px] text-[var(--text-tertiary)]">更早内容已压缩</p>
          ) : null}
          {messages.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-[20px] font-medium tracking-tight text-[var(--text-primary)]">有什么可以帮忙的？</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={m.id ?? i} className="space-y-2">
                <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                  {m.role}
                </div>
                {m.role === "user" && m.images?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {m.images.map((url, j) => (
                      <img
                        key={j}
                        src={url}
                        alt={`附图 ${j + 1}`}
                        className="max-h-40 rounded-[var(--radius-md)] border border-[var(--border-subtle)]"
                      />
                    ))}
                  </div>
                ) : null}
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
            {images.length ? (
              <div className="flex flex-wrap gap-2 px-3 pt-2">
                {images.map((url, i) => (
                  <span key={i} className="relative inline-block">
                    <img
                      src={url}
                      alt={`待发送图片 ${i + 1}`}
                      className="h-14 w-14 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] object-cover"
                    />
                    <button
                      type="button"
                      aria-label="移除图片"
                      className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[10px] leading-none"
                      onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <textarea
              className="playground-composer-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="发消息或输入问题…"
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
                  className="btn btn-subtle py-1.5 text-[13px]"
                  onClick={() => {
                    setUploadError("");
                    setUploadOpen(true);
                  }}
                >
                  上传
                </button>
                <button type="button" className="btn btn-subtle py-1.5 text-[13px]" onClick={newChat}>
                  新对话
                </button>
                {thinkingProfile.kind !== "none" ? (
                  <div className="thinking-depth" title="思考深度">
                    <span className="thinking-depth-label">
                      思考深度<span className="thinking-depth-value">{stopLabel}</span>
                    </span>
                    <div
                      className="thinking-depth-slider"
                      style={{ width: `${Math.max(72, 30 * (thinkingProfile.stops.length - 1) + 18)}px` }}
                    >
                      <input
                        type="range"
                        className="thinking-depth-range"
                        min={0}
                        max={thinkingProfile.stops.length - 1}
                        step={1}
                        value={Math.max(0, stopIndex)}
                        aria-label={stopLabel ? `思考深度：${stopLabel}` : "思考深度"}
                        style={{ ["--fill" as string]: `${stopPct}%` } as React.CSSProperties}
                        onChange={(e) => {
                          const idx = Number(e.target.value);
                          const stop = thinkingProfile.stops[idx];
                          if (stop) setThinkingStop(stop.id);
                        }}
                      />
                      {/* 刻度点：与滑块圆钮中心对齐（18px 圆钮 → 9px 边距） */}
                      <span className="thinking-depth-dots" aria-hidden>
                        {thinkingProfile.stops.map((s, i) => {
                          const p = thinkingProfile.stops.length > 1 ? i / (thinkingProfile.stops.length - 1) : 0;
                          return (
                            <span
                              key={s.id}
                              className={`thinking-depth-dot${i <= stopIndex ? " is-on" : ""}`}
                              style={{ left: `calc(9px + (100% - 18px) * ${p})` }}
                            />
                          );
                        })}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="select-subtle min-w-[10rem]"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {(chatModels.length ? chatModels : [model]).map((m) => (
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
                  <button className="btn py-1.5 text-[13px]" type="submit" disabled={!input.trim() && images.length === 0}>
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
      </div>

      <Dialog.Root open={memoryOpen} onOpenChange={setMemoryOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[50] bg-[var(--overlay-scrim)]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[50] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
            <Dialog.Title className="text-[15px] font-medium">长期记忆</Dialog.Title>
            <Dialog.Description className="mt-1 text-[13px] text-[var(--text-secondary)]">
              这些事实会在之后的对话里自动带上。可以删除单条，或全部清空。
            </Dialog.Description>
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
              {memories.length === 0 ? (
                <p className="text-[13px] text-[var(--text-tertiary)]">还没有记住的事实。聊过几轮后会自动出现。</p>
              ) : (
                memories.map((memory) => (
                  <div
                    key={memory.id}
                    className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-2"
                  >
                    <p className="text-[13px] leading-relaxed text-[var(--text-primary)]">{memory.content}</p>
                    <button
                      type="button"
                      className="shrink-0 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                      onClick={() => void deleteMemory(memory.id)}
                    >
                      删除
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void clearMemories()}
                disabled={memories.length === 0}
              >
                清空
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
